import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon = require('extract-file-icon');
import { pathToFileURL, fileURLToPath } from 'url';
import { spawn } from 'child_process';
// @ts-ignore - JS backend module without typings
import { DiscordRPCManager } from '../../backend/discord_rpc_manager';

type MainWindowGetter = () => BrowserWindow | null;

let CONFIG_PATH = path.join(__dirname, '../../config.json');
let DISCORD_APP_ID = '';
let discordManager: any = null;

function loadDiscordAppId(): string {
  try {
    const devPath = path.join(__dirname, '../renderer/locales/link.json');
    const prodPath = path.join(__dirname, '../renderer/public/locales/link.json');
    let raw: string | null = null;
    if (fs.existsSync(devPath)) raw = fs.readFileSync(devPath, 'utf-8');
    else if (fs.existsSync(prodPath)) raw = fs.readFileSync(prodPath, 'utf-8');
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.discordAppId === 'string' && obj.discordAppId.trim()) return obj.discordAppId.trim();
    }
  } catch (e) { console.warn('Discord appId: lecture link.json échouée:', e); }
  return '1423463152669954128';
}

function generateTitle(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  return nameWithoutExt
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function migrateConfig() {
  try {
    const raw = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf-8') : '';
    const cfg = JSON.parse(raw || '{"blenders":[]}');
    cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
    // Ensure general section exists first in the file (schema-wise)
    if (!cfg.general || typeof cfg.general !== 'object') {
      cfg.general = { scanOnStartup: false, exitOnClose: false, launchOnStartup: false };
      console.log('Migration: ajout bloc general par defaut');
    } else {
  if (typeof cfg.general.scanOnStartup !== 'boolean') cfg.general.scanOnStartup = false;
  if (typeof cfg.general.exitOnClose !== 'boolean') cfg.general.exitOnClose = false;
  if (typeof cfg.general.launchOnStartup !== 'boolean') cfg.general.launchOnStartup = false;
    }
    if (!cfg.discord) {
      cfg.discord = { enabled: false, showFile: true, showTitle: true, showTime: false, appId: DISCORD_APP_ID };
      console.log('Migration: ajout bloc discord par defaut + appId intégré');
    } else {
      if (typeof cfg.discord.enabled !== 'boolean') cfg.discord.enabled = false;
      if (typeof cfg.discord.showFile !== 'boolean') cfg.discord.showFile = true;
      if (typeof cfg.discord.showTitle !== 'boolean') cfg.discord.showTitle = true;
      cfg.discord.showTime = false;
      if (!cfg.discord.appId || cfg.discord.appId === '0000000000000000000') cfg.discord.appId = DISCORD_APP_ID;
    }
    let needsUpdate = false;
    cfg.blenders.forEach((b: any) => {
      if (!b.title && b.name) {
        b.title = generateTitle(b.name);
        needsUpdate = true;
        console.log(`Migration: ajout du title "${b.title}" pour ${b.name}`);
      }
    });
    if (!fs.existsSync(CONFIG_PATH)) needsUpdate = true;
    if (needsUpdate) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('Config migrée avec succès (titles + discord)');
    }
  } catch (e) {
    console.error('Erreur lors de la migration du config:', e);
  }
}

export function getConfigPath() { return CONFIG_PATH; }
export function getDiscordManager() { return discordManager; }
export function getDiscordAppId() { return DISCORD_APP_ID; }

export function initSettings(opts: {
  getMainWindow: MainWindowGetter;
  blenderScanner: any;
  steamWarp: any;
}) {
  // Prepare config and managers
  CONFIG_PATH = path.join(__dirname, '../../config.json');
  DISCORD_APP_ID = loadDiscordAppId();
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('config.json non trouvé, création...');
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ blenders: [] }, null, 2), 'utf-8');
    console.log('config.json créé à', CONFIG_PATH);
  } else {
    console.log('config.json déjà présent.');
  }
  migrateConfig();
  // @ts-ignore
  discordManager = new DiscordRPCManager(CONFIG_PATH);

  // --- Discord IPC ---
  // --- General IPC ---
  ipcMain.handle('get-general-config', async () => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
  if (!cfg.general || typeof cfg.general !== 'object') return { scanOnStartup: false, exitOnClose: false, launchOnStartup: false };
  return { scanOnStartup: cfg.general.scanOnStartup === true, exitOnClose: cfg.general.exitOnClose === true, launchOnStartup: cfg.general.launchOnStartup === true };
    } catch (e) {
      console.error('[General] get-general-config erreur:', e);
      return { scanOnStartup: false, exitOnClose: false };
    }
  });

  ipcMain.handle('update-general-config', async (_event, partial) => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      if (!cfg.general || typeof cfg.general !== 'object') cfg.general = { scanOnStartup: false, exitOnClose: false, launchOnStartup: false };
      const prevLaunch = cfg.general.launchOnStartup === true;
      cfg.general = { ...cfg.general, ...(partial || {}) };
      cfg.general.scanOnStartup = cfg.general.scanOnStartup === true; // normalize boolean
      cfg.general.exitOnClose = cfg.general.exitOnClose === true;
      cfg.general.launchOnStartup = cfg.general.launchOnStartup === true;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');

      // If launchOnStartup changed, attempt to apply to OS using Electron API
      try {
        if (prevLaunch !== cfg.general.launchOnStartup) {
          // Use process.execPath to point to the current executable (works when packaged)
          const exePath = process.execPath;
          console.log('[General] Applying launchOnStartup ->', cfg.general.launchOnStartup, 'via setLoginItemSettings path=', exePath);
          // When openAtLogin is false, we can call setLoginItemSettings with openAtLogin:false
          // On Windows this will register/unregister in Startup registry entries
          app.setLoginItemSettings({ openAtLogin: !!cfg.general.launchOnStartup, path: exePath, args: [] });
        }
      } catch (e) {
        console.warn('[General] Failed to apply launchOnStartup to OS:', e);
      }

      const win = opts.getMainWindow();
      if (win) win.webContents.send('config-updated');
      return { success: true, general: cfg.general };
    } catch (e) {
      console.error('[General] update-general-config erreur:', e);
      return { success: false, error: String(e) };
    }
  });

  // --- Discord IPC ---
  ipcMain.handle('get-discord-config', async () => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      return cfg.discord || null;
    } catch (e) {
      console.error('[DiscordRPC] get-discord-config erreur:', e);
      return null;
    }
  });

  function findDiscordInstall(): { variant: string; baseDir: string; updateExe?: string; discordExe?: string } | null {
    try {
      const local = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
      if (!local || !fs.existsSync(local)) return null;
      const variants = ['Discord', 'DiscordPTB', 'DiscordCanary'];
      for (const name of variants) {
        const baseDir = path.join(local, name);
        if (!fs.existsSync(baseDir)) continue;
        const updateExe = path.join(baseDir, 'Update.exe');
        let discordExe: string | undefined;
        try {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          const appDirs = entries.filter(e => e.isDirectory() && /^app-/i.test(e.name));
          for (const d of appDirs) {
            const p = path.join(baseDir, d.name, 'Discord.exe');
            if (fs.existsSync(p)) { discordExe = p; break; }
          }
        } catch {}
        if (fs.existsSync(updateExe) || discordExe) {
          return { variant: name, baseDir, updateExe: fs.existsSync(updateExe) ? updateExe : undefined, discordExe };
        }
      }
    } catch {}
    return null;
  }

  ipcMain.handle('get-discord-availability', async () => {
    try {
      let hasModule = false;
      try { require.resolve('discord-rpc'); hasModule = true; } catch {}
      const hasAppId = typeof DISCORD_APP_ID === 'string' && !!DISCORD_APP_ID.trim() && DISCORD_APP_ID !== '0000000000000000000';
      const install = findDiscordInstall();
      if (!install) {
        return { available: false, reason: 'not-installed' };
      }
      const available = !!install && hasModule && hasAppId;
      const reason = available ? undefined : (!hasModule ? 'module-missing' : (!hasAppId ? 'appId-missing' : undefined));
      return { available, appId: DISCORD_APP_ID, reason, install };
    } catch (e) {
      return { available: false, reason: String(e) };
    }
  });

  ipcMain.handle('update-discord-config', async (_event, partial) => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      const prevEnabled = cfg.discord?.enabled;
      cfg.discord = { ...(cfg.discord || {}), ...(partial || {}) };
      cfg.discord.appId = DISCORD_APP_ID;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('[DiscordRPC] Config mise a jour');
      if (prevEnabled !== cfg.discord.enabled) {
        discordManager.init(true);
      }
      return { success: true, discord: cfg.discord };
    } catch (e) {
      console.error('[DiscordRPC] update-discord-config erreur:', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('update-discord-presence', async (_event, params) => {
    try {
      discordManager.setActivity({
        blenderTitle: params?.blenderTitle || 'Blender',
        fileName: params?.fileName || null
      });
      discordManager.init();
      return { success: true };
    } catch (e) {
      console.error('[DiscordRPC] update-discord-presence erreur:', e);
      return { success: false, error: String(e) };
    }
  });

  // --- Steam IPC ---
  ipcMain.handle('get-steam-config', async () => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      return cfg.steam || { enabled: false };
    } catch (e) {
      console.error('[Steam] get-steam-config erreur:', e);
      return { enabled: false };
    }
  });

  ipcMain.handle('update-steam-config', async (_event, partial) => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      cfg.steam = { ...(cfg.steam || {}), ...(partial || {}) };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      const win = opts.getMainWindow();
      if (win) win.webContents.send('config-updated');
      return { success: true, steam: cfg.steam };
    } catch (e) {
      console.error('[Steam] update-steam-config erreur:', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('get-steam-availability', async () => {
    try {
      const dir = opts.steamWarp.findBlenderSteamDir && opts.steamWarp.findBlenderSteamDir();
      if (dir && fs.existsSync(dir)) {
        return { available: true, path: dir };
      }
      return { available: false };
    } catch (e) {
      return { available: false, error: String(e) };
    }
  });

  // Helper: find candidate addons directories for a given Blender executable
  function findCandidateAddonsDirs(exePath: string): string[] {
    const results: Set<string> = new Set();
    try {
      if (!exePath) return [];
      const exeDir = path.dirname(exePath);
      // direct scripts/addons next to exe
      const direct = path.join(exeDir, 'scripts', 'addons');
      if (fs.existsSync(direct)) results.add(direct);

      // search downwards a couple levels from exeDir for */scripts/addons
      const walk = (base: string, depth: number) => {
        if (depth < 0) return;
        try {
          const entries = fs.readdirSync(base, { withFileTypes: true });
          for (const e of entries) {
            try {
              const p = path.join(base, e.name);
              const maybe = path.join(p, 'scripts', 'addons');
              if (fs.existsSync(maybe)) results.add(maybe);
              if (e.isDirectory()) walk(p, depth - 1);
            } catch {}
          }
        } catch {}
      };
      walk(exeDir, 2);

      // check user AppData Blenders (Windows) or ~/.config on Linux
      try {
        const appData = app.getPath('appData');
        const bf = path.join(appData, 'Blender Foundation', 'Blender');
        if (fs.existsSync(bf)) {
          const versions = fs.readdirSync(bf, { withFileTypes: true });
          for (const v of versions) {
            if (!v.isDirectory()) continue;
            const cand = path.join(bf, v.name, 'scripts', 'addons');
            if (fs.existsSync(cand)) results.add(cand);
          }
        }
      } catch {}

      // normalize into array
      return Array.from(results);
    } catch (e) {
      console.warn('findCandidateAddonsDirs erreur', e);
      return Array.from(results);
    }
  }

  // Copy helper (recursive) - uses fs.cpSync when available, falls back to manual copy
  function copyRecursiveSync(src: string, dest: string) {
    if ((fs as any).cpSync) {
      try { (fs as any).cpSync(src, dest, { recursive: true, force: true }); return; } catch (e) { /* fallback */ }
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const e of entries) {
        const s = path.join(src, e.name);
        const d = path.join(dest, e.name);
        if (e.isDirectory()) copyRecursiveSync(s, d);
        else fs.copyFileSync(s, d);
      }
    } else {
      const dd = path.dirname(dest);
      if (!fs.existsSync(dd)) fs.mkdirSync(dd, { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }

  ipcMain.handle('install-addon-on', async (_event, params: { exePath?: string; addonPath?: string }) => {
    try {
      const exePath = params?.exePath;
      const addonPath = params?.addonPath;
      if (!exePath) return { success: false, error: 'exePath manquant' };
      if (!addonPath || !fs.existsSync(addonPath)) return { success: false, error: 'addonPath invalide' };

      const candidates = findCandidateAddonsDirs(exePath);
      if (!candidates || candidates.length === 0) {
        return { success: false, error: 'Aucun dossier addons trouvé pour ce Blender' };
      }

      // choose first candidate
      const targetBase = candidates[0];
      const addonName = path.basename(addonPath);
      const dest = path.join(targetBase, addonName);

      // If dest exists, remove it (overwrite)
      try {
        if (fs.existsSync(dest)) {
          // remove file or directory
          const st = fs.statSync(dest);
          if (st.isDirectory()) {
            fs.rmSync(dest, { recursive: true, force: true });
          } else {
            fs.unlinkSync(dest);
          }
        }
      } catch (e) { /* ignore removal errors */ }

      // perform copy
      copyRecursiveSync(addonPath, dest);

  // invalidate cache for this exePath
  try { const cache = readAddonsCache(); if (cache[exePath]) { delete cache[exePath]; writeAddonsCache(cache); } } catch (e) {}
  // schedule refresh
  setTimeout(() => { void refreshAddonsCacheForExe(exePath); }, 100);

  return { success: true, dest };
    } catch (e) {
      console.error('[install-addon-on] erreur', e);
      return { success: false, error: String(e) };
    }
  });

  // --- Icônes d'exécutables ---
  ipcMain.handle('get-exe-icon', async (_event, exePath: string) => {
    try {
      if (process.platform !== 'win32') return '';
      if (!exePath || !fs.existsSync(exePath)) return '';
      console.log('[IPC] get-exe-icon demandé pour:', exePath);
      try {
        const ni = await app.getFileIcon(exePath, { size: 'large' as any });
        if (ni && !ni.isEmpty()) {
          const dataUrl = ni.toDataURL();
          console.log('[IPC] get-exe-icon OK via app.getFileIcon pour:', exePath);
          return dataUrl;
        }
      } catch (e) {
        console.warn('[IPC] app.getFileIcon a échoué, fallback extract-file-icon. Détail:', e);
      }
      let buf = extractIcon(exePath, 64) || extractIcon(exePath, 32) || extractIcon(exePath, 16) || extractIcon(exePath, 256) || extractIcon(exePath);
      if (!buf) {
        console.warn('[IPC] get-exe-icon: aucune icône récupérée pour', exePath);
        return '';
      }
      try {
        const isPng = buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
        const isIco = buf.length > 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00;
        const mime = isPng ? 'image/png' : (isIco ? 'image/x-icon' : 'application/octet-stream');
        if (mime !== 'application/octet-stream') {
          const dataUrl = `data:${mime};base64,` + buf.toString('base64');
          console.log('[IPC] get-exe-icon OK (dataURL base64) pour:', exePath, 'mime:', mime, 'len:', dataUrl.length);
          return dataUrl;
        }
      } catch {}
      const iconsDir = path.join(app.getPath('userData'), 'icons');
      if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
      let mtime = '0';
      try { mtime = String(fs.statSync(exePath).mtimeMs | 0); } catch {}
      const safeName = exePath.replace(/[^a-zA-Z0-9-_\.]/g, '_');
      const isPng2 = buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      const isIco2 = buf.length > 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00;
      const ext = isPng2 ? 'png' : (isIco2 ? 'ico' : 'bin');
      const iconFile = path.join(iconsDir, `exe_${safeName}_${mtime}.${ext}`);
      if (!fs.existsSync(iconFile)) fs.writeFileSync(iconFile, buf);
      console.log('[IPC] get-exe-icon OK (fileURL) pour:', exePath, '->', iconFile);
      return pathToFileURL(iconFile).toString();
    } catch (e) {
      console.warn('[IPC] get-exe-icon échec:', e);
      return '';
    }
  });

  // --- Gestion des exécutables Blender dans config.json ---
  ipcMain.on('open-folder-dialog', async (_event, currentPath) => {
    const win = opts.getMainWindow();
    console.log('Recu : open-folder-dialog, currentPath =', currentPath);
    if (win) {
      const filters: Electron.FileFilter[] =
        process.platform === 'win32'
          ? [{ name: 'Blender Executable', extensions: ['exe'] }]
          : process.platform === 'linux'
          ? [{ name: 'Blender Executable', extensions: ['AppImage', 'run', ''] }]
          : [];
      const properties: Array<'openFile'> = ['openFile'];
      let defaultPath: string | undefined = undefined;
      if (currentPath && typeof currentPath === 'string' && fs.existsSync(currentPath)) {
        defaultPath = path.dirname(currentPath);
        console.log('Ouverture du dialog dans le dossier :', defaultPath);
      }
      const result = await dialog.showOpenDialog(win, { properties, filters, defaultPath });
      if (result.canceled || !result.filePaths[0]) return;
      const exePath = result.filePaths[0];
      let iconPath = '';
      try {
        if (process.platform === 'win32') {
          const iconBuffer = extractIcon(exePath, 256) || extractIcon(exePath, 64) || extractIcon(exePath, 32) || extractIcon(exePath, 16);
          if (iconBuffer) {
            const iconsDir = path.join(app.getPath('userData'), 'icons');
            if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
            const iconFile = path.join(iconsDir, `icon_${Date.now()}.png`);
            fs.writeFileSync(iconFile, iconBuffer);
            iconPath = pathToFileURL(iconFile).toString();
          }
        }
      } catch (e) { console.error('Erreur extraction icône :', e); }
      try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
        const exists = cfg.blenders.some((b: any) => b.path === exePath);
        if (!exists) {
          const parts = exePath.split(/[\\/]/);
          const exeName = parts[parts.length - 1];
          const title = generateTitle(exeName);
          cfg.blenders.push({ path: exePath, name: exeName, title: title, icon: iconPath || '' });
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
          console.log('Config mise à jour avec un nouvel import');
          win.webContents.send('config-updated');
        } else {
          console.log('Import ignoré, chemin déjà présent dans config');
        }
      } catch (e) { console.error('Erreur lors de la mise à jour de config.json :', e); }
      win.webContents.send('selected-blender-folder', { filePath: exePath, iconPath });
      console.log('Fichier choisi :', exePath, 'Icone :', iconPath);
    }
  });

  ipcMain.on('change-executable', async (_event, oldPath) => {
    const win = opts.getMainWindow();
    console.log('Recu : change-executable, oldPath =', oldPath);
    if (win) {
      const filters: Electron.FileFilter[] =
        process.platform === 'win32'
          ? [{ name: 'Blender Executable', extensions: ['exe'] }]
          : process.platform === 'linux'
          ? [{ name: 'Blender Executable', extensions: ['AppImage', 'run', ''] }]
          : [];
      const properties: Array<'openFile'> = ['openFile'];
      let defaultPath = undefined;
      if (oldPath && typeof oldPath === 'string' && fs.existsSync(oldPath)) {
        defaultPath = path.dirname(oldPath);
        console.log('Ouverture du dialog dans le dossier :', defaultPath);
      }
      const result = await dialog.showOpenDialog(win, { properties, filters, defaultPath });
      if (result.canceled || !result.filePaths[0]) return;
      const newExePath = result.filePaths[0];
      let iconPath = '';
      try {
        if (process.platform === 'win32') {
          const iconBuffer = extractIcon(newExePath, 256) || extractIcon(newExePath, 64) || extractIcon(newExePath, 32) || extractIcon(newExePath, 16);
          if (iconBuffer) {
            const iconsDir = path.join(app.getPath('userData'), 'icons');
            if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
            const iconFile = path.join(iconsDir, `icon_${Date.now()}.png`);
            fs.writeFileSync(iconFile, iconBuffer);
            iconPath = pathToFileURL(iconFile).toString();
          }
        }
      } catch (e) { console.error('Erreur extraction icône :', e); }
      try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
        const index = cfg.blenders.findIndex((b: any) => b.path === oldPath);
        if (index !== -1) {
          const parts = newExePath.split(/[\\/]/);
          const exeName = parts[parts.length - 1];
          const previous = cfg.blenders[index];
          const preservedTitle = previous.title || previous.name || generateTitle(exeName);
          cfg.blenders[index] = { ...previous, path: newExePath, name: exeName, title: preservedTitle, icon: iconPath || previous.icon || '' };
          console.log('Titre conservé lors du changement d\'exécutable :', preservedTitle);
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
          console.log('Config mise à jour - ancien:', oldPath, '-> nouveau:', newExePath);
          win.webContents.send('executable-updated', { oldPath, newExecutable: cfg.blenders[index] });
          win.webContents.send('config-updated');
        } else {
          console.warn('Ancien exécutable non trouvé dans la config:', oldPath);
        }
      } catch (e) { console.error('Erreur lors de la mise à jour de config.json :', e); }
      console.log('Exécutable changé :', oldPath, '->', newExePath, 'Icone :', iconPath);
    }
  });

  ipcMain.handle('delete-exécutable', async (_event, payload) => {
    try {
      const targetPathRaw = typeof payload === 'string' ? payload : payload?.path;
      if (!targetPathRaw) {
        console.warn('[IPC] delete-executable: chemin manquant');
        return { success: false, reason: 'missing-path' };
      }
      const normalize = (p: string) => { try { let r = path.resolve(p); if (process.platform === 'win32') r = r.toLowerCase(); return r; } catch { return p; } };
      const targetPath = normalize(targetPathRaw);
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{"blenders":[]}');
      if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
      const before = cfg.blenders.length;
      console.log('[IPC] delete-executable: tentative suppression', targetPathRaw, 'normalisé =', targetPath, 'total entrées =', before);
      cfg.blenders.forEach((b:any,i:number)=>{ console.log('  >> entrée', i, 'path=', b.path, 'norm=', normalize(b.path)); });
      const targetFileName = path.basename(targetPathRaw).toLowerCase();
      let matchedIndex = cfg.blenders.findIndex((b:any) => normalize(b.path) === targetPath);
      if (matchedIndex === -1) {
        matchedIndex = cfg.blenders.findIndex((b:any) => path.basename(b.path).toLowerCase() === targetFileName);
        if (matchedIndex !== -1) console.log('[IPC] delete-executable: correspondance par nom de fichier');
      }
      if (matchedIndex === -1) {
        try {
          const realTarget = (fs as any).realpathSync.native ? (fs as any).realpathSync.native(targetPathRaw) : fs.realpathSync(targetPathRaw);
          const realNorm = normalize(realTarget);
          matchedIndex = cfg.blenders.findIndex((b:any)=>{ try { return normalize(fs.realpathSync(b.path)) === realNorm; } catch { return false; } });
          if (matchedIndex !== -1) console.log('[IPC] delete-executable: correspondance par realpath');
        } catch {}
      }
      const win = opts.getMainWindow();
      if (matchedIndex === -1) {
        console.log('[IPC] delete-executable: aucune entrée correspondante trouvée');
        if (win) win.webContents.send('executable-deleted', { path: targetPathRaw, found: false });
        return { success: false, reason: 'not-found' };
      }
      const removed = cfg.blenders.splice(matchedIndex, 1)[0];
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('[IPC] delete-executable: supprimé index', matchedIndex, '->', removed.path);
      if (win) {
        win.webContents.send('config-updated');
        win.webContents.send('executable-deleted', { path: removed.path, found: true });
      }
      return { success: true };
    } catch (e) {
      console.error('[IPC] delete-executable erreur:', e);
      return { success: false, reason: 'exception', error: String(e) };
    }
  });

  ipcMain.on('delete-executable', async (event, payload) => {
    console.log('[IPC] delete-executable (legacy on) déclenché - configPath =', CONFIG_PATH);
    const res = await (async () => {
      try {
        const targetPathRaw = typeof payload === 'string' ? payload : payload?.path;
        if (!targetPathRaw) {
          console.warn('[IPC] delete-executable legacy: chemin manquant');
          event.sender.send('executable-deleted', { path: payload?.path, found: false });
          return { success: false };
        }
        const normalize = (p: string) => { try { let r = path.resolve(p); if (process.platform === 'win32') r = r.toLowerCase(); return r; } catch { return p; } };
        const targetPath = normalize(targetPathRaw);
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
        const targetFileName = path.basename(targetPathRaw).toLowerCase();
        let matchedIndex = cfg.blenders.findIndex((b:any) => normalize(b.path) === targetPath);
        if (matchedIndex === -1) matchedIndex = cfg.blenders.findIndex((b:any)=> path.basename(b.path).toLowerCase() === targetFileName);
        if (matchedIndex === -1) {
          try {
            const realTarget = (fs as any).realpathSync.native ? (fs as any).realpathSync.native(targetPathRaw) : fs.realpathSync(targetPathRaw);
            const realNorm = normalize(realTarget);
            matchedIndex = cfg.blenders.findIndex((b:any)=>{ try { return normalize(fs.realpathSync(b.path)) === realNorm; } catch { return false; } });
          } catch {}
        }
        if (matchedIndex === -1) {
          console.log('[IPC] delete-executable legacy: not found');
          event.sender.send('executable-deleted', { path: targetPathRaw, found: false });
          return { success: false };
        }
        const removed = cfg.blenders.splice(matchedIndex,1)[0];
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
        console.log('[IPC] delete-executable legacy: supprimé', removed.path);
        event.sender.send('config-updated');
        event.sender.send('executable-deleted', { path: removed.path, found: true });
        return { success: true };
      } catch (e) {
        console.error('[IPC] delete-executable legacy erreur:', e);
        return { success: false };
      }
    })();
    event.sender.send('delete-executable-result', res);
  });

  ipcMain.handle('update-executable-title', async (_event, payload) => {
    console.log('[IPC] update-executable-title reçu avec payload:', payload);
    const exePath = payload?.path;
    const newTitle = payload?.title;
    console.log('[IPC] Extraction - path:', exePath, 'title:', newTitle);
    if (!exePath || !newTitle) {
      console.error('[IPC] Paramètres manquants - path:', exePath, 'title:', newTitle);
      return { success: false, error: 'Paramètres manquants' };
    }
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{"blenders":[]}');
      if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
      const idx = cfg.blenders.findIndex((b: any) => b.path === exePath);
      if (idx === -1) {
        console.warn('[IPC] update-executable-title: exécutable introuvable dans config:', exePath);
        return { success: false, error: 'Exécutable introuvable' };
      }
      const old = { ...cfg.blenders[idx] };
      cfg.blenders[idx].title = newTitle;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('[IPC] Titre mis à jour dans config.json:', old.title, '->', newTitle);
      const win = opts.getMainWindow();
      if (win) {
        win.webContents.send('config-updated');
        win.webContents.send('executable-updated', { oldPath: exePath, newExecutable: cfg.blenders[idx] });
      }
      return { success: true, message: 'Titre sauvegardé', updated: cfg.blenders[idx] };
    } catch (e) {
      console.error('[IPC] Erreur update-executable-title:', e);
      return { success: false, error: String(e) };
    }
  });

  // Répond à la requête du renderer pour obtenir la liste des applications
  ipcMain.handle('get-blenders', async () => {
    try {
      console.log('[IPC] get-blenders appelé');
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{"blenders":[]}');
      const list = Array.isArray(cfg.blenders) ? cfg.blenders : [];
      const userIconsDir = path.join(app.getPath('userData'), 'icons');
      const distIconsDir = path.join(__dirname, '../../dist/renderer/icons');
      let updated = false;
      const ensureIcon = async (b: any): Promise<any> => {
        if (!b || typeof b.path !== 'string') return b;
        const setIcon = (absPath: string) => {
          const url = pathToFileURL(absPath).toString();
          if (b.icon !== url) {
            b.icon = url;
            updated = true;
          }
        };
        if (typeof b.icon === 'string' && b.icon.startsWith('file://')) {
          try {
            const p = fileURLToPath(b.icon);
            console.log('[IPC] get-blenders: Traitement icône file://', b.icon, '-> chemin local:', p);
            if (fs.existsSync(p)) {
              const buffer = fs.readFileSync(p);
              console.log('[IPC] get-blenders: Icône convertie en DataURL pour', b.name, '(taille:', buffer.length, 'bytes)');
              if (buffer.length > 0) {
                const ext = path.extname(p).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : (ext === '.ico' ? 'image/x-icon' : 'image/png');
                const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
                b.icon = dataUrl;
                return b;
              } else {
                console.warn('[IPC] get-blenders: Fichier d\'icône vide, passage aux fallbacks pour', b.name);
              }
            } else {
              console.warn('[IPC] get-blenders: Fichier icône non trouvé:', p);
            }
          } catch (e) {
            console.warn('[IPC] get-blenders: Impossible de lire le fichier d\'icône', b.icon, e);
          }
        }
        if (typeof b.icon === 'string' && b.icon.length > 0 && !b.icon.startsWith('data:')) {
          const base = path.basename(b.icon);
          const c1 = path.join(userIconsDir, base);
          const c2 = path.join(distIconsDir, base);
          if (fs.existsSync(c1)) { setIcon(c1); return b; }
          if (fs.existsSync(c2)) { setIcon(c2); return b; }
        }
        if (process.platform === 'win32' && fs.existsSync(b.path)) {
          try {
            console.log('[IPC] get-blenders: Tentative app.getFileIcon pour', b.name);
            const ni = await app.getFileIcon(b.path, { size: 'large' as any });
            if (ni && !ni.isEmpty()) {
              const dataUrl = ni.toDataURL();
              console.log('[IPC] get-blenders: Icône extraite via app.getFileIcon pour', b.name, '(taille DataURL:', dataUrl.length, 'chars)');
              b.icon = dataUrl;
              return b;
            }
          } catch (e) {
            console.warn('[IPC] get-blenders: app.getFileIcon a échoué pour', b.path, e);
          }
        }
        try {
          if (process.platform === 'win32' && fs.existsSync(b.path)) {
            console.log('[IPC] get-blenders: Tentative extract-file-icon pour', b.name);
            const iconBuffer = extractIcon(b.path, 256) || extractIcon(b.path, 64) || extractIcon(b.path, 32) || extractIcon(b.path, 16);
            if (iconBuffer && iconBuffer.length > 0) {
              console.log('[IPC] get-blenders: Buffer extrait pour', b.name, '(taille:', iconBuffer.length, 'bytes)');
              const isPng = iconBuffer.length > 4 && iconBuffer[0] === 0x89 && iconBuffer[1] === 0x50;
              const mimeType = isPng ? 'image/png' : 'image/x-icon';
              const dataUrl = `data:${mimeType};base64,${iconBuffer.toString('base64')}`;
              b.icon = dataUrl;
              console.log('[IPC] get-blenders: Icône convertie en DataURL pour', b.name, '(taille DataURL:', dataUrl.length, 'chars)');
              return b;
            } else {
              console.warn('[IPC] get-blenders: Buffer d\'icône vide ou null pour', b.name);
            }
          }
        } catch (e) { console.warn('Ré-extraction icône échouée pour', b.name, ':', e); }
        return b;
      };
      const mapped: any[] = [];
      for (const b of list) { mapped.push(await ensureIcon(b)); }
      if (updated) {
        try {
          const cfg2 = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8') || '{"blenders":[]}');
          cfg2.blenders = mapped;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg2, null, 2), 'utf-8');
          console.log('[IPC] config.json mis à jour avec des icônes normalisées (config préservée)');
        } catch (e) { console.warn('Impossible d\'écrire config.json après normalisation des icônes:', e); }
      }
      console.log('[IPC] get-blenders retourne', mapped.length, 'élément(s)');
      return mapped;
    } catch (e) {
      console.error('Erreur lors de la lecture de config.json :', e);
      return [];
    }
  });

  // Reorder blenders: receive an array of executable paths in the desired order
  

  // --- Add-ons: list / enable / disable / remove via Blender runtime ---
  // Simple persistent cache for addon scans to speed up UI startup
  const ADDONS_CACHE_PATH = path.join(app.getPath('userData'), 'addons_cache.json');

  function readAddonsCache(): Record<string, { ts: number; addons: any[] }> {
    try {
      if (!fs.existsSync(ADDONS_CACHE_PATH)) return {};
      const raw = fs.readFileSync(ADDONS_CACHE_PATH, 'utf-8');
      if (!raw) return {};
      return JSON.parse(raw || '{}');
    } catch (e) {
      console.warn('[cache] failed to read addons cache', e);
      return {};
    }
  }

  function writeAddonsCache(cache: Record<string, { ts: number; addons: any[] }>) {
    try {
      const dir = path.dirname(ADDONS_CACHE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ADDONS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[cache] failed to write addons cache', e);
    }
  }

  async function refreshAddonsCacheForExe(exePath: string) {
    try {
      if (!exePath || !fs.existsSync(exePath)) return;
      const script = `\ntry:\n    import json, addon_utils\n    res = []\n    for m in addon_utils.modules():\n        try:\n            name = (getattr(m, 'bl_info', {}) or {}).get('name') or getattr(m, '__name__', str(m))\n            module = getattr(m, '__name__', None)\n            bl_info = getattr(m, 'bl_info', {}) or {}\n            enabled = False\n            try:\n                enabled = addon_utils.check(module)[0]\n            except Exception:\n                try:\n                    enabled = addon_utils.is_enabled(module)\n                except Exception:\n                    enabled = False\n            res.append({ 'module': module, 'name': name, 'bl_info': bl_info, 'enabled': enabled })\n        except Exception:\n            pass\n    print('@@ADDONS_JSON_START@@')\n    print(json.dumps(res))\n    print('@@ADDONS_JSON_END@@')\nexcept Exception as e:\n    import traceback\n    traceback.print_exc()\n`;
      const out = await runBlenderScriptAndCaptureJson(exePath, script, 25000);
      if (out && out.json && Array.isArray(out.json)) {
        const cache = readAddonsCache();
        cache[exePath] = { ts: Date.now(), addons: out.json };
        writeAddonsCache(cache);
        try { opts.getMainWindow()?.webContents.send('addons-updated', { exePath, addons: out.json }); } catch {};
      }
    } catch (e) { console.warn('[cache] refresh failed for', exePath, e); }
  }

  async function runBlenderScriptAndCaptureJson(exePath: string, scriptContent: string, timeoutMs = 20000): Promise<{ stdout: string; stderr: string; json?: any; error?: string }> {
    const markerStart = '@@ADDONS_JSON_START@@';
    const markerEnd = '@@ADDONS_JSON_END@@';
    // Always write the provided scriptContent into a temporary script and execute it.
    const scriptPath = path.join(app.getPath('userData'), 'temp_blender_scripts', `bl_script_${Date.now()}.py`);
    const fullScript = `import sys\n${scriptContent}\n`;
    try {
      const tmpDir = path.dirname(scriptPath);
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(scriptPath, fullScript, 'utf-8');
    } catch (e) {
      return { stdout: '', stderr: '', error: 'failed-to-write-script' };
    }
    return await new Promise<{ stdout: string; stderr: string; json?: any; error?: string }>((resolve) => {
      const child = spawn(exePath, ['--background', '--python', scriptPath], { windowsHide: true });
      let stdout = '';
      let stderr = '';
      let finished = false;
      const to = setTimeout(() => {
        try { child.kill(); } catch {}
      }, timeoutMs);
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('error', (err) => {
        clearTimeout(to);
        if (finished) return;
        finished = true;
        resolve({ stdout, stderr, error: String(err) });
      });
      child.on('close', (code) => {
        clearTimeout(to);
        if (finished) return;
        finished = true;
        // try to extract JSON between markers
        const s = stdout || '';
        const start = s.indexOf(markerStart);
        const end = s.indexOf(markerEnd, start >= 0 ? start : 0);
        if (start >= 0 && end > start) {
          const jsonStr = s.substring(start + markerStart.length, end).trim();
          try { const parsed = JSON.parse(jsonStr); resolve({ stdout, stderr, json: parsed }); return; } catch (e) { /* fallthrough */ }
        }
        resolve({ stdout, stderr });
      });
    }).finally(() => {
      try { fs.unlinkSync(scriptPath); } catch {}
    });
  }

  ipcMain.handle('get-addons', async (_event, exePath: string) => {
    try {
      if (!exePath || !fs.existsSync(exePath)) return { success: false, error: 'exe-not-found', addons: [] };
      // Try cache first for fast response
      try {
        const cache = readAddonsCache();
        const entry = cache[exePath];
        if (entry && Array.isArray(entry.addons) && entry.addons.length >= 0) {
          // schedule background refresh but return cached result immediately
          setTimeout(() => { void refreshAddonsCacheForExe(exePath); }, 10);
          return { success: true, addons: entry.addons, cached: true };
        }
      } catch (e) { /* ignore cache read errors */ }

      // Python script that enumerates addons using Blender's addon_utils and prints JSON between markers
      const script = `\ntry:\n    import json, addon_utils\n    res = []\n    for m in addon_utils.modules():\n        try:\n            name = (getattr(m, 'bl_info', {}) or {}).get('name') or getattr(m, '__name__', str(m))\n            module = getattr(m, '__name__', None)\n            bl_info = getattr(m, 'bl_info', {}) or {}\n            enabled = False\n            try:\n                enabled = addon_utils.check(module)[0]\n            except Exception:\n                try:\n                    enabled = addon_utils.is_enabled(module)\n                except Exception:\n                    enabled = False\n            res.append({ 'module': module, 'name': name, 'bl_info': bl_info, 'enabled': enabled })\n        except Exception:\n            pass\n    print('@@ADDONS_JSON_START@@')\n    print(json.dumps(res))\n    print('@@ADDONS_JSON_END@@')\nexcept Exception as e:\n    import traceback\n    traceback.print_exc()\n`;
      const out = await runBlenderScriptAndCaptureJson(exePath, script, 25000);
      if (out.error) return { success: false, error: out.error, stdout: out.stdout, stderr: out.stderr, addons: [] };
      if (out.json) {
        try { const cache = readAddonsCache(); cache[exePath] = { ts: Date.now(), addons: out.json }; writeAddonsCache(cache); } catch (e) {}
        return { success: true, addons: out.json, stdout: out.stdout, stderr: out.stderr };
      }
      // fallback: try to parse any JSON like content in stdout
      try {
        const s = out.stdout || '';
        const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/m);
        if (m) {
          const parsed = JSON.parse(m[0]);
          try { const cache = readAddonsCache(); cache[exePath] = { ts: Date.now(), addons: parsed }; writeAddonsCache(cache); } catch (e) {}
          return { success: true, addons: parsed, stdout: out.stdout, stderr: out.stderr };
        }
      } catch (e) {}
      return { success: false, error: 'no-json', stdout: out.stdout, stderr: out.stderr, addons: [] };
    } catch (e) {
      return { success: false, error: String(e), addons: [] };
    }
  });

  ipcMain.handle('scan-addons-fs', async (_event, payload: { exePath?: string }) => {
    try {
      const exePath = payload?.exePath;
      const candidates: string[] = [];
      // 1) scan relative to exe: ../scripts/addons and ./scripts/addons
      try {
        if (exePath && fs.existsSync(exePath)) {
          const exeDir = path.dirname(exePath);
          const maybe1 = path.join(exeDir, '..', 'scripts', 'addons');
          const maybe2 = path.join(exeDir, 'scripts', 'addons');
          candidates.push(maybe1, maybe2);
        }
      } catch {}
      // 2) user AppData Blender folders
      try {
        const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : null);
        if (appData) {
          const blenderBase = path.join(appData, 'Blender Foundation', 'Blender');
          if (fs.existsSync(blenderBase)) {
            const vers = fs.readdirSync(blenderBase, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(blenderBase, d.name));
            for (const v of vers) candidates.push(path.join(v, 'scripts', 'addons'));
          }
        }
      } catch {}
      // 3) common locations: Program Files Blender install 'scripts/addons' if present
      try {
        const prog = process.env['PROGRAMFILES'] || process.env['ProgramFiles(x86)'];
        if (prog) {
          // search for blender folders under Program Files
          const entries = fs.existsSync(prog) ? fs.readdirSync(prog, { withFileTypes: true }) : [];
          for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (/blender/i.test(e.name)) {
              const p = path.join(prog, e.name, 'scripts', 'addons');
              candidates.push(p);
            }
          }
        }
      } catch {}

      const seen = new Set<string>();
      const addonList: any[] = [];
      for (const cand of candidates) {
        if (!cand) continue;
        try {
          if (!fs.existsSync(cand)) continue;
          const children = fs.readdirSync(cand, { withFileTypes: true });
          for (const ch of children) {
            if (!ch.isDirectory()) continue;
            const addonDir = path.join(cand, ch.name);
            if (seen.has(addonDir)) continue;
            seen.add(addonDir);
            // try to parse __init__.py
            const initPy = path.join(addonDir, '__init__.py');
            let bl_info: any = {};
            let name = ch.name;
            try {
              if (fs.existsSync(initPy)) {
                const txt = fs.readFileSync(initPy, 'utf-8');
                const m = txt.match(/bl_info\s*=\s*\{/m);
                if (m) {
                  // extract from the first '{' after match to the matching '}'
                  const startPos = txt.indexOf('{', m.index || 0);
                  let depth = 0;
                  let endPos = -1;
                  for (let i = startPos; i < txt.length; i++) {
                    const ch2 = txt[i];
                    if (ch2 === '{') depth++; else if (ch2 === '}') { depth--; if (depth === 0) { endPos = i; break; } }
                  }
                  if (startPos >= 0 && endPos > startPos) {
                    let dictStr = txt.substring(startPos, endPos + 1);
                    // strip python comments
                    dictStr = dictStr.replace(/#.*$/gm, '');
                    // normalize booleans/null
                    dictStr = dictStr.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
                    // convert simple single-quoted strings to double-quoted strings (heuristic)
                    dictStr = dictStr.replace(/'([^'\\]*)'/g, '"$1"');
                    // remove trailing commas before } or ]
                    dictStr = dictStr.replace(/,(\s*[}\]])/g, '$1');
                    // convert simple tuples to arrays: ('a','b') -> ["a","b"] (heuristic)
                    dictStr = dictStr.replace(/\(\s*([^\)]*?)\s*\)/g, (m: string, inner: string) => '[' + inner.replace(/'([^'\\]*)'/g, '"$1"').replace(/,\s*$/, '') + ']');
                    // ensure bareword keys are quoted: key: -> "key":
                    dictStr = dictStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$1":');
                    try { bl_info = JSON.parse(dictStr); if (bl_info && bl_info.name) name = bl_info.name; } catch (e) { bl_info = {}; }
                  }
                }
              }
            } catch (e) { /* ignore parse errors */ }
            addonList.push({ module: ch.name, name, bl_info, path: addonDir, exists: true, source: cand });
          }
        } catch (e) { /* ignore folder read errors */ }
      }
      return { success: true, addons: addonList };
    } catch (e) {
      return { success: false, error: String(e), addons: [] };
    }
  });

  ipcMain.handle('enable-addon', async (_event, params: { exePath: string; module: string; enable: boolean }) => {
  try {
    const { exePath, module, enable } = params || ({} as any);
    if (!exePath || !module) return { success: false, error: 'missing-params' };
    const action = enable ? 'enable' : 'disable';

    // try to find backend script in a couple of likely locations
    const backendCandidates = [
      path.join(__dirname, '../../backend/blender_addon_action.py'),
      path.join(process.cwd(), 'backend', 'blender_addon_action.py')
    ];
    let scriptContent = '';
    for (const c of backendCandidates) {
      try { if (fs.existsSync(c)) { scriptContent = fs.readFileSync(c, 'utf-8'); break; } } catch {}
    }

    if (!scriptContent) {
      // fallback embedded tolerant script
      scriptContent = `#!/usr/bin/env python3\nimport sys, traceback\ntry:\n    import addon_utils\n    MARK_OK='@@ACTION_OK@@'\n    MARK_FAIL='@@ACTION_FAIL@@'\n    args = sys.argv\n    if '--' in args:\n        idx = args.index('--')\n        a = args[idx+1:]\n    else:\n        a = args[1:]\n    params = {}\n    i = 0\n    while i < len(a):\n        k = a[i]\n        v = a[i+1] if i+1 < len(a) else None\n        params[k] = v\n        i += 2\n    action = params.get('action')\n    mod = params.get('module')\n    desired = (action == 'enable')\n    try:\n        if desired:\n            try:\n                addon_utils.enable(mod)\n            except Exception:\n                try:\n                    import bpy\n                    bpy.ops.preferences.addon_enable(module=mod)\n                except Exception:\n                    pass\n        else:\n            try:\n                addon_utils.disable(mod, default_set=False, persistent=False)\n            except TypeError:\n                try:\n                    addon_utils.disable(mod)\n                except Exception:\n                    pass\n            except Exception:\n                pass\n            try:\n                import bpy\n                bpy.ops.preferences.addon_disable(module=mod)\n            except Exception:\n                pass\n    except Exception:\n        traceback.print_exc()\n    ok = False\n    try:\n        chk = addon_utils.check(mod)\n        if isinstance(chk, (list, tuple)) and len(chk) >= 1:\n            ok = bool(chk[0])\n        else:\n            try:\n                ok = bool(addon_utils.is_enabled(mod))\n            except Exception:\n                ok = False\n    except Exception:\n        try:\n            ok = bool(addon_utils.is_enabled(mod))\n        except Exception:\n            ok = False\n    if ok == desired:\n        print(MARK_OK)\n    else:\n        print(MARK_FAIL)\nexcept Exception:\n    traceback.print_exc()\n`;
    }

    // write temp script to userData
    const tmpDir = path.join(app.getPath('userData'), 'temp_blender_scripts');
    try { if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true }); } catch {}
    const tmpPath = path.join(tmpDir, `bl_action_${Date.now()}.py`);
    try { fs.writeFileSync(tmpPath, scriptContent, 'utf-8'); } catch (e) { return { success: false, error: 'failed-write-temp-script', detail: String(e) }; }

    // spawn blender with --python <tmpPath> -- action ...
    console.log('[IPC enable-addon] exec=', exePath, 'tmpScript=', tmpPath, 'action=', action, 'module=', module);
    const child = spawn(exePath, ['--background', '--python', tmpPath, '--', 'action', action, 'module', module], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    return await new Promise((resolve) => {
      const to = setTimeout(() => { try { child.kill(); } catch {} }, 20000);
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('error', (err) => { clearTimeout(to); try { fs.unlinkSync(tmpPath); } catch {} ; resolve({ success: false, error: String(err), stdout, stderr }); });
      child.on('close', (code) => {
        clearTimeout(to);
        try { fs.unlinkSync(tmpPath); } catch {}
        console.log('[IPC enable-addon] stdout=', String(stdout).slice(0,8000));
        console.log('[IPC enable-addon] stderr=', String(stderr).slice(0,8000));
        const ok = stdout.indexOf('@@ACTION_OK@@') >= 0;
        const fail = stdout.indexOf('@@ACTION_FAIL@@') >= 0;
        if (ok) { resolve({ success: true, stdout, stderr }); }
        else if (fail) { resolve({ success: false, error: 'validation-failed', stdout, stderr }); }
        else { resolve({ success: false, error: 'no-confirmation', stdout, stderr }); }
      });
    });
  } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('remove-addon', async (_event, params: { path: string }) => {
    try {
      const p = params?.path;
      if (!p) return { success: false, error: 'missing-path' };
      if (!fs.existsSync(p)) return { success: false, error: 'not-found' };
      // Be conservative: only allow removal inside Blender 'addons' folders
      // We won't attempt to guess root; assume caller provides the exact addon folder
      try {
        fs.rmSync(p, { recursive: true, force: true });
        // invalidate any cache entries that reference this path
        try {
          const cache = readAddonsCache();
          let changed = false;
          for (const k of Object.keys(cache)) {
            const entry = cache[k];
            if (Array.isArray(entry.addons)) {
              const found = entry.addons.some((ad: any) => ad.path === p || (ad.path && ad.path.startsWith(p)));
              if (found) { delete cache[k]; changed = true; }
            }
          }
          if (changed) writeAddonsCache(cache);
        } catch (e) { /* ignore */ }
        return { success: true };
      } catch (e) { return { success: false, error: String(e) }; }
    } catch (e) { return { success: false, error: String(e) }; }
  });

  // Scanner et fusionner les installations Blender (Program Files, Registre, Steam)
  ipcMain.handle('scan-and-merge-blenders', async () => {
    try {
      const res = await opts.blenderScanner.scanAndMerge(CONFIG_PATH);
      if (res?.success) {
        try { opts.getMainWindow()?.webContents.send('config-updated'); } catch {}
      }
      return res;
    } catch (e) { return { success: false, error: String(e) }; }
  });

  // Reorder blenders: receive an array of exe paths in desired order and rewrite config.json accordingly
  ipcMain.handle('reorder-blenders', async (_event, paths: string[]) => {
    try {
      if (!Array.isArray(paths)) return { success: false, error: 'invalid-params' };
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{"blenders":[]}');
      cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
      // Build new array preserving full objects where path matches, otherwise ignore
      const mapByPath: Record<string, any> = {};
      for (const b of cfg.blenders) if (b && b.path) mapByPath[b.path] = b;
      const newList: any[] = [];
      for (const p of paths) {
        if (mapByPath[p]) newList.push(mapByPath[p]);
      }
      // Append any entries that weren't included in paths to preserve them
      for (const b of cfg.blenders) {
        if (!newList.find(x => x.path === b.path)) newList.push(b);
      }
      cfg.blenders = newList;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      try { opts.getMainWindow()?.webContents.send('config-updated'); } catch {}
      return { success: true };
    } catch (e) {
      console.error('[IPC] reorder-blenders erreur:', e);
      return { success: false, error: String(e) };
    }
  });
}

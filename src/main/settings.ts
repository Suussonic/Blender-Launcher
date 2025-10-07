import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon from 'extract-file-icon';
import { pathToFileURL, fileURLToPath } from 'url';
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
      cfg.general = { scanOnStartup: false, exitOnClose: false };
      console.log('Migration: ajout bloc general par defaut');
    } else {
      if (typeof cfg.general.scanOnStartup !== 'boolean') cfg.general.scanOnStartup = false;
      if (typeof cfg.general.exitOnClose !== 'boolean') cfg.general.exitOnClose = false;
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
      if (!cfg.general || typeof cfg.general !== 'object') return { scanOnStartup: false, exitOnClose: false };
      return { scanOnStartup: cfg.general.scanOnStartup === true, exitOnClose: cfg.general.exitOnClose === true };
    } catch (e) {
      console.error('[General] get-general-config erreur:', e);
      return { scanOnStartup: false, exitOnClose: false };
    }
  });

  ipcMain.handle('update-general-config', async (_event, partial) => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
  if (!cfg.general || typeof cfg.general !== 'object') cfg.general = { scanOnStartup: false, exitOnClose: false };
      cfg.general = { ...cfg.general, ...(partial || {}) };
      cfg.general.scanOnStartup = cfg.general.scanOnStartup === true; // normalize boolean
  cfg.general.exitOnClose = cfg.general.exitOnClose === true;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
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
}

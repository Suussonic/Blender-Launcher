import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon = require('extract-file-icon');
import { pathToFileURL, fileURLToPath } from 'url';
import { spawn } from 'child_process';
// @ts-ignore - JS backend module without typings
import { DiscordRPCManager } from '../../backend/integrations/discord_rpc_manager';

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
      cfg.general = { scanOnStartup: false, exitOnClose: false, launchOnStartup: false, language: 'fr' };
      console.log('Migration: ajout bloc general par defaut');
    } else {
  if (typeof cfg.general.scanOnStartup !== 'boolean') cfg.general.scanOnStartup = false;
  if (typeof cfg.general.exitOnClose !== 'boolean') cfg.general.exitOnClose = false;
  if (typeof cfg.general.launchOnStartup !== 'boolean') cfg.general.launchOnStartup = false;
  if (cfg.general.language !== 'fr' && cfg.general.language !== 'en') cfg.general.language = 'fr';
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
  if (!cfg.general || typeof cfg.general !== 'object') return { scanOnStartup: false, exitOnClose: false, launchOnStartup: false, language: 'fr', theme: 'dark-blue' };
  const validThemes = ['dark-blue', 'black', 'grey', 'light'];
  return {
    scanOnStartup: cfg.general.scanOnStartup === true,
    exitOnClose: cfg.general.exitOnClose === true,
    launchOnStartup: cfg.general.launchOnStartup === true,
    language: cfg.general.language === 'en' ? 'en' : 'fr',
    theme: validThemes.includes(cfg.general.theme) ? cfg.general.theme : 'dark-blue',
  };
    } catch (e) {
      console.error('[General] get-general-config erreur:', e);
      return { scanOnStartup: false, exitOnClose: false, launchOnStartup: false, language: 'fr' };
    }
  });

  // Enable or disable an addon by invoking backend/addons/action.py through Blender.
  ipcMain.handle('enable-addon', async (_event, params: { exePath?: string; module?: string; enable?: boolean }) => {
    try {
      const exePath = params?.exePath;
      const moduleName = params?.module;
      const enable = !!params?.enable;
      if (!exePath || !fs.existsSync(exePath)) return { success: false, error: 'exe-not-found' };
      if (!moduleName) return { success: false, error: 'missing-module' };
      if (await isExecutableRunning(exePath)) {
        return {
          success: false,
          error: 'Blender est deja ouvert pour cette instance. Ferme Blender avant de modifier les add-ons depuis le launcher.'
        };
      }

      const trimForLog = (s: string, max = 1000) => {
        if (!s) return '';
        if (s.length <= max) return s;
        return `${s.slice(0, max)} ...[truncated ${s.length - max} chars]`;
      };

      console.log('[addons][toggle] request', {
        exePath,
        module: moduleName,
        action: enable ? 'enable' : 'disable'
      });

      const out = await runBlenderBackendScript(exePath, path.join('backend', 'addons', 'action.py'), ['action', enable ? 'enable' : 'disable', 'module', moduleName], 25000);
      const stdout = out.stdout || '';
      const stderr = out.stderr || '';
      const ok = stdout.includes('@@ACTION_OK@@');
      let actionError: string | undefined;
      try {
        const marker = '@@ACTION_ERR@@';
        const idx = stdout.indexOf(marker);
        if (idx >= 0) actionError = stdout.substring(idx + marker.length).split('\n')[0].trim();
      } catch {}
      if (!actionError && !ok) actionError = 'Impossible de changer l\'etat de ce module.';

      console.log('[addons][toggle] blender-result', {
        exePath,
        module: moduleName,
        action: enable ? 'enable' : 'disable',
        ok,
        actionError: actionError || null,
        stdout: trimForLog(stdout),
        stderr: trimForLog(stderr)
      });

      if (ok) {
        try {
          const cache = readAddonsCache();
          if (cache[exePath]) {
            delete cache[exePath];
            writeAddonsCache(cache);
            console.log('[addons][toggle] cache invalidated', { exePath });
          }
        } catch (e) {
          console.warn('[addons] cache invalidation failed after enable-addon', e);
        }
      } else {
        console.warn('[addons][toggle] failed', {
          exePath,
          module: moduleName,
          action: enable ? 'enable' : 'disable',
          actionError: actionError || null
        });
      }

      return { success: !!ok, stdout, stderr, error: actionError };
    } catch (e) {
      console.error('[addons][toggle] exception', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('update-general-config', async (_event, partial) => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      if (!cfg.general || typeof cfg.general !== 'object') cfg.general = { scanOnStartup: false, exitOnClose: false, launchOnStartup: false, language: 'fr', theme: 'dark-blue' };
      const prevLaunch = cfg.general.launchOnStartup === true;
      cfg.general = { ...cfg.general, ...(partial || {}) };
      cfg.general.scanOnStartup = cfg.general.scanOnStartup === true; // normalize boolean
      cfg.general.exitOnClose = cfg.general.exitOnClose === true;
      cfg.general.launchOnStartup = cfg.general.launchOnStartup === true;
      cfg.general.language = cfg.general.language === 'en' ? 'en' : 'fr';
      const validThemes = ['dark-blue', 'black', 'grey', 'light'];
      cfg.general.theme = validThemes.includes(cfg.general.theme) ? cfg.general.theme : 'dark-blue';
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

  // Helper: download a URL to a local file path (handles HTTP redirects)
  function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol: any = url.startsWith('https:') ? require('https') : require('http');
      const file = fs.createWriteStream(dest);
      const timer = setTimeout(() => {
        try { file.destroy(); } catch {}
        reject(new Error('Download timeout'));
      }, 120000);

      const req = protocol.get(url, (res: any) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          file.close();
          try { fs.unlinkSync(dest); } catch {}
          downloadFile(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          file.close();
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          clearTimeout(timer);
          file.close(() => resolve());
        });
      });
      req.on('error', (err: Error) => {
        clearTimeout(timer);
        try { file.close(); } catch {}
        try { fs.unlinkSync(dest); } catch {}
        reject(err);
      });
    });
  }

  ipcMain.handle('install-extension-from-url', async (_event, params: { blenderExePath?: string; downloadUrl?: string; extensionTitle?: string }) => {
    const exePath = params?.blenderExePath;
    const downloadUrl = params?.downloadUrl;

    if (!exePath || !fs.existsSync(exePath)) return { success: false, error: 'exe-not-found' };
    if (!downloadUrl) return { success: false, error: 'download-url-manquant' };

    const tmpFile = path.join(app.getPath('temp'), `bl_ext_${Date.now()}.zip`);
    try {
      // 1. Download
      console.log('[install-extension] downloading', downloadUrl);
      try {
        await downloadFile(downloadUrl, tmpFile);
      } catch (dlErr) {
        return { success: false, error: 'Téléchargement échoué: ' + String(dlErr) };
      }

      // 2. Vérification zip valide
      let isZip = false;
      try {
        const fd = fs.openSync(tmpFile, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        // Signature ZIP : 0x50 0x4B 0x03 0x04
        isZip = buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
      } catch {}
      if (!isZip) {
        return { success: false, error: 'Le fichier téléchargé n\'est pas un fichier ZIP valide.\nVérifiez l\'URL ou le serveur distant.', tmpFile };
      }

      // 3. Run install script inside Blender
      const out = await runBlenderBackendScript(
        exePath,
        path.join('backend', 'addons', 'install_extension.py'),
        [tmpFile],
        90000
      );
      const stdout = out.stdout || '';
      const stderr = out.stderr || '';
      console.log('[install-extension] script stdout', stdout.slice(0, 500));

      const okMarker   = '@@INSTALL_OK@@';
      const failMarker = '@@INSTALL_FAIL@@';
      const okIdx   = stdout.indexOf(okMarker);
      const failIdx = stdout.indexOf(failMarker);

      if (okIdx >= 0) {
        const moduleName = stdout.substring(okIdx + okMarker.length).split('\n')[0].trim();
        if (!moduleName) {
          return { success: false, error: 'Module activé introuvable', stdout, stderr };
        }

        // Invalidate addons cache
        try {
          const cache = readAddonsCache();
          if (cache[exePath]) { delete cache[exePath]; writeAddonsCache(cache); }
        } catch {}
        setTimeout(() => { void refreshAddonsCacheForExe(exePath); }, 300);
        return { success: true, module: moduleName };
      }

      if (failIdx >= 0) {
        const reason = stdout.substring(failIdx + failMarker.length).split('\n')[0].trim();
        // Ajout du détail stdout/stderr pour aider au debug
        return { success: false, error: reason + '\n--- stdout ---\n' + stdout + '\n--- stderr ---\n' + stderr, stdout, stderr };
      }

      // Si le script ne retourne rien d'exploitable, afficher tout le stdout/stderr
      return { success: false, error: 'Script sans résultat\n--- stdout ---\n' + stdout + '\n--- stderr ---\n' + stderr, stdout, stderr };
    } catch (e) {
      console.error('[install-extension-from-url] erreur', e);
      return { success: false, error: String(e) };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
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
      const out = await runBlenderBackendScript(exePath, path.join('backend', 'addons', 'probe.py'), [], 25000);
      const parsed = extractAddonsJsonFromStdout(out.stdout || '');
      if (parsed && Array.isArray(parsed)) {
        const cache = readAddonsCache();
        cache[exePath] = { ts: Date.now(), addons: parsed };
        writeAddonsCache(cache);
        try { opts.getMainWindow()?.webContents.send('addons-updated', { exePath, addons: parsed }); } catch {};
      }
    } catch (e) { console.warn('[cache] refresh failed for', exePath, e); }
  }

  function resolveBackendScript(relativePath: string): string | null {
    const candidates = [
      path.join(process.cwd(), relativePath),
      path.join(__dirname, '..', '..', relativePath),
      path.join(app.getAppPath(), relativePath),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {}
    }
    return null;
  }

  async function isExecutableRunning(exePath: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const normalized = exePath.replace(/\\/g, '\\\\').replace(/'/g, "''");
      const command = `(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${normalized}' } | Select-Object -First 1 ProcessId | ConvertTo-Json -Compress)`;
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('error', () => resolve(false));
      child.on('close', () => {
        if (stderr && stderr.trim()) {
          console.warn('[addons] running-process detection stderr', stderr.trim());
        }
        try {
          const trimmed = stdout.trim();
          if (!trimmed || trimmed === 'null') return resolve(false);
          const parsed = JSON.parse(trimmed);
          resolve(!!parsed && !!parsed.ProcessId);
        } catch {
          resolve(false);
        }
      });
    });
  }

  async function runBlenderBackendScript(exePath: string, backendRelativePath: string, scriptArgs: string[] = [], timeoutMs = 25000): Promise<{ stdout: string; stderr: string; error?: string }> {
    const scriptPath = resolveBackendScript(backendRelativePath);
    if (!scriptPath) return { stdout: '', stderr: '', error: `backend-script-not-found:${backendRelativePath}` };
    return await new Promise<{ stdout: string; stderr: string; error?: string }>((resolve) => {
      const child = spawn(exePath, ['--background', '--python', scriptPath, '--', ...scriptArgs], { windowsHide: true });
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
      child.on('close', () => {
        clearTimeout(to);
        if (finished) return;
        finished = true;
        resolve({ stdout, stderr });
      });
    });
  }

  function extractAddonsJsonFromStdout(stdout: string): any[] | null {
    const markerStart = '@@ADDONS_JSON_START@@';
    const markerEnd = '@@ADDONS_JSON_END@@';
    const s = stdout || '';
    const start = s.indexOf(markerStart);
    const end = s.indexOf(markerEnd, start >= 0 ? start : 0);
    if (start >= 0 && end > start) {
      const jsonStr = s.substring(start + markerStart.length, end).trim();
      try { return JSON.parse(jsonStr); } catch {}
    }
    return null;
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
      const out = await runBlenderBackendScript(exePath, path.join('backend', 'addons', 'probe.py'), [], 25000);
      if (out.error) return { success: false, error: out.error, stdout: out.stdout, stderr: out.stderr, addons: [] };
      const parsed = extractAddonsJsonFromStdout(out.stdout || '');
      if (parsed) {
        try { const cache = readAddonsCache(); cache[exePath] = { ts: Date.now(), addons: parsed }; writeAddonsCache(cache); } catch (e) {}
        return { success: true, addons: parsed, stdout: out.stdout, stderr: out.stderr };
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
                    // Try to coerce the python dict literal into JSON by doing a few safe replacements.
                    // This is tolerant and will fall back to an empty bl_info on parse failure.
                    try {
                      let jsonLike = dictStr
                        .replace(/'/g, '"')
                        .replace(/\bTrue\b/g, 'true')
                        .replace(/\bFalse\b/g, 'false')
                        .replace(/\bNone\b/g, 'null')
                        // remove trailing commas before closing braces/brackets
                        .replace(/,\s*([}\]])/g, '$1');
                      try {
                        const parsed = JSON.parse(jsonLike);
                        bl_info = parsed || {};
                      } catch (e) {
                        bl_info = {};
                      }
                    } catch (e) {
                      bl_info = {};
                    }
                    try { name = (bl_info && bl_info.name) ? bl_info.name : name; } catch {}
                  }
                }
              }
            } catch (e) {
              // ignore single-add-on parse errors
            }
            addonList.push({ path: addonDir, name, bl_info });
          }
        } catch (e) {
          // ignore candidate directory errors
        }
      }
      return { success: true, addons: addonList };
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

  // Extensions search handler
  ipcMain.handle('extensions-search', async (_event, query: string) => {
    try {
      const https = require('https');
      const url = `https://extensions.blender.org/search/?q=${encodeURIComponent(query)}`;
      console.log('[IPC] extensions-search:', url);
      
      return new Promise((resolve, reject) => {
        https.get(url, (res: any) => {
          let html = '';
          res.on('data', (chunk: any) => { html += chunk; });
          res.on('end', () => {
            console.log('[IPC] extensions-search: HTML reçu, longueur =', html.length);
            resolve({ html });
          });
        }).on('error', (err: any) => {
          console.error('[IPC] extensions-search erreur:', err);
          reject(err);
        });
      });
    } catch (e) {
      console.error('[IPC] extensions-search exception:', e);
      return { html: '', error: String(e) };
    }
  });

  // Open external URL handler
  ipcMain.handle('open-external-url', async (_event, url: string) => {
    try {
      const { shell } = require('electron');
      await shell.openExternal(url);
      return { success: true };
    } catch (e) {
      console.error('[IPC] open-external-url erreur:', e);
      return { success: false, error: String(e) };
    }
  });
}

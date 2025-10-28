// Small file logger to capture main-process startup logs for debugging in packaged builds
function appendLog(msg: string) {
  try {
    const p = app && app.getPath ? app.getPath('userData') : process.cwd();
    const logFile = require('path').join(p, 'bl-launcher-main.log');
    const line = new Date().toISOString() + ' - ' + String(msg) + '\n';
    require('fs').appendFileSync(logFile, line, { encoding: 'utf8' });
  } catch (e) { /* ignore logging errors */ }
}
appendLog('Chargement des modules Electron...');
console.log('Chargement des modules Electron...');
import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon = require('extract-file-icon');
import { pathToFileURL, fileURLToPath } from 'url';
import { initSettings, getConfigPath, getDiscordManager } from './settings';
import { initTrayMenu, destroyTrayMenu } from './trayMenu';
console.log('Modules Electron charges.');
// Résolveur robuste pour modules backend (évite les soucis de chemins en dist/dev)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodePath = require('path');
function requireBackend(modBaseName: string) {
  const candidates = [
    // dev: src/main -> ../../backend
    nodePath.resolve(__dirname, '../../backend', modBaseName + '.js'),
    nodePath.resolve(__dirname, '../../backend', modBaseName),
    // dist: dist/main -> ../../backend
    nodePath.resolve(__dirname, '..', '..', 'backend', modBaseName + '.js'),
    nodePath.resolve(__dirname, '..', '..', 'backend', modBaseName),
    // cwd fallback
    nodePath.resolve(process.cwd(), 'backend', modBaseName + '.js'),
    nodePath.resolve(process.cwd(), 'backend', modBaseName),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return require(p);
    } catch {}
  }
  // Dernier recours: require relatif classique (peut échouer selon contexte)
  try { return require('../../backend/' + modBaseName); } catch {}
  try { return require('../../../backend/' + modBaseName); } catch {}
  throw new Error('Backend module introuvable: ' + modBaseName);
}
// Charge le warp backend via le résolveur
const steamWarp = requireBackend('steam_warp');
const blenderScanner = require('../../backend/blender_scanner');

// Résolution minimale du chemin de steam.exe sans dépendre d'un module backend
function getSteamExePathFallback(): string | null {
  try {
    const cp = require('child_process');
    // HKCU puis HKLM (incl. WOW6432Node)
    const keys = [
      'HKCU\\Software\\Valve\\Steam',
      'HKLM\\Software\\Valve\\Steam',
      'HKLM\\Software\\WOW6432Node\\Valve\\Steam'
    ];
    for (const k of keys) {
      try {
        const out = cp.execSync(`reg query ${k} /v SteamPath`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const m = out.match(/SteamPath\s+REG_\w+\s+(.+)$/mi);
        if (m && m[1]) {
          const base = m[1].trim();
          const exe = nodePath.join(base, 'steam.exe');
          if (fs.existsSync(exe)) return exe;
        }
      } catch {}
    }
  } catch {}
  const candidates = [
    'C:/Program Files (x86)/Steam/steam.exe',
    'C:/Program Files/Steam/steam.exe'
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return null;
}

// Discord installation detection moved to settings module where needed

// Fonction utilitaire pour générer un title à partir du nom de fichier
function generateTitle(fileName: string): string {
  // Retire l'extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // Capitalise la première lettre de chaque mot et remplace les tirets/underscores par des espaces
  return nameWithoutExt
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

let mainWindow: BrowserWindow | null = null;
let forceQuit = false; // set by tray Quit
// Track whether a render is currently active to avoid quitting the app prematurely
let renderActive: boolean = false;

// Quit helper: make red X identical to tray Quit
function quitAppFully() {
  try { destroyTrayMenu(); } catch {}
  forceQuit = true;
  try { app.quit(); } catch {}
}
function createWindow() {
  console.log('Debut de createWindow');
  try {
    // Prefer 512x512 for crisper taskbar icon
    const iconCandidates = [
      path.join(__dirname, '../../public/logo/ico/Blender-Launcher-512x512.ico'),
      path.join(__dirname, '../../public/logo/ico/Blender-Launcher-256x256.ico'),
      path.join(__dirname, '../../public/logo/ico/Blender-Launcher-128x128.ico'),
    ];
    const iconPath = iconCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || iconCandidates[1];
  console.log('Chemin icone :', iconPath, fs.existsSync(iconPath) ? 'OK' : 'NON TROUVE');
  // Détermination dynamique des chemins (compatible asar)
  const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
  let preloadPath = app.isPackaged
    ? path.join(appRoot, 'dist', 'preload.js')
    : path.join(appRoot, 'src', 'main', 'preload.js');
  if (!fs.existsSync(preloadPath)) {
    // fallback to dist for dev if not found
    const fallback = path.join(appRoot, 'dist', 'preload.js');
    if (fs.existsSync(fallback)) preloadPath = fallback;
  }
  const htmlPath = app.isPackaged
    ? path.join(appRoot, 'dist', 'renderer', 'index.html')
    : path.join(appRoot, 'dist', 'renderer', 'index.html');
  console.log('Chemin index.html :', htmlPath, fs.existsSync(htmlPath) ? 'OK' : 'NON TROUVE');

  // If running packaged but required runtime files are missing (common when
  // user moves only the exe without the resources folder), show a clear error
  // and quit instead of leaving the renderer stuck on a spinner.
  try {
    const missingPreload = !fs.existsSync(preloadPath);
    const missingHtml = !fs.existsSync(htmlPath);
    if ((app.isPackaged && (missingPreload || missingHtml)) || (!fs.existsSync(htmlPath))) {
      const msgLines = [];
      if (missingHtml) msgLines.push(`Fichier manquant: ${htmlPath}`);
      if (missingPreload) msgLines.push(`Fichier manquant: ${preloadPath}`);
      msgLines.push('Le paquet semble incomplet. Assurez-vous de déplacer le dossier entier "release\\Blender Launcher-win32-x64" et non seulement l\'exécutable.');
      msgLines.push('Pour obtenir un exe unique et portable, générez le build "portable" (npm run package:win:portable) sur une machine avec les permissions nécessaires.');
      try { dialog.showErrorBox('Blender Launcher — fichiers manquants', msgLines.join('\n\n')); } catch (e) { console.error('Impossible d\'afficher le dialogue d\'erreur', e); }
      try { app.quit(); } catch (e) { }
      return;
    }
  } catch (e) { /* ignore */ }

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      frame: false,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
      },
    });
  console.log('Fenetre BrowserWindow creee');
    win.removeMenu();
  console.log('Menu supprime');
    win.loadFile(htmlPath)
      .then(() => console.log('index.html charge avec succes'))
      .catch((err) => console.error('Erreur lors du chargement de index.html :', err));
    mainWindow = win;
    win.on('closed', () => {
      console.log('Fenetre principale fermee');
      mainWindow = null;
    });
  } catch (e) {
  console.error('ERREUR lors de la creation de la fenetre Electron:', e);
  }
}



import { dialog } from 'electron';

app.whenReady().then(() => {
  console.log('App ready - initialisation des handlers avant creation de la fenetre...');
  // Initialize settings module and register all settings-related IPC handlers
  // Doing this before creating the BrowserWindow avoids a race where the renderer
  // calls ipcRenderer.invoke(...) before the handlers are registered (causing
  // "No handler registered" errors observed during startup).
  initSettings({
    getMainWindow: () => mainWindow,
    blenderScanner,
    steamWarp,
  });

  // Now create the main window (renderer may start and call invoke() - handlers are ready)
  createWindow();

  // Init tray popup menu
  const ensureMainWindow = () => {
    if (!mainWindow) createWindow();
    return mainWindow;
  };
  initTrayMenu(() => mainWindow, ensureMainWindow);

  // On macOS/Windows: recreate/show window when the app is activated (e.g., from tray)
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createWindow();
    } else {
      try { mainWindow?.show(); mainWindow?.focus(); } catch {}
    }
  });
  // Au démarrage: tenter une restauration de warp laissée en plan
  try {
    const userDataDir = app.getPath('userData');
    steamWarp.startupRestore(userDataDir).then((res: any)=>{
      if (res?.restored) console.log('[SteamWarp] Restauration au démarrage effectuée');
    }).catch(()=>{});
  } catch(e) { console.warn('[SteamWarp] startup restore erreur:', e); }
  
  console.log('[IPC] Enregistrement des handlers principaux...');

  ipcMain.on('minimize-window', () => {
    console.log('Recu : minimize-window');
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.on('maximize-window', () => {
    console.log('Recu : maximize-window');
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('close-window', () => {
    console.log('Recu : close-window');
    try {
      const cfgPath = getConfigPath();
      const raw = cfgPath && fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf-8') : '{}';
      const cfg = JSON.parse(raw || '{}');
      const exitOnClose = !!cfg?.general?.exitOnClose;
      console.log('[Close] exitOnClose =', exitOnClose);
      if (exitOnClose) {
        // Unified with tray Quit
        quitAppFully();
      } else {
        // Hide if possible, otherwise log the situation
        try { if (mainWindow) { mainWindow.hide(); } else { console.warn('[Close] mainWindow absent - cannot hide'); } } catch (e) { console.warn('[Close] hide failed', e); }
      }
    } catch (e) {
      console.warn('[Close] lecture config échouée, tentative de hide par défaut:', e);
      try { if (mainWindow) { mainWindow.hide(); } else { console.warn('[Close] mainWindow absent - cannot hide'); } } catch (e2) { console.warn('[Close] hide failed', e2); }
    }
  });

  // Settings-related IPC are registered by settings module

  // Raccourci F12 pour ouvrir les DevTools
  if (mainWindow) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        console.log('F12 pressed, opening DevTools...');
        if (mainWindow) {
          mainWindow.webContents.openDevTools();
        }
      }
    });
  }

  app.on('before-quit', () => { forceQuit = true; });

  // Intercept close to hide-to-tray unless exitOnClose is enabled
  if (mainWindow) {
    mainWindow.on('close', (e) => {
      try {
        if (forceQuit) { console.log('[Close] forceQuit=true -> fermeture réelle'); return; }
        const raw = fs.readFileSync(getConfigPath(), 'utf-8');
        const cfg = JSON.parse(raw || '{}');
        const exitOnClose = !!cfg?.general?.exitOnClose;
        console.log('[Close] handler, exitOnClose =', exitOnClose);
        if (!exitOnClose) {
          e.preventDefault();
          mainWindow?.hide();
        } else {
          // Fully quit the app when enabled (same as tray Quit)
          e.preventDefault();
          quitAppFully();
        }
      } catch (err) {
        console.warn('[Close] erreur -> hide par défaut:', err);
        e.preventDefault();
        mainWindow?.hide();
      }
    });
  }

  // get-exe-icon now handled in settings module

  // open-folder-dialog handled in settings module

  // change-executable handled in settings module

  // delete-exécutable handled in settings module

  // legacy delete-executable handled in settings module

  ipcMain.on('launch-blender', async (event, exePath) => {
    try {
      const rawCfg = fs.readFileSync(getConfigPath(), 'utf-8');
      const cfg = JSON.parse(rawCfg || '{}');
      const steamEnabled = !!(cfg.steam && cfg.steam.enabled);
        if (steamEnabled) {
          const userDataDir = app.getPath('userData');
          const res = await steamWarp.warpToBlender(exePath, userDataDir, []);
          if (!res?.success) {
            console.warn('[SteamWarp] Warp échoué, lancement direct sans Steam:', res?.error);
            const { spawn } = require('child_process');
            try { const p = spawn(exePath, [], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('[launch] spawn erreur:', e2); }
          } else {
            // Lancer via Steam si possible (steam.exe sinon protocole steam://)
            const cp = require('child_process');
            let launchedViaSteam = false;
            const steamExe = getSteamExePathFallback();
            if (steamExe && fs.existsSync(steamExe)) {
              try { cp.spawn(steamExe, ['-applaunch', '365670'], { detached: true, stdio: 'ignore' }).unref(); launchedViaSteam = true; } catch {}
            }
            if (!launchedViaSteam) {
              try { cp.spawn('cmd.exe', ['/c', 'start', 'steam://rungameid/365670'], { detached: true, stdio: 'ignore' }).unref(); launchedViaSteam = true; } catch {}
              if (!launchedViaSteam) {
                try { cp.spawn('powershell.exe', ['Start-Process', '"steam://rungameid/365670"'], { detached: true, stdio: 'ignore' }).unref(); launchedViaSteam = true; } catch {}
              }
            }
            if (!launchedViaSteam) {
              console.warn('[SteamWarp] Impossible de lancer via Steam, fallback direct');
              const { spawn } = require('child_process');
              try { const p = spawn(exePath, [], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('[launch] spawn erreur:', e2); }
            }
            try { steamWarp.startAutoRestore(userDataDir, 2500); } catch {}
        }
      } else {
  const { spawn } = require('child_process');
  try { const p = spawn(exePath, [], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('Erreur lors du lancement de Blender :', e2); }
      }
    } catch (e) {
      console.error('[IPC] launch-blender erreur:', e);
  const { spawn } = require('child_process');
  try { const p = spawn(exePath, [], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('Erreur lors du lancement de Blender :', e2); }
    }
    // Mise à jour presence Discord si actif
    try {
      if (exePath) {
        const raw = fs.readFileSync(getConfigPath(), 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        const entry = (cfg.blenders||[]).find((b:any)=> b.path === exePath);
        // Essai extraction version (ex: Blender 4.1, 4.2, etc.)
        let version = null;
        const m = exePath.match(/(\d+\.\d+)/);
        if (m) version = m[1].replace('.', ''); // 4.1 -> 41
        const dm = getDiscordManager();
        if (dm) {
          dm.setActivity({ blenderTitle: entry?.title || entry?.name || 'Blender', fileName: null, version });
          dm.init();
        }
      }
    } catch(e) { console.warn('[DiscordRPC] Maj presence launch erreur:', e); }
  });
  // get-blenders and scan-and-merge-blenders handled in settings module

  // Récupération des fichiers récents Blender pour un exécutable donné
  ipcMain.handle('get-recent-blend-files', async (_event, payload) => {
    try {
      const exePath: string | undefined = payload?.exePath;
      if (!exePath || !fs.existsSync(exePath)) {
        return { version: null, files: [], error: 'invalid-exe' };
      }

      // 1) Tenter de récupérer la version via --version (timeout un peu plus long)
      const getVersion = (): Promise<string | null> => {
        return new Promise((resolve) => {
          try {
            const { execFile } = require('child_process');
            const proc = execFile(exePath, ['--version'], { timeout: 4000 }, (err: any, stdout: string, stderr: string) => {
              if (err) return resolve(null);
              const out = (stdout || stderr || '').trim();
              const match = out.match(/Blender\s+(\d+\.\d+)/i);
              if (match) return resolve(match[1]);
              const matchFull = out.match(/Blender\s+(\d+\.\d+\.\d+)/i);
              if (matchFull) {
                const parts = matchFull[1].split('.');
                if (parts.length >= 2) return resolve(parts[0] + '.' + parts[1]);
              }
              resolve(null);
            });
            setTimeout(() => { try { proc.kill('SIGKILL'); } catch {}; resolve(null); }, 4500);
          } catch { resolve(null); }
        });
      };

      let version = await getVersion();
      if (!version) {
        // Fallback: tenter de deviner à partir du chemin de l'exécutable
        const lower = exePath.toLowerCase();
        const guess = lower.match(/(\d+\.\d+)/);
        if (guess) version = guess[1];
      }

      // 2) Windows: recent-files.txt
      if (process.platform === 'win32') {
        const appData = process.env.APPDATA; // C:\Users\User\AppData\Roaming
        const filesFromTxt = (rfPath: string): any[] => {
          let content = '';
          try { content = fs.readFileSync(rfPath, 'utf-8'); } catch { return []; }
          const lines = content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
          const MAX_FILES = 40;
          const selected = lines.slice(0, MAX_FILES);
          return selected.map((p, idx) => {
            let exists = false; let size: number | undefined; let mtime: number | undefined; let ctime: number | undefined; let name = path.basename(p);
            try {
              const st = fs.statSync(p);
              exists = true;
              size = st.size;
              mtime = st.mtimeMs;
              ctime = (st as any).birthtimeMs && (st as any).birthtimeMs > 0 ? (st as any).birthtimeMs : st.ctimeMs;
            } catch { exists = false; }
            return { path: p, name, exists, size, mtime, ctime, order: idx };
          });
        };

        // 2a) Si la version est connue, lire recent-files.txt correspondant
        if (appData && version) {
          const rf = path.join(appData, 'Blender Foundation', 'Blender', version, 'config', 'recent-files.txt');
          if (fs.existsSync(rf)) {
            return { version, files: filesFromTxt(rf) };
          }
        }

        // 2b) Fallback: scanner toutes les versions et agréger
        if (appData) {
          const base = path.join(appData, 'Blender Foundation', 'Blender');
          const agg: any[] = [];
          const seen = new Set<string>();
          try {
            const entries: any[] = fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }) as any : [];
            const versionDirs = entries
              .filter((e: any) => e.isDirectory && (typeof e.isDirectory !== 'function' || e.isDirectory()) && /^(\d+\.\d+)/.test(e.name))
              .sort((a:any,b:any)=>{
                const ma = a.name.match(/(\d+)\.(\d+)/); const mb = b.name.match(/(\d+)\.(\d+)/);
                if (ma && mb) {
                  const va = parseInt(ma[1])*100 + parseInt(ma[2]);
                  const vb = parseInt(mb[1])*100 + parseInt(mb[2]);
                  return vb - va;
                }
                return 0;
              });
            for (const d of versionDirs) {
              const rf = path.join(base, d.name, 'config', 'recent-files.txt');
              if (!fs.existsSync(rf)) continue;
              const items = filesFromTxt(rf);
              for (const it of items) {
                const norm = path.normalize(it.path).toLowerCase();
                if (seen.has(norm)) continue;
                seen.add(norm);
                agg.push(it);
              }
              if (agg.length >= 40) break;
            }
          } catch {}
          return { version: version || null, files: agg.slice(0, 40) };
        }
      }

      // 3) Plateformes non supportées pour l'instant
      return { version: version || null, files: [] };
    } catch (e) {
      console.error('[IPC] get-recent-blend-files erreur:', e);
      return { version: null, files: [], error: String(e) };
    }
  });

  // Suppression d'un fichier spécifique de recent-files.txt pour un exécutable donné
  ipcMain.handle('remove-recent-blend-file', async (_event, payload) => {
    try {
      const exePath: string | undefined = payload?.exePath;
      const targetPath: string | undefined = payload?.blendPath;
      if (!exePath || !targetPath || !fs.existsSync(exePath)) {
        return { success: false, reason: 'invalid-args' };
      }

      // Reprendre la logique de détermination de version (courte)
      const getVersion = (): Promise<string | null> => {
        return new Promise((resolve) => {
          try {
            const { execFile } = require('child_process');
            const proc = execFile(exePath, ['--version'], { timeout: 1500 }, (err: any, stdout: string, stderr: string) => {
              if (err) return resolve(null);
              const out = (stdout || stderr || '').trim();
              const match = out.match(/Blender\s+(\d+\.\d+)/i);
              if (match) return resolve(match[1]);
              const matchFull = out.match(/Blender\s+(\d+\.\d+\.\d+)/i);
              if (matchFull) {
                const parts = matchFull[1].split('.');
                if (parts.length >= 2) return resolve(parts[0] + '.' + parts[1]);
              }
              resolve(null);
            });
            setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} resolve(null); }, 1800);
          } catch { resolve(null); }
        });
      };

      let version = await getVersion();
      if (!version) {
        const guess = exePath.toLowerCase().match(/(\d+\.\d+)/);
        if (guess) version = guess[1];
      }
      if (!version) return { success: false, reason: 'version-not-found' };

      if (process.platform !== 'win32') {
        // Pour l'instant seulement Windows supporté
        return { success: false, reason: 'unsupported-platform' };
      }
      const appData = process.env.APPDATA;
      if (!appData) return { success: false, reason: 'appdata-missing' };
      const recentFilePath = path.join(appData, 'Blender Foundation', 'Blender', version, 'config', 'recent-files.txt');
      if (!fs.existsSync(recentFilePath)) {
        return { success: false, reason: 'recent-file-missing' };
      }

      let content = '';
      try { content = fs.readFileSync(recentFilePath, 'utf-8'); } catch {
        return { success: false, reason: 'read-failed' };
      }
      const linesRaw = content.split(/\r?\n/);
      const targetNorm = path.normalize(targetPath).toLowerCase();
      let removed = false;
      const filtered = linesRaw.filter(l => {
        const trimmed = l.trim();
        if (!trimmed) return false; // ignore/vire les lignes vides
        const norm = path.normalize(trimmed).toLowerCase();
        if (norm === targetNorm) {
          removed = true;
          return false; // ne garde pas
        }
        return true;
      });

      if (!removed) {
        return { success: false, reason: 'entry-not-found' };
      }

      try {
        fs.writeFileSync(recentFilePath, filtered.join('\n') + '\n', 'utf-8');
      } catch {
        return { success: false, reason: 'write-failed' };
      }

      return { success: true };
    } catch (e) {
      console.error('[IPC] remove-recent-blend-file erreur:', e);
      return { success: false, reason: 'exception', error: String(e) };
    }
  });

  // Ouvrir un fichier .blend via l'exécutable choisi
  ipcMain.on('open-blend-file', async (event, payload) => {
    try {
      const exePath: string | undefined = payload?.exePath;
      const blendPath: string | undefined = payload?.blendPath;
      if (!exePath || !blendPath) return;
      if (!fs.existsSync(exePath) || !fs.existsSync(blendPath)) return;
      try {
  const rawCfg = fs.readFileSync(getConfigPath(), 'utf-8');
        const cfg = JSON.parse(rawCfg || '{}');
        const steamEnabled = !!(cfg.steam && cfg.steam.enabled);
        if (steamEnabled) {
          const userDataDir = app.getPath('userData');
          const res = await steamWarp.warpToBlender(exePath, userDataDir, [blendPath]);
          if (res?.success) {
            const cp = require('child_process');
            let launchedViaSteam = false;
            const steamExe = getSteamExePathFallback();
            if (steamExe && fs.existsSync(steamExe)) {
              try { cp.spawn(steamExe, ['-applaunch', '365670', blendPath], { detached: true, stdio: 'ignore' }).unref(); launchedViaSteam = true; } catch {}
            }
            if (!launchedViaSteam) {
              try { cp.spawn('cmd.exe', ['/c', 'start', 'steam://rungameid/365670'], { detached: true, stdio: 'ignore' }).unref(); launchedViaSteam = true; } catch {}
              if (!launchedViaSteam) {
                try { cp.spawn('powershell.exe', ['Start-Process', '"steam://rungameid/365670"'], { detached: true, stdio: 'ignore' }).unref(); launchedViaSteam = true; } catch {}
              }
            }
            if (!launchedViaSteam) {
              const { spawn } = require('child_process');
              try { const p = spawn(exePath, [blendPath], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('[IPC] open-blend-file spawn erreur:', e2); }
            } else {
              try { steamWarp.startAutoRestore(userDataDir, 2500); } catch {}
            }
          } else {
            const { spawn } = require('child_process');
            try { const p = spawn(exePath, [blendPath], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('[IPC] open-blend-file spawn erreur:', e2); }
          }
        } else {
          const { spawn } = require('child_process');
          try { const p = spawn(exePath, [blendPath], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('[IPC] open-blend-file spawn erreur:', e2); }
        }
      } catch (e) {
  const { spawn } = require('child_process');
  try { const p = spawn(exePath, [blendPath], { detached: true, stdio: 'ignore' }); p.unref(); } catch (e2) { console.error('[IPC] open-blend-file spawn erreur:', e2); }
      }
      // Update Discord presence
      try {
  const raw = fs.readFileSync(getConfigPath(), 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        const entry = (cfg.blenders||[]).find((b:any)=> b.path === exePath);
        const fileName = path.basename(blendPath);
        let version = null;
        const m = exePath.match(/(\d+\.\d+)/);
        if (m) version = m[1].replace('.', '');
        const dm = getDiscordManager();
        if (dm) {
          dm.setActivity({ blenderTitle: entry?.title || entry?.name || 'Blender', fileName, version });
          dm.init();
        }
      } catch(e) { console.warn('[DiscordRPC] presence open file erreur:', e); }
    } catch (e) {
      console.error('[IPC] open-blend-file exception:', e);
    }
  });

  // Révéler un fichier ou dossier dans l'explorateur
  ipcMain.on('reveal-in-folder', (event, payload) => {
    try {
      const target: string | undefined = payload?.path;
      if (!target) return;
      shell.showItemInFolder(target);
    } catch (e) {
      console.error('[IPC] reveal-in-folder erreur:', e);
    }
  });

  ipcMain.handle('get-blend-metadata', async (_event, payload) => {
    try {
      const exePath: string | undefined = payload?.exePath;
      const blendPath: string | undefined = payload?.blendPath;
      if (!exePath || !blendPath || !fs.existsSync(exePath) || !fs.existsSync(blendPath)) {
        return { success: false, reason: 'invalid-args' };
      }

      // Prefer running a bundled backend script for robust extraction
      const scriptCandidates = [
        path.join(__dirname, '../../backend/blend_info.py'), // dev
        path.join(process.cwd(), 'backend', 'blend_info.py'), // cwd fallback
        path.join(__dirname, '..', '..', 'backend', 'blend_info.py'), // dist
      ];
      const scriptPath = scriptCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  // We pass the blend path to the helper after '--' so it can force-open the file
  const scriptArg = scriptPath ? ['--python', scriptPath, '--', blendPath] : [];

  const { execFile } = require('child_process');
  // Use factory startup; do not rely on positional blend load (the helper will open it explicitly)
  const args = ['-b', '--factory-startup', ...scriptArg, '--quit'];

      const result = await new Promise((resolve) => {
        try {
          const child = execFile(exePath, args, { timeout: 20000 }, (err: any, stdout: string, stderr: string) => {
            if (err) {
              return resolve({ success: false, reason: 'exec-error', err: String(err) });
            }
            // Find the last BL_META: JSON line for robust parsing
            const all = ((stdout || '') + '\n' + (stderr || '')).split(/\r?\n/);
            const tagged = all.filter(l => l.includes('BL_META:'));
            if (tagged.length > 0) {
              const last = tagged[tagged.length - 1];
              const idx = last.indexOf('BL_META:');
              const jsonPart = last.slice(idx + 'BL_META:'.length).trim();
              try {
                const data = JSON.parse(jsonPart);
                return resolve({ success: true, data });
              } catch (e) {
                return resolve({ success: false, reason: 'parse-failed' });
              }
            }
            resolve({ success: false, reason: 'no-output' });
          });
          // Additional hard timeout guard
          setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 22000);
        } catch (e) {
          resolve({ success: false, reason: 'spawn-failed', error: String(e) });
        }
      });

      return result;
    } catch (e) {
      return { success: false, reason: 'exception', error: String(e) };
    }
  });

  ipcMain.handle('select-output-folder', async () => {
    try {
      if (!mainWindow) return '';
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Choisir un dossier de sortie',
        properties: ['openDirectory', 'createDirectory']
      });
      if (res.canceled || !res.filePaths || !res.filePaths[0]) return '';
      return res.filePaths[0];
    } catch (e) {
      console.warn('[IPC] select-output-folder erreur:', e);
      return '';
    }
  });

  ipcMain.handle('start-render', async (_event, cfg) => {
    try {
      const exePath: string | undefined = cfg?.blender?.path;
      const blendPath: string | undefined = cfg?.filePath;
      if (!exePath || !fs.existsSync(exePath)) return { success: false, reason: 'invalid-exe' };
      if (!blendPath || !fs.existsSync(blendPath)) return { success: false, reason: 'invalid-blend' };

    const engine: string = cfg?.engine || 'BLENDER_EEVEE';
      const mode: 'IMAGE' | 'ANIMATION' = cfg?.mode || 'IMAGE';
      const w: number = cfg?.resolution?.width || 1920;
      const h: number = cfg?.resolution?.height || 1080;
  const start: number = cfg?.frames?.start ?? 1;
  const end: number = cfg?.frames?.end ?? start;
  const stillFrame: number | undefined = cfg?.stillFrame;
      const outputDir: string = cfg?.outputDir || '';
    const imageFormat: string | undefined = cfg?.imageFormat;
    const videoMode: 'VIDEO' | 'SEQUENCE' | undefined = cfg?.videoMode;
    const videoContainer: string | undefined = cfg?.videoContainer;
    const videoCodec: string | undefined = cfg?.videoCodec;
    const videoQuality: string | undefined = cfg?.videoQuality;
  const openRenderWindow: boolean = !!cfg?.openRenderWindow;

      // Assure le dossier de sortie
      try { if (outputDir && !fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true }); } catch {}

  // Normalize output folder for Blender; script will add filename base
  let out = outputDir ? outputDir.replace(/\\/g, '/') : '';
  if (out && !out.endsWith('/')) out += '/';

      // Build headless render using backend/render_headless.py and stream progress markers
      const scriptCandidates = [
        path.join(__dirname, '../../backend/render_headless.py'),
        path.join(process.cwd(), 'backend', 'render_headless.py'),
        path.join(__dirname, '..', '..', 'backend', 'render_headless.py'),
      ];
      const scriptPath = scriptCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
      if (!scriptPath) return { success: false, reason: 'script-missing' };

      // Build CLI args. If openRenderWindow is true, run Blender with UI and open the Image Editor render window.
      // Optional log file for GUI mode to duplicate BL_REN markers
      const guiLogPath = path.join(app.getPath('temp'), 'bl-launcher-render.log');

      const commonArgs: string[] = [
        // Always use factory-startup to avoid third-party addon popups during scripting
          '--factory-startup',
        '--python', scriptPath,
        '--',
        blendPath,
        `mode=${mode}`,
        `engine=${engine}`,
        `width=${Math.max(1, w)}`,
        `height=${Math.max(1, h)}`,
  (out ? `out=${out}` : ''),
  // Provide a temp log file to duplicate markers in GUI mode
  (openRenderWindow ? `log=${guiLogPath.replace(/\\/g, '/')}` : ''),
        // For IMAGE, pass explicit frame if specified (fallback to start)
        (mode === 'IMAGE' && (stillFrame !== undefined) ? `frame=${stillFrame}` : ''),
        (mode === 'ANIMATION' ? `start=${start}` : ''),
        (mode === 'ANIMATION' ? `end=${end}` : ''),
        // Output formatting
        // SEQUENCE -> image format, VIDEO -> FFMPEG
        (mode === 'ANIMATION' && videoMode === 'VIDEO' ? 'format=FFMPEG' : (imageFormat ? `format=${imageFormat}` : '')),
        (mode === 'ANIMATION' && videoMode === 'VIDEO' && videoContainer ? `container=${videoContainer}` : ''),
        (mode === 'ANIMATION' && videoMode === 'VIDEO' && videoCodec ? `codec=${videoCodec}` : ''),
        // omit quality to simplify
      ].filter(Boolean) as string[];

      // Append flag for GUI script to show render window when requested
      if (openRenderWindow) {
        commonArgs.push('open_window=1');
      }

      const args: string[] = openRenderWindow
        ? (process.platform === 'win32' ? ['-con', ...commonArgs] : commonArgs) // GUI mode; on Windows force console to capture prints
        : ['-b', ...commonArgs]; // headless mode

    const { spawn } = require('child_process');
      console.log('[render] Launching headless render:', { exePath, args });
  const child = spawn(exePath, args, { detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
  const wc = mainWindow?.webContents;
  const shouldShutdown: boolean = !!cfg?.shutdownOnFinish;
  let sawInit = false;
  // Mark render as active until Blender finishes or sends DONE/CANCEL/ERROR
  renderActive = true;

      const emit = (event: string, payload: any) => { try { wc?.send('render-progress', { event, ...payload }); } catch {} };

      // In GUI mode, Blender may not flush our markers to stdout on Windows; emit a synthetic INIT/START so the UI shows a bar.
      if (openRenderWindow) {
        const totalFrames = mode === 'ANIMATION' ? Math.max(1, (end - start + 1)) : 1;
        emit('INIT', { total: String(totalFrames) });
        sawInit = true; // consider synthetic INIT valid for shutdown behavior
        setTimeout(() => emit('START', {}), 300);
      } else {
        // Headless: show a bar immediately too; real markers will update soon after
        const totalFrames = mode === 'ANIMATION' ? Math.max(1, (end - start + 1)) : 1;
        emit('INIT', { total: String(totalFrames) });
        sawInit = true; // synthetic INIT
        setTimeout(() => emit('START', {}), 150);
      }

      child.stdout?.on('data', (d: Buffer) => {
        const lines = d.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('BL_REN:')) {
            const rest = line.slice('BL_REN:'.length).trim();
            const [tag, ...kvparts] = rest.split(/\s+/);
            const payload: any = { raw: line };
            for (const kv of kvparts) {
              const i = kv.indexOf('=');
              if (i > 0) payload[kv.slice(0, i)] = kv.slice(i + 1);
            }
            emit(tag, payload);
            if (tag === 'INIT') sawInit = true;
            if (tag === 'DONE') {
              renderActive = false;
            }
            if ((tag === 'CANCEL') || (tag === 'ERROR')) {
              renderActive = false;
            }
            if (tag === 'DONE' && shouldShutdown) {
              try {
                if (process.platform === 'win32') {
                  require('child_process').spawn('shutdown', ['/s', '/t', '0'], { detached: true, stdio: 'ignore' });
                }
              } catch {}
            }
          }
        }
      });
      // If GUI mode, tail the log file written by the Python script for robust progress
      let tailTimer: NodeJS.Timeout | null = null;
      if (openRenderWindow) {
        let lastSize = 0;
        const readChunk = (start: number, end: number) => new Promise<string>((resolve) => {
          try {
            const fd = fs.createReadStream(guiLogPath, { start, end: end - 1, encoding: 'utf-8' });
            let buf = '';
            fd.on('data', (c: any) => { try { buf += String(c); } catch { /* ignore */ } });
            fd.on('end', () => resolve(buf));
            fd.on('error', () => resolve(''));
          } catch {
            resolve('');
          }
        });
        const poll = async () => {
          try {
            const st = fs.existsSync(guiLogPath) ? fs.statSync(guiLogPath) : null;
            if (st && st.size > lastSize) {
              const chunk = await readChunk(lastSize, st.size);
              lastSize = st.size;
              if (chunk) {
                const lines = chunk.split(/\r?\n/).filter(Boolean);
                for (const line of lines) {
                  if (line.startsWith('BL_REN:')) {
                    const rest = line.slice('BL_REN:'.length).trim();
                    const [tag, ...kvparts] = rest.split(/\s+/);
                    const payload: any = { raw: line };
                    for (const kv of kvparts) {
                      const i = kv.indexOf('=');
                      if (i > 0) payload[kv.slice(0, i)] = kv.slice(i + 1);
                    }
                    emit(tag, payload);
                    if (tag === 'INIT') sawInit = true;
                    if (tag === 'DONE') {
                      renderActive = false;
                      if (shouldShutdown) {
                        try {
                          if (process.platform === 'win32') {
                            require('child_process').spawn('shutdown', ['/s', '/t', '0'], { detached: true, stdio: 'ignore' });
                          }
                        } catch {}
                      }
                    }
                    if (tag === 'CANCEL' || tag === 'ERROR') {
                      renderActive = false;
                    }
                  }
                }
              }
            }
          } catch {}
          tailTimer = setTimeout(poll, 400);
        };
        tailTimer = setTimeout(poll, 600);
      }
      child.stderr?.on('data', (d: Buffer) => {
        const s = d.toString();
        if (s.trim()) console.warn('[render][stderr]', s.trim());
      });
      child.on('exit', (code: number) => {
        console.log('[render] Blender headless process exited with code', code);
        emit('EXIT', { code });
        if (tailTimer) { try { clearTimeout(tailTimer); } catch {} tailTimer = null; }
        // No matter what, consider the render inactive once the process exits
        renderActive = false;
        if (shouldShutdown && code === 0 && sawInit) {
          try {
            if (process.platform === 'win32') {
              require('child_process').spawn('shutdown', ['/s', '/t', '0'], { detached: true, stdio: 'ignore' });
            }
          } catch {}
        }
      });

      return { success: true };
    } catch (e) {
      return { success: false, reason: 'exception', error: String(e) };
    }
  });

  // Clone repository handler
  ipcMain.handle('clone-repository', async (event, payload) => {
    console.log('[clone-repository] Début du clonage avec payload:', payload);
    
    try {
      const { url, branch, targetPath, folderName, shallow } = payload;
      
      if (!url || !targetPath || !folderName) {
        console.log('[clone-repository] Paramètres manquants');
        return { success: false, error: 'Paramètres manquants pour le clonage' };
      }

      const { spawn } = require('child_process');
      const targetFullPath = path.join(targetPath, folderName);
      console.log('[clone-repository] Chemin cible:', targetFullPath);

      // Vérifier si le dossier existe déjà
      if (fs.existsSync(targetFullPath)) {
        console.log('[clone-repository] Le dossier existe déjà');
        return { success: false, error: `Le dossier "${folderName}" existe déjà dans ce répertoire` };
      }

      return new Promise((resolve) => {
        // Simple, direct git clone with minimal overhead as requested
        const gitArgs: string[] = ['clone'];
        if (branch && branch !== 'main' && branch !== 'master') {
          gitArgs.push('-b', branch);
          gitArgs.push('--single-branch');
        }
        gitArgs.push(url, targetFullPath);

        console.log('[clone-repository] Commande git (simple):', 'git', gitArgs.join(' '));

        const childEnv = Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' });
        const gitProcess = spawn('git', gitArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: childEnv
        });

        let stdout = '';
        let stderr = '';

        // Pipe logs to main process console for debugging; avoid sending IPC progress to renderer
        gitProcess.stdout?.on('data', (data: any) => {
          const s = data.toString();
          stdout += s;
          // log minimally
          if (s.trim()) console.log('[git stdout]', s.trim());
        });
        gitProcess.stderr?.on('data', (data: any) => {
          const s = data.toString();
          stderr += s;
          if (s.trim()) console.log('[git stderr]', s.trim());
        });

        gitProcess.on('close', (code: any) => {
          if (code === 0) {
            console.log('[clone-repository] Clonage réussi');
            resolve({ success: true, path: targetFullPath });
            return;
          }

          const errorMsg = stderr || stdout || `Git a quitté avec le code ${code}`;
          console.log('[clone-repository] Erreur:', errorMsg);

          // Detect common Git LFS errors (quota / smudge failures)
          const lfsError = /smudge filter 'git-lfs filter-process' failed|smudge filter lfs failed|This repository exceeded its LFS budget|batch response: This repository exceeded its LFS budget/i;
          if (lfsError.test(errorMsg)) {
            console.log('[clone-repository] Détection d\'une erreur Git LFS. Tentative de clonage sans smudge (placeholders)...');
            try {
              // remove partial folder if exists
              if (fs.existsSync(targetFullPath)) {
                try { fs.rmdirSync(targetFullPath, { recursive: true }); } catch (e) { console.warn('[clone-repository] Échec suppression dossier partiel:', e); }
              }
            } catch (e) { /* ignore */ }

            // Retry clone but skip smudge to avoid LFS download (placeholders will be present)
            try {
              const retryArgs = ['clone'];
              if (branch && branch !== 'main' && branch !== 'master') {
                retryArgs.push('-b', branch);
                retryArgs.push('--single-branch');
              }
              retryArgs.push(url, targetFullPath);
              const retryEnv = Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' });
              console.log('[clone-repository] Commande git (retry skip-smudge):', 'git', retryArgs.join(' '));
              const retryProc = spawn('git', retryArgs, { stdio: ['pipe', 'pipe', 'pipe'], env: retryEnv });
              let rstdout = '';
              let rstderr = '';
              retryProc.stdout?.on('data', (d: any) => { const s = d.toString(); rstdout += s; if (s.trim()) console.log('[git retry stdout]', s.trim()); });
              retryProc.stderr?.on('data', (d: any) => { const s = d.toString(); rstderr += s; if (s.trim()) console.log('[git retry stderr]', s.trim()); });
              retryProc.on('close', (rcode: any) => {
                if (rcode === 0) {
                  console.log('[clone-repository] Clonage (skip-smudge) réussi — les fichiers LFS seront des placeholders.');
                  resolve({ success: true, path: targetFullPath, lfsSkipped: true });
                } else {
                  const rerr = rstderr || rstdout || `Git a quitté avec le code ${rcode}`;
                  console.log('[clone-repository] Retry erreur:', rerr);
                  resolve({ success: false, error: `${errorMsg}\nRetry (skip-smudge) failed: ${rerr}` });
                }
              });
            } catch (e) {
              console.error('[clone-repository] Retry exception:', e);
              resolve({ success: false, error: `${errorMsg}\nRetry exception: ${e}` });
            }
            return;
          }

          resolve({ success: false, error: errorMsg });
        });

        gitProcess.on('error', (err: any) => {
          console.error('[clone-repository] Erreur du processus git:', err);
          resolve({ success: false, error: `Impossible d'exécuter git: ${err.message}. Vérifiez que Git est installé.` });
        });

        // Timeout de 10 minutes (larger safety margin)
        const timeout = setTimeout(() => {
          console.log('[clone-repository] Timeout atteint');
          try { gitProcess.kill(); } catch (e) {}
          resolve({ success: false, error: 'Timeout: le clonage a pris trop de temps (10 minutes)' });
        }, 10 * 60 * 1000);

        gitProcess.on('exit', () => { try { clearTimeout(timeout); } catch {} });
      });
    } catch (error) {
      console.error('[clone-repository] Exception:', error);
      return { success: false, error: `Erreur: ${error}` };
    }
  });

});


app.on('window-all-closed', () => {
  console.log('Toutes les fenetres sont fermees');
  if (process.platform !== 'darwin') {
  // If a render is active, keep the app alive to allow the render to complete
  if (renderActive) {
    console.log('Render actif détecté: l’application reste en arrière-plan jusqu’à la fin du rendu.');
    return;
  }
  console.log('Fermeture de l application');
    try {
      const userDataDir = app.getPath('userData');
      steamWarp.startupRestore(userDataDir);
    } catch {}
    app.quit();
  }
});

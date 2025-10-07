console.log('Chargement des modules Electron...');
import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon from 'extract-file-icon';
import { pathToFileURL, fileURLToPath } from 'url';
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

// Détection simple de l'installation de Discord (Stable/PTB/Canary)
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
// Track whether a render is currently active to avoid quitting the app prematurely
let renderActive: boolean = false;
function createWindow() {
  console.log('Debut de createWindow');
  try {
    const iconPath = path.join(__dirname, '../../public/logo/ico/Blender-Launcher-256x256.ico');
  console.log('Chemin icone :', iconPath, fs.existsSync(iconPath) ? 'OK' : 'NON TROUVE');
  // Détermination dynamique du preload (dev : src, prod : dist)
  let preloadPath = path.join(__dirname, '../../dist/preload.js');
  const devPreloadCandidate = path.join(__dirname, '../../src/main/preload.js');
  if (!app.isPackaged && fs.existsSync(devPreloadCandidate)) {
    preloadPath = devPreloadCandidate;
    console.log('Mode dev: utilisation du preload source:', preloadPath);
  } else {
    console.log('Utilisation du preload dist:', preloadPath, fs.existsSync(preloadPath) ? 'OK' : 'NON TROUVE');
  }
    const htmlPath = path.join(__dirname, '../../dist/renderer/index.html');
  console.log('Chemin index.html :', htmlPath, fs.existsSync(htmlPath) ? 'OK' : 'NON TROUVE');

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      frame: false,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
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
// Discord RPC manager (JS module)
// @ts-ignore - pas de declarations TS fournies
import { DiscordRPCManager } from '../../backend/discord_rpc_manager';
// Charger l'appId Discord depuis link.json (packagé via webpack dans dist/renderer)
function loadDiscordAppId(): string {
  try {
    // En dev: lire le fichier source; en prod: lire depuis dist
    const devPath = path.join(__dirname, '../renderer/locales/link.json');
    const prodPath = path.join(__dirname, '../renderer/public/locales/link.json');
    let raw: string | null = null;
    if (fs.existsSync(devPath)) raw = fs.readFileSync(devPath, 'utf-8');
    else if (fs.existsSync(prodPath)) raw = fs.readFileSync(prodPath, 'utf-8');
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.discordAppId === 'string' && obj.discordAppId.trim()) return obj.discordAppId.trim();
    }
  } catch(e) { console.warn('Discord appId: lecture link.json échouée:', e); }
  return '1423463152669954128'; // fallback intégré
}
const DISCORD_APP_ID = loadDiscordAppId();


// Création automatique du fichier config.json à la racine du projet si il n'existe pas
const configPath = path.join(__dirname, '../../config.json');
// Initialisation tardive du manager Discord (apres configPath)
// @ts-ignore
const discordManager = new DiscordRPCManager(configPath);
if (!fs.existsSync(configPath)) {
  console.log('config.json non trouvé, création...');
  fs.writeFileSync(configPath, JSON.stringify({ blenders: [] }, null, 2), 'utf-8');
  console.log('config.json créé à', configPath);
} else {
  console.log('config.json déjà présent.');
}

// Migration: ajouter le champ 'title' aux entrées existantes qui n'en ont pas et bloc discord par defaut
function migrateConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw || '{"blenders":[]}');
    cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
    if (!cfg.discord) {
  cfg.discord = { enabled: false, showFile: true, showTitle: true, showTime: false, appId: DISCORD_APP_ID };
      console.log('Migration: ajout bloc discord par defaut + appId intégré');
    } else {
      if (typeof cfg.discord.enabled !== 'boolean') cfg.discord.enabled = false;
      if (typeof cfg.discord.showFile !== 'boolean') cfg.discord.showFile = true;
      if (typeof cfg.discord.showTitle !== 'boolean') cfg.discord.showTitle = true;
      // showTime est désormais forcé à false (option supprimée)
      cfg.discord.showTime = false;
      // Remplace si placeholder différent de notre ID intégré
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
    
    if (needsUpdate) {
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('Config migrée avec succès (titles + discord)');
    }
  } catch (e) {
    console.error('Erreur lors de la migration du config:', e);
  }
}

// Exécuter la migration
migrateConfig();

app.whenReady().then(() => {
  console.log('App ready, creation de la fenetre...');
  createWindow();
  // Au démarrage: tenter une restauration de warp laissée en plan
  try {
    const userDataDir = app.getPath('userData');
    steamWarp.startupRestore(userDataDir).then((res: any)=>{
      if (res?.restored) console.log('[SteamWarp] Restauration au démarrage effectuée');
    }).catch(()=>{});
  } catch(e) { console.warn('[SteamWarp] startup restore erreur:', e); }
  
  console.log('[IPC] Enregistrement du handler update-executable-title...');

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
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // --- Discord IPC ---
  ipcMain.handle('get-discord-config', async () => {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      return cfg.discord || null;
    } catch (e) {
      console.error('[DiscordRPC] get-discord-config erreur:', e);
      return null;
    }
  });

  // Disponibilité Discord (module + appId)
  ipcMain.handle('get-discord-availability', async () => {
    try {
      // Vérifie module discord-rpc et appId valide
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
      const raw = fs.readFileSync(configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      const prevEnabled = cfg.discord?.enabled;
      cfg.discord = { ...(cfg.discord || {}), ...(partial || {}) };
      // Toujours imposer l'appId interne
      cfg.discord.appId = DISCORD_APP_ID;
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
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
      const raw = fs.readFileSync(configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      return cfg.steam || { enabled: false };
    } catch (e) {
      console.error('[Steam] get-steam-config erreur:', e);
      return { enabled: false };
    }
  });

  ipcMain.handle('update-steam-config', async (_event, partial) => {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      cfg.steam = { ...(cfg.steam || {}), ...(partial || {}) };
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
      if (mainWindow) mainWindow.webContents.send('config-updated');
      return { success: true, steam: cfg.steam };
    } catch (e) {
      console.error('[Steam] update-steam-config erreur:', e);
      return { success: false, error: String(e) };
    }
  });

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

  // Extraction d'icône à la demande depuis un exécutable (comme dans l'ancien dossier)
  ipcMain.handle('get-exe-icon', async (_event, exePath: string) => {
    try {
      if (process.platform !== 'win32') return '';
      if (!exePath || !fs.existsSync(exePath)) return '';
      console.log('[IPC] get-exe-icon demandé pour:', exePath);
      // 0) Tentative via Electron: app.getFileIcon (renvoie un NativeImage)
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
  // On privilégie une taille raisonnable pour la sidebar, mais on tente aussi sans taille si besoin
  let buf = extractIcon(exePath, 64) || extractIcon(exePath, 32) || extractIcon(exePath, 16) || extractIcon(exePath, 256) || extractIcon(exePath);
      if (!buf) {
        console.warn('[IPC] get-exe-icon: aucune icône récupérée pour', exePath);
        return '';
      }
      // Essaye d'abord un DataURL base64 direct, avec détection du mimetype
      try {
        const isPng = buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47; // 89 50 4E 47
        const isIco = buf.length > 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00; // 00 00 01 00
        const mime = isPng ? 'image/png' : (isIco ? 'image/x-icon' : 'application/octet-stream');
        if (mime !== 'application/octet-stream') {
          const dataUrl = `data:${mime};base64,` + buf.toString('base64');
          console.log('[IPC] get-exe-icon OK (dataURL base64) pour:', exePath, 'mime:', mime, 'len:', dataUrl.length);
          return dataUrl;
        }
      } catch {}
      // Fallback: écrire en fichier et renvoyer file://
      const iconsDir = path.join(app.getPath('userData'), 'icons');
      if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
      let mtime = '0';
      try { mtime = String(fs.statSync(exePath).mtimeMs | 0); } catch {}
      const safeName = exePath.replace(/[^a-zA-Z0-9-_\.]/g, '_');
      // Déterminer l'extension appropriée
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

  ipcMain.on('open-folder-dialog', async (event, currentPath) => {
    console.log('Recu : open-folder-dialog, currentPath =', currentPath);
    if (mainWindow) {
      const filters: Electron.FileFilter[] =
        process.platform === 'win32'
          ? [{ name: 'Blender Executable', extensions: ['exe'] }]
          : process.platform === 'linux'
          ? [{ name: 'Blender Executable', extensions: ['AppImage', 'run', ''] }]
          : [];
      const properties: Array<'openFile'> = ['openFile'];
      
      // Si un chemin est fourni, utiliser son dossier parent comme dossier par défaut
      let defaultPath = undefined;
      if (currentPath && typeof currentPath === 'string' && fs.existsSync(currentPath)) {
        defaultPath = path.dirname(currentPath);
        console.log('Ouverture du dialog dans le dossier :', defaultPath);
      }
      
      const result = await dialog.showOpenDialog(mainWindow, {
        properties,
        filters,
        defaultPath
      });
      if (result.canceled || !result.filePaths[0]) return;
      const exePath = result.filePaths[0];
      let iconPath = '';
      try {
        // Extraction de l’icône (Windows uniquement)
        if (process.platform === 'win32') {
          const iconBuffer = extractIcon(exePath, 256) || extractIcon(exePath, 64) || extractIcon(exePath, 32) || extractIcon(exePath, 16);
          if (iconBuffer) {
            // Stocke les icônes dans un dossier persistant (userData)
            const iconsDir = path.join(app.getPath('userData'), 'icons');
            if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
            const iconFile = path.join(iconsDir, `icon_${Date.now()}.png`);
            fs.writeFileSync(iconFile, iconBuffer);
            // URL absolue en file:// pour garantir l'affichage dans le renderer
            iconPath = pathToFileURL(iconFile).toString();
          }
        }
      } catch (e) {
        console.error('Erreur extraction icône :', e);
      }
      // Persist l'import dans config.json
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
        // évite les doublons
        const exists = cfg.blenders.some((b: any) => b.path === exePath);
        if (!exists) {
          const parts = exePath.split(/[\\/]/);
          const exeName = parts[parts.length - 1];
          const title = generateTitle(exeName);
          cfg.blenders.push({ path: exePath, name: exeName, title: title, icon: iconPath || '' });
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
          console.log('Config mise à jour avec un nouvel import');
          // Informe le renderer pour rafraîchir
          if (mainWindow) mainWindow.webContents.send('config-updated');
        } else {
          console.log('Import ignoré, chemin déjà présent dans config');
        }
      } catch (e) {
        console.error('Erreur lors de la mise à jour de config.json :', e);
      }
      // Envoie le chemin du fichier sélectionné + icône au renderer (pour feedback immédiat)
      if (mainWindow) mainWindow.webContents.send('selected-blender-folder', { filePath: exePath, iconPath });
      console.log('Fichier choisi :', exePath, 'Icone :', iconPath);
    }
  });

  ipcMain.on('change-executable', async (event, oldPath) => {
    console.log('Recu : change-executable, oldPath =', oldPath);
    if (mainWindow) {
      const filters: Electron.FileFilter[] =
        process.platform === 'win32'
          ? [{ name: 'Blender Executable', extensions: ['exe'] }]
          : process.platform === 'linux'
          ? [{ name: 'Blender Executable', extensions: ['AppImage', 'run', ''] }]
          : [];
      const properties: Array<'openFile'> = ['openFile'];
      
      // Ouvrir l'explorateur dans le dossier de l'ancien exécutable
      let defaultPath = undefined;
      if (oldPath && typeof oldPath === 'string' && fs.existsSync(oldPath)) {
        defaultPath = path.dirname(oldPath);
        console.log('Ouverture du dialog dans le dossier :', defaultPath);
      }
      
      const result = await dialog.showOpenDialog(mainWindow, {
        properties,
        filters,
        defaultPath
      });
      
      if (result.canceled || !result.filePaths[0]) return;
      const newExePath = result.filePaths[0];
      let iconPath = '';
      
      try {
        // Extraction de l'icône du nouvel exécutable
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
      } catch (e) {
        console.error('Erreur extraction icône :', e);
      }
      
      // Mettre à jour l'exécutable existant dans config.json
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        cfg.blenders = Array.isArray(cfg.blenders) ? cfg.blenders : [];
        
        // Trouver et mettre à jour l'ancien exécutable
        const index = cfg.blenders.findIndex((b: any) => b.path === oldPath);
        if (index !== -1) {
          const parts = newExePath.split(/[\\/]/);
          const exeName = parts[parts.length - 1];
          // Conserver l'ancien titre personnalisé (ne pas le régénérer)
          const previous = cfg.blenders[index];
          const preservedTitle = previous.title || previous.name || generateTitle(exeName);
          cfg.blenders[index] = {
            ...previous,               // préserve d'autres champs éventuels
            path: newExePath,
            name: exeName,
            title: preservedTitle,     // garde l'ancien titre
            icon: iconPath || previous.icon || ''
          };
          console.log('Titre conservé lors du changement d\'exécutable :', preservedTitle);
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
          console.log('Config mise à jour - ancien:', oldPath, '-> nouveau:', newExePath);
          // Informe le renderer avec les détails de la mise à jour
          if (mainWindow) {
            mainWindow.webContents.send('executable-updated', {
              oldPath,
              newExecutable: cfg.blenders[index]
            });
            // Notifier aussi que la config globale a changé pour déclencher les rechargements éventuels
            mainWindow.webContents.send('config-updated');
          }
        } else {
          console.warn('Ancien exécutable non trouvé dans la config:', oldPath);
        }
      } catch (e) {
        console.error('Erreur lors de la mise à jour de config.json :', e);
      }
      
      console.log('Exécutable changé :', oldPath, '->', newExePath, 'Icone :', iconPath);
    }
  });

  // Suppression d'un exécutable de la config (handle pour obtenir un résultat direct)
  ipcMain.handle('delete-exécutable', async (_event, payload) => {
    try {
      const targetPathRaw = typeof payload === 'string' ? payload : payload?.path;
      if (!targetPathRaw) {
        console.warn('[IPC] delete-executable: chemin manquant');
        return { success: false, reason: 'missing-path' };
      }
      // Normalisation chemin (Windows: insensibilité à la casse + backslashes)
      const normalize = (p: string) => {
        try {
          let r = path.resolve(p);
          if (process.platform === 'win32') r = r.toLowerCase();
          return r;
        } catch { return p; }
      };
      const targetPath = normalize(targetPathRaw);
      const raw = fs.readFileSync(configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{"blenders":[]}');
      if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
      const before = cfg.blenders.length;
      console.log('[IPC] delete-executable: tentative suppression', targetPathRaw, 'normalisé =', targetPath, 'total entrées =', before);
      cfg.blenders.forEach((b:any,i:number)=>{
        console.log('  >> entrée', i, 'path=', b.path, 'norm=', normalize(b.path));
      });
      // Tentatives de correspondance avancées
      const targetFileName = path.basename(targetPathRaw).toLowerCase();
      let matchedIndex = cfg.blenders.findIndex((b:any) => normalize(b.path) === targetPath);
      if (matchedIndex === -1) {
        matchedIndex = cfg.blenders.findIndex((b:any) => path.basename(b.path).toLowerCase() === targetFileName);
        if (matchedIndex !== -1) console.log('[IPC] delete-executable: correspondance par nom de fichier');
      }
      if (matchedIndex === -1) {
        // Essai realpath
        try {
          const realTarget = fs.realpathSync.native ? fs.realpathSync.native(targetPathRaw) : fs.realpathSync(targetPathRaw);
          const realNorm = normalize(realTarget);
          matchedIndex = cfg.blenders.findIndex((b:any)=>{
            try { return normalize(fs.realpathSync(b.path)) === realNorm; } catch { return false; }
          });
          if (matchedIndex !== -1) console.log('[IPC] delete-executable: correspondance par realpath');
        } catch {}
      }
      if (matchedIndex === -1) {
        console.log('[IPC] delete-executable: aucune entrée correspondante trouvée');
        if (mainWindow) mainWindow.webContents.send('executable-deleted', { path: targetPathRaw, found: false });
        return { success: false, reason: 'not-found' };
      }
      const removed = cfg.blenders.splice(matchedIndex, 1)[0];
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('[IPC] delete-executable: supprimé index', matchedIndex, '->', removed.path);
      if (mainWindow) {
        mainWindow.webContents.send('config-updated');
        mainWindow.webContents.send('executable-deleted', { path: removed.path, found: true });
      }
      return { success: true };
    } catch (e) {
      console.error('[IPC] delete-executable erreur:', e);
      return { success: false, reason: 'exception', error: String(e) };
    }
  });

  // Listener legacy pour compatibilité avec send('delete-executable', ...) si le preload n'a pas encore la whitelist invoke mise à jour
  ipcMain.on('delete-executable', async (event, payload) => {
    console.log('[IPC] delete-executable (legacy on) déclenché - configPath =', configPath);
    const res = await (async () => {
      try {
        const targetPathRaw = typeof payload === 'string' ? payload : payload?.path;
        if (!targetPathRaw) {
          console.warn('[IPC] delete-executable legacy: chemin manquant');
          event.sender.send('executable-deleted', { path: payload?.path, found: false });
          return { success: false };
        }
        const normalize = (p: string) => {
          try { let r = path.resolve(p); if (process.platform === 'win32') r = r.toLowerCase(); return r; } catch { return p; }
        };
        const targetPath = normalize(targetPathRaw);
        const raw = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
        const targetFileName = path.basename(targetPathRaw).toLowerCase();
        let matchedIndex = cfg.blenders.findIndex((b:any) => normalize(b.path) === targetPath);
        if (matchedIndex === -1) matchedIndex = cfg.blenders.findIndex((b:any)=> path.basename(b.path).toLowerCase() === targetFileName);
        if (matchedIndex === -1) {
          try {
            const realTarget = fs.realpathSync.native ? fs.realpathSync.native(targetPathRaw) : fs.realpathSync(targetPathRaw);
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
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
        console.log('[IPC] delete-executable legacy: supprimé', removed.path);
        event.sender.send('config-updated');
        event.sender.send('executable-deleted', { path: removed.path, found: true });
        return { success: true };
      } catch (e) {
        console.error('[IPC] delete-executable legacy erreur:', e);
        return { success: false };
      }
    })();
    // Optionnel: renvoyer un résultat direct via canal séparé si nécessaire
    event.sender.send('delete-executable-result', res);
  });

  ipcMain.on('launch-blender', async (event, exePath) => {
    try {
      const rawCfg = fs.readFileSync(configPath, 'utf-8');
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
        const raw = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        const entry = (cfg.blenders||[]).find((b:any)=> b.path === exePath);
        // Essai extraction version (ex: Blender 4.1, 4.2, etc.)
        let version = null;
        const m = exePath.match(/(\d+\.\d+)/);
        if (m) version = m[1].replace('.', ''); // 4.1 -> 41
        discordManager.setActivity({ blenderTitle: entry?.title || entry?.name || 'Blender', fileName: null, version });
        discordManager.init();
      }
    } catch(e) { console.warn('[DiscordRPC] Maj presence launch erreur:', e); }
  });

  ipcMain.handle('update-executable-title', async (event, payload) => {
    console.log('[IPC] update-executable-title reçu avec payload:', payload);
    
    const exePath = payload?.path;
    const newTitle = payload?.title;
    console.log('[IPC] Extraction - path:', exePath, 'title:', newTitle);
    
    if (!exePath || !newTitle) {
      console.error('[IPC] Paramètres manquants - path:', exePath, 'title:', newTitle);
      return { success: false, error: 'Paramètres manquants' };
    }
    
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
        const idx = cfg.blenders.findIndex((b: any) => b.path === exePath);
        if (idx === -1) {
          console.warn('[IPC] update-executable-title: exécutable introuvable dans config:', exePath);
          return { success: false, error: 'Exécutable introuvable' };
        }
        const old = { ...cfg.blenders[idx] };
        cfg.blenders[idx].title = newTitle;
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
        console.log('[IPC] Titre mis à jour dans config.json:', old.title, '->', newTitle);
        if (mainWindow) {
          // notifier liste globale et élément individuel
          mainWindow.webContents.send('config-updated');
          mainWindow.webContents.send('executable-updated', { oldPath: exePath, newExecutable: cfg.blenders[idx] });
        }
        return { success: true, message: 'Titre sauvegardé', updated: cfg.blenders[idx] };
      } catch (e) {
        console.error('[IPC] Erreur update-executable-title:', e);
        return { success: false, error: String(e) };
      }
  });

  // Disponibilité de Blender via Steam pour les Settings
  ipcMain.handle('get-steam-availability', async () => {
    try {
      const dir = steamWarp.findBlenderSteamDir && steamWarp.findBlenderSteamDir();
      if (dir && fs.existsSync(dir)) {
        return { available: true, path: dir };
      }
      return { available: false };
    } catch (e) {
      return { available: false, error: String(e) };
    }
  });

  // Répond à la requête du renderer pour obtenir la liste des applications
  ipcMain.handle('get-blenders', async () => {
  try {
    console.log('[IPC] get-blenders appelé');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw || '{"blenders":[]}');
    const list = Array.isArray(cfg.blenders) ? cfg.blenders : [];
    // Normalise les chemins d'icône en URL file:// si possible
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

      // 1) Si b.icon est une URL file://, vérifier que le fichier existe et convertir en DataURL
      if (typeof b.icon === 'string' && b.icon.startsWith('file://')) {
        try {
          const p = fileURLToPath(b.icon);
          console.log('[IPC] get-blenders: Traitement icône file://', b.icon, '-> chemin local:', p);
          if (fs.existsSync(p)) {
            // Convertir le fichier en DataURL base64
            const buffer = fs.readFileSync(p);
            console.log('[IPC] get-blenders: Icône convertie en DataURL pour', b.name, '(taille:', buffer.length, 'bytes)');
            // Ne convertir que si le buffer n'est pas vide
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

      // 2) Si b.icon est une chaîne non vide, tenter de la résoudre par nom de fichier
      if (typeof b.icon === 'string' && b.icon.length > 0 && !b.icon.startsWith('data:')) {
        const base = path.basename(b.icon);
        const c1 = path.join(userIconsDir, base);
        const c2 = path.join(distIconsDir, base);
        if (fs.existsSync(c1)) { setIcon(c1); return b; }
        if (fs.existsSync(c2)) { setIcon(c2); return b; }
      }

      // 3) Tente DataURL via app.getFileIcon (priorité car plus fiable)
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

      // 4) Fallback: ré-extrait l'icône depuis l'exécutable avec extract-file-icon
      try {
        if (process.platform === 'win32' && fs.existsSync(b.path)) {
          console.log('[IPC] get-blenders: Tentative extract-file-icon pour', b.name);
          const iconBuffer = extractIcon(b.path, 256) || extractIcon(b.path, 64) || extractIcon(b.path, 32) || extractIcon(b.path, 16);
          if (iconBuffer && iconBuffer.length > 0) {
            console.log('[IPC] get-blenders: Buffer extrait pour', b.name, '(taille:', iconBuffer.length, 'bytes)');
            // Convertir directement en DataURL base64
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
      } catch (e) {
        console.warn('Ré-extraction icône échouée pour', b.name, ':', e);
      }
      // 5) Pas d'icône trouvée; laisser tel quel (le renderer décidera)
      return b;
    };

    const mapped: any[] = [];
    for (const b of list) {
      mapped.push(await ensureIcon(b));
    }
    if (updated) {
      try {
        fs.writeFileSync(configPath, JSON.stringify({ blenders: mapped }, null, 2), 'utf-8');
        console.log('[IPC] config.json mis à jour avec des icônes normalisées');
      } catch (e) {
        console.warn('Impossible d\'écrire config.json après normalisation des icônes:', e);
      }
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
      const res = await blenderScanner.scanAndMerge(configPath);
      if (res?.success) {
        // Notifier UI que la config a été mise à jour
        try { mainWindow?.webContents.send('config-updated'); } catch {}
      }
      return res;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });

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
        const rawCfg = fs.readFileSync(configPath, 'utf-8');
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
        const raw = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(raw || '{"blenders":[]}');
        const entry = (cfg.blenders||[]).find((b:any)=> b.path === exePath);
        const fileName = path.basename(blendPath);
        let version = null;
        const m = exePath.match(/(\d+\.\d+)/);
        if (m) version = m[1].replace('.', '');
        discordManager.setActivity({ blenderTitle: entry?.title || entry?.name || 'Blender', fileName, version });
        discordManager.init();
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

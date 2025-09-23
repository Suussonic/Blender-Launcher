
console.log('Chargement des modules Electron...');
import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon from 'extract-file-icon';
import { pathToFileURL, fileURLToPath } from 'url';
console.log('Modules Electron charges.');


let mainWindow: BrowserWindow | null = null;
function createWindow() {
  console.log('Debut de createWindow');
  try {
    const iconPath = path.join(__dirname, '../../public/logo/ico/Blender-Launcher-256x256.ico');
  console.log('Chemin icone :', iconPath, fs.existsSync(iconPath) ? 'OK' : 'NON TROUVE');
  const preloadPath = path.join(__dirname, '../../dist/preload.js');
  console.log('Chemin preload :', preloadPath, fs.existsSync(preloadPath) ? 'OK' : 'NON TROUVE');
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


// Création automatique du fichier config.json à la racine du projet si il n'existe pas
const configPath = path.join(__dirname, '../../config.json');
if (!fs.existsSync(configPath)) {
  console.log('config.json non trouvé, création...');
  fs.writeFileSync(configPath, JSON.stringify({ blenders: [] }, null, 2), 'utf-8');
  console.log('config.json créé à', configPath);
} else {
  console.log('config.json déjà présent.');
}

app.whenReady().then(() => {
  console.log('App ready, creation de la fenetre...');
  createWindow();

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
          cfg.blenders.push({ path: exePath, name: exeName, icon: iconPath || '' });
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
          cfg.blenders[index] = { 
            path: newExePath, 
            name: exeName, 
            icon: iconPath || cfg.blenders[index].icon || '' 
          };
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
          console.log('Config mise à jour - ancien:', oldPath, '-> nouveau:', newExePath);
          // Informe le renderer avec les détails de la mise à jour
          if (mainWindow) {
            mainWindow.webContents.send('executable-updated', {
              oldPath,
              newExecutable: cfg.blenders[index]
            });
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

  ipcMain.on('launch-blender', (event, exePath) => {
    console.log('Lancement de Blender :', exePath);
    const { execFile } = require('child_process');
    execFile(exePath, (error: any) => {
      if (error) {
        console.error('Erreur lors du lancement de Blender :', error);
      }
    });
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
});


app.on('window-all-closed', () => {
  console.log('Toutes les fenetres sont fermees');
  if (process.platform !== 'darwin') {
  console.log('Fermeture de l application');
    app.quit();
  }
});

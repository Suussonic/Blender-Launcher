
console.log('Chargement des modules Electron...');
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import extractIcon from 'extract-file-icon';
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

  ipcMain.on('open-folder-dialog', async (event) => {
    console.log('Recu : open-folder-dialog');
    if (mainWindow) {
      const filters: Electron.FileFilter[] =
        process.platform === 'win32'
          ? [{ name: 'Blender Executable', extensions: ['exe'] }]
          : process.platform === 'linux'
          ? [{ name: 'Blender Executable', extensions: ['AppImage', 'run', ''] }]
          : [];
      const properties: Array<'openFile'> = ['openFile'];
      const result = await dialog.showOpenDialog(mainWindow, {
        properties,
        filters
      });
      if (result.canceled || !result.filePaths[0]) return;
      const exePath = result.filePaths[0];
      let iconPath = '';
      try {
        // Extraction de l’icône (Windows uniquement)
        if (process.platform === 'win32') {
          const iconBuffer = extractIcon(exePath, 256) || extractIcon(exePath, 64) || extractIcon(exePath, 32) || extractIcon(exePath, 16);
          if (iconBuffer) {
            const iconsDir = path.join(__dirname, '../../dist/renderer/icons');
            if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
            const iconFile = path.join(iconsDir, `icon_${Date.now()}.png`);
            fs.writeFileSync(iconFile, iconBuffer);
            // Chemin relatif pour le renderer (./icons/xxx.png)
            iconPath = `./icons/${path.basename(iconFile)}`;
          }
        }
      } catch (e) {
        console.error('Erreur extraction icône :', e);
      }
      // Envoie le chemin du fichier sélectionné + icône au renderer
      mainWindow.webContents.send('selected-blender-folder', { filePath: exePath, iconPath });
      console.log('Fichier choisi :', exePath, 'Icone :', iconPath);
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
});


app.on('window-all-closed', () => {
  console.log('Toutes les fenetres sont fermees');
  if (process.platform !== 'darwin') {
  console.log('Fermeture de l application');
    app.quit();
  }
});

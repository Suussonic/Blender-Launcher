
console.log('Chargement des modules Electron...');
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
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
});


app.on('window-all-closed', () => {
  console.log('Toutes les fenetres sont fermees');
  if (process.platform !== 'darwin') {
  console.log('Fermeture de l application');
    app.quit();
  }
});

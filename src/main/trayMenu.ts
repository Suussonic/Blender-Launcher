import { app, BrowserWindow, Menu, Tray, screen, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;

function resolveTrayHtml(): string {
  const appRoot = app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(process.cwd());
  const candidates = [
    path.join(appRoot, 'dist', 'tray', 'index.html'),
    path.join(appRoot, 'src', 'tray', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[candidates.length - 1];
}

function resolveTrayIcon(): string {
  const appRoot = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
  const candidates = [
    // Prefer ICO for Windows tray for best scaling
    path.join(appRoot, 'public', 'logo', 'ico', 'Blender-Launcher-512x512.ico'),
    path.join(appRoot, 'public', 'logo', 'ico', 'Blender-Launcher-256x256.ico'),
    path.join(appRoot, 'public', 'logo', 'ico', 'Blender-Launcher-128x128.ico'),
    path.join(appRoot, 'public', 'logo', 'ico', 'Blender-Launcher-64x64.ico'),
    path.join(appRoot, 'public', 'logo', 'png', 'Blender-Launcher-64x64.png'),
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return candidates[0];
}

function resolveTrayPreload(): string {
  // Try dist path first (when packaged), then dev source locations
  const candidates = [
    path.join(__dirname, '..', 'tray', 'preload.js'),                 // dist: dist/main/../tray/preload.js => dist/tray/preload.js
    path.join(process.cwd(), 'dist', 'tray', 'preload.js'),           // cwd dist fallback
    path.join(process.cwd(), 'src', 'main', 'tray', 'preload.js'),    // dev source
    path.join(__dirname, '../../src/main/tray/preload.js'),           // another dev-resolve relative to dist/main
  ];
  for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch {} }
  return candidates[0];
}

function getPopupPosition(width = 340, height = 520) {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const taskbarMargin = 12;
  let x = cursor.x - Math.floor(width / 2);
  let y = cursor.y - height - taskbarMargin;
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  if (x < dx) x = dx + 8;
  if (x + width > dx + dw) x = dx + dw - width - 8;
  if (y < dy) y = dy + taskbarMargin;
  return { x, y };
}

export function initTrayMenu(getMainWindow: () => BrowserWindow | null, ensureMainWindow?: () => BrowserWindow | null) {
  if (tray) return;
  const iconPath = resolveTrayIcon();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const fallbackMenu = Menu.buildFromTemplate([
    { label: 'Accueil', click: () => getMainWindow()?.webContents.send('navigate-home') },
    { label: 'Paramètres', click: () => getMainWindow()?.webContents.send('open-settings') },
    { type: 'separator' },
    { label: 'Quitter', role: 'quit' },
  ]);
  tray.setToolTip('Blender Launcher');
  tray.setContextMenu(fallbackMenu);

  trayWindow = new BrowserWindow({
    width: 340,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: resolveTrayPreload(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  trayWindow.setMenu(null);
  trayWindow.loadFile(resolveTrayHtml()).catch(() => {});

  const togglePopup = () => {
    if (!trayWindow) return;
    if (trayWindow.isVisible()) { trayWindow.hide(); return; }
    const { x, y } = getPopupPosition(340, 520);
    trayWindow.setPosition(x, y, false);
    trayWindow.showInactive();
    try { trayWindow.webContents.send('tray-refresh'); } catch {}
  };
  tray.on('click', togglePopup);
  tray.on('right-click', togglePopup);
  trayWindow.on('blur', () => trayWindow?.hide());

  // IPC
  ipcMain.on('tray-open-home', () => {
    const mw = (ensureMainWindow ? ensureMainWindow() : getMainWindow());
    try { mw?.show(); mw?.focus(); } catch {}
    try { mw?.webContents.send('navigate-home'); } catch {}
    trayWindow?.hide();
  });
  ipcMain.on('tray-open-settings', () => {
    const mw = (ensureMainWindow ? ensureMainWindow() : getMainWindow());
    try { mw?.show(); mw?.focus(); } catch {}
    try { mw?.webContents.send('open-settings'); } catch {}
    trayWindow?.hide();
  });
  ipcMain.on('tray-quit', () => {
    try {
      // Tell main to allow closing without hiding
      const anyApp: any = app;
      // Access forceQuit flag via global if needed; simpler: emit event
    } catch {}
    try { destroyTrayMenu(); } catch {}
    app.quit();
  });

  const { spawn } = require('child_process');
  ipcMain.on('tray-launch-blender', async (_evt, payload: { exePath: string }) => {
    try {
      if (!payload?.exePath) return;
      const child = spawn(payload.exePath, [], { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
      trayWindow?.hide();
      const mw = getMainWindow();
      mw?.webContents.send('toast', { type: 'info', text: 'Blender lancé.' });
    } catch (e) {
      const mw = getMainWindow();
      mw?.webContents.send('toast', { type: 'error', text: 'Échec du lancement de Blender.' });
    }
  });

  ipcMain.on('tray-hide', () => trayWindow?.hide());
}

export function destroyTrayMenu() {
  try { trayWindow?.destroy(); } catch {}
  trayWindow = null;
  try { tray?.destroy(); } catch {}
  tray = null;
}

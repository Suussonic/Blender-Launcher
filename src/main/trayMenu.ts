import { app, BrowserWindow, Menu, Tray, screen, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function resolveTrayHtml(): string {
  const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
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
  const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
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
  // Try to anchor to the tray icon bounds when available (more stable on Windows taskbar)
  try {
    if (tray && typeof (tray as any).getBounds === 'function') {
      const b = (tray as any).getBounds();
      // Center horizontally on the tray icon
      let x = Math.floor(b.x + (b.width / 2) - (width / 2));
      // Place the popup above the icon with a small extra offset to avoid overlapping Windows overflow popup
      const extraUp = 10; // raise popup a bit higher
      let y = Math.floor(b.y - height - extraUp);
      // Ensure within display work area
      const display = screen.getDisplayNearestPoint({ x: b.x, y: b.y });
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
      if (x < dx) x = dx + 8;
      if (x + width > dx + dw) x = dx + dw - width - 8;
      if (y < dy) y = dy + 8;
      return { x, y };
    }
  } catch (e) { /* fallback to cursor-based positioning */ }

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
  // Do not set a native context menu here because we want to show a custom HTML popup
  // on right-click. The fallbackMenu is kept for reference but won't be bound by default.

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

  // Create an overlay window to catch outside clicks and close the tray popup
  try {
    const display = screen.getPrimaryDisplay();
    overlayWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: resolveTrayPreload(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    overlayWindow.setMenu(null);
    overlayWindow.setIgnoreMouseEvents(false);
    // Load overlay HTML if available (dist first, then src)
    const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
    const overlayCandidates = [
      path.join(appRoot, 'dist', 'tray', 'overlay.html'),
      path.join(appRoot, 'src', 'tray', 'overlay.html'),
    ];
    for (const p of overlayCandidates) {
      try { if (fs.existsSync(p)) { overlayWindow.loadFile(p).catch(() => {}); break; } } catch (e) {}
    }
  } catch (e) { overlayWindow = null; }

  // Pipe tray window console messages to a log file for packaged debugging
  try {
    const userData = app.getPath('userData');
    const trayLog = path.join(userData, 'bl-launcher-tray.log');
    trayWindow.webContents.on('console-message', (_evt: any, level: number, message: string, line: number, sourceId: string) => {
      try {
        const entry = `[${new Date().toISOString()}] [level:${level}] ${message} (source:${sourceId}:${line})\n`;
        fs.appendFileSync(trayLog, entry);
      } catch (e) { /* best-effort */ }
    });
    // Also forward unhandled exceptions from the tray renderer
    // Handle renderer process exit/crash in a typed-safe way
    trayWindow.webContents.on('render-process-gone', (_evt: any, details: any) => {
      try {
        const entry = `[${new Date().toISOString()}] tray render-process-gone: type=${details?.type} reason=${details?.reason} \n`;
        fs.appendFileSync(trayLog, entry);
      } catch (e) { /* best-effort */ }
    });
    // Optionally open DevTools if TRAY_DEBUG env var is set
    if (process.env.TRAY_DEBUG === '1') {
      try { trayWindow.webContents.openDevTools({ mode: 'detach' }); } catch (e) {}
    }
  } catch (e) { /* non-fatal */ }

  let _lastToggleMs = 0;
  const togglePopup = (pos?: { x: number; y: number }) => {
    const now = Date.now();
    if (now - _lastToggleMs < 200) return; // debounce rapid double events
    _lastToggleMs = now;

    if (!trayWindow) return;
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'bl-launcher-tray.log'), `[${new Date().toISOString()}] togglePopup called pos=${JSON.stringify(pos)} visible=${trayWindow.isVisible()}\n`); } catch {}
    if (trayWindow.isVisible()) {
      trayWindow.hide();
      try { fs.appendFileSync(path.join(app.getPath('userData'), 'bl-launcher-tray.log'), `[${new Date().toISOString()}] hide popup\n`); } catch {}
      try { if (overlayWindow && overlayWindow.isVisible()) overlayWindow.hide(); } catch {}
      return;
    }
    let x: number, y: number;
    const width = 340, height = 520;
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      // Position the popup centered horizontally on the tray icon and well above the icon
      x = Math.floor(pos.x - width / 2);
  // Use a slightly larger upward offset so the popup appears clearly above the taskbar/overflow
  const extraUp = 42; // small tweak: a bit lower than previous 52
      y = Math.floor(pos.y - height - extraUp);
    } else {
      const p = getPopupPosition(width, height);
      x = p.x; y = p.y;
    }
    // Clamp to visible work area
    try {
      const display = screen.getDisplayNearestPoint({ x, y });
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
      if (x < dx) x = dx + 8;
      if (x + width > dx + dw) x = dx + dw - width - 8;
      if (y < dy) y = dy + 8;
    } catch (e) {}

    // Try to ensure the popup is above system UI by using the pop-up-menu level
    try {
      trayWindow.setAlwaysOnTop(true, 'pop-up-menu');
      trayWindow.setVisibleOnAllWorkspaces(true);
    } catch (e) {}

    trayWindow.setPosition(x, y, false);
    // Show overlay first so clicks outside the popup close it
    try {
      if (overlayWindow) {
        const displayForOverlay = screen.getDisplayNearestPoint({ x, y });
        overlayWindow.setBounds({ x: displayForOverlay.bounds.x, y: displayForOverlay.bounds.y, width: displayForOverlay.bounds.width, height: displayForOverlay.bounds.height });
        overlayWindow.showInactive();
      }
    } catch (e) {}
    // Use showInactive to avoid stealing focus while keeping the popup visible above the taskbar
    try { trayWindow.showInactive(); } catch { try { trayWindow.show(); } catch {} }
    try { trayWindow.webContents.send('tray-refresh'); } catch {}
  };

  // Left-click: open main window (Accueil). Right-click: show tray popup
  tray.on('click', () => {
    const mw = (ensureMainWindow ? ensureMainWindow() : getMainWindow());
    try { mw?.show(); mw?.focus(); } catch {}
    try { mw?.webContents.send('navigate-home'); } catch {}
  });
  // Use mouse-up to reliably detect right-button release; avoid using both 'right-click' and
  // 'mouse-up' which can trigger twice on some platforms and cause a flicker.
  tray.on('mouse-up', (event: any, bounds: any) => {
    try {
      try { fs.appendFileSync(path.join(app.getPath('userData'), 'bl-launcher-tray.log'), `[${new Date().toISOString()}] mouse-up event button=${event?.button} bounds=${JSON.stringify(bounds)}\n`); } catch {}
      if (event && (event.button === 2 || event.button === 3)) {
        if (bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number') {
          togglePopup({ x: bounds.x + Math.floor(bounds.width / 2), y: bounds.y + bounds.height });
        } else {
          togglePopup();
        }
      }
    } catch (e) { /* best-effort */ }
  });
  // right-click fallback: some Windows setups fire 'right-click' instead of mouse-up
  tray.on('right-click', (event: any, bounds: any) => {
    try {
      try { fs.appendFileSync(path.join(app.getPath('userData'), 'bl-launcher-tray.log'), `[${new Date().toISOString()}] right-click event bounds=${JSON.stringify(bounds)}\n`); } catch {}
      if (bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number') {
        togglePopup({ x: bounds.x + Math.floor(bounds.width / 2), y: bounds.y + bounds.height });
      } else {
        togglePopup();
      }
    } catch (e) { /* best-effort */ }
  });
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
  // Also hide overlay when requested
  ipcMain.on('tray-hide', () => { try { overlayWindow?.hide(); } catch {} });
}

export function destroyTrayMenu() {
  try { trayWindow?.destroy(); } catch {}
  trayWindow = null;
  try { tray?.destroy(); } catch {}
  tray = null;
}

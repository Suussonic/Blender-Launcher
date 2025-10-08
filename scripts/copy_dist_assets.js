const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

function copyFile(srcFile, dstFile) {
  try {
    const dir = path.dirname(dstFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcFile, dstFile);
    console.log('Copied', srcFile, '->', dstFile);
  } catch (e) {
    console.warn('Failed to copy', srcFile, '->', dstFile, e.message);
  }
}

// Copy main preload if present
const preloadSrc = path.join(src, 'main', 'preload.js');
const preloadDst = path.join(dist, 'preload.js');
if (fs.existsSync(preloadSrc)) copyFile(preloadSrc, preloadDst);

// Copy tray folder (if present) to dist/tray
const traySrc = path.join(root, 'src', 'tray');
const trayDst = path.join(dist, 'tray');
function copyDir(s, d) {
  if (!fs.existsSync(s)) return;
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  for (const item of fs.readdirSync(s)) {
    const si = path.join(s, item);
    const di = path.join(d, item);
    const st = fs.statSync(si);
    if (st.isDirectory()) {
      copyDir(si, di);
    } else {
      copyFile(si, di);
    }
  }
}
copyDir(traySrc, trayDst);

// Also copy the tray preload from src/main/tray (where it's located) -> dist/tray/preload.js
const trayPreloadSrc = path.join(root, 'src', 'main', 'tray', 'preload.js');
const trayPreloadDst = path.join(dist, 'tray', 'preload.js');
if (fs.existsSync(trayPreloadSrc)) copyFile(trayPreloadSrc, trayPreloadDst);

// Also copy any public assets that might be referenced directly (safe no-op if already present)
const publicSrc = path.join(root, 'public');
const publicDst = path.join(dist, 'public');
copyDir(publicSrc, publicDst);

console.log('copy_dist_assets done');

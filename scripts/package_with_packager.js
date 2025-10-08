const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'release', 'packager-staging');

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dest, f));
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Clean staging
if (fs.existsSync(out)) {
  fs.rmSync(out, { recursive: true, force: true });
}
fs.mkdirSync(out, { recursive: true });

// Files to include in package - mirror build.files from package.json build config
const include = ['dist', 'backend', 'package.json', 'public'];
for (const p of include) {
  const src = path.join(root, p);
  if (!fs.existsSync(src)) continue;
  copy(src, path.join(out, p));
}

// Copy node_modules for production dependencies only
const pkg = require(path.join(root, 'package.json'));
const prodDeps = Object.assign({}, pkg.dependencies || {});
if (Object.keys(prodDeps).length > 0) {
  const nodeModulesOut = path.join(out, 'node_modules');
  fs.mkdirSync(nodeModulesOut, { recursive: true });
  for (const dep of Object.keys(prodDeps)) {
    const src = path.join(root, 'node_modules', dep);
    const dest = path.join(nodeModulesOut, dep);
    if (fs.existsSync(src)) copy(src, dest);
  }
}

// Run electron-packager against staging dir
const appName = process.argv[2] || 'Blender Launcher';
try {
  const cmd = `npx electron-packager "${out}" "${appName}" --platform=win32 --arch=x64 --out=..\\..\\release --overwrite --asar --electron-version=${process.env.ELECTRON_VERSION || '38.1.0'}`;
  console.log('Running:', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: out });
  console.log('Packager finished.');
} catch (err) {
  console.error('Packager failed:', err && err.message ? err.message : err);
  process.exit(1);
}

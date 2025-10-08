const packager = require('electron-packager');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

async function run() {
  const root = process.cwd();
  const outDir = path.join(root, 'release');
  console.log('Building unpacked app with electron-packager...');
  const opts = {
    dir: root,
    out: outDir,
    overwrite: true,
    platform: 'win32',
    arch: 'x64',
    executableName: 'Blender Launcher',
    ignore: [
      '^/src',
      '^/scripts',
      '^/\.git',
      '^/\.vscode',
      '^/release'
    ],
    electronVersion: '38.1.0',
    asar: false
  };

  const apps = await packager(opts);
  if (!apps || apps.length === 0) throw new Error('No app produced by packager');
  const appPath = apps[0];
  console.log('Packager produced:', appPath);

  // Create a zip (portable) next to release
  const baseName = path.basename(appPath);
  const zipPath = path.join(outDir, `${baseName}-portable.zip`);
  console.log('Creating portable zip:', zipPath);

  await zipFolder(appPath, zipPath);
  console.log('Portable zip created at', zipPath);
}

function zipFolder(sourceDir, outPath) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive
      .directory(sourceDir, false)
      .on('error', err => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

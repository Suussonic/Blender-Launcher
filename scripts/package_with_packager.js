const packager = require('electron-packager');
const path = require('path');

(async () => {
  try {
    // Ensure build has run (caller should run npm run build)
    const opts = {
      dir: path.resolve('.'),
      out: path.resolve('release'),
      name: 'Blender Launcher',
      platform: 'win32',
      arch: 'x64',
      overwrite: true,
      electronVersion: '38.1.0',
      ignore: [/^src($|\/)/, /^scripts($|\/)/, /^\.git($|\/)/, /^\.vscode($|\/)/],
      // Set Windows metadata so CompanyName is not GitHub, Inc.
      win32metadata: {
        CompanyName: 'Suussonic',
        FileDescription: 'Blender Launcher',
        ProductName: 'Blender Launcher'
      },
      icon: path.join(__dirname, '..', 'public', 'logo', 'ico', 'Blender-Launcher-256x256.ico')
    };
    console.log('Packaging with options:', opts);
    const appPaths = await packager(opts);
    console.log('Packaging complete:', appPaths);
  } catch (e) {
    console.error('Packaging failed:', e);
    process.exit(1);
  }
})();


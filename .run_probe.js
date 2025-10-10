const { spawn } = require('child_process');
const path = require('path');

const exe = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe';
const script = path.join(process.cwd(), 'backend', 'blender_addons_probe.py');
console.log('Using exe:', exe);
console.log('Using script:', script);

if (!require('fs').existsSync(exe)) {
  console.error('Blender exe not found at', exe);
  process.exit(2);
}
if (!require('fs').existsSync(script)) {
  console.error('Probe script not found at', script);
  process.exit(2);
}

const child = spawn(exe, ['--background', '--python', script], { windowsHide: true });
let out = '';
let err = '';
const to = setTimeout(() => {
  try { child.kill(); } catch {}
}, 30000);
child.stdout.on('data', d => out += d.toString());
child.stderr.on('data', d => err += d.toString());
child.on('error', e => { clearTimeout(to); console.error('spawn error', e); process.exit(1); });
child.on('close', code => {
  clearTimeout(to);
  console.log('\n--- CHILD EXIT CODE ---\n', code);
  console.log('\n--- STDOUT (truncated 10000 chars) ---\n');
  console.log(out.substring(0, 10000));
  console.log('\n--- STDERR (truncated 10000 chars) ---\n');
  console.log(err.substring(0, 10000));
  try {
    const s = out || '';
    const start = s.indexOf('@@ADDONS_JSON_START@@');
    const end = s.indexOf('@@ADDONS_JSON_END@@', start >= 0 ? start : 0);
    if (start >= 0 && end > start) {
      const j = s.substring(start + '@@ADDONS_JSON_START@@'.length, end).trim();
      const parsed = JSON.parse(j);
      console.log('\n--- PARSED JSON COUNT ---\n', Array.isArray(parsed) ? parsed.length : typeof parsed);
      if (Array.isArray(parsed)) {
        console.log('First 5 entries (module, name, enabled):');
        parsed.slice(0,5).forEach((p, i) => console.log(i+1, p.module, ' / ', p.name, ' / enabled=', p.enabled));
      }
    } else {
      console.log('\nNo markers found in stdout.');
    }
  } catch (e) { console.error('JSON parse error', e); }
  process.exit(0);
});

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function log(...args) { try { console.log('[BlenderScanner]', ...args); } catch {} }

function norm(p) { try { return path.resolve(p).toLowerCase(); } catch { return (p||'').toLowerCase(); } }

function safeJSONRead(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }
function safeJSONWrite(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8'); }

function candidatesFromProgramFiles() {
  const out = [];
  const roots = new Set();
  const pf = process.env['ProgramFiles'];
  const pf86 = process.env['ProgramFiles(x86)'];
  if (pf) roots.add(pf);
  if (pf86) roots.add(pf86);
  // Common vendor folders
  for (const r of roots) {
    const blenderFoundation = path.join(r, 'Blender Foundation');
    if (fs.existsSync(blenderFoundation)) {
      try {
        const sub = fs.readdirSync(blenderFoundation, { withFileTypes: true });
        for (const d of sub) {
          if (!d.isDirectory()) continue;
          const exe = path.join(blenderFoundation, d.name, 'blender.exe');
          if (fs.existsSync(exe)) out.push(exe);
        }
      } catch {}
    }
    // Generic quick scan: top-level dirs with blender or goo keywords
    try {
      const sub = fs.readdirSync(r, { withFileTypes: true });
      for (const d of sub) {
        if (!d.isDirectory()) continue;
        const name = d.name.toLowerCase();
        if (name.includes('blender') || name.includes('goo')) {
          const exe = path.join(r, d.name, 'blender.exe');
          if (fs.existsSync(exe)) out.push(exe);
        }
      }
    } catch {}
  }
  return out;
}

function fromRegistry() {
  const res = [];
  const roots = [
    'HKLM/Software/Microsoft/Windows/CurrentVersion/Uninstall',
    'HKLM/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall'
  ];
  for (const root of roots) {
    try {
      const out = cp.execSync(`reg query ${root.replaceAll('/', '\\')} /s`, { stdio: ['ignore','pipe','ignore'] }).toString();
      const blocks = out.split(/\r?\n\r?\n/).map(b => b.trim()).filter(Boolean);
      for (const b of blocks) {
        const low = b.toLowerCase();
        if (!/displayname\s+reg_/i.test(b)) continue;
        if (!(low.includes('blender') || low.includes('goo engine'))) continue;
        let install = null; let icon = null;
        const m1 = b.match(/InstallLocation\s+REG_\w+\s+(.+)$/mi); if (m1) install = m1[1].trim();
        const m2 = b.match(/DisplayIcon\s+REG_\w+\s+(.+)$/mi); if (m2) icon = m2[1].trim();
        if (install) {
          const exe = path.join(install, 'blender.exe');
          if (fs.existsSync(exe)) res.push(exe);
        }
        if (icon) {
          let p = icon.replace(/,\d+$/, '').trim();
          if (p.toLowerCase().endsWith('blender.exe') && fs.existsSync(p)) res.push(p);
        }
      }
    } catch {}
  }
  return res;
}

function fromSteam() {
  try {
    const steamWarp = require('./steam_warp');
    const dir = steamWarp.findBlenderSteamDir && steamWarp.findBlenderSteamDir();
    if (!dir) return [];
    const exe = path.join(dir, 'blender.exe');
    if (fs.existsSync(exe)) return [exe];
    const launcher = path.join(dir, 'blender-launcher.exe');
    if (fs.existsSync(launcher)) return [launcher];
  } catch {}
  return [];
}

function makeTitle(p) {
  const base = path.basename(path.dirname(p)); // parent dir often contains version
  const low = base.toLowerCase();
  const isSteam = p.toLowerCase().includes(path.sep + 'steamapps' + path.sep);
  let title = 'Blender';
  const m = base.match(/(\d+\.\d+)/);
  if (m) title = `Blender ${m[1]}`;
  if (low.includes('goo')) title = base;
  if (isSteam) title = title.includes('Blender') ? `${title} (Steam)` : `${base} (Steam)`;
  return title;
}

function mergeIntoConfig(configPath, paths) {
  const cfg = safeJSONRead(configPath) || { blenders: [] };
  if (!Array.isArray(cfg.blenders)) cfg.blenders = [];
  const existing = new Set(cfg.blenders.map(b => norm(b.path)));
  let added = 0;
  for (const p of paths) {
    const n = norm(p);
    if (!p || existing.has(n)) continue;
    const entry = {
      path: p,
      name: path.basename(p),
      title: makeTitle(p),
    };
    cfg.blenders.push(entry);
    existing.add(n);
    added++;
  }
  if (added > 0) {
    safeJSONWrite(configPath, cfg);
  }
  return { added, total: cfg.blenders.length };
}

async function scanAndMerge(configPath) {
  try {
    const set = new Set();
    const pushAll = (arr) => { for (const p of arr) if (p && fs.existsSync(p)) set.add(path.resolve(p)); };
    pushAll(candidatesFromProgramFiles());
    pushAll(fromRegistry());
    pushAll(fromSteam());
    const result = mergeIntoConfig(configPath, Array.from(set));
    log('Scan terminé. Ajoutés:', result.added, 'Total:', result.total);
    return { success: true, ...result };
  } catch (e) {
    log('Erreur scan:', e);
    return { success: false, error: String(e) };
  }
}

module.exports = { scanAndMerge };

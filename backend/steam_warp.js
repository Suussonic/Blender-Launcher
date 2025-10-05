const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// Simple VDF/ACF parser sufficient for Steam's libraryfolders.vdf and appmanifest files
function parseVDF(text) {
  const tokens = [];
  const len = text.length;
  let i = 0;
  function skipWs() { while (i < len && /[\s\r\n\t]/.test(text[i])) i++; }
  function readString() {
    let s = '';
    i++; // skip opening quote
    while (i < len) {
      const ch = text[i++];
      if (ch === '\\') { if (i < len) s += text[i++]; }
      else if (ch === '"') break;
      else s += ch;
    }
    return s;
  }
  while (i < len) {
    skipWs();
    const ch = text[i];
    if (!ch) break;
    if (ch === '"') { tokens.push({ t: 's', v: readString() }); }
    else if (ch === '{') { tokens.push({ t: '{' }); i++; }
    else if (ch === '}') { tokens.push({ t: '}' }); i++; }
    else { i++; }
  }
  let k = 0;
  function parseObj() {
    const out = {};
    while (k < tokens.length) {
      const tk = tokens[k++]; if (!tk) break;
      if (tk.t === '}') break;
      if (tk.t !== 's') continue;
      const key = tk.v;
      const next = tokens[k++]; if (!next) break;
      if (next.t === 's') out[key] = next.v;
      else if (next.t === '{') out[key] = parseObj();
    }
    return out;
  }
  return parseObj();
}

function logLine(userDataDir, msg) {
  try {
    const p = path.join(userDataDir, 'steam_warp_log.txt');
    fs.mkdirSync(userDataDir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(p, line, 'utf-8');
  } catch {}
}

function getSteamBasePath() {
  // Registry lookup first
  try {
    const out = cp.execSync('reg query HKCU\\Software\\Valve\\Steam /v SteamPath', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const m = out.match(/SteamPath\s+REG_\w+\s+(.+)$/mi);
    if (m && m[1] && fs.existsSync(m[1].trim())) return m[1].trim();
  } catch {}
  const candidates = ['C:/Program Files (x86)/Steam', 'C:/Program Files/Steam'];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return candidates[0];
}

function findBlenderSteamDir() {
  const base = getSteamBasePath();
  const steamappsDefault = path.join(base, 'steamapps');
  // Collect library paths from libraryfolders.vdf
  const libs = new Set([steamappsDefault]);
  try {
    const vdfPath = path.join(steamappsDefault, 'libraryfolders.vdf');
    if (fs.existsSync(vdfPath)) {
      const txt = fs.readFileSync(vdfPath, 'utf-8');
      const v = parseVDF(txt);
      const lf = v.libraryfolders || v.LibraryFolders || v;
      const keys = Object.keys(lf);
      for (const k of keys) {
        const node = lf[k];
        if (node && typeof node === 'object' && node.path) {
          const p = path.join(node.path, 'steamapps');
          if (fs.existsSync(p)) libs.add(p);
        } else if (typeof node === 'string') {
          const p = path.join(node, 'steamapps');
          if (fs.existsSync(p)) libs.add(p);
        }
      }
    }
  } catch {}

  // Search for appmanifest for Blender (365670)
  let selectedSteamapps = null;
  for (const lib of libs) {
    const mf = path.join(lib, 'appmanifest_365670.acf');
    if (fs.existsSync(mf)) { selectedSteamapps = lib; break; }
  }
  if (!selectedSteamapps) return null;
  const manifest = path.join(selectedSteamapps, 'appmanifest_365670.acf');
  try {
    const txt = fs.readFileSync(manifest, 'utf-8');
    const m = parseVDF(txt);
    const installdir = (m.AppState && m.AppState.installdir) || (m.appstate && m.appstate.installdir) || 'Blender';
    const common = path.join(selectedSteamapps, 'common');
    const installPath = path.join(common, installdir);
    if (fs.existsSync(installPath)) return installPath;
    // fallback default
    const fallback = path.join(common, 'Blender');
    return fs.existsSync(fallback) ? fallback : installPath;
  } catch {
    const fallback = path.join(selectedSteamapps, 'common', 'Blender');
    return fs.existsSync(fallback) ? fallback : null;
  }
}

function robocopyMirror(src, dst) {
  return new Promise((resolve) => {
    try {
      fs.mkdirSync(dst, { recursive: true });
    } catch {}
    // Robocopy exit codes: 0,1,2,3,4,5,6,7 are success/semi-success
    const ok = (code) => (typeof code === 'number') && code >= 0 && code <= 7;
    const args = [
      '"' + src + '"',
      '"' + dst + '"',
      '/MIR',
      '/COPY:DAT',
      '/R:2', '/W:1',
      '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
    ];
    const child = cp.spawn('robocopy', args, { shell: true });
    child.on('close', (code) => resolve({ success: ok(code), code }));
    child.on('error', () => resolve({ success: false, code: -1 }));
  });
}

function writeState(userDataDir, state) {
  const p = path.join(userDataDir, 'steam_warp_state.json');
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

function readState(userDataDir) {
  const p = path.join(userDataDir, 'steam_warp_state.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function removeState(userDataDir) {
  const p = path.join(userDataDir, 'steam_warp_state.json');
  try { fs.unlinkSync(p); } catch {}
}

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const entry of fs.readdirSync(p)) rimraf(path.join(p, entry));
    try { fs.rmdirSync(p); } catch {}
  } else {
    try { fs.unlinkSync(p); } catch {}
  }
}

function isAnyProcessRunningInDir(dir) {
  try {
    const ps = cp.execSync('wmic process get ExecutablePath', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/);
    const norm = path.resolve(dir).toLowerCase();
    return ps.some(line => {
      const p = line.trim();
      if (!p) return false;
      const low = p.toLowerCase();
      return low.startsWith(norm);
    });
  } catch {
    return false;
  }
}

async function waitForNoProcessInDir(dir, timeoutMs = 2 * 60 * 60 * 1000) { // 2h max
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isAnyProcessRunningInDir(dir)) return true;
    await new Promise(r => setTimeout(r, 1500));
  }
  return !isAnyProcessRunningInDir(dir);
}

async function warpToBlender(exePath, userDataDir, argsArray /* optional: string[] */) {
  const chosenExe = path.resolve(exePath);
  const chosenDir = path.dirname(chosenExe);
  fs.mkdirSync(userDataDir, { recursive: true });
  logLine(userDataDir, `[warp] Demande de warp vers: ${chosenExe}`);

  const steamDir = findBlenderSteamDir();
  if (!steamDir || !fs.existsSync(steamDir)) {
    logLine(userDataDir, `[warp] Échec: dossier Blender Steam introuvable. Assurez-vous que Blender est installé via Steam.`);
    return { success: false, error: 'steam-blender-not-found' };
  }
  const backupDir = steamDir + `__backup_${Date.now()}`;
  const placedDir = steamDir; // we will replace contents here after moving old dir

  // Move original to backup
  try {
    fs.renameSync(steamDir, backupDir);
    logLine(userDataDir, `[warp] Original déplacé -> ${backupDir}`);
  } catch (e) {
    logLine(userDataDir, `[warp] rename original -> backup ÉCHEC: ${e && e.message}`);
    return { success: false, error: 'rename-failed' };
  }

  // Create new steamDir and copy chosen folder content (async robocopy)
  const copyRes = await robocopyMirror(chosenDir, placedDir);
  if (!copyRes.success) {
    logLine(userDataDir, `[warp] Copie ÉCHEC (robocopy code=${copyRes.code}). Tentative de restauration immédiate.`);
    try { fs.renameSync(backupDir, steamDir); } catch {}
    return { success: false, error: 'copy-failed' };
  }
  logLine(userDataDir, `[warp] Copie du build utilisateur terminée -> ${placedDir}`);

  // Écrire launch_path/args (facultatif, sans incidence si non utilisé)
  try {
    const launchPathTxt = path.join(placedDir, 'launch_path.txt');
    fs.writeFileSync(launchPathTxt, chosenExe, 'utf-8');
    const launchArgsTxt = path.join(placedDir, 'launch_args.txt');
    if (Array.isArray(argsArray) && argsArray.length > 0) {
      const quoted = argsArray.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ');
      fs.writeFileSync(launchArgsTxt, quoted, 'utf-8');
      logLine(userDataDir, `[warp] Écrit launch_args.txt: ${quoted}`);
    } else {
      try { if (fs.existsSync(launchArgsTxt)) fs.unlinkSync(launchArgsTxt); } catch {}
    }
  } catch (e) { logLine(userDataDir, `[warp] Écriture launch_path/args échouée: ${e && e.message}`); }
  // Restaurer le stub Steam blender-launcher.exe si disponible (évite la popup manquant)
  try {
    const stub = path.join(backupDir, 'blender-launcher.exe');
    if (fs.existsSync(stub)) {
      fs.copyFileSync(stub, path.join(placedDir, 'blender-launcher.exe'));
      logLine(userDataDir, `[warp] Stub Steam restauré: blender-launcher.exe`);
    }
  } catch (e) { logLine(userDataDir, `[warp] Copie stub échouée: ${e && e.message}`); }

  // Save state for later restore
  const state = { steamDir, backupDir, placedDir, mode: 'copy', createdAt: new Date().toISOString() };
  writeState(userDataDir, state);
  logLine(userDataDir, `[warp] ÉTAT SAUVÉ: ${JSON.stringify(state)}`);
  return { success: true, steamDir, backupDir, placedDir, mode: 'copy' };
}

async function restoreWarp(userDataDir, options = {}) {
  const state = readState(userDataDir);
  if (!state) return { restored: false, reason: 'no-state' };
  const { steamDir, backupDir, placedDir } = state;
  logLine(userDataDir, `[restore] Début restauration: steamDir=${steamDir}`);
  // Wait for processes to exit if still running in placedDir
  try { await waitForNoProcessInDir(placedDir, options.timeoutMs || 15 * 60 * 1000); } catch {}
  try {
    // Remove placed contents (may be large)
    rimraf(placedDir);
  } catch (e) {
    logLine(userDataDir, `[restore] Suppression du dossier placé échouée: ${e && e.message}`);
  }
  try {
    fs.renameSync(backupDir, steamDir);
    logLine(userDataDir, `[restore] Restauration OK -> ${steamDir}`);
  } catch (e) {
    logLine(userDataDir, `[restore] RENAME backup -> original ÉCHEC: ${e && e.message}`);
    return { restored: false, reason: 'rename-back-failed' };
  }
  removeState(userDataDir);
  return { restored: true };
}

function startAutoRestore(userDataDir, intervalMs = 2500) {
  const st = readState(userDataDir);
  if (!st) return false;
  const { placedDir } = st;
  let stopped = false;
  async function loop() {
    if (stopped) return;
    try {
      if (!isAnyProcessRunningInDir(placedDir)) {
        await restoreWarp(userDataDir, { timeoutMs: 60 * 1000 });
        return; // stop after restore
      }
    } catch {}
    setTimeout(loop, intervalMs);
  }
  setTimeout(loop, intervalMs);
  return true;
}

async function startupRestore(userDataDir) {
  const st = readState(userDataDir);
  if (!st) return { restored: false, reason: 'no-state' };
  // If there is a leftover state, attempt to restore quickly
  return await restoreWarp(userDataDir, { timeoutMs: 60 * 1000 });
}

module.exports = {
  findBlenderSteamDir,
  warpToBlender,
  restoreWarp,
  startAutoRestore,
  startupRestore,
};

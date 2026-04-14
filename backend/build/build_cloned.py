#!/usr/bin/env python3
"""Build an already-cloned Blender repository on Windows.

The script is resilient to old/new Blender fork layouts and emits `BL_CLONE:`
markers so Electron can display real-time progress.
"""
import sys
import os
import subprocess
import argparse
import time
import shutil

from utils.windows_tools import detect_pwsh_failure
from utils.windows_tools import ensure_pwsh_available
from utils.windows_tools import find_cmake_dir
from utils.windows_tools import find_vsdevcmd_path

MARK = 'BL_CLONE:'
_log_file = None


def _log(text: str):
    """Write a line to the log file if open."""
    if _log_file:
        try:
            _log_file.write(text + '\n')
            _log_file.flush()
        except Exception:
            pass


def echo(tag: str, **kv):
    parts = [MARK + tag]
    for k, v in kv.items():
        if v is None:
            continue
        s = str(v).replace('\n', ' ').replace('\r', ' ').replace('\t', ' ').strip()
        parts.append(f"{k}={s}")
    # Use tab separator so paths with spaces are not split by the IPC parser
    msg = '\t'.join(parts)
    _log(msg)
    try:
        print(msg, flush=True)
    except Exception:
        try:
            sys.stdout.write(msg + '\n')
            sys.stdout.flush()
        except Exception:
            pass


def run_and_stream(cmd, cwd=None, stdin_text=None):
    """Run a command while streaming output line by line.

    stdin_text: optional string to feed to stdin (for auto-accepting prompts).
    """
    try:
        env = os.environ.copy()
        env['GIT_TERMINAL_PROMPT'] = '0'
        env['GIT_LFS_SKIP_SMUDGE'] = '1'
        p = subprocess.Popen(
            cmd, cwd=cwd,
            stdin=subprocess.PIPE if stdin_text else subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            universal_newlines=True, env=env
        )
        # Feed pre-filled answers for interactive prompts (e.g. "Would you like to download them? (y/n)")
        if stdin_text and p.stdin:
            try:
                p.stdin.write(stdin_text)
                p.stdin.flush()
                p.stdin.close()
            except Exception:
                pass
        out_lines = []
        last_text = None
        repeat_count = 0
        while True:
            line = p.stdout.readline()
            if not line:
                if p.poll() is not None:
                    break
                time.sleep(0.05)
                continue
            out_lines.append(line)
            _log('[CMD] ' + line.rstrip())
            text = line.strip()
            if text:
                # Deduplicate consecutive identical lines (e.g. LFS budget spam)
                if text == last_text:
                    repeat_count += 1
                else:
                    if repeat_count > 0:
                        echo('LOG', text=f'(… répété {repeat_count} fois)')
                    last_text = text
                    repeat_count = 0
                    echo('LOG', text=text[:300])
        if repeat_count > 0:
            echo('LOG', text=f'(… répété {repeat_count} fois)')
        code = p.wait()
        return code, ''.join(out_lines)
    except Exception as e:
        return 1, str(e)


def warn_if_spaces_in_path(path_value: str):
    """Warn when the source/build path contains spaces, per Blender docs."""
    if path_value and ' ' in path_value:
        echo('LOG', text=f'Attention: le chemin contient des espaces et Blender indique que cela peut casser le build: {path_value}')


def ensure_libs(src, git_exe):
    """Download precompiled Blender libraries if missing (best-effort)."""
    import re, shutil as _sh
    import urllib.parse
    import urllib.request
    from html.parser import HTMLParser
    parent = os.path.dirname(src)
    lib_base = os.path.join(parent, 'lib')

    # --- Detect expected lib directory from build scripts ---
    make_bat_path = os.path.join(src, 'make.bat')
    find_dep_path = os.path.join(src, 'build_files', 'windows', 'find_dependencies.cmd')
    check_lib_path = os.path.join(src, 'build_files', 'windows', 'check_libraries.cmd')
    lib_dirname = None
    required_lib_dirs = []
    candidates_detected = []

    def _add_candidate(name):
        if not name:
            return
        n = name.strip().strip('"').strip()
        if not n:
            return
        if n not in candidates_detected:
            candidates_detected.append(n)

    # 1) Detect explicit `lib/<name>` usages from scripts.
    for pth in [make_bat_path, find_dep_path, check_lib_path]:
        if not os.path.isfile(pth):
            continue
        try:
            content = open(pth, 'r', encoding='utf-8', errors='replace').read()
            for m in re.finditer(r'lib[/\\]([A-Za-z0-9_]+)', content, re.IGNORECASE):
                _add_candidate(m.group(1))
        except Exception:
            pass

    # 2) Resolve BUILD_VS_SVNDIR from check_libraries.cmd patterns.
    if os.path.isfile(check_lib_path):
        try:
            lines = open(check_lib_path, 'r', encoding='utf-8', errors='replace').read().splitlines()
            libpost_values = []
            svndir_value = None
            for ln in lines:
                s = ln.strip()
                m_post = re.match(r'if\s+"%BUILD_VS_YEAR%"\s*==\s*"\d+"\s+set\s+BUILD_VS_LIBDIRPOST\s*=\s*([A-Za-z0-9_]+)', s, re.IGNORECASE)
                if m_post:
                    v = m_post.group(1).strip()
                    if v and v not in libpost_values:
                        libpost_values.append(v)
                m_svndir = re.match(r'set\s+BUILD_VS_SVNDIR\s*=\s*(.+)$', s, re.IGNORECASE)
                if m_svndir:
                    svndir_value = m_svndir.group(1).strip().strip('"')
            if svndir_value:
                if '%BUILD_VS_LIBDIRPOST%' in svndir_value and libpost_values:
                    for v in libpost_values:
                        resolved = svndir_value.replace('%BUILD_VS_LIBDIRPOST%', v)
                        _add_candidate(resolved)
                        if resolved not in required_lib_dirs:
                            required_lib_dirs.append(resolved)
                else:
                    _add_candidate(svndir_value)
                    if svndir_value not in required_lib_dirs:
                        required_lib_dirs.append(svndir_value)
        except Exception:
            pass

    # 3) Conservative defaults for known Windows Blender library layouts.
    _add_candidate('win64_vc15')
    _add_candidate('windows_x64')

    if required_lib_dirs:
        lib_dirname = required_lib_dirs[0]
    elif candidates_detected:
        lib_dirname = candidates_detected[0]

    if os.path.isfile(make_bat_path):
        try:
            content = open(make_bat_path, 'r', encoding='utf-8', errors='replace').read()
            m = re.search(r'lib[/\\](win(?:dows)?_?[0-9a-z_]+)', content, re.IGNORECASE)
            if m:
                lib_dirname = m.group(1)
        except Exception:
            pass

    if not lib_dirname:
        # Check if any known lib dir already exists
        for name in candidates_detected + ['windows_x64', 'win64_vc15', 'win64_vc14']:
            if os.path.isdir(os.path.join(lib_base, name)):
                return True
        return False

    lib_dir_candidates = []
    ordered_candidates = []
    # Priority: directories explicitly required by check_libraries.cmd first.
    ordered_candidates.extend(required_lib_dirs)
    ordered_candidates.extend([lib_dirname])
    ordered_candidates.extend(candidates_detected)
    for name in ordered_candidates:
        if name and name not in lib_dir_candidates:
            lib_dir_candidates.append(name)

    os.makedirs(lib_base, exist_ok=True)

    def _dir_has_payload(pth):
        if not os.path.isdir(pth):
            return False
        try:
            return any(name != '.git' for name in os.listdir(pth))
        except Exception:
            return False

    def _try_link_or_copy(required_name, existing_name):
        """Best-effort compatibility fallback for old branches.

        Example: some 3.x forks expect lib/win64_vc15 while only lib/windows_x64
        is available from git mirrors.
        """
        req_dir = os.path.join(lib_base, required_name)
        src_dir = os.path.join(lib_base, existing_name)
        if _dir_has_payload(req_dir):
            return True
        if not _dir_has_payload(src_dir):
            return False

        echo('LOG', text=f'Compatibilité libs: tentative de réutiliser {existing_name} pour {required_name}')

        # 1) Prefer NTFS junction (no data copy)
        try:
            subprocess.run(
                ['cmd.exe', '/c', 'mklink', '/J', req_dir, src_dir],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False
            )
            if _dir_has_payload(req_dir):
                echo('LOG', text=f'Compatibilité libs: jonction créée {required_name} -> {existing_name}')
                return True
        except Exception:
            pass

        # 2) Fallback to copy (slower, but robust)
        try:
            if os.path.isdir(req_dir):
                shutil.rmtree(req_dir, ignore_errors=True)
            shutil.copytree(src_dir, req_dir)
            if _dir_has_payload(req_dir):
                echo('LOG', text=f'Compatibilité libs: copie réalisée {existing_name} -> {required_name}')
                return True
        except Exception as e:
            echo('LOG', text=f'Compatibilité libs impossible ({required_name}): {e}')
        return False

    class _DirListingParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.links = []
        def handle_starttag(self, tag, attrs):
            if tag.lower() != 'a':
                return
            for k, v in attrs:
                if k.lower() == 'href' and v:
                    self.links.append(v)

    def _http_fetch_svn_dir(target_name):
        """Fetch an SVN directory tree over HTTP without requiring svn.exe.

        This is a fallback for legacy branches where git mirror repos don't exist
        (e.g. lib-win64_vc15.git).
        """
        base_url = f'https://svn.blender.org/svnroot/bf-blender/trunk/lib/{target_name}/'
        target_dir = os.path.join(lib_base, target_name)
        if _dir_has_payload(target_dir):
            return True

        echo('LOG', text=f'Tentative HTTP sans svn.exe: {base_url}')
        os.makedirs(target_dir, exist_ok=True)

        stack = [(base_url, target_dir)]
        visited = set()
        downloaded = 0

        while stack:
            url, local_dir = stack.pop()
            if url in visited:
                continue
            visited.add(url)

            try:
                with urllib.request.urlopen(url, timeout=30) as resp:
                    html = resp.read().decode('utf-8', errors='ignore')
            except Exception as e:
                echo('LOG', text=f'HTTP listing indisponible pour {url}: {e}')
                return False

            parser = _DirListingParser()
            parser.feed(html)

            for href in parser.links:
                if not href or href in ('../', '..') or href.startswith('?') or href.startswith('#'):
                    continue
                full_url = urllib.parse.urljoin(url, href)
                if href.endswith('/'):
                    sub = urllib.parse.unquote(href.rstrip('/'))
                    if not sub:
                        continue
                    sub_dir = os.path.join(local_dir, sub)
                    os.makedirs(sub_dir, exist_ok=True)
                    stack.append((full_url, sub_dir))
                else:
                    name = urllib.parse.unquote(href)
                    if not name:
                        continue
                    dst = os.path.join(local_dir, name)
                    if os.path.isfile(dst) and os.path.getsize(dst) > 0:
                        continue
                    try:
                        urllib.request.urlretrieve(full_url, dst)
                        downloaded += 1
                        if downloaded % 200 == 0:
                            echo('LOG', text=f'HTTP fallback: {downloaded} fichiers téléchargés pour {target_name}...')
                    except Exception as e:
                        echo('LOG', text=f'Echec téléchargement {full_url}: {e}')
                        return False

        if _dir_has_payload(target_dir):
            echo('LOG', text=f'HTTP fallback réussi pour {target_name} ({downloaded} fichiers)')
            return True
        return False

    # Clone WITHOUT GIT_LFS_SKIP_SMUDGE — we need the actual LFS binary objects.
    env = os.environ.copy()
    env.pop('GIT_LFS_SKIP_SMUDGE', None)
    env['GIT_TERMINAL_PROMPT'] = '0'

    def _clone_lib_dir(target_name):
        lib_dir = os.path.join(lib_base, target_name)
        # Already exists with real content?
        if os.path.isdir(lib_dir):
            real_files = [f for f in os.listdir(lib_dir) if f != '.git']
            if real_files:
                echo('LOG', text=f'Bibliothèques trouvées: {lib_dir}')
                return True
            try:
                _sh.rmtree(lib_dir)
            except Exception:
                pass

        echo('PROGRESS', progress=6, text=f'Téléchargement des bibliothèques ({target_name})… cela peut prendre plusieurs minutes')
        git_url = f'https://projects.blender.org/blender/lib-{target_name}.git'
        echo('LOG', text=f'Clonage depuis {git_url}')

        try:
            p = subprocess.Popen(
                [git_exe, 'clone', '--depth', '1', '--progress', git_url, lib_dir],
                cwd=lib_base, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                universal_newlines=True, env=env
            )
            last_text = None
            repeat_count = 0
            while True:
                line = p.stdout.readline()
                if not line:
                    if p.poll() is not None:
                        break
                    time.sleep(0.05)
                    continue
                _log('[LIB] ' + line.rstrip())
                text = line.strip()
                if text:
                    if text == last_text:
                        repeat_count += 1
                    else:
                        if repeat_count > 0:
                            echo('LOG', text=f'(… répété {repeat_count} fois)')
                        last_text = text
                        repeat_count = 0
                        echo('LOG', text=text[:300])
            if repeat_count > 0:
                echo('LOG', text=f'(… répété {repeat_count} fois)')
            code = p.wait()
        except Exception as e:
            echo('LOG', text=f'Erreur clone libs {target_name}: {e}')
            code = 1

        if code == 0 and os.path.isdir(lib_dir) and len(os.listdir(lib_dir)) > 1:
            echo('LOG', text=f'Bibliothèques téléchargées: {lib_dir}')
            return True
        return False

    success_dirs = set()
    for cand in lib_dir_candidates:
        if _clone_lib_dir(cand):
            success_dirs.add(cand)

    if required_lib_dirs:
        # Compatibility fallback for old branches: required win64_vc15 can often
        # be satisfied by the newer windows_x64 bundle.
        compat_map = {
            'win64_vc15': ['windows_x64'],
        }
        for req in required_lib_dirs:
            for alt in compat_map.get(req, []):
                if _try_link_or_copy(req, alt):
                    return True

        # Last no-extra-install fallback: fetch from SVN HTTP endpoint recursively.
        for req in required_lib_dirs:
            if _http_fetch_svn_dir(req):
                return True

        for req in required_lib_dirs:
            req_dir = os.path.join(lib_base, req)
            if req in success_dirs:
                return True
            if os.path.isdir(req_dir):
                try:
                    real_files = [f for f in os.listdir(req_dir) if f != '.git']
                    if real_files:
                        return True
                except Exception:
                    pass
        echo('LOG', text=f'Les libs requises ({", ".join(required_lib_dirs)}) ne sont pas disponibles.')
    elif success_dirs:
        return True

    # Fallback: try SVN
    svn_exe = _sh.which('svn')
    if svn_exe:
        echo('LOG', text='Tentative de téléchargement via SVN…')
        for cand in lib_dir_candidates:
            svn_dir = os.path.join(lib_base, cand)
            svn_url = f'https://svn.blender.org/svnroot/bf-blender/trunk/lib/{cand}'
            code2, _ = run_and_stream([svn_exe, 'checkout', svn_url, svn_dir], cwd=lib_base)
            if code2 == 0 and os.path.isdir(svn_dir):
                return True

    echo('LOG', text='Impossible de télécharger les bibliothèques. Le build va tenter de continuer…')
    return False


def main():
    global _log_file
    parser = argparse.ArgumentParser(description='Build already-cloned Blender source')
    parser.add_argument('--src', required=True, help='Chemin vers le source Blender cloné')
    args = parser.parse_args()

    src = os.path.abspath(args.src)

    # Open log file next to the source directory
    log_path = os.path.join(src, 'build_log.txt') if os.path.isdir(src) else os.path.join(os.path.dirname(src), 'build_log.txt')
    try:
        _log_file = open(log_path, 'w', encoding='utf-8')
        _log(f'=== Build log started {time.strftime("%Y-%m-%d %H:%M:%S")} ===')
        _log(f'Source: {src}')
        _log(f'Args: {sys.argv}')
        _log(f'Python: {sys.version}')
        _log(f'PATH: {os.environ.get("PATH", "")[:500]}')
        _log('')
    except Exception:
        _log_file = None
    if not os.path.isdir(src):
        echo('ERROR', message=f'Dossier source introuvable: {src}')
        return 1

    warn_if_spaces_in_path(src)

    echo('START', text='Démarrage de la compilation Blender')

    if os.name != 'nt':
        echo('ERROR', message='Compilation Windows uniquement pour le moment')
        return 2

    vsdev = find_vsdevcmd_path()
    vsver = None
    if vsdev:
        low = vsdev.lower()
        is_buildtools = 'buildtools' in low
        if '2022' in low:
            vsver = '2022b' if is_buildtools else '2022'
        elif '2019' in low:
            vsver = '2019b' if is_buildtools else '2019'

    # --- Pre-check: CMake must be available ---
    cmake_dir = find_cmake_dir()
    if not cmake_dir:
        echo('ERROR', message='CMake introuvable. Installez CMake (https://cmake.org/) et cochez "Add CMake to the system PATH".')
        return 2

    echo('LOG', text=f'CMake trouvé: {cmake_dir}')

    # Prepend cmake's directory to PATH so Blender's find_dependencies.cmd can find it.
    # Also ensures all subprocesses (run_and_stream) inherit it.
    if cmake_dir not in os.environ.get('PATH', ''):
        os.environ['PATH'] = cmake_dir + os.pathsep + os.environ.get('PATH', '')

    # --- Step 1: let make.bat handle everything ---
    # We skip manual submodule/lfs steps because:
    # - Forks often have LFS budget exceeded → submodule checkout is empty
    # - make.bat has its own robust library download from Blender's official repo
    # - The manual step just generates spam and wastes time
    echo('PROGRESS', progress=5, text='Préparation de la compilation…')

    git_exe = shutil.which('git') or r'C:\Program Files\Git\cmd\git.exe'

    # --- Ensure pwsh.exe exists for Blender custom rules ---
    pwsh_ok, pwsh_ref = ensure_pwsh_available()
    if not pwsh_ok:
        echo('ERROR', message='pwsh.exe introuvable. Installez PowerShell 7 (winget install --id Microsoft.PowerShell -e) ou vérifiez powershell.exe.')
        return 2
    if pwsh_ref and pwsh_ref != 'pwsh':
        echo('LOG', text=f'pwsh.exe absent, shim activé via: {pwsh_ref}')

    # Run `git lfs install --skip-repo` so make.bat doesn't complain
    try:
        subprocess.run([git_exe, 'lfs', 'install', '--skip-repo'],
                       cwd=src, timeout=10, capture_output=True)
    except Exception:
        pass

    # --- Ensure precompiled libs are present ---
    # Older forks (Blender 3.x) need lib/win64_vc15; newer ones need lib/windows_x64.
    # If the directory is missing, clone it from Blender's official git repo.
    libs_ok = ensure_libs(src, git_exe)
    if not libs_ok:
        echo(
            'ERROR',
            message='Bibliothèques Blender manquantes et téléchargement impossible via Git. Vérifiez la connexion réseau/accès à projects.blender.org puis relancez.'
        )
        return 4

    echo('PROGRESS', progress=10, text='Compilation release en cours (make.bat téléchargera les libs si nécessaire)…')

    # --- Step 2: make release (compile) ---
    # Try with vsver first; if the fork's make.bat doesn't support it
    # (e.g. 'Command "2022" unknown'), retry without.
    def _build_make_cmd(with_vsver):
        args = ['make.bat', 'release']
        if with_vsver and vsver:
            args.append(vsver)
        bat = os.path.join(src, '_bl_make_build.bat')
        try:
            with open(bat, 'w', encoding='utf-8') as f:
                f.write('@echo off\r\n')
                # Source VS developer environment so cl.exe / msbuild are in
                # PATH.  Forks whose make.bat can't autodetect VS need this.
                if vsdev:
                    f.write(f'call "{vsdev}" -no_logo\r\n')
                f.write('call ' + ' '.join(args) + ' verbose\r\n')
        except Exception:
            bat = None
        return (['cmd.exe', '/c', bat] if bat else ['cmd.exe', '/c'] + args + ['verbose'])

    make_build_cmd = _build_make_cmd(with_vsver=bool(vsver))

    # Pipe "y\n" answers for interactive prompts ("Would you like to download them?")
    code, out = run_and_stream(make_build_cmd, cwd=src, stdin_text='y\ny\ny\ny\n')

    # If failed and we passed vsver, check if it was rejected and retry without
    if code != 0 and vsver:
        lower_out = (out or '').lower()
        if 'unknown' in lower_out or 'unrecognized' in lower_out or 'invalid' in lower_out:
            echo('LOG', text=f'make.bat ne supporte pas l\'argument "{vsver}", relance sans…')
            make_build_cmd = _build_make_cmd(with_vsver=False)
            code, out = run_and_stream(make_build_cmd, cwd=src, stdin_text='y\ny\ny\ny\n')

    pwsh_error = detect_pwsh_failure(out or '')
    if pwsh_error:
        echo('ERROR', message=pwsh_error)
        return 4

    if code != 0:
        echo('ERROR', message='Echec de la compilation (make release)', detail=(out or '')[-400:])
        return 4

    echo('PROGRESS', progress=95, text='Compilation terminée — recherche de blender.exe…')

    # --- Find blender.exe ---
    # Blender's make.bat builds into ../build_windows* (sibling of the source dir)
    exe_path = None
    parent = os.path.dirname(src)
    search_dirs = [src]
    try:
        for entry in os.listdir(parent):
            if entry.lower().startswith('build_windows'):
                search_dirs.append(os.path.join(parent, entry))
    except Exception:
        pass
    for search_dir in search_dirs:
        try:
            for root, dirs, files in os.walk(search_dir):
                for f in files:
                    if f.lower() == 'blender.exe':
                        exe_path = os.path.join(root, f)
                        break
                if exe_path:
                    break
        except Exception:
            pass
        if exe_path:
            break

    if not exe_path:
        echo('ERROR', message='blender.exe introuvable après la compilation')
        return 5

    echo('DONE', exe=exe_path)
    return 0


if __name__ == '__main__':
    ret = main()
    if _log_file:
        _log(f'\n=== Build ended (code {ret}) at {time.strftime("%Y-%m-%d %H:%M:%S")} ===')
        _log_file.close()
    sys.exit(ret)

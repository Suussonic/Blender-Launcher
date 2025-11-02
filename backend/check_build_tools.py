#!/usr/bin/env python3
import os, sys, json, subprocess, glob, argparse
from typing import List
try:
    import ctypes  # for admin check on Windows
except Exception:
    ctypes = None
try:
    import winreg  # type: ignore
except Exception:
    winreg = None

IS_WIN = os.name == 'nt'

def have(cmd: str) -> bool:
    """Return True if command resolves in PATH."""
    try:
        p = subprocess.Popen(['where' if IS_WIN else 'which', cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        p.communicate(timeout=6)
        return p.returncode == 0
    except Exception:
        return False

def exists_any(paths):
    for p in paths:
        if os.path.exists(p):
            return True
    return False

# SVN is no longer required for Windows builds per current Blender docs.

def detect_msvc() -> bool:
    """Return True only when Visual Studio with VC Tools is installed.
    Conservative: PATH-only msbuild isn't enough; prefer cl.exe or vswhere with VC Tools.
    """
    # If cl.exe is in PATH, it's good enough
    if have('cl'):
        return True
    if not IS_WIN:
        return False
    # Use vswhere to detect Build Tools + VC workload
    vswhere_cands = [
        r"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
        r"C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe",
    ]
    vswhere = next((p for p in vswhere_cands if os.path.exists(p)), None)
    if not vswhere:
        return False
    try:
        out = subprocess.check_output([
            vswhere,
            '-latest',
            '-products', '*',
            '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
            '-property', 'installationPath'
        ], stderr=subprocess.DEVNULL, timeout=8, text=True)
        inst = out.strip()
        if not inst:
            return False
        # Look for cl.exe under VC Tools tree
        patterns = [
            os.path.join(inst, 'VC', 'Tools', 'MSVC', '*', 'bin', 'Hostx64', 'x64', 'cl.exe'),
            os.path.join(inst, 'VC', 'Tools', 'MSVC', '*', 'bin', 'Hostx86', 'x86', 'cl.exe'),
        ]
        for pat in patterns:
            if glob.glob(pat):
                return True
    except Exception:
        return False
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true', help='Install missing tools using winget')
    parser.add_argument('--tools', type=str, help='Comma-separated list of tools to install (git,cmake,ninja,msvc). Default: missing only')
    args = parser.parse_args()

    tools = {
        'git': have('git'),
        'cmake': have('cmake'),
        'ninja': have('ninja'),
        'python': True,  # running under python
        'msvc': detect_msvc(),
    }

    # Always include a simple list of missing tools when not installing
    missing = [k for k, v in tools.items() if v is False]

    if not args.install:
        print(json.dumps({ 'success': True, 'tools': tools, 'missing': missing }))
        return 0

    # Install flow via winget
    # Map tool -> winget id and optional override args
    pkg_map = {
        'git':   { 'id': 'Git.Git', 'args': ['--silent'] },
        'cmake': { 'id': 'Kitware.CMake', 'args': ['--silent'] },
        'ninja': { 'id': 'Ninja-build.Ninja', 'args': ['--silent'] },
        # Full Visual Studio Community with Desktop C++ workload per Blender docs
        'msvc':  { 'id': 'Microsoft.VisualStudio.2022.Community', 'override': '--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended' },
    }

    # Determine targets
    if args.tools:
        requested = [t.strip().lower() for t in args.tools.split(',') if t.strip()]
    else:
        requested = [k for k, v in tools.items() if k in ('git','cmake','ninja','msvc') and v is False]
    requested = [t for t in requested if t in pkg_map]
    if not requested:
        print(json.dumps({ 'success': True, 'installed': [], 'note': 'nothing-to-install' }))
        return 0

    def run_winget(args_list):
        try:
            p = subprocess.Popen(['winget'] + args_list, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
            out = []
            while True:
                line = p.stdout.readline()
                if not line:
                    if p.poll() is not None:
                        break
                    continue
                out.append(line)
            code = p.wait()
            return code, ''.join(out)
        except Exception as e:
            return 1, str(e)

    # Basic check: is winget available
    try:
        wg = subprocess.run(['winget','--version'], capture_output=True, text=True)
        if wg.returncode != 0:
            sys.stderr.write('[install] winget introuvable. Installez l\'Application Installer (winget) depuis le Microsoft Store.\n')
    except Exception:
        sys.stderr.write('[install] winget introuvable. Installez l\'Application Installer (winget) depuis le Microsoft Store.\n')

    installed: List[str] = []
    failed: List[str] = []

    def is_admin() -> bool:
        if os.name != 'nt' or ctypes is None:
            return False
        try:
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:
            return False
    for t in requested:
        pkg = pkg_map[t]
        args_list = ['install', '--id', pkg['id'], '-e', '--accept-package-agreements', '--accept-source-agreements']
        if 'args' in pkg and pkg['args']:
            args_list += pkg['args']
        if 'override' in pkg and pkg['override']:
            args_list += ['--override', pkg['override']]
        code, out = run_winget(args_list)
        # Consider non-zero exit as soft-fail; continue to next tool
        if code == 0:
            installed.append(t)
        else:
            # include a short message to help troubleshooting (permission/admin)
            sys.stderr.write(f'[install] {t} failed with code {code}\n')
            failed.append(t)

    # If MSVC failed, print a clear admin/elevated command hint
    hint = None
    if 'msvc' in failed:
        hint = 'winget install --id Microsoft.VisualStudio.2022.Community -e --accept-package-agreements --accept-source-agreements --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended"'
        sys.stderr.write('[install] Pour MSVC, exécutez PowerShell en Administrateur puis lancez:\n')
        sys.stderr.write(f'  {hint}\n')

    # After install attempt, return updated tool status too
    refreshed = {
        'git': have('git'),
        'cmake': have('cmake'),
        'ninja': have('ninja'),
        'python': True,
        'msvc': detect_msvc(),
    }
    print(json.dumps({ 'success': True, 'installed': installed, 'failed': failed, 'tools': refreshed, 'missing': [k for k,v in refreshed.items() if v is False], 'needs_admin': (len(failed) > 0 and not is_admin()), 'hint': hint }))
    return 0

if __name__ == '__main__':
    sys.exit(main())

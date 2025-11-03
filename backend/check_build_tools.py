#!/usr/bin/env python3
"""
check_build_tools.py - Windows only
Per Blender official Windows build docs (https://developer.blender.org/docs/handbook/building_blender/windows/):
Required tools:
  - Git (for cloning source)
  - CMake (build configuration)
  - Visual Studio 2019 or 2022 Community with "Desktop development with C++" workload
"""
import os, sys, json, subprocess, glob, argparse
from typing import List
try:
    import ctypes  # for admin check on Windows
except Exception:
    ctypes = None

IS_WIN = os.name == 'nt'

def have(cmd: str) -> bool:
    """Return True if command resolves in PATH."""
    try:
        p = subprocess.Popen(['where' if IS_WIN else 'which', cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        p.communicate(timeout=6)
        return p.returncode == 0
    except Exception:
        return False

def detect_visual_studio() -> bool:
    """
    Per Blender docs: Visual Studio 2019 or 2022 Community with Desktop development with C++ workload.
    Returns True only when VS is installed with the required C++ workload.
    """
    if not IS_WIN:
        return False
    # Check cl.exe in PATH (means VS dev environment is active)
    if have('cl'):
        return True
    # Use vswhere to detect VS with VC.Tools component
    vswhere_cands = [
        r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe",
        r"C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe",
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
        # Verify cl.exe exists in the installation
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
    parser.add_argument('--tools', type=str, help='Comma-separated list of tools to install (git,cmake,visual_studio). Default: missing only')
    args = parser.parse_args()

    # Blender Windows requirements: Git, CMake, Visual Studio 2019/2022 Community with Desktop C++ workload
    tools = {
        'git': have('git'),
        'cmake': have('cmake'),
        'python': True,  # running under python
        'visual_studio': detect_visual_studio(),
    }

    missing = [k for k, v in tools.items() if v is False]

    if not args.install:
        print(json.dumps({ 'success': True, 'tools': tools, 'missing': missing }))
        return 0

    # Install flow via winget (Windows only)
    # Map tool -> winget id and optional override args per Blender docs
    pkg_map = {
        'git':   { 'id': 'Git.Git', 'args': ['--silent'] },
        'cmake': { 'id': 'Kitware.CMake', 'args': ['--silent'] },
        # Visual Studio 2022 Community with Desktop development with C++ workload
        'visual_studio':  { 
            'id': 'Microsoft.VisualStudio.2022.Community', 
            'override': '--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended' 
        },
    }

    # Determine targets
    if args.tools:
        requested = [t.strip().lower() for t in args.tools.split(',') if t.strip()]
    else:
        requested = [k for k, v in tools.items() if k in pkg_map and v is False]
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
        if code == 0:
            installed.append(t)
        else:
            sys.stderr.write(f'[install] {t} failed with code {code}\n')
            failed.append(t)

    # If visual_studio failed, print a clear admin/elevated command hint
    hint = None
    if 'visual_studio' in failed:
        hint = 'winget install --id Microsoft.VisualStudio.2022.Community -e --accept-package-agreements --accept-source-agreements --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended"'
        sys.stderr.write('[install] Pour Visual Studio, exécutez PowerShell en Administrateur puis lancez:\n')
        sys.stderr.write(f'  {hint}\n')

    # After install attempt, return updated tool status
    refreshed = {
        'git': have('git'),
        'cmake': have('cmake'),
        'python': True,
        'visual_studio': detect_visual_studio(),
    }
    print(json.dumps({ 
        'success': True, 
        'installed': installed, 
        'failed': failed, 
        'tools': refreshed, 
        'missing': [k for k,v in refreshed.items() if v is False], 
        'needs_admin': (len(failed) > 0 and not is_admin()), 
        'hint': hint 
    }))
    return 0

if __name__ == '__main__':
    sys.exit(main())

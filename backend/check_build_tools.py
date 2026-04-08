#!/usr/bin/env python3
"""
check_build_tools.py - Windows only
Per Blender official Windows build docs (https://developer.blender.org/docs/handbook/building_blender/windows/):
Required tools:
  - Git (for cloning source)
  - CMake (build configuration)
  - Visual Studio 2019 or 2022 Community with "Desktop development with C++" workload
    - PowerShell 7 (pwsh.exe) used by several custom Blender build rules
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

def detect_cmake() -> bool:
    """Check cmake in PATH, then common install locations."""
    if have('cmake'):
        return True
    if not IS_WIN:
        return False
    # CMake default install dirs on Windows
    candidates = [
        os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'), 'CMake', 'bin', 'cmake.exe'),
        os.path.join(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'), 'CMake', 'bin', 'cmake.exe'),
    ]
    # Also check via winget/scoop/choco typical paths
    local = os.environ.get('LOCALAPPDATA', '')
    if local:
        candidates += glob.glob(os.path.join(local, 'CMake*', 'bin', 'cmake.exe'))
    for c in candidates:
        if os.path.isfile(c):
            return True
    # Last resort: check registry for CMake install path
    try:
        import winreg
        for root in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
            try:
                key = winreg.OpenKey(root, r'SOFTWARE\Kitware\CMake', 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY)
                val, _ = winreg.QueryValueEx(key, 'InstallDir')
                winreg.CloseKey(key)
                if val and os.path.isfile(os.path.join(val, 'bin', 'cmake.exe')):
                    return True
            except OSError:
                pass
    except ImportError:
        pass
    return False

def detect_git() -> bool:
    """Check git in PATH, then common install locations."""
    if have('git'):
        return True
    if not IS_WIN:
        return False
    candidates = [
        os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'), 'Git', 'cmd', 'git.exe'),
        os.path.join(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'), 'Git', 'cmd', 'git.exe'),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return True
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

def detect_pwsh() -> bool:
    """Check pwsh in PATH, then common install locations for PowerShell 7."""
    if have('pwsh'):
        return True
    if not IS_WIN:
        return False
    candidates = [
        os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'), 'PowerShell', '7', 'pwsh.exe'),
        os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'), 'PowerShell', '7-preview', 'pwsh.exe'),
        os.path.join(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'), 'PowerShell', '7', 'pwsh.exe'),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return True
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true', help='Install missing tools using winget')
    parser.add_argument('--tools', type=str, help='Comma-separated list of tools to install (git,cmake,msvc,pwsh). Default: missing only')
    args = parser.parse_args()

    # Blender Windows requirements: Git, CMake, Visual Studio 2019/2022 Community with Desktop C++ workload
    tools = {
        'git': detect_git(),
        'cmake': detect_cmake(),
        'msvc': detect_visual_studio(),
        'pwsh': detect_pwsh(),
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
        'pwsh':  { 'id': 'Microsoft.PowerShell' },
        # Visual Studio 2022 Community with Desktop development with C++ workload
        'msvc':  { 
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

    # If msvc failed, print a clear admin/elevated command hint
    hint = None
    if 'msvc' in failed:
        hint = 'winget install --id Microsoft.VisualStudio.2022.Community -e --accept-package-agreements --accept-source-agreements --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended"'
        sys.stderr.write('[install] Pour Visual Studio, exécutez PowerShell en Administrateur puis lancez:\n')
        sys.stderr.write(f'  {hint}\n')

    # After install attempt, return updated tool status
    refreshed = {
        'git': detect_git(),
        'cmake': detect_cmake(),
        'msvc': detect_visual_studio(),
        'pwsh': detect_pwsh(),
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

#!/usr/bin/env python3
import os, sys, json, subprocess, glob
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

def detect_svn() -> bool:
    if have('svn'):
        return True
    if not IS_WIN:
        return False
    # Common Windows installs
    candidates = [
        r"C:\\Program Files\\TortoiseSVN\\bin\\svn.exe",
        r"C:\\Program Files (x86)\\TortoiseSVN\\bin\\svn.exe",
        r"C:\\Program Files\\Subversion\\bin\\svn.exe",
        r"C:\\Program Files\\SlikSvn\\bin\\svn.exe",
        r"C:\\Program Files\\SlikSVN\\bin\\svn.exe",
        r"C:\\Program Files\\Git\\usr\\bin\\svn.exe",
    ]
    # App portable tool path
    try:
        appdata = os.environ.get('APPDATA')
        if appdata:
            candidates.append(os.path.join(appdata, 'blender-launcher', 'tools', 'svn', 'bin', 'svn.exe'))
            candidates.append(os.path.join(appdata, 'blender-launcher', 'tools', 'svn', 'extract'))
    except Exception:
        pass
    if exists_any(candidates):
        return True
    # Check registry InstallLocation for TortoiseSVN
    if IS_WIN and winreg is not None:
        try:
            roots = [
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
            ]
            for hive, path in roots:
                try:
                    with winreg.OpenKey(hive, path) as root:
                        for i in range(0, winreg.QueryInfoKey(root)[0]):
                            try:
                                subname = winreg.EnumKey(root, i)
                                with winreg.OpenKey(root, subname) as sk:
                                    name = ''
                                    try:
                                        name = winreg.QueryValueEx(sk, 'DisplayName')[0]
                                    except Exception:
                                        continue
                                    if name and 'tortoisesvn' in str(name).lower():
                                        loc = None
                                        try:
                                            loc = winreg.QueryValueEx(sk, 'InstallLocation')[0]
                                        except Exception:
                                            pass
                                        if not loc:
                                            try:
                                                icon = winreg.QueryValueEx(sk, 'DisplayIcon')[0]
                                                loc = os.path.dirname(icon)
                                            except Exception:
                                                pass
                                        if loc:
                                            cand = os.path.join(loc, 'bin', 'svn.exe')
                                            if os.path.exists(cand):
                                                return True
                            except Exception:
                                continue
                except Exception:
                    continue
        except Exception:
            pass

    # Shallow recursive search under Program Files folders (depth <= 3)
    roots = [os.environ.get('ProgramFiles', r'C:\\Program Files'), os.environ.get('ProgramFiles(x86)', r'C:\\Program Files (x86)')]
    for root in roots:
        try:
            if not root or not os.path.isdir(root):
                continue
            for d1 in os.listdir(root):
                p1 = os.path.join(root, d1)
                if not os.path.isdir(p1):
                    continue
                # Only check likely folders to keep it fast
                if 'svn' not in d1.lower() and 'tortoise' not in d1.lower():
                    continue
                # depth 1
                cand = os.path.join(p1, 'bin', 'svn.exe')
                if os.path.exists(cand):
                    return True
                # depth 2
                try:
                    for d2 in os.listdir(p1):
                        p2 = os.path.join(p1, d2)
                        if not os.path.isdir(p2):
                            continue
                        cand2 = os.path.join(p2, 'bin', 'svn.exe')
                        if os.path.exists(cand2):
                            return True
                except Exception:
                    pass
        except Exception:
            pass
    return False

def detect_msvc() -> bool:
    # Quick PATH check first
    if have('cl') or have('devenv') or have('msbuild'):
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
    tools = {
        'git': have('git'),
        'cmake': have('cmake'),
        'svn': detect_svn(),
        'ninja': have('ninja'),
        'python': True,  # running under python
        'msvc': detect_msvc(),
    }
    print(json.dumps(tools))
    return 0

if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
import sys, os, subprocess, argparse, shutil, time
try:
    import winreg  # type: ignore
except Exception:
    winreg = None

MARK = 'BL_CLONE:'

def echo(tag: str, **kv):
    parts = [MARK + tag]
    for k, v in kv.items():
        if v is None:
            continue
        s = str(v).replace('\n',' ').replace('\r',' ').strip()
        # Avoid spaces in keys/values by replacing with underscores where needed
        s = s.replace('  ', ' ')
        parts.append(f"{k}={s}")
    try:
        print(' '.join(parts), flush=True)
    except Exception:
        try:
            sys.stdout.write(' '.join(parts) + '\n'); sys.stdout.flush()
        except Exception:
            pass

def run(cmd, cwd=None, shell=False):
    try:
        p = subprocess.Popen(cmd, cwd=cwd, shell=shell, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        out = []
        while True:
            line = p.stdout.readline()
            if not line:
                if p.poll() is not None:
                    break
                time.sleep(0.05)
                continue
            out.append(line)
        code = p.wait()
        return code, ''.join(out)
    except Exception as e:
        return 1, str(e)

def ensure_dir(path: str):
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)

def find_svn_candidates():
    if os.name != 'nt':
        return []
    cands = [
        r"C:\\Program Files\\TortoiseSVN\\bin\\svn.exe",
        r"C:\\Program Files (x86)\\TortoiseSVN\\bin\\svn.exe",
        r"C:\\Program Files\\Subversion\\bin\\svn.exe",
        r"C:\\Program Files\\SlikSvn\\bin\\svn.exe",
        r"C:\\Program Files\\SlikSVN\\bin\\svn.exe",
        r"C:\\Program Files\\Git\\usr\\bin\\svn.exe",
    ]
    existing = [p for p in cands if os.path.exists(p)]
    # Shallow scan under Program Files for svn.exe if not found
    if not existing:
        for root in [os.environ.get('ProgramFiles', r'C:\\Program Files'), os.environ.get('ProgramFiles(x86)', r'C:\\Program Files (x86)')]:
            try:
                if not root or not os.path.isdir(root):
                    continue
                for d1 in os.listdir(root):
                    p1 = os.path.join(root, d1)
                    if not os.path.isdir(p1):
                        continue
                    if 'svn' not in d1.lower() and 'tortoise' not in d1.lower():
                        continue
                    cand = os.path.join(p1, 'bin', 'svn.exe')
                    if os.path.exists(cand):
                        existing.append(cand)
                        break
            except Exception:
                pass
    # Registry: TortoiseSVN InstallLocation
    if winreg is not None:
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
                                                existing.insert(0, cand)
                                                raise StopIteration
                            except StopIteration:
                                raise
                            except Exception:
                                continue
                except StopIteration:
                    break
                except Exception:
                    continue
        except Exception:
            pass
    # AppData portable path
    try:
        appdata = os.environ.get('APPDATA')
        if appdata:
            p = os.path.join(appdata, 'blender-launcher', 'tools', 'svn')
            if os.path.isdir(p):
                # prefer bin if exists
                pb = os.path.join(p, 'bin', 'svn.exe')
                if os.path.exists(pb):
                    existing.insert(0, pb)
                else:
                    # search extract folder
                    for root, _dirs, files in os.walk(p):
                        if 'svn.exe' in files:
                            existing.insert(0, os.path.join(root, 'svn.exe'))
                            break
    except Exception:
        pass
    return existing


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', required=True)
    parser.add_argument('--branch', default='master')
    parser.add_argument('--target', required=True)
    parser.add_argument('--name', required=False)
    args = parser.parse_args()

    repo_url = args.repo
    branch = args.branch
    target = os.path.abspath(args.target)

    echo('START', text='Préparation du clonage')

    # quick git presence check
    try:
        subprocess.check_call(['git', '--version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        echo('ERROR', message='Git introuvable dans le PATH')
        return 1

    ensure_dir(target)

    # derive folder name from repo and branch (override with --name if provided)
    if args.name:
        base_name = args.name.strip()
    else:
        base_name = os.path.splitext(os.path.basename(repo_url.rstrip('/')))[0] or 'blender'
        safe_branch = branch.replace('/', '_')
        base_name = f"{base_name}-{safe_branch}"
    clone_dir = os.path.join(target, base_name)

    # If folder already exists, append timestamp
    if os.path.exists(clone_dir):
        clone_dir = clone_dir + '-' + str(int(time.time()))

    echo('PROGRESS', progress=1, text='Clonage du dépôt…')

    # Install LFS in skip smudge mode if available
    try:
        subprocess.call(['git', 'lfs', 'install', '--skip-smudge'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Clone
    code, out = run(['git', 'clone', '--branch', branch, '--depth', '1', repo_url, clone_dir])
    if code != 0:
        # Fallback without LFS smudge
        code2, out2 = run(['git', '-c', 'filter.lfs.smudge=', '-c', 'filter.lfs.required=false', 'clone', '--branch', branch, '--depth', '1', repo_url, clone_dir])
        if code2 != 0:
            echo('ERROR', message='Echec du clone', detail=(out2 or out)[-400:])
            return 2
    echo('PROGRESS', progress=20, text='Clone terminé')

    # Windows build using make.bat wrappers
    is_win = os.name == 'nt'
    if not is_win:
        echo('ERROR', message='Flux de build Windows uniquement pour le moment')
        return 3

    # Ensure svn in PATH if we can locate it locally
    svn_paths = find_svn_candidates()
    if svn_paths:
        svn_dir = os.path.dirname(svn_paths[0])
        os.environ['PATH'] = svn_dir + os.pathsep + os.environ.get('PATH', '')
        echo('PROGRESS', progress=24, text=f'SVN détecté localement → PATH +={svn_dir}')

    # Run make update
    echo('PROGRESS', progress=25, text='Préparation des librairies (make update)…')
    make_cmd = ['cmd.exe', '/c', 'make', 'update']
    code, out = run(make_cmd, cwd=clone_dir)
    if code != 0:
        echo('ERROR', message='Echec make update', detail=out[-600:])
        return 4
    echo('PROGRESS', progress=60, text='Librairies récupérées')

    # Run make release
    echo('PROGRESS', progress=65, text='Compilation (make release)…')
    code, out = run(['cmd.exe', '/c', 'make', 'release'], cwd=clone_dir)
    if code != 0:
        echo('ERROR', message='Echec make release', detail=out[-800:])
        return 5
    echo('PROGRESS', progress=95, text='Compilation terminée')

    # Try to locate blender.exe under build folder
    exe_path = None
    try:
        # typical output folder search
        for root, dirs, files in os.walk(clone_dir):
            for f in files:
                if f.lower() == 'blender.exe':
                    exe_path = os.path.join(root, f)
                    break
            if exe_path:
                break
    except Exception:
        pass

    if not exe_path:
        echo('ERROR', message='blender.exe introuvable après la compilation')
        return 6

    echo('DONE', exe=exe_path)
    return 0

if __name__ == '__main__':
    sys.exit(main())

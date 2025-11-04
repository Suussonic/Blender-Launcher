#!/usr/bin/env python3
import sys, os, subprocess, argparse, shutil, time, glob
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

def run(cmd, cwd=None, shell=False, env=None, stream_output=False):
    """Run command and capture output. If stream_output=True, print live to console."""
    try:
        if stream_output:
            # For long operations like git clone, stream output directly
            p = subprocess.Popen(cmd, cwd=cwd, shell=shell, env=env)
            code = p.wait()
            return code, ''
        else:
            # Capture output for error reporting
            p = subprocess.Popen(cmd, cwd=cwd, shell=shell, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
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

# SVN is not required since Blender libraries are downloaded by make.bat.

def find_vsdevcmd() -> tuple[str | None, str | None]:
    """Locate VsDevCmd.bat for Visual Studio 2019/2022 to initialize MSVC env.
    Prefer vswhere, then fall back to common install paths.
    """
    # Try vswhere
    vswhere_candidates = [
        r"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
        r"C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe",
    ]
    product = None
    for vswhere in vswhere_candidates:
        if os.path.exists(vswhere):
            try:
                out = subprocess.check_output([
                    vswhere,
                    '-latest',
                    '-products','*',
                    '-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
                    '-property','installationPath'
                ], stderr=subprocess.DEVNULL, text=True, timeout=10)
                inst = (out or '').strip()
                if inst:
                    try:
                        pid = subprocess.check_output([
                            vswhere,
                            '-latest',
                            '-products','*',
                            '-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
                            '-property','productId'
                        ], stderr=subprocess.DEVNULL, text=True, timeout=10).strip()
                        product = pid or None
                    except Exception:
                        product = None
                    cand = os.path.join(inst, 'Common7', 'Tools', 'VsDevCmd.bat')
                    if os.path.exists(cand):
                        return cand, product
            except Exception:
                pass
    # Fallback to common paths
    fallbacks = [
        r"C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
        r"C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\Tools\\VsDevCmd.bat",
        r"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
        r"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\Common7\\Tools\\VsDevCmd.bat",
    ]
    for pth in fallbacks:
        if os.path.exists(pth):
            return pth, product
    return None, product

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

    # If folder already exists, reuse it when it's already a Blender clone
    skip_clone = False
    if os.path.exists(clone_dir):
        # Detect if it's a git repo pointing to the requested remote
        try:
            code_remote, remote_out = run(['git', '-C', clone_dir, 'remote', 'get-url', 'origin'])
            if code_remote == 0:
                remote = (remote_out or '').strip()
                def norm(u: str) -> str:
                    u = u.strip().lower().rstrip('/')
                    if u.endswith('.git'):
                        u = u[:-4]
                    return u
                if norm(remote).endswith(norm(repo_url)) or norm(repo_url).endswith(norm(remote)):
                    skip_clone = True
        except Exception:
            pass
        if not skip_clone:
            clone_dir = clone_dir + '-' + str(int(time.time()))

    if not skip_clone:
        echo('PROGRESS', progress=1, text='Clonage du dépôt…')

        # Clone - use subprocess.run for simpler flow, no output capture
        try:
            result = subprocess.run(
                ['git', 'clone', '--branch', branch, '--depth', '1', '--progress', repo_url, clone_dir],
                capture_output=False,
                text=True,
                timeout=600  # 10 min max for clone
            )
            if result.returncode != 0:
                echo('ERROR', message='Echec du clone')
                return 2
        except subprocess.TimeoutExpired:
            echo('ERROR', message='Clone timeout (>10min)')
            return 2
        except Exception as e:
            echo('ERROR', message='Echec du clone', detail=str(e))
            return 2
        
        echo('PROGRESS', progress=20, text='Clone terminé')
    else:
        echo('PROGRESS', progress=20, text='Clone déjà présent')

    # Windows build using make.bat wrappers
    is_win = os.name == 'nt'
    if not is_win:
        echo('ERROR', message='Flux de build Windows uniquement pour le moment')
        return 3

    # No SVN required; proceed directly to make update

    # Run make update (initialize MSVC env via VsDevCmd if available)
    echo('PROGRESS', progress=25, text='Préparation des librairies (make update)…')
    vsdev, product = find_vsdevcmd()
    vsver = None
    try:
        if vsdev:
            low = vsdev.lower()
            is_buildtools = 'buildtools' in low
            if '2022' in low:
                vsver = '2022b' if is_buildtools else '2022'
            elif '2019' in low:
                vsver = '2019b' if is_buildtools else '2019'
    except Exception:
        vsver = None
    if vsdev and os.path.exists(vsdev):
        # Use a temp .bat to avoid cmd parsing quirks
        bat_path = os.path.join(clone_dir, '_bl_make_update.bat')
        try:
            with open(bat_path, 'w', encoding='utf-8') as f:
                f.write('@echo off\r\n')
                f.write(f'call "{vsdev}"\r\n')
                # Don't force generator - let make.bat decide per official docs
                # Use make.bat explicitly and add verbose for diagnostics
                if vsver:
                    f.write(f'call make.bat update {vsver} verbose\r\n')
                else:
                    f.write(f'call make.bat update verbose\r\n')
        except Exception:
            bat_path = None
        make_cmd = ['cmd.exe', '/c', bat_path] if bat_path else ['cmd.exe', '/c', f'call "{vsdev}" && make update']
    else:
        make_cmd = ['cmd.exe', '/c', 'make.bat', 'update', 'verbose']
    code, out = run(make_cmd, cwd=clone_dir, shell=False)
    if code != 0:
        # Detect common VS missing workload error and provide an actionable hint
        lower_out = (out or '').lower()
        needs_vs_workload = (
            'no suitable installation was found' in lower_out or
            'desktop development with c++' in lower_out or
            'visual studio 2022 not found' in lower_out or
            'vs_installdir' in lower_out
        )
        if needs_vs_workload:
            hint = (
                'Ouvrez PowerShell en Administrateur puis lancez:\n'
                'winget install --id Microsoft.VisualStudio.2022.Community -e '
                '--accept-package-agreements --accept-source-agreements '
                '--override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended"'
            )
            echo('ERROR', message='Echec make update (Visual Studio incomplet: workload C++ manquante)', detail=out[-600:], hint=hint)
        else:
            echo('ERROR', message='Echec make update', detail=out[-600:])
        return 4
    echo('PROGRESS', progress=60, text='Librairies récupérées')

    # Compile (per docs, plain `make` builds and installs the binaries)
    echo('PROGRESS', progress=65, text='Compilation (make)…')
    if vsdev and os.path.exists(vsdev):
        bat_path_b = os.path.join(clone_dir, '_bl_make_build.bat')
        try:
            with open(bat_path_b, 'w', encoding='utf-8') as f:
                f.write('@echo off\r\n')
                f.write(f'call "{vsdev}"\r\n')
                # Don't force generator - let make.bat decide per official docs
                if vsver:
                    f.write(f'call make.bat {vsver} verbose\r\n')
                else:
                    f.write(f'call make.bat verbose\r\n')
        except Exception:
            bat_path_b = None
        build_cmd = ['cmd.exe', '/c', bat_path_b] if bat_path_b else ['cmd.exe', '/c', f'call "{vsdev}" && call make.bat verbose']
    else:
        build_cmd = ['cmd.exe', '/c', 'make.bat', 'verbose']
    code, out = run(build_cmd, cwd=clone_dir, shell=False)
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

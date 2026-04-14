#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Clone and compile a Blender source tree on Windows.

Pipeline:
1) clone repository,
2) run `make.bat update`,
3) run `make.bat release`,
4) locate `blender.exe`.

This script emits `BL_CLONE:` markers consumed by Electron.
"""
import sys
import os
import subprocess
import argparse
import time

from utils.ipc_output import emit_marker
from utils.windows_tools import detect_pwsh_failure
from utils.windows_tools import ensure_pwsh_available

# Force UTF-8 encoding to avoid Windows console rendering issues
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def echo(tag, **kv):
    """Emit an IPC-parseable progress message."""
    emit_marker('BL_CLONE:', tag, sep=' ', **kv)


def warn_if_spaces_in_path(path_value: str):
    """Warn when the source/build path contains spaces, per Blender docs."""
    if path_value and ' ' in path_value:
        echo('LOG', text=f'Attention: le chemin contient des espaces et Blender indique que cela peut casser le build: {path_value}')

def main():
    parser = argparse.ArgumentParser(description='Clone and compile Blender')
    parser.add_argument('--repo', required=True, help='Repository URL')
    parser.add_argument('--branch', required=True, help='Branch name')
    parser.add_argument('--target', required=True, help='Target directory')
    parser.add_argument('--name', help='Folder name (optional)')
    args = parser.parse_args()

    repo_url = args.repo
    branch = args.branch
    target = args.target
    folder_name = args.name

    echo('START', text='Début du clonage et compilation')
    warn_if_spaces_in_path(os.path.abspath(target))

    # === STEP 1: Verify Git ===
    echo('PROGRESS', progress=1, text='Vérification de Git...')
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            echo('ERROR', message='Git introuvable')
            return 1
    except Exception as e:
        echo('ERROR', message=f'Git introuvable: {e}')
        return 1

    # === STEP 2: Verify CMake ===
    echo('PROGRESS', progress=2, text='Vérification de CMake...')
    try:
        result = subprocess.run(['cmake', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            echo('ERROR', message='CMake introuvable')
            return 1
    except Exception as e:
        echo('ERROR', message=f'CMake introuvable: {e}')
        return 1
    
    # === STEP 2.5: Verify Visual Studio ===
    echo('PROGRESS', progress=3, text='Vérification de Visual Studio...')
    vswhere_paths = [
        r'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe',
        r'C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe'
    ]
    vs_found = False
    vs_path = None
    vcvarsall_path = None
    vs_devshell = None
    
    for vswhere in vswhere_paths:
        if os.path.exists(vswhere):
            # Try first with the required C++ component
            try:
                result = subprocess.run(
                    [vswhere, '-latest', '-products', '*', 
                     '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
                     '-property', 'installationPath'],
                    capture_output=True, text=True, timeout=10
                )
                if result.returncode == 0 and result.stdout.strip():
                    vs_path = result.stdout.strip()
            except:
                pass
            
            # If not found, search any VS installation with build tools
            if not vs_path:
                try:
                    result = subprocess.run(
                        [vswhere, '-latest', '-products', '*', '-property', 'installationPath'],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        candidate = result.stdout.strip()
                        # Verify that vcvarsall.bat exists
                        test_vcvarsall = os.path.join(candidate, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat')
                        if os.path.exists(test_vcvarsall):
                            vs_path = candidate
                except:
                    pass
            
            if vs_path:
                # Find vcvarsall.bat
                vcvarsall_candidate = os.path.join(vs_path, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat')
                if os.path.exists(vcvarsall_candidate):
                    vcvarsall_path = vcvarsall_candidate
                    vs_found = True
                
                # Find VsDevCmd.bat (preferred for make.bat)
                vsdevcmd_candidate = os.path.join(vs_path, 'Common7', 'Tools', 'VsDevCmd.bat')
                if os.path.exists(vsdevcmd_candidate):
                    vs_devshell = vsdevcmd_candidate
                
                if vs_found:
                    echo('PROGRESS', progress=4, text=f'Visual Studio trouvé: {vs_path}')
                    break
    
    if not vs_found or not vcvarsall_path:
        echo('ERROR', message='Visual Studio 2022 avec outils C++ introuvable. Installez Build Tools ou Community avec "Desktop development with C++"')
        return 1
    # === STEP 3: Create target directory ===
    try:
        if not os.path.isdir(target):
            os.makedirs(target, exist_ok=True)
    except Exception as e:
        echo('ERROR', message=f'Impossible de créer le dossier cible: {e}')
        return 1

    # === STEP 4: Resolve target folder name ===
    if folder_name:
        clone_dir = os.path.join(target, folder_name)
    else:
        repo_name = os.path.splitext(os.path.basename(repo_url.rstrip('/')))[0] or 'blender'
        safe_branch = branch.replace('/', '_')
        clone_dir = os.path.join(target, f"{repo_name}-{safe_branch}")

    # Check whether target already exists
    if os.path.exists(clone_dir):
        try:
            result = subprocess.run(
                ['git', '-C', clone_dir, 'remote', 'get-url', 'origin'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                existing_remote = result.stdout.strip().lower().rstrip('/').rstrip('.git')
                requested_remote = repo_url.strip().lower().rstrip('/').rstrip('.git')
                if existing_remote.endswith(requested_remote) or requested_remote.endswith(existing_remote):
                    echo('PROGRESS', progress=10, text=f'Dossier {clone_dir} existe déjà, configuration...')
                    # Set core.symlinks=false to avoid Python/library symlink issues
                    try:
                        subprocess.run(
                            ['git', '-C', clone_dir, 'config', 'core.symlinks', 'false'],
                            capture_output=True, timeout=5
                        )
                    except:
                        pass
                    # Skip cloning but continue with compilation
                    pass
                else:
                    clone_dir = f"{clone_dir}-{int(time.time())}"
        except:
            clone_dir = f"{clone_dir}-{int(time.time())}"
    
    # === STEP 5: Clone ===
    if not os.path.exists(os.path.join(clone_dir, '.git')):
        echo('PROGRESS', progress=5, text=f'Clonage vers {clone_dir}...')
        try:
            # Clone with core.symlinks=false on Windows (prevents broken Python/library symlinks)
            result = subprocess.run(
                ['git', '-c', 'core.symlinks=false', 'clone', '--branch', branch, '--depth', '1', repo_url, clone_dir],
                capture_output=False,
                text=True,
                timeout=1800  # 30 min max
            )
            if result.returncode != 0:
                echo('ERROR', message='Échec du clone git')
                return 2
            
            # Configure repository to never use symlinks
            try:
                subprocess.run(['git', '-C', clone_dir, 'config', 'core.symlinks', 'false'], 
                              capture_output=True, timeout=5)
                # Also configure submodule behavior
                subprocess.run(['git', '-C', clone_dir, 'config', 'submodule.recurse', 'false'],
                              capture_output=True, timeout=5)
            except:
                pass
                
        except subprocess.TimeoutExpired:
            echo('ERROR', message='Clone timeout (>30min)')
            return 2
        except Exception as e:
            echo('ERROR', message=f'Erreur clone: {e}')
            return 2
        echo('PROGRESS', progress=15, text='Clone terminé')
    else:
        echo('PROGRESS', progress=15, text='Repository déjà cloné')

    # === STEP 6: Ensure Windows environment ===
    if os.name != 'nt':
        echo('ERROR', message='Compilation Windows uniquement')
        return 3

    # Some Blender rules call pwsh.exe explicitly.
    pwsh_ok, pwsh_ref = ensure_pwsh_available()
    if not pwsh_ok:
        echo('ERROR', message='pwsh.exe introuvable. Installez PowerShell 7 (winget install --id Microsoft.PowerShell -e) ou vérifiez powershell.exe.')
        return 3
    if pwsh_ref and pwsh_ref != 'pwsh':
        echo('PROGRESS', progress=19, text='pwsh.exe absent, shim PowerShell activé')

    # === STEP 7: Verify make.bat ===
    make_bat = os.path.join(clone_dir, 'make.bat')
    if not os.path.exists(make_bat):
        echo('ERROR', message='make.bat introuvable dans le repository cloné')
        return 3

    # === STEP 8: MAKE UPDATE (library download - LONG) ===
    echo('PROGRESS', progress=20, text='Téléchargement des libraries (peut prendre 10-30 min)...')
    
    # Do not pre-initialize submodules; make update handles that automatically
    # avec BUILD_BLENDER_NO_PROMPT=1
    lib_path = os.path.join(clone_dir, 'lib', 'windows_x64')
    
    # Resolve make.bat arguments based on Visual Studio flavor
    make_args = []
    if 'BuildTools' in vs_path:
        # Use Build Tools variant
        if '2022' in vs_path:
            make_args.append('2022b')
        elif '2019' in vs_path:
            make_args.append('2019b')
        echo('PROGRESS', progress=40, text='Utilisation de Visual Studio Build Tools')
    
    # Use VsDevCmd.bat when available, otherwise fall back to vcvarsall.bat
    if not vs_devshell:
        vs_devshell = vcvarsall_path
        shell_args = 'x64'
    else:
        shell_args = '-arch=x64 -host_arch=x64'
    
    try:
        # Create a batch script that uses cmd.exe as recommended by Blender docs
        batch_script = os.path.join(clone_dir, 'temp_make_update.bat')
        make_cmd = f'make.bat update {" ".join(make_args)}' if make_args else 'make.bat update'
        
        with open(batch_script, 'w', encoding='utf-8') as f:
            f.write('@echo off\n')
            f.write('echo ===== Configuration Visual Studio =====\n')
            f.write(f'call "{vs_devshell}" {shell_args}\n')
            f.write('if errorlevel 1 (\n')
            f.write('  echo ERROR: Visual Studio environment setup failed\n')
            f.write('  exit /b 1\n')
            f.write(')\n')
            f.write('echo ===== VS environment OK =====\n')
            # Disable interactive Blender prompts
            f.write('set BUILD_BLENDER_NO_PROMPT=1\n')
            f.write('cd /d "%~dp0"\n')  # Change to script directory (clone_dir)
            # Force system Python because bundled Python can be a broken symlink
            f.write('for /f "delims=" %%i in (\'where python\') do set PYTHON=%%i & goto :found_python\n')
            f.write(':found_python\n')
            f.write('echo Using Python: %PYTHON%\n')
            f.write('echo Current directory: %CD%\n')
            f.write(f'echo ===== Running {make_cmd} =====\n')
            # BUILD_BLENDER_NO_PROMPT=1 disables all interactive questions
            f.write(f'{make_cmd}\n')
            f.write('exit /b %errorlevel%\n')
        
        # Use cmd.exe explicitly, as recommended by Blender docs
        result = subprocess.run(
            ['cmd.exe', '/c', batch_script],
            cwd=clone_dir,
            capture_output=True,
            text=True,
            timeout=3600
        )
        
        # Log output tail for diagnostics
        if result.stdout:
            # Forward important trailing lines to stderr for logging
            for line in result.stdout.splitlines()[-10:]:
                if line.strip():
                    try:
                        print(line, file=sys.stderr, flush=True)
                    except:
                        pass
        
        # Remove temporary script
        try:
            os.remove(batch_script)
        except:
            pass

        all_output = (result.stdout or '') + '\n' + (result.stderr or '')
        pwsh_error = detect_pwsh_failure(all_output)
        if pwsh_error:
            echo('ERROR', message=pwsh_error)
            return 4
        
        if result.returncode != 0:
            error_msg = 'Échec make update'
            
            # Look for error signals in stdout and stderr
            error_lines = []
            
            for line in all_output.splitlines():
                line_clean = line.strip()
                if any(keyword in line_clean.lower() for keyword in ['error', 'fail', 'not found', 'introuvable', 'impossible', 'detection failed', 'fatal', 'cannot', 'unable']):
                    error_lines.append(line_clean)
            
            if error_lines:
                # Keep the most relevant trailing error lines
                error_msg = ' | '.join(error_lines[-5:])[:400]
            elif result.stderr:
                stderr_lines = [l.strip() for l in result.stderr.splitlines() if l.strip()]
                if stderr_lines:
                    error_msg = ' | '.join(stderr_lines[-3:])[:300]
            elif result.stdout:
                # If no explicit errors found, fall back to trailing stdout lines
                stdout_lines = [l.strip() for l in result.stdout.splitlines() if l.strip()]
                if stdout_lines:
                    error_msg = ' | '.join(stdout_lines[-5:])[:400]
            
            echo('ERROR', message=f'make update: {error_msg}')
            return 4
    except subprocess.TimeoutExpired:
        echo('ERROR', message='make update timeout (>1h)')
        return 4
    except Exception as e:
        echo('ERROR', message=f'Erreur make update: {e}')
        return 4
    
    echo('PROGRESS', progress=60, text='Libraries téléchargées')

    # === STEP 9: MAKE RELEASE (compilation - VERY LONG) ===
    echo('PROGRESS', progress=65, text='Compilation release (peut prendre 30-60 min)...')
    try:
        # Create a temporary batch script for compilation
        batch_script = os.path.join(clone_dir, 'temp_make.bat')
        make_cmd = f'make.bat release {" ".join(make_args)} verbose' if make_args else 'make.bat release verbose'
        
        with open(batch_script, 'w', encoding='utf-8') as f:
            f.write('@echo off\n')
            f.write('echo ===== Configuration Visual Studio pour compilation =====\n')
            f.write(f'call "{vs_devshell}" {shell_args}\n')
            f.write('if errorlevel 1 (\n')
            f.write('  echo ERROR: Visual Studio environment setup failed\n')
            f.write('  exit /b 1\n')
            f.write(')\n')
            f.write('echo ===== VS environment OK =====\n')
            f.write('cd /d "%~dp0"\n')
            f.write('echo Current directory: %CD%\n')
            f.write(f'echo ===== Running {make_cmd} =====\n')
            f.write(f'{make_cmd}\n')
            f.write('exit /b %errorlevel%\n')
        
        # Use cmd.exe explicitly
        result = subprocess.run(
            ['cmd.exe', '/c', batch_script],
            cwd=clone_dir,
            capture_output=True,
            text=True,
            timeout=7200
        )
        
        # Remove temporary script
        try:
            os.remove(batch_script)
        except:
            pass

        all_output = (result.stdout or '') + '\n' + (result.stderr or '')
        pwsh_error = detect_pwsh_failure(all_output)
        if pwsh_error:
            echo('ERROR', message=pwsh_error)
            return 5
        
        if result.returncode != 0:
            error_msg = 'Échec compilation'
            if result.stderr:
                stderr_lines = [l.strip() for l in result.stderr.splitlines() if l.strip()]
                if stderr_lines:
                    error_msg = f'make release: {stderr_lines[-1][:150]}'
            echo('ERROR', message=error_msg)
            return 5
    except subprocess.TimeoutExpired:
        echo('ERROR', message='Compilation timeout (>2h)')
        return 5
    except Exception as e:
        echo('ERROR', message=f'Erreur compilation: {e}')
        return 5
    
    echo('PROGRESS', progress=95, text='Compilation terminée')

    # === STEP 10: Locate blender.exe ===
    echo('PROGRESS', progress=97, text='Recherche de blender.exe...')
    exe_path = None
    try:
        # Search in build_windows_* outputs
        for root, dirs, files in os.walk(clone_dir):
            # Limit depth to avoid excessive traversal
            if root.count(os.sep) - clone_dir.count(os.sep) > 5:
                continue
            for f in files:
                if f.lower() == 'blender.exe':
                    candidate = os.path.join(root, f)
                    # Prefer locations under bin/Release-style folders
                    if 'bin' in candidate.lower() or 'release' in candidate.lower():
                        exe_path = candidate
                        break
            if exe_path:
                break
    except Exception as e:
        echo('ERROR', message=f'Erreur recherche exe: {e}')
        return 6

    if not exe_path or not os.path.exists(exe_path):
        echo('ERROR', message='blender.exe introuvable après compilation')
        return 6

    echo('PROGRESS', progress=100, text='Compilation réussie!')
    echo('DONE', exe=exe_path, path=clone_dir)
    return 0

if __name__ == '__main__':
    sys.exit(main())

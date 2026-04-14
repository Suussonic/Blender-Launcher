#!/usr/bin/env python3
"""
Minimal script to clone a Blender repository.
CLONE ONLY - no build.
"""
import sys
import os
import subprocess
import argparse

def echo(tag, **kv):
    """Emit an IPC-parseable progress message."""
    parts = ['BL_CLONE:' + tag]
    for k, v in kv.items():
        if v is not None:
            s = str(v).replace('\n', ' ').replace('\r', ' ').replace('\t', ' ').strip()
            parts.append(f"{k}={s}")
    # Use tab separator so paths with spaces are not split by the IPC parser
    try:
        print('\t'.join(parts), flush=True)
    except:
        try:
            sys.stdout.write('\t'.join(parts) + '\n')
            sys.stdout.flush()
        except:
            pass

def main():
    parser = argparse.ArgumentParser(description='Clone Blender repository')
    parser.add_argument('--repo', required=True, help='Repository URL')
    parser.add_argument('--branch', required=True, help='Branch name')
    parser.add_argument('--target', required=True, help='Target directory')
    parser.add_argument('--name', help='Folder name (optional)')
    args = parser.parse_args()

    repo_url = args.repo
    branch = args.branch
    target = args.target
    folder_name = args.name

    echo('START', text='Début du clonage')

    # Verify Git availability
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            echo('ERROR', message='Git introuvable')
            return 1
    except Exception as e:
        echo('ERROR', message=f'Git introuvable: {e}')
        return 1

    # Create target directory when needed
    try:
        if not os.path.isdir(target):
            os.makedirs(target, exist_ok=True)
    except Exception as e:
        echo('ERROR', message=f'Impossible de créer le dossier cible: {e}')
        return 1

    # Resolve clone folder name
    if folder_name:
        clone_dir = os.path.join(target, folder_name)
    else:
        # Default: repo name + branch
        repo_name = os.path.splitext(os.path.basename(repo_url.rstrip('/')))[0] or 'blender'
        safe_branch = branch.replace('/', '_')
        clone_dir = os.path.join(target, f"{repo_name}-{safe_branch}")

    # Check if the target folder already exists
    if os.path.exists(clone_dir):
        # If this is already the expected git remote, reuse it
        try:
            result = subprocess.run(
                ['git', '-C', clone_dir, 'remote', 'get-url', 'origin'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                existing_remote = result.stdout.strip().lower().rstrip('/').rstrip('.git')
                requested_remote = repo_url.strip().lower().rstrip('/').rstrip('.git')
                if existing_remote.endswith(requested_remote) or requested_remote.endswith(existing_remote):
                    echo('PROGRESS', progress=20, text=f'Dossier {clone_dir} existe déjà')
                    echo('DONE', path=clone_dir)
                    return 0
        except:
            pass
        
        # Otherwise add a timestamp to avoid collisions
        import time
        clone_dir = f"{clone_dir}-{int(time.time())}"

    echo('PROGRESS', progress=5, text=f'Clonage vers {clone_dir}')

    # Clone with git
    # Skip LFS during clone to avoid failures when LFS budget is exceeded,
    # server is down, or repo has broken LFS pointers. We'll try LFS pull separately after.
    try:
        echo('PROGRESS', progress=10, text='Clone en cours...')
        
        clone_env = os.environ.copy()
        clone_env['GIT_LFS_SKIP_SMUDGE'] = '1'

        # Start clone process
        result = subprocess.run(
            ['git', 'clone', '--branch', branch, '--depth', '1', '--progress', repo_url, clone_dir],
            capture_output=False,  # Laisser l'output visible
            text=True,
            timeout=1800,  # 30 minutes max
            env=clone_env
        )
        
        if result.returncode != 0:
            # Clone may report failure but still create the directory with partial checkout.
            # Check if we can salvage it.
            if os.path.isdir(os.path.join(clone_dir, '.git')):
                echo('PROGRESS', progress=60, text='Clone partiel détecté — tentative de récupération…')
                try:
                    subprocess.run(
                        ['git', '-C', clone_dir, 'restore', '--source=HEAD', ':/'],
                        capture_output=True, text=True, timeout=300, env=clone_env
                    )
                except Exception:
                    pass
            else:
                echo('ERROR', message='Échec du clone git')
                return 2
            
    except subprocess.TimeoutExpired:
        echo('ERROR', message='Timeout du clone (>30min)')
        return 2
    except Exception as e:
        echo('ERROR', message=f'Erreur clone: {e}')
        return 2

    # Try to pull LFS files (best effort — not fatal if it fails)
    if os.path.isdir(os.path.join(clone_dir, '.git')):
        try:
            echo('PROGRESS', progress=80, text='Récupération des fichiers LFS…')
            lfs_result = subprocess.run(
                ['git', '-C', clone_dir, 'lfs', 'pull'],
                capture_output=True, text=True, timeout=600
            )
            if lfs_result.returncode != 0:
                echo('LOG', text='LFS pull échoué (non bloquant) — les fichiers LFS seront des pointeurs')
        except Exception:
            echo('LOG', text='LFS indisponible (non bloquant)')

    echo('PROGRESS', progress=100, text='Clone terminé')
    echo('DONE', path=clone_dir)
    return 0

if __name__ == '__main__':
    sys.exit(main())

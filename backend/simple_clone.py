#!/usr/bin/env python3
"""
Script ultra-simple pour cloner un dépôt Blender.
UNIQUEMENT LE CLONE - pas de build.
"""
import sys
import os
import subprocess
import argparse

def echo(tag, **kv):
    """Émettre un message de progression parsable par l'IPC"""
    parts = ['BL_CLONE:' + tag]
    for k, v in kv.items():
        if v is not None:
            s = str(v).replace('\n', ' ').replace('\r', ' ').strip()
            parts.append(f"{k}={s}")
    try:
        print(' '.join(parts), flush=True)
    except:
        try:
            sys.stdout.write(' '.join(parts) + '\n')
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

    # Vérifier que git existe
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            echo('ERROR', message='Git introuvable')
            return 1
    except Exception as e:
        echo('ERROR', message=f'Git introuvable: {e}')
        return 1

    # Créer le dossier cible si nécessaire
    try:
        if not os.path.isdir(target):
            os.makedirs(target, exist_ok=True)
    except Exception as e:
        echo('ERROR', message=f'Impossible de créer le dossier cible: {e}')
        return 1

    # Déterminer le nom du dossier de clone
    if folder_name:
        clone_dir = os.path.join(target, folder_name)
    else:
        # Par défaut: nom du repo + branche
        repo_name = os.path.splitext(os.path.basename(repo_url.rstrip('/')))[0] or 'blender'
        safe_branch = branch.replace('/', '_')
        clone_dir = os.path.join(target, f"{repo_name}-{safe_branch}")

    # Vérifier si le dossier existe déjà
    if os.path.exists(clone_dir):
        # Si c'est déjà un dépôt git du bon remote, on le réutilise
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
        
        # Sinon, ajouter un timestamp pour éviter la collision
        import time
        clone_dir = f"{clone_dir}-{int(time.time())}"

    echo('PROGRESS', progress=5, text=f'Clonage vers {clone_dir}')

    # CLONE avec git
    # Utiliser --progress pour voir la progression
    try:
        echo('PROGRESS', progress=10, text='Clone en cours...')
        
        # Lancer le clone
        result = subprocess.run(
            ['git', 'clone', '--branch', branch, '--depth', '1', '--progress', repo_url, clone_dir],
            capture_output=False,  # Laisser l'output visible
            text=True,
            timeout=1800  # 30 minutes max
        )
        
        if result.returncode != 0:
            echo('ERROR', message='Échec du clone git')
            return 2
            
    except subprocess.TimeoutExpired:
        echo('ERROR', message='Timeout du clone (>30min)')
        return 2
    except Exception as e:
        echo('ERROR', message=f'Erreur clone: {e}')
        return 2

    echo('PROGRESS', progress=100, text='Clone terminé')
    echo('DONE', path=clone_dir)
    return 0

if __name__ == '__main__':
    sys.exit(main())

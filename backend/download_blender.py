"""
Download official Blender releases
"""
import sys
import os
import json
import urllib.request
import zipfile
import shutil
from pathlib import Path

def get_config_path():
    """Resolve config.json path relative to project root."""
    # backend/ -> project root one level up
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'config.json'))

def update_config(blender_exe: str, version: str):
    """Append the blender executable entry into config.json under 'blenders' avoiding duplicates."""
    cfg_path = get_config_path()
    title = f"Blender {version}".strip()
    try:
        if not os.path.exists(cfg_path):
            log(f"config.json non trouvé, création: {cfg_path}")
            data = {"blenders": []}
        else:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                raw = f.read().strip() or '{}'
            data = json.loads(raw)
        if not isinstance(data, dict):
            data = {"blenders": []}
        if "blenders" not in data or not isinstance(data["blenders"], list):
            data["blenders"] = []
        # Deduplicate by path
        already = any(entry.get('path') == blender_exe for entry in data["blenders"] if isinstance(entry, dict))
        if already:
            log("Entrée déjà présente dans config.json, pas d'ajout")
        else:
            data["blenders"].append({
                "path": blender_exe,
                "name": os.path.basename(blender_exe),
                "title": title
            })
            with open(cfg_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            log("config.json mis à jour avec l'exécutable")
        # Emit separate message for config update
        print(json.dumps({"type": "config-updated", "path": blender_exe, "title": title}), flush=True)
    except Exception as e:
        error(f"config-update-failed: {e}")

def log(msg):
    """Log message to stdout for IPC"""
    print(json.dumps({"type": "log", "message": msg}), flush=True)

def progress(percent, text):
    """Send progress update"""
    print(json.dumps({"type": "progress", "progress": percent, "text": text}), flush=True)

def error(msg):
    """Send error"""
    print(json.dumps({"type": "error", "message": msg}), flush=True)

def complete(exe_path):
    """Send completion"""
    print(json.dumps({"type": "complete", "path": exe_path}), flush=True)

def find_blender_exe(directory):
    """Find blender.exe recursively"""
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower() == 'blender.exe':
                return os.path.join(root, file)
    return None

def download_blender(version, url, target_path, folder_name):
    """Download and extract Blender"""
    try:
        log(f"Starting download: {version}")
        log(f"URL: {url}")
        log(f"Target: {target_path}")
        log(f"Folder: {folder_name}")
        
        # Create target directory
        final_path = os.path.join(target_path, folder_name)
        os.makedirs(final_path, exist_ok=True)
        log(f"Created directory: {final_path}")
        
        progress(5, "Téléchargement démarré...")
        
        # Download ZIP
        zip_path = os.path.join(final_path, "blender.zip")
        log(f"Downloading to: {zip_path}")
        
        def report_hook(block_num, block_size, total_size):
            if total_size > 0:
                downloaded = block_num * block_size
                percent = min(100, int((downloaded / total_size) * 70)) + 5
                progress(percent, f"Téléchargement: {int((downloaded / total_size) * 100)}%")
        
        urllib.request.urlretrieve(url, zip_path, report_hook)
        log(f"Download complete: {zip_path}")
        
        progress(80, "Extraction...")
        
        # Extract ZIP
        log("Starting extraction...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(final_path)
        log("Extraction complete")
        
        # Delete ZIP
        os.remove(zip_path)
        log("ZIP removed")
        
        progress(90, "Recherche de l'exécutable...")
        
        # Find blender.exe
        blender_exe = find_blender_exe(final_path)
        if not blender_exe:
            error("blender.exe not found")
            return False
        
        log(f"Found blender.exe: {blender_exe}")
        # Update config.json before completion
        update_config(blender_exe, version)
        progress(100, "Installation terminée!")
        complete(blender_exe)
        return True
        
    except Exception as e:
        error(str(e))
        log(f"Exception: {type(e).__name__}: {str(e)}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 5:
        error("Usage: download_blender.py <version> <url> <target_path> <folder_name>")
        sys.exit(1)
    
    version = sys.argv[1]
    url = sys.argv[2]
    target_path = sys.argv[3]
    folder_name = sys.argv[4]
    
    log("Script started")
    success = download_blender(version, url, target_path, folder_name)
    sys.exit(0 if success else 1)

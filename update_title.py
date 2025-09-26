#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script simple pour modifier le titre d'un exécutable dans config.json
Usage: python update_title.py "chemin_exe" "nouveau_titre"
"""

import json
import sys
import os

def update_title(exe_path, new_title):
    """Met à jour le titre d'un exécutable dans config.json"""
    
    # Chemin du fichier config.json
    config_path = 'config.json'
    
    try:
        # Step 1: Read the JSON file
        with open(config_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        # Step 2: Modify the data
        found = False
        for blender in data.get('blenders', []):
            if blender.get('path') == exe_path:
                blender['title'] = new_title
                found = True
                break
        
        if not found:
            print(f'{{"success": false, "error": "Exécutable non trouvé: {exe_path}"}}')
            return
        
        # Step 3: Write the updated data back to the file
        with open(config_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
        
        print(f'{{"success": true, "message": "Titre mis à jour avec succès"}}')
        
    except FileNotFoundError:
        print(f'{{"success": false, "error": "Fichier config.json non trouvé"}}')
    except json.JSONDecodeError as e:
        print(f'{{"success": false, "error": "Erreur JSON: {str(e)}"}}')
    except Exception as e:
        print(f'{{"success": false, "error": "Erreur: {str(e)}"}}')

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print('{"success": false, "error": "Usage: python update_title.py <exe_path> <new_title>"}')
        sys.exit(1)
    
    exe_path = sys.argv[1]
    new_title = sys.argv[2]
    
    update_title(exe_path, new_title)
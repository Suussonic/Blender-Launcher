#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilitaires pour Blender Launcher
Génération de titres, extraction d'icônes, etc.
"""

import os
import re
from pathlib import Path
from typing import Optional


def generate_title_from_filename(filename: str) -> str:
    """
    Génère un titre propre à partir du nom de fichier
    
    Args:
        filename: Nom du fichier (ex: "blender.exe")
        
    Returns:
        str: Titre formaté (ex: "Blender")
    """
    # Retire l'extension
    name_without_ext = Path(filename).stem
    
    # Cas spéciaux courants
    special_cases = {
        'blender': 'Blender',
        'git-bash': 'Git Bash',
        'code': 'Visual Studio Code',
        'chrome': 'Google Chrome',
        'firefox': 'Mozilla Firefox',
        'steam': 'Steam',
        'discord': 'Discord',
        'notepad++': 'Notepad++',
        'gimp': 'GIMP',
        'vlc': 'VLC Media Player',
        'photoshop': 'Adobe Photoshop',
        'illustrator': 'Adobe Illustrator',
        'aftereffects': 'Adobe After Effects',
        'unity': 'Unity',
        'unreal': 'Unreal Engine',
        'maya': 'Autodesk Maya',
        'max': '3ds Max',
        'cinema4d': 'Cinema 4D',
        'zbrush': 'ZBrush'
    }
    
    lower_name = name_without_ext.lower()
    if lower_name in special_cases:
        return special_cases[lower_name]
    
    # Capitalise la première lettre de chaque mot et remplace les séparateurs
    title = (name_without_ext
             .replace('-', ' ')
             .replace('_', ' ')
             .replace('.', ' '))
    
    # Sépare les mots en CamelCase
    title = re.sub(r'([a-z])([A-Z])', r'\1 \2', title)
    
    # Capitalise chaque mot
    words = title.split()
    capitalized_words = []
    
    for word in words:
        if word:
            # Garde les acronymes en majuscules (ex: "API", "UI")
            if word.isupper() and len(word) <= 4:
                capitalized_words.append(word)
            else:
                capitalized_words.append(word.capitalize())
    
    return ' '.join(capitalized_words)


def validate_executable_path(exe_path: str) -> bool:
    """
    Valide qu'un chemin d'exécutable est valide
    
    Args:
        exe_path: Chemin vers l'exécutable
        
    Returns:
        bool: True si le chemin est valide
    """
    if not exe_path:
        return False
    
    path = Path(exe_path)
    
    # Vérifie que le fichier existe
    if not path.exists():
        return False
    
    # Vérifie que c'est un fichier (pas un dossier)
    if not path.is_file():
        return False
    
    # Vérifie l'extension (Windows)
    if os.name == 'nt':  # Windows
        valid_extensions = ['.exe', '.bat', '.cmd', '.com']
        return path.suffix.lower() in valid_extensions
    else:  # Linux/Mac
        # Sur Unix, vérifie les permissions d'exécution
        return os.access(exe_path, os.X_OK)


def sanitize_filename(filename: str) -> str:
    """
    Nettoie un nom de fichier pour éviter les caractères problématiques
    
    Args:
        filename: Nom de fichier à nettoyer
        
    Returns:
        str: Nom de fichier sécurisé
    """
    # Remplace les caractères interdits par des underscores
    invalid_chars = r'[<>:"/\\|?*]'
    clean_name = re.sub(invalid_chars, '_', filename)
    
    # Limite la longueur
    if len(clean_name) > 255:
        clean_name = clean_name[:255]
    
    # Retire les espaces en début/fin
    clean_name = clean_name.strip()
    
    # Évite les noms réservés Windows
    reserved_names = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ]
    
    name_upper = clean_name.upper()
    if name_upper in reserved_names or name_upper.split('.')[0] in reserved_names:
        clean_name = f"_{clean_name}"
    
    return clean_name


def get_executable_info(exe_path: str) -> dict:
    """
    Extrait les informations d'un exécutable
    
    Args:
        exe_path: Chemin vers l'exécutable
        
    Returns:
        dict: Informations de l'exécutable
    """
    if not validate_executable_path(exe_path):
        return {
            "valid": False,
            "error": "Chemin d'exécutable invalide"
        }
    
    path = Path(exe_path)
    filename = path.name
    title = generate_title_from_filename(filename)
    
    return {
        "valid": True,
        "path": str(path.absolute()),
        "name": filename,
        "title": title,
        "directory": str(path.parent),
        "size": path.stat().st_size,
        "extension": path.suffix.lower()
    }


if __name__ == "__main__":
    # Tests unitaires basiques
    import sys
    
    if len(sys.argv) > 1:
        test_path = sys.argv[1]
        info = get_executable_info(test_path)
        print(f"Informations pour {test_path}:")
        for key, value in info.items():
            print(f"  {key}: {value}")
    else:
        # Tests de génération de titre
        test_cases = [
            "blender.exe",
            "git-bash.exe", 
            "FactoryGameSteam.exe",
            "SonicRacingCrossWorlds.exe",
            "Adobe_Photoshop_2024.exe",
            "UnityHub.exe",
            "my_custom_app.exe"
        ]
        
        print("Tests de génération de titre:")
        for case in test_cases:
            title = generate_title_from_filename(case)
            print(f"  {case} → {title}")
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utility helpers for Blender Launcher.
Title generation, executable metadata extraction, etc.
"""

import os
import re
from pathlib import Path
from typing import Optional


def generate_title_from_filename(filename: str) -> str:
    """
    Generate a clean title from a file name.
    
    Args:
        filename: File name (example: "blender.exe").
        
    Returns:
        str: Formatted title (example: "Blender").
    """
    # Remove extension
    name_without_ext = Path(filename).stem
    
    # Common special cases
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
    
    # Replace separators and capitalize words
    title = (name_without_ext
             .replace('-', ' ')
             .replace('_', ' ')
             .replace('.', ' '))
    
    # Split CamelCase words
    title = re.sub(r'([a-z])([A-Z])', r'\1 \2', title)
    
    # Capitalize each word
    words = title.split()
    capitalized_words = []
    
    for word in words:
        if word:
            # Keep short acronyms uppercase (e.g. API, UI)
            if word.isupper() and len(word) <= 4:
                capitalized_words.append(word)
            else:
                capitalized_words.append(word.capitalize())
    
    return ' '.join(capitalized_words)


def validate_executable_path(exe_path: str) -> bool:
    """
    Validate that an executable path is valid.
    
    Args:
        exe_path: Executable path.
        
    Returns:
        bool: True if the path is valid.
    """
    if not exe_path:
        return False
    
    path = Path(exe_path)
    
    # Ensure the file exists
    if not path.exists():
        return False
    
    # Ensure it is a file (not a directory)
    if not path.is_file():
        return False
    
    # Validate extension on Windows
    if os.name == 'nt':  # Windows
        valid_extensions = ['.exe', '.bat', '.cmd', '.com']
        return path.suffix.lower() in valid_extensions
    else:  # Linux/Mac
        # On Unix, validate executable permissions
        return os.access(exe_path, os.X_OK)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a file name to avoid problematic characters.
    
    Args:
        filename: File name to sanitize.
        
    Returns:
        str: Safe file name.
    """
    # Replace forbidden characters with underscores
    invalid_chars = r'[<>:"/\\|?*]'
    clean_name = re.sub(invalid_chars, '_', filename)
    
    # Limit length
    if len(clean_name) > 255:
        clean_name = clean_name[:255]
    
    # Trim leading/trailing spaces
    clean_name = clean_name.strip()
    
    # Avoid reserved Windows names
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
    Extract executable metadata.
    
    Args:
        exe_path: Executable path.
        
    Returns:
        dict: Executable metadata.
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
    # Basic unit-style smoke tests
    import sys
    
    if len(sys.argv) > 1:
        test_path = sys.argv[1]
        info = get_executable_info(test_path)
        print(f"Information for {test_path}:")
        for key, value in info.items():
            print(f"  {key}: {value}")
    else:
        # Title generation tests
        test_cases = [
            "blender.exe",
            "git-bash.exe", 
            "FactoryGameSteam.exe",
            "SonicRacingCrossWorlds.exe",
            "Adobe_Photoshop_2024.exe",
            "UnityHub.exe",
            "my_custom_app.exe"
        ]
        
        print("Title generation tests:")
        for case in test_cases:
            title = generate_title_from_filename(case)
            print(f"  {case} → {title}")
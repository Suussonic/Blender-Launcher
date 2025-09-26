#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gestionnaire de configuration pour Blender Launcher
Gère les opérations CRUD sur le fichier config.json
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Union


class ConfigManager:
    """Gestionnaire principal pour les opérations de configuration"""
    
    def __init__(self, config_path: str):
        """
        Initialise le gestionnaire de configuration
        
        Args:
            config_path: Chemin vers le fichier config.json
        """
        self.config_path = Path(config_path)
        self.ensure_config_exists()
    
    def ensure_config_exists(self) -> None:
        """Crée le fichier config.json s'il n'existe pas"""
        if not self.config_path.exists():
            default_config = {"blenders": []}
            self.save_config(default_config)
    
    def load_config(self) -> Dict:
        """
        Charge la configuration depuis le fichier JSON
        
        Returns:
            Dict: Configuration chargée
            
        Raises:
            Exception: Si erreur de lecture ou format JSON invalide
        """
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            # Validation de base
            if not isinstance(config, dict):
                raise ValueError("Format de configuration invalide")
            
            if 'blenders' not in config:
                config['blenders'] = []
            
            if not isinstance(config['blenders'], list):
                config['blenders'] = []
                
            return config
            
        except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
            print(f"ERREUR - Impossible de charger la configuration: {e}", file=sys.stderr)
            return {"blenders": []}
    
    def save_config(self, config: Dict) -> bool:
        """
        Sauvegarde la configuration dans le fichier JSON
        
        Args:
            config: Configuration à sauvegarder
            
        Returns:
            bool: True si succès, False sinon
        """
        try:
            # Créer le dossier parent si nécessaire
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            return True
            
        except Exception as e:
            print(f"ERREUR - Impossible de sauvegarder la configuration: {e}", file=sys.stderr)
            return False
    
    def find_executable_index(self, exe_path: str) -> int:
        """
        Trouve l'index d'un exécutable dans la configuration
        
        Args:
            exe_path: Chemin de l'exécutable à chercher
            
        Returns:
            int: Index de l'exécutable (-1 si non trouvé)
        """
        config = self.load_config()
        
        for i, blender in enumerate(config['blenders']):
            if blender.get('path') == exe_path:
                return i
        
        return -1
    
    def update_executable_title(self, exe_path: str, new_title: str) -> Dict[str, Union[bool, str]]:
        """
        Met à jour le titre d'un exécutable
        
        Args:
            exe_path: Chemin de l'exécutable
            new_title: Nouveau titre
            
        Returns:
            Dict: Résultat de l'opération avec success et message
        """
        try:
            config = self.load_config()
            index = self.find_executable_index(exe_path)
            
            if index == -1:
                return {
                    "success": False,
                    "error": f"Exécutable non trouvé: {exe_path}"
                }
            
            old_title = config['blenders'][index].get('title', 'Sans titre')
            config['blenders'][index]['title'] = new_title
            
            if self.save_config(config):
                return {
                    "success": True,
                    "message": f"Titre mis à jour: '{old_title}' → '{new_title}'",
                    "old_title": old_title,
                    "new_title": new_title,
                    "updated_executable": config['blenders'][index]
                }
            else:
                return {
                    "success": False,
                    "error": "Erreur lors de la sauvegarde"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Erreur lors de la mise à jour: {str(e)}"
            }
    
    def get_executables(self) -> List[Dict]:
        """
        Récupère la liste de tous les exécutables
        
        Returns:
            List[Dict]: Liste des exécutables configurés
        """
        config = self.load_config()
        return config.get('blenders', [])
    
    def add_executable(self, exe_data: Dict) -> Dict[str, Union[bool, str]]:
        """
        Ajoute un nouvel exécutable à la configuration
        
        Args:
            exe_data: Données de l'exécutable (path, name, title, icon)
            
        Returns:
            Dict: Résultat de l'opération
        """
        try:
            config = self.load_config()
            
            # Vérifier si l'exécutable existe déjà
            if self.find_executable_index(exe_data.get('path', '')) != -1:
                return {
                    "success": False,
                    "error": "Cet exécutable est déjà configuré"
                }
            
            config['blenders'].append(exe_data)
            
            if self.save_config(config):
                return {
                    "success": True,
                    "message": f"Exécutable ajouté: {exe_data.get('title', exe_data.get('name', 'Sans nom'))}"
                }
            else:
                return {
                    "success": False,
                    "error": "Erreur lors de la sauvegarde"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Erreur lors de l'ajout: {str(e)}"
            }
    
    def remove_executable(self, exe_path: str) -> Dict[str, Union[bool, str]]:
        """
        Supprime un exécutable de la configuration
        
        Args:
            exe_path: Chemin de l'exécutable à supprimer
            
        Returns:
            Dict: Résultat de l'opération
        """
        try:
            config = self.load_config()
            index = self.find_executable_index(exe_path)
            
            if index == -1:
                return {
                    "success": False,
                    "error": f"Exécutable non trouvé: {exe_path}"
                }
            
            removed = config['blenders'].pop(index)
            
            if self.save_config(config):
                return {
                    "success": True,
                    "message": f"Exécutable supprimé: {removed.get('title', removed.get('name', 'Sans nom'))}"
                }
            else:
                return {
                    "success": False,
                    "error": "Erreur lors de la sauvegarde"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Erreur lors de la suppression: {str(e)}"
            }


def main():
    """Point d'entrée principal pour les appels en ligne de commande"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python config_manager.py <action> [arguments...]"
        }))
        sys.exit(1)
    
    try:
        config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config.json')
        manager = ConfigManager(config_path)
        
        action = sys.argv[1]
        
        if action == "update-title":
            if len(sys.argv) != 4:
                result = {
                    "success": False,
                    "error": "Usage: python config_manager.py update-title <exe_path> <new_title>"
                }
            else:
                exe_path = sys.argv[2]
                new_title = sys.argv[3]
                result = manager.update_executable_title(exe_path, new_title)
        
        elif action == "get-executables":
            executables = manager.get_executables()
            result = {
                "success": True,
                "executables": executables
            }
        
        elif action == "add-executable":
            if len(sys.argv) != 6:
                result = {
                    "success": False,
                    "error": "Usage: python config_manager.py add-executable <path> <name> <title> <icon>"
                }
            else:
                exe_data = {
                    "path": sys.argv[2],
                    "name": sys.argv[3],
                    "title": sys.argv[4],
                    "icon": sys.argv[5]
                }
                result = manager.add_executable(exe_data)
        
        elif action == "remove-executable":
            if len(sys.argv) != 3:
                result = {
                    "success": False,
                    "error": "Usage: python config_manager.py remove-executable <exe_path>"
                }
            else:
                exe_path = sys.argv[2]
                result = manager.remove_executable(exe_path)
        
        else:
            result = {
                "success": False,
                "error": f"Action non reconnue: {action}"
            }
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Erreur critique: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
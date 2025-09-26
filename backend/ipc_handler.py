#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gestionnaire IPC pour la communication entre Electron et Python
Traite les commandes reçues d'Electron et retourne les résultats
"""

import json
import sys
import os
from pathlib import Path

# Ajouter le dossier parent au path pour les imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from config.config_manager import ConfigManager
from utils.file_utils import get_executable_info, generate_title_from_filename


class IPCHandler:
    """Gestionnaire principal pour les communications IPC avec Electron"""
    
    def __init__(self):
        """Initialise le gestionnaire IPC"""
        # Chemin vers le config.json (relatif au script)
        self.config_path = os.path.join(
            os.path.dirname(__file__), 
            '..', '..', 
            'config.json'
        )
        self.config_manager = ConfigManager(self.config_path)
    
    def handle_update_title(self, exe_path: str, new_title: str) -> dict:
        """
        Gère la mise à jour du titre d'un exécutable
        
        Args:
            exe_path: Chemin de l'exécutable
            new_title: Nouveau titre
            
        Returns:
            dict: Résultat de l'opération
        """
        if not exe_path or not new_title:
            return {
                "success": False,
                "error": "Paramètres manquants (exe_path et new_title requis)"
            }
        
        result = self.config_manager.update_executable_title(exe_path, new_title)
        
        # Ajouter des informations supplémentaires pour Electron
        if result.get("success"):
            result["action"] = "title_updated"
            result["exe_path"] = exe_path
        
        return result
    
    def handle_get_executables(self) -> dict:
        """
        Récupère la liste des exécutables configurés
        
        Returns:
            dict: Liste des exécutables avec métadonnées
        """
        try:
            executables = self.config_manager.get_executables()
            
            # Enrichir chaque exécutable avec des métadonnées
            enriched_executables = []
            for exe in executables:
                enriched = exe.copy()
                
                # Vérifier si le fichier existe encore
                exe_path = exe.get('path', '')
                if exe_path and os.path.exists(exe_path):
                    enriched['exists'] = True
                    enriched['size'] = os.path.getsize(exe_path)
                else:
                    enriched['exists'] = False
                    enriched['size'] = 0
                
                # S'assurer qu'il y a un titre
                if not enriched.get('title') and enriched.get('name'):
                    enriched['title'] = generate_title_from_filename(enriched['name'])
                
                enriched_executables.append(enriched)
            
            return {
                "success": True,
                "executables": enriched_executables,
                "count": len(enriched_executables)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Erreur lors de la récupération des exécutables: {str(e)}"
            }
    
    def handle_add_executable(self, exe_path: str, name: str = None, title: str = None, icon: str = None) -> dict:
        """
        Gère l'ajout d'un nouvel exécutable
        
        Args:
            exe_path: Chemin vers l'exécutable
            name: Nom du fichier (optionnel, déduit du chemin)
            title: Titre personnalisé (optionnel, généré automatiquement)
            icon: Chemin vers l'icône (optionnel)
            
        Returns:
            dict: Résultat de l'opération
        """
        if not exe_path:
            return {
                "success": False,
                "error": "Chemin d'exécutable requis"
            }
        
        # Obtenir les informations de l'exécutable
        exe_info = get_executable_info(exe_path)
        
        if not exe_info.get("valid"):
            return {
                "success": False,
                "error": exe_info.get("error", "Exécutable invalide")
            }
        
        # Préparer les données
        exe_data = {
            "path": exe_info["path"],
            "name": name or exe_info["name"],
            "title": title or exe_info["title"],
            "icon": icon or ""
        }
        
        result = self.config_manager.add_executable(exe_data)
        
        if result.get("success"):
            result["action"] = "executable_added"
            result["executable"] = exe_data
        
        return result
    
    def handle_remove_executable(self, exe_path: str) -> dict:
        """
        Gère la suppression d'un exécutable
        
        Args:
            exe_path: Chemin de l'exécutable à supprimer
            
        Returns:
            dict: Résultat de l'opération
        """
        if not exe_path:
            return {
                "success": False,
                "error": "Chemin d'exécutable requis"
            }
        
        result = self.config_manager.remove_executable(exe_path)
        
        if result.get("success"):
            result["action"] = "executable_removed"
            result["exe_path"] = exe_path
        
        return result
    
    def handle_validate_executable(self, exe_path: str) -> dict:
        """
        Valide un chemin d'exécutable
        
        Args:
            exe_path: Chemin à valider
            
        Returns:
            dict: Informations de validation
        """
        exe_info = get_executable_info(exe_path)
        
        return {
            "success": True,
            "validation": exe_info
        }
    
    def process_command(self, command: str, **kwargs) -> dict:
        """
        Traite une commande reçue d'Electron
        
        Args:
            command: Nom de la commande
            **kwargs: Arguments de la commande
            
        Returns:
            dict: Résultat de la commande
        """
        try:
            if command == "update_title":
                return self.handle_update_title(
                    kwargs.get("exe_path"),
                    kwargs.get("new_title")
                )
            
            elif command == "get_executables":
                return self.handle_get_executables()
            
            elif command == "add_executable":
                return self.handle_add_executable(
                    kwargs.get("exe_path"),
                    kwargs.get("name"),
                    kwargs.get("title"),
                    kwargs.get("icon")
                )
            
            elif command == "remove_executable":
                return self.handle_remove_executable(kwargs.get("exe_path"))
            
            elif command == "validate_executable":
                return self.handle_validate_executable(kwargs.get("exe_path"))
            
            else:
                return {
                    "success": False,
                    "error": f"Commande non reconnue: {command}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Erreur lors du traitement de la commande '{command}': {str(e)}"
            }


def main():
    """Point d'entrée principal pour les appels IPC"""
    try:
        if len(sys.argv) < 2:
            result = {
                "success": False,
                "error": "Usage: python ipc_handler.py <command> [arguments...]"
            }
        else:
            handler = IPCHandler()
            command = sys.argv[1]
            
            # Parse les arguments selon la commande
            if command == "update_title" and len(sys.argv) >= 4:
                result = handler.process_command(
                    "update_title",
                    exe_path=sys.argv[2],
                    new_title=sys.argv[3]
                )
            
            elif command == "get_executables":
                result = handler.process_command("get_executables")
            
            elif command == "add_executable" and len(sys.argv) >= 3:
                result = handler.process_command(
                    "add_executable",
                    exe_path=sys.argv[2],
                    name=sys.argv[3] if len(sys.argv) > 3 else None,
                    title=sys.argv[4] if len(sys.argv) > 4 else None,
                    icon=sys.argv[5] if len(sys.argv) > 5 else None
                )
            
            elif command == "remove_executable" and len(sys.argv) >= 3:
                result = handler.process_command(
                    "remove_executable",
                    exe_path=sys.argv[2]
                )
            
            elif command == "validate_executable" and len(sys.argv) >= 3:
                result = handler.process_command(
                    "validate_executable",
                    exe_path=sys.argv[2]
                )
            
            else:
                result = {
                    "success": False,
                    "error": f"Arguments insuffisants ou commande inconnue: {command}"
                }
        
        # Sortie JSON pour Electron
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Erreur critique dans IPC handler: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
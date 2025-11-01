#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scan simplifié des builds Blender dans un dossier "bibliothèque".
- Détecte les dossiers contenant un exécutable Blender
- Optionnel: tente d'écrire .blinfo si absent en lançant Blender -v

Inspiré des idées de Blender-Launcher-V2 (lecture d'un .blinfo et détection d'exe),
mais ré-implémenté ici sans copier de code.

Utilisation CLI:
  python backend/library_scanner.py <library_folder> [--write-blinfo]
Renvoie un JSON sur stdout.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable, List, Tuple

from build_info_extractor import extract_and_write, detect_executable


def iter_build_folders(library_root: Path) -> Iterable[Path]:
    # Parcourt 1 niveau: <library_root>/<subfolder>/<build>
    if not library_root.is_dir():
        return []
    for sub in library_root.iterdir():
        if not sub.is_dir():
            continue
        for build in sub.iterdir():
            if build.is_dir():
                yield build


def scan_library(library_root: Path, write_blinfo: bool = False) -> List[dict]:
    results: List[dict] = []
    for build in iter_build_folders(library_root):
        exe = detect_executable(build)
        blinfo = build / ".blinfo"
        has_blinfo = blinfo.is_file()
        has_exe = exe is not None

        if write_blinfo and has_exe and not has_blinfo:
            try:
                extract_and_write(build)
                has_blinfo = True
            except Exception:
                # On ignore les erreurs de génération de .blinfo
                pass

        results.append(
            {
                "path": build.as_posix(),
                "has_exe": has_exe,
                "has_blinfo": has_blinfo,
                "exe": exe.as_posix() if exe else None,
            }
        )
    return results


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: library_scanner.py <library_folder> [--write-blinfo]"}))
        return 1

    root = Path(argv[1]).resolve()
    write_blinfo = "--write-blinfo" in argv

    data = scan_library(root, write_blinfo=write_blinfo)
    print(json.dumps({"success": True, "items": data}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    import sys
    raise SystemExit(main(sys.argv))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction légère d'informations de build Blender.

Inspiré du comportement du projet Blender-Launcher-V2, mais ré-implémenté ici
sans copier de code, pour éviter tout problème de licence. Objectif:
- Lancer l'exécutable Blender avec l'option `-v`
- Parser la sortie pour en déduire: date/heure du commit, hash, version et nom
- Écrire un fichier `.blinfo` compatible dans le dossier de build

Utilisation CLI:
  python backend/build_info_extractor.py <dossier_build> [--exe <chemin_blender>]
Retourne un JSON sur stdout avec le résumé et écrit `<dossier_build>/.blinfo`.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple


@dataclass
class BuildInfo:
    path: str
    branch: str
    subversion: str
    build_hash: str
    commit_time: datetime
    custom_name: str = ""
    custom_executable: str = ""

    # Format attendu par notre launcher
    @property
    def file_version(self) -> int:
        return 1

    def to_dict(self) -> dict:
        return {
            "file_version": self.file_version,
            "blinfo": [
                {
                    "branch": self.branch,
                    "subversion": self.subversion,
                    "build_hash": self.build_hash,
                    "commit_time": self.commit_time.isoformat(),
                    "custom_name": self.custom_name,
                    "is_favorite": False,
                    "custom_executable": self.custom_executable,
                }
            ],
        }


def _run_blender_version(exe: Path) -> str:
    # Sur Windows, demandez toujours la sortie en UTF-8
    try:
        completed = subprocess.run(
            [exe.as_posix(), "-v"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        return completed.stdout.decode("utf-8", errors="replace")
    except Exception as e:
        return f"ERROR: {e}"


def parse_blender_version_output(output: str, fallback_subversion: Optional[str] = None) -> Tuple[datetime, str, str, str]:
    """Retourne (commit_time, build_hash, subversion, custom_name)."""
    # Commit time / date
    ctime = re.search(r"build commit time:\s*(.*)", output)
    cdate = re.search(r"build commit date:\s*(.*)", output)

    if ctime and cdate:
        try:
            commit_dt = datetime.strptime(f"{cdate[1].strip()} {ctime[1].strip()}", "%Y-%m-%d %H:%M")
        except Exception:
            # Format exotique => fallback à maintenant
            commit_dt = datetime.now()
    else:
        commit_dt = datetime.now()

    # Build hash
    bh = re.search(r"build hash:\s*([0-9a-fA-F]+)", output)
    build_hash = bh[1].strip() if bh else ""

    # Subversion et nom custom
    subversion = fallback_subversion or ""
    custom_name = ""

    # Exemple de première ligne: "Blender 4.1.0 (hash)" ou "Bforartists 4.1.0"
    # On essaye d'extraire la dernière paire "<nom> <version>"
    first_line = output.splitlines()[0].strip() if output else ""
    m = re.search(r"(Blender|Bforartists)\s+([^\s]+)", first_line)
    if m:
        custom_name = m.group(1)
        subversion = subversion or m.group(2)

    return commit_dt, build_hash, subversion, custom_name


def write_blinfo(build_dir: Path, info: BuildInfo) -> dict:
    data = info.to_dict()
    blinfo_path = build_dir / ".blinfo"
    with blinfo_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


def detect_executable(build_dir: Path) -> Optional[Path]:
    # Recherche simple: blender.exe (Windows) ou blender (Linux)
    candidates = [
        build_dir / "blender.exe",
        build_dir / "blender",
        build_dir / "Bforartists" / "Bforartists.app" / "Contents" / "MacOS" / "Bforartists",
        build_dir / "Blender" / "Blender.app" / "Contents" / "MacOS" / "Blender",
    ]
    for c in candidates:
        if c.exists():
            return c
    # Sinon, essayer de fouiller un peu (bin/, build/, etc.)
    for sub in ("bin", "build", "Release", "release"):
        p = build_dir / sub
        if p.is_dir():
            exe = detect_executable(p)
            if exe:
                return exe
    return None


def extract_and_write(build_dir: Path, branch: str = "custom", exe_override: Optional[Path] = None) -> dict:
    exe = exe_override or detect_executable(build_dir)
    if not exe:
        raise FileNotFoundError("Aucun exécutable Blender détecté dans ce dossier")

    out = _run_blender_version(exe)
    commit_time, build_hash, subversion, custom_name = parse_blender_version_output(out)

    info = BuildInfo(
        path=build_dir.as_posix(),
        branch=branch,
        subversion=subversion,
        build_hash=build_hash,
        commit_time=commit_time,
        custom_name=custom_name,
        custom_executable=str(exe.relative_to(build_dir)) if build_dir in exe.parents or build_dir == exe.parent else "",
    )
    return write_blinfo(build_dir, info)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: build_info_extractor.py <dossier_build> [--exe <chemin_blender>]"}))
        return 1

    build_dir = Path(argv[1]).resolve()
    exe: Optional[Path] = None
    branch = "custom"

    if "--exe" in argv:
        i = argv.index("--exe")
        if i + 1 < len(argv):
            exe = Path(argv[i + 1]).resolve()
    if "--branch" in argv:
        i = argv.index("--branch")
        if i + 1 < len(argv):
            branch = argv[i + 1]

    try:
        data = extract_and_write(build_dir, branch=branch, exe_override=exe)
        print(json.dumps({"success": True, "data": data}, ensure_ascii=False))
        return 0
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

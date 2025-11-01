Backend Python tools

This folder contains lightweight Python utilities used by Blender Launcher to manage existing Blender builds without in-app cloning/building:

- build_info_extractor.py: Run a Blender executable with -v, parse version/hash/date, and write a .blinfo file into a build folder. Inspired by Blender-Launcher-V2 behavior, re-implemented here to avoid license conflicts.
- library_scanner.py: Scan a library root (e.g., D:\Blenders) to find builds, detect executables, and optionally auto-generate .blinfo files.

Quick usage (Windows PowerShell):

```powershell
# Write .blinfo for a build folder containing blender.exe
python .\backend\build_info_extractor.py "C:\\Blenders\\stable\\blender-4.1.0"

# Scan a library and auto-write .blinfo for builds that don’t have one yet
python .\backend\library_scanner.py "C:\\Blenders" --write-blinfo
```

Notes
- These scripts don’t clone or build Blender. The Electron app UI for clone/build has been removed as requested.
- You can wire an IPC to call these scripts later if needed (e.g., a "Scan library" button).

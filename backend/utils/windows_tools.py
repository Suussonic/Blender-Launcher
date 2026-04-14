#!/usr/bin/env python3
"""Shared Windows tooling helpers for Blender backend scripts."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile


def find_vsdevcmd_with_product() -> tuple[str | None, str | None]:
    """Locate VsDevCmd.bat and return (path, VS productId when available)."""
    vswhere_candidates = [
        r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe",
        r"C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe",
    ]
    product = None
    for vswhere in vswhere_candidates:
        if not os.path.exists(vswhere):
            continue
        try:
            out = subprocess.check_output(
                [
                    vswhere,
                    "-latest",
                    "-products",
                    "*",
                    "-requires",
                    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                    "-property",
                    "installationPath",
                ],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=10,
            )
            inst = (out or "").strip()
            if not inst:
                continue
            try:
                pid = subprocess.check_output(
                    [
                        vswhere,
                        "-latest",
                        "-products",
                        "*",
                        "-requires",
                        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                        "-property",
                        "productId",
                    ],
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=10,
                ).strip()
                product = pid or None
            except Exception:
                product = None

            candidate = os.path.join(inst, "Common7", "Tools", "VsDevCmd.bat")
            if os.path.exists(candidate):
                return candidate, product
        except Exception:
            pass

    fallbacks = [
        r"C:\Program Files\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat",
        r"C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat",
        r"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\Common7\Tools\VsDevCmd.bat",
        r"C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\Tools\VsDevCmd.bat",
    ]
    for path in fallbacks:
        if os.path.exists(path):
            return path, product
    return None, product


def find_vsdevcmd_path() -> str | None:
    """Locate VsDevCmd.bat and return only its path."""
    path, _ = find_vsdevcmd_with_product()
    return path


def find_cmake_dir() -> str | None:
    """Find cmake.exe and return the directory containing it."""
    cmake = shutil.which("cmake")
    if cmake:
        return os.path.dirname(cmake)

    candidates = [
        r"C:\Program Files\CMake\bin\cmake.exe",
        r"C:\Program Files (x86)\CMake\bin\cmake.exe",
    ]
    local = os.environ.get("LOCALAPPDATA", "")
    if local:
        candidates.append(os.path.join(local, "CMake", "bin", "cmake.exe"))

    try:
        import winreg

        for root_key in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            try:
                with winreg.OpenKey(root_key, r"SOFTWARE\Kitware\CMake") as key:
                    val, _ = winreg.QueryValueEx(key, "InstallDir")
                    if val:
                        candidates.append(os.path.join(val, "bin", "cmake.exe"))
            except Exception:
                pass
    except Exception:
        pass

    for candidate in candidates:
        if os.path.isfile(candidate):
            return os.path.dirname(candidate)
    return None


def ensure_pwsh_available() -> tuple[bool, str | None]:
    """Ensure pwsh.exe can be resolved, or provide a best-effort shim."""
    if shutil.which("pwsh"):
        return True, "pwsh"

    powershell_exe = shutil.which("powershell")
    if not powershell_exe:
        system_root = os.environ.get("SystemRoot", r"C:\Windows")
        candidate = os.path.join(system_root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
        if os.path.isfile(candidate):
            powershell_exe = candidate

    if not powershell_exe:
        return False, None

    shim_dir = os.path.join(tempfile.gettempdir(), "bl_launcher_pwsh_shim")
    shim_exe = os.path.join(shim_dir, "pwsh.exe")
    try:
        os.makedirs(shim_dir, exist_ok=True)
        if not os.path.isfile(shim_exe):
            shutil.copy2(powershell_exe, shim_exe)
        path_now = os.environ.get("PATH", "")
        if shim_dir.lower() not in path_now.lower():
            os.environ["PATH"] = shim_dir + os.pathsep + path_now
        return True, shim_exe
    except Exception:
        return False, None


def detect_pwsh_failure(output: str) -> str | None:
    """Return a user-facing diagnostic message for common pwsh failure logs."""
    text = (output or "").lower()
    if "pwsh.exe" not in text and "pwsh" not in text:
        return None
    patterns = [
        "pwsh.exe is not recognized",
        "'pwsh.exe' is not recognized",
        "'pwsh' is not recognized",
        "pwsh was unexpected at this time",
    ]
    if any(pattern in text for pattern in patterns):
        return (
            "La compilation a echoue silencieusement car pwsh.exe est indisponible. "
            "Installez PowerShell 7 ou relancez avec le shim active."
        )
    return None

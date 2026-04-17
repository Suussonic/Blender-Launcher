#!/usr/bin/env python3
"""
Install a Blender extension or add-on from a local .zip file.

Usage:
    blender.exe --background --python install_extension.py -- <zip_path>

Output markers:
    @@INSTALL_OK@@<module_name>   on success
    @@INSTALL_FAIL@@<reason>      on failure
    @@INSTALL_DEBUG@@<info>       diagnostic info
"""

import sys
import os
import zipfile

MARKER_OK    = '@@INSTALL_OK@@'
MARKER_FAIL  = '@@INSTALL_FAIL@@'
MARKER_DEBUG = '@@INSTALL_DEBUG@@'


def _iter_addon_modules(addon_utils_mod):
    try:
        return addon_utils_mod.modules(refresh=False)
    except TypeError:
        pass
    except Exception:
        return []
    try:
        return addon_utils_mod.modules()
    except Exception:
        return []


def _pref_enabled(bpy_mod, module_name):
    try:
        return bool(bpy_mod.context.preferences.addons.get(module_name, None))
    except Exception:
        return False


def _enable(addon_utils_mod, bpy_mod, module_name):
    errors = []

    def err_cb(ex):
        try:
            errors.append(str(ex))
        except Exception:
            pass

    for call in (
        lambda: addon_utils_mod.enable(module_name, default_set=True, persistent=True, handle_error=err_cb),
        lambda: addon_utils_mod.enable(module_name, default_set=True, persistent=True),
        lambda: addon_utils_mod.enable(module_name, default_set=True, handle_error=err_cb),
        lambda: addon_utils_mod.enable(module_name, default_set=True),
        lambda: addon_utils_mod.enable(module_name),
        lambda: bpy_mod.ops.preferences.addon_enable(module=module_name),
    ):
        try:
            call()
            try:
                bpy_mod.ops.wm.save_userpref()
            except Exception:
                pass
            if _pref_enabled(bpy_mod, module_name):
                return True, errors
        except TypeError:
            continue
        except Exception as ex:
            errors.append(str(ex))

    return _pref_enabled(bpy_mod, module_name), errors


def _collect_module_names(addon_utils_mod):
    out = set()
    for module in _iter_addon_modules(addon_utils_mod):
        try:
            name = getattr(module, '__name__', '')
            if name:
                out.add(name)
        except Exception:
            continue
    return out


def _candidate_names(module_name, before_modules, after_modules):
    candidates = []

    def add(name):
        if name and name not in candidates:
            candidates.append(name)

    add(module_name)
    normalized = module_name.replace('-', '_') if module_name else ''
    add(normalized)

    for repo_name in ('user_default', 'blender_org', 'default'):
        add('bl_ext.' + repo_name + '.' + normalized if normalized else '')
        add('bl_ext.' + repo_name + '.' + module_name if module_name else '')

    for name in sorted(after_modules - before_modules):
        add(name)

    if module_name:
        for name in sorted(after_modules):
            if name == module_name or name == normalized:
                add(name)
            elif name.endswith('.' + module_name) or name.endswith('.' + normalized):
                add(name)

    return candidates


def _get_arg(index=0):
    """Return positional argument after '--' separator."""
    argv = sys.argv
    try:
        sep = argv.index('--')
        pos = sep + 1 + index
        return argv[pos] if pos < len(argv) else None
    except ValueError:
        return None


def _zip_module_name(zip_path):
    """
    Extract the module/extension id from the zip archive.
    Priority:
      1. blender_manifest.toml -> 'id' field  (Blender 4.2+ extension format)
      2. Top-level __init__.py -> parent folder name (legacy add-on)
    """
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            names = zf.namelist()

            # --- Blender 4.2+ extension manifest ---
            manifest_files = [n for n in names if n.endswith('blender_manifest.toml')]
            if manifest_files:
                content = zf.read(manifest_files[0]).decode('utf-8', errors='ignore')
                for line in content.splitlines():
                    stripped = line.strip()
                    if stripped.startswith('id') and '=' in stripped:
                        val = stripped.split('=', 1)[1].strip().strip('"\'')
                        if val:
                            return val

            # --- Legacy add-on: folder/__init__.py or __init__.py ---
            init_files = sorted(
                [n for n in names if n.endswith('__init__.py')],
                key=lambda x: x.count('/')
            )
            if init_files:
                top = init_files[0]
                parts = top.split('/')
                if len(parts) > 1:
                    return parts[0]   # top-level folder name
                return os.path.splitext(top)[0]

    except Exception as e:
        print(MARKER_DEBUG + 'zip parse error: ' + str(e))

    return ''


def _main():
    zip_path = _get_arg(0)

    if not zip_path or not os.path.isfile(zip_path):
        print(MARKER_FAIL + 'zip file not found: ' + str(zip_path))
        sys.stdout.flush()
        return

    module_name = _zip_module_name(zip_path)
    print(MARKER_DEBUG + 'module_name detected: ' + str(module_name))
    sys.stdout.flush()

    try:
        import bpy  # only available inside Blender
        import addon_utils
    except ImportError:
        print(MARKER_FAIL + 'Not running inside Blender (bpy not available)')
        sys.stdout.flush()
        return

    before_modules = _collect_module_names(addon_utils)
    before_enabled = set()
    try:
        before_enabled = {addon.module for addon in bpy.context.preferences.addons}
    except Exception:
        before_enabled = set()
    print(MARKER_DEBUG + 'before modules count: ' + str(len(before_modules)))
    print(MARKER_DEBUG + 'before enabled count: ' + str(len(before_enabled)))
    sys.stdout.flush()

    # ------------------------------------------------------------------
    # Method 1: bpy.ops.preferences.addon_install  (legacy + 4.x)
    # ------------------------------------------------------------------
    try:
        result = bpy.ops.preferences.addon_install(filepath=zip_path, overwrite=True)
        print(MARKER_DEBUG + 'addon_install result: ' + str(result))
        sys.stdout.flush()
        if 'FINISHED' in str(result):
            pass
    except Exception as e:
        print(MARKER_DEBUG + 'addon_install error: ' + str(e))
        sys.stdout.flush()

    # ------------------------------------------------------------------
    # Method 2: bpy.ops.preferences.extension_install  (Blender 4.2+)
    # ------------------------------------------------------------------
    try:
        if hasattr(bpy.ops.preferences, 'extension_install'):
            result = bpy.ops.preferences.extension_install(filepath=zip_path)
            print(MARKER_DEBUG + 'extension_install result: ' + str(result))
            sys.stdout.flush()
            if 'FINISHED' in str(result):
                pass
    except Exception as e:
        print(MARKER_DEBUG + 'extension_install error: ' + str(e))
        sys.stdout.flush()

    after_modules = _collect_module_names(addon_utils)
    after_enabled = set()
    try:
        after_enabled = {addon.module for addon in bpy.context.preferences.addons}
    except Exception:
        after_enabled = set()

    print(MARKER_DEBUG + 'after modules count: ' + str(len(after_modules)))
    print(MARKER_DEBUG + 'after enabled count: ' + str(len(after_enabled)))
    print(MARKER_DEBUG + 'new modules: ' + repr(sorted(after_modules - before_modules)))
    sys.stdout.flush()

    already_enabled = sorted(after_enabled - before_enabled)
    if already_enabled:
        print(MARKER_DEBUG + 'already enabled after install: ' + repr(already_enabled))
        print(MARKER_OK + already_enabled[0])
        sys.stdout.flush()
        return

    candidates = _candidate_names(module_name, before_modules, after_modules)
    print(MARKER_DEBUG + 'enable candidates: ' + repr(candidates))
    sys.stdout.flush()

    for candidate in candidates:
        ok, errors = _enable(addon_utils, bpy, candidate)
        print(MARKER_DEBUG + 'enable ' + candidate + ' => ' + str(ok) + (' errors=' + repr(errors) if errors else ''))
        sys.stdout.flush()
        if ok:
            print(MARKER_OK + candidate)
            sys.stdout.flush()
            return

    print(MARKER_FAIL + 'Installation ou activation impossible')
    sys.stdout.flush()


_main()

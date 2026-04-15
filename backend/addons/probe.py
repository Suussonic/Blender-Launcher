#!/usr/bin/env python3
"""Enumerate Blender add-ons and emit JSON payload markers.

Usage:
    blender --background --python backend/addons/probe.py
"""

import json
import os
import sys

MARKER_START = '@@ADDONS_JSON_START@@'
MARKER_END = '@@ADDONS_JSON_END@@'


def _check_loaded(addon_utils_mod, module_name):
    try:
        chk = addon_utils_mod.check(module_name)
        if isinstance(chk, (list, tuple)) and len(chk) >= 2:
            return bool(chk[1])
        if isinstance(chk, (list, tuple)) and len(chk) >= 1:
            return bool(chk[0])
        return bool(chk)
    except Exception:
        return False


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


def _addon_path(module_file):
    try:
        if not module_file:
            return None
        if str(module_file).lower().endswith('__init__.py'):
            return os.path.dirname(module_file)
        return module_file
    except Exception:
        return module_file


def main():
    try:
        import addon_utils
        import bpy
    except Exception:
        print('ERROR: addon_utils or bpy not available', file=sys.stderr)
        return

    try:
        addons = []
        used_addon_module_names = {addon.module for addon in bpy.context.preferences.addons}
        for m in _iter_addon_modules(addon_utils):
            try:
                module_name = getattr(m, '__name__', str(m))
                bl_info = getattr(m, 'bl_info', {}) or {}
                module_file = getattr(m, '__file__', None)

                enabled = module_name in used_addon_module_names

                loaded = _check_loaded(addon_utils, module_name)

                addons.append({
                    'module': module_name,
                    'name': bl_info.get('name') or module_name,
                    'bl_info': bl_info,
                    'enabled': enabled,
                    'loaded': loaded,
                    'path': _addon_path(module_file),
                })
            except Exception:
                continue

        print(MARKER_START)
        print(json.dumps(addons))
        print(MARKER_END)
    except Exception:
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

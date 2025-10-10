#!/usr/bin/env python3
"""
Probe script to enumerate Blender addons. Intended to be run with the Blender executable
using: blender --background --python blender_addons_probe.py

Outputs JSON to stdout wrapped between markers so the caller can extract it reliably.
"""
import json
import sys

MARKER_START = '@@ADDONS_JSON_START@@'
MARKER_END = '@@ADDONS_JSON_END@@'

def main():
    try:
        import addon_utils
    except Exception:
        print('ERROR: addon_utils not available', file=sys.stderr)
        return

    try:
        addons = []
        # addon_utils.modules() yields module objects
        for m in addon_utils.modules():
            try:
                module_name = getattr(m, '__name__', str(m))
                bl_info = getattr(m, 'bl_info', {}) or {}
                # check enabled using addon_utils when possible
                enabled = False
                try:
                    chk = addon_utils.check(module_name)
                    if isinstance(chk, (list, tuple)) and len(chk) >= 1:
                        enabled = bool(chk[0])
                except Exception:
                    try:
                        enabled = bool(addon_utils.is_enabled(module_name))
                    except Exception:
                        enabled = False
                # module file path (if available)
                module_file = getattr(m, '__file__', None)
                addons.append({
                    'module': module_name,
                    'name': bl_info.get('name') or module_name,
                    'bl_info': bl_info,
                    'enabled': enabled,
                    'file': module_file,
                })
            except Exception:
                # ignore single addon errors
                continue

        print(MARKER_START)
        print(json.dumps(addons))
        print(MARKER_END)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

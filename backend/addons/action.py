#!/usr/bin/env python3
"""Enable or disable a Blender add-on using Blender's Python API.

Usage:
    blender --background --python backend/addons/action.py -- action enable module addon_module
"""

import sys
import traceback

MARK_OK = "@@ACTION_OK@@"
MARK_FAIL = "@@ACTION_FAIL@@"
MARK_ERR = "@@ACTION_ERR@@"
MARK_DBG = "@@ACTION_DEBUG@@"


def _parse_args(argv):
    if '--' in argv:
        args = argv[argv.index('--') + 1:]
    else:
        args = argv[1:]

    action = None
    module = None

    if len(args) >= 4 and args[0] == 'action' and args[2] == 'module':
        action = args[1]
        module = args[3]
    else:
        for i, token in enumerate(args):
            if token in ('action', '--action') and i + 1 < len(args):
                action = args[i + 1]
            if token in ('module', '--module') and i + 1 < len(args):
                module = args[i + 1]

    return action, module


def _pref_enabled(bpy_mod, module_name):
    try:
        return bool(bpy_mod.context.preferences.addons.get(module_name, None))
    except Exception:
        return False


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


def _enable(addon_utils_mod, bpy_mod, module_name, errors):
    def err_cb(ex):
        try:
            errors.append(str(ex))
        except Exception:
            pass

    try:
        addon_utils_mod.enable(module_name, default_set=True, persistent=True, handle_error=err_cb)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.enable(module_name, default_set=True, persistent=True)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.enable(module_name, default_set=True, handle_error=err_cb)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.enable(module_name, default_set=True)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.enable(module_name)
        return True
    except Exception as e:
        errors.append(str(e))

    try:
        bpy_mod.ops.preferences.addon_enable(module=module_name)
        return True
    except Exception as e2:
        errors.append(str(e2))
        return False


def _disable(addon_utils_mod, bpy_mod, module_name, errors):
    def err_cb(ex):
        try:
            errors.append(str(ex))
        except Exception:
            pass

    try:
        addon_utils_mod.disable(module_name, default_set=True, persistent=True, handle_error=err_cb)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.disable(module_name, default_set=True, persistent=True)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.disable(module_name, default_set=True, handle_error=err_cb)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.disable(module_name, default_set=True)
        return True
    except TypeError:
        pass
    except Exception as e:
        errors.append(str(e))

    try:
        addon_utils_mod.disable(module_name)
        return True
    except Exception as e:
        errors.append(str(e))

    try:
        bpy_mod.ops.preferences.addon_disable(module=module_name)
        return True
    except Exception as e2:
        errors.append(str(e2))
        return False


def main():
    try:
        action, module = _parse_args(sys.argv)
        if not action or not module:
            print('missing-params', file=sys.stderr)
            sys.exit(2)

        desired = action.lower() == 'enable'
        errors = []

        import addon_utils
        import bpy

        before_pref = _pref_enabled(bpy, module)
        before_loaded = _check_loaded(addon_utils, module)
        print(f"{MARK_DBG} before pref={before_pref} loaded={before_loaded} desired={desired}")

        op_ok = _enable(addon_utils, bpy, module, errors) if desired else _disable(addon_utils, bpy, module, errors)

        try:
            bpy.ops.wm.save_userpref()
        except Exception as e:
            errors.append(str(e))

        after_pref = _pref_enabled(bpy, module)
        after_loaded = _check_loaded(addon_utils, module)
        print(f"{MARK_DBG} after pref={after_pref} loaded={after_loaded} desired={desired}")

        if after_pref == desired:
            print(MARK_OK)
        else:
            print(MARK_FAIL)
            if not op_ok:
                errors.append('addon-operation-failed')
            if errors:
                msg = (errors[-1] or '').replace('\n', ' ').strip()
                if msg:
                    print(MARK_ERR + msg)
        sys.stdout.flush()
    except Exception:
        traceback.print_exc()
        sys.stderr.flush()
        sys.exit(1)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Script helper to perform addon actions in Blender (enable/disable).
Usage (from shell):
  blender --background --python blender_addon_action.py -- action enable module addon_module_name

Prints marker @@ACTION_OK@@ on success, @@ACTION_FAIL@@ on validation failure, and writes traceback to stderr on exceptions.
"""
import sys
import traceback

MARK_OK = "@@ACTION_OK@@"
MARK_FAIL = "@@ACTION_FAIL@@"


def main():
    try:
        if '--' in sys.argv:
            idx = sys.argv.index('--')
            args = sys.argv[idx+1:]
        else:
            # if run directly, skip script name
            args = sys.argv[1:]
        # parse args basic
        params = {}
        i = 0
        while i < len(args):
            k = args[i]
            v = None
            if i+1 < len(args):
                v = args[i+1]
            params[k] = v
            i += 2
        action = params.get('action')
        module = params.get('module')
        if not action or not module:
            print('missing-params', file=sys.stderr)
            sys.exit(2)

        import addon_utils
        import importlib
        desired = (action.lower() == 'enable')
        ok = False
        # Try to be defensive: monkeypatch some bpy helpers to avoid crashes in addons' unregister
        try:
            import bpy
            # patch unregister_class to ignore errors coming from malformed classes
            try:
                _orig_unregister_class = bpy.utils.unregister_class
                def _safe_unregister_class(cls):
                    try:
                        _orig_unregister_class(cls)
                    except Exception:
                        # swallow errors during unregister
                        pass
                bpy.utils.unregister_class = _safe_unregister_class
            except Exception:
                pass
        except Exception:
            bpy = None

        # Provide safe helpers inspired by BBAM to avoid KeyError on keymap access
        def _safe_get_keymap(kc, km_name):
            try:
                if not kc:
                    return None
                if km_name in kc.keymaps:
                    return kc.keymaps[km_name]
            except Exception:
                try:
                    # fallback: iterate and match by name
                    for km in getattr(kc, 'keymaps', []) or []:
                        try:
                            if getattr(km, 'name', None) == km_name:
                                return km
                        except Exception:
                            continue
                except Exception:
                    pass
            return None

        def _safe_remove_keymap_items():
            try:
                if not bpy:
                    return
                wm = bpy.context.window_manager
                kc = getattr(wm, 'keyconfigs', None)
                if not kc:
                    return
                # common failure: accessing km.keymap_items['mesh.knife_tool'] may raise KeyError
                # we will iterate safely and ignore missing items
                for cfg_name in ('user_default', 'addon'):
                    try:
                        kconf = kc.get(cfg_name, None) if isinstance(kc, dict) else getattr(kc, cfg_name, None)
                        if not kconf:
                            continue
                        km = _safe_get_keymap(kconf, 'Mesh') or _safe_get_keymap(kconf, 'mesh') or _safe_get_keymap(kconf, 'mesh.knife_tool')
                        # just attempt to remove items if present
                        if km:
                            try:
                                # iterate copy to avoid runtime mutation issues
                                for item in list(getattr(km, 'keymap_items', []) or []):
                                    try:
                                        # if item.idname contains 'knife' or similar, remove attributes safely
                                        name = getattr(item, 'idname', '')
                                        if 'knife' in str(name).lower():
                                            try:
                                                # attempt to clear states that may cause errors
                                                setattr(item, 'alt', False)
                                            except Exception:
                                                pass
                                    except Exception:
                                        continue
                            except Exception:
                                pass
                    except Exception:
                        continue
            except Exception:
                pass

        stderr_captured = []
        def _safe_print_stderr(msg: str):
            try:
                stderr_captured.append(msg)
            except Exception:
                pass

        try:
            # Try addon_utils API first
            if desired:
                try:
                    addon_utils.enable(module)
                except Exception:
                    try:
                        if bpy:
                            bpy.ops.preferences.addon_enable(module=module)
                    except Exception:
                        pass
            else:
                # attempt to import module and call its unregister manually in a safe way
                try:
                    m = importlib.import_module(module)
                    try:
                        if hasattr(m, 'unregister'):
                            try:
                                m.unregister()
                            except Exception:
                                # swallow errors from addon unregister
                                pass
                    except Exception:
                        pass
                except Exception:
                    # module might not be importable; fall back to addon_utils.disable
                    pass

                try:
                    # Attempt to monkeypatch the module.unregister to a safe wrapper so addon_utils.disable
                    # won't let the addon unregister exceptions escape.
                    try:
                        m = importlib.import_module(module)
                        if hasattr(m, 'unregister'):
                            try:
                                orig_unreg = m.unregister
                                def _safe_unreg():
                                    try:
                                        orig_unreg()
                                    except Exception:
                                        import traceback as _tb
                                        _tb.print_exc()
                                m.unregister = _safe_unreg
                            except Exception:
                                pass
                    except Exception:
                        pass
                    try:
                        addon_utils.disable(module, default_set=False, persistent=False)
                    except TypeError:
                        addon_utils.disable(module)
                except Exception as e:
                    # capture stderr info and attempt bpy fallback
                    try:
                        _safe_print_stderr(str(e))
                    except Exception:
                        pass
                    try:
                        if bpy:
                            bpy.ops.preferences.addon_disable(module=module)
                    except Exception as e2:
                        try:
                            _safe_print_stderr(str(e2))
                        except Exception:
                            pass
        except Exception:
            pass

        # validate
        try:
            chk = addon_utils.check(module)
            if isinstance(chk, (list, tuple)) and len(chk) >= 1:
                ok = bool(chk[0])
            else:
                try:
                    ok = bool(addon_utils.is_enabled(module))
                except Exception:
                    ok = False
        except Exception:
            try:
                ok = bool(addon_utils.is_enabled(module))
            except Exception:
                ok = False

        # If stderr captured but the final check reports the desired state, accept it.
        if ok == desired:
            print(MARK_OK)
            sys.stdout.flush()
            return
        else:
            # if we have captured stderr lines (exceptions), but addon_utils reports the addon is not enabled when desired==False, accept as OK
            if not desired:
                try:
                    # final attempt: consider disabled if is_enabled returns False
                    try:
                        is_en = addon_utils.is_enabled(module)
                        if not is_en:
                            print(MARK_OK)
                            sys.stdout.flush()
                            return
                    except Exception:
                        pass
                except Exception:
                    pass
            print(MARK_FAIL)
            sys.stdout.flush()
            return

    except Exception:
        traceback.print_exc()
        sys.stderr.flush()
        sys.exit(1)


if __name__ == '__main__':
    main()

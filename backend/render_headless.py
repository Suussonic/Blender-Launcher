"""
Headless render runner for Blender-Launcher with progress markers.

Usage:
  blender -b --factory-startup --python backend/render_headless.py -- <file.blend> key=value ...

It prints single-line markers to stdout that start with BL_REN: so the launcher
can parse them in real time:
  BL_REN:INIT mode=ANIMATION total=120
  BL_REN:FRAME_START frame=1
  BL_REN:FRAME_DONE frame=1
  BL_REN:DONE
  BL_REN:CANCEL
  BL_REN:ERROR message=...
"""
from __future__ import annotations
import sys
import os
from typing import Optional

try:
    import bpy  # type: ignore
except Exception as e:  # pragma: no cover
    print(f"BL_REN:ERROR message=bpy_import_failed:{e}")
    sys.stdout.flush()
    sys.exit(0)


def _norm(p: str) -> str:
    try:
        return os.path.normcase(os.path.abspath(p))
    except Exception:
        return p


def get_scene():
    try:
        scn = bpy.context.scene
        if scn is None and bpy.data.scenes:
            scn = bpy.data.scenes[0]
        return scn
    except Exception:
        return bpy.data.scenes[0] if bpy.data.scenes else None


def parse_args():
    blend_path = None
    params = {}
    if '--' in sys.argv:
        idx = sys.argv.index('--')
        args = sys.argv[idx + 1:]
        if args:
            blend_path = args[0]
            for kv in args[1:]:
                if '=' in kv:
                    k, v = kv.split('=', 1)
                    params[k.strip()] = v.strip()
    return blend_path, params


def make_out(log_path: Optional[str]):
    def _out(msg: str):
        try:
            print(msg)
            sys.stdout.flush()
        except Exception:
            pass
        if log_path:
            try:
                with open(log_path, 'a', encoding='utf-8', errors='ignore') as f:
                    f.write(msg + "\n")
            except Exception:
                pass
    return _out


def open_file_if_needed(path: str) -> None:
    try:
        if not path or not os.path.exists(path):
            return
        cur = bpy.data.filepath
        if not cur or _norm(cur) != _norm(path):
            bpy.ops.wm.open_mainfile(filepath=path)
    except Exception:
        pass


def engine_fallback(wanted: str) -> str:
    enum_items = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    if wanted in enum_items:
        return wanted
    if wanted == 'BLENDER_EEVEE' and 'BLENDER_EEVEE_NEXT' in enum_items:
        return 'BLENDER_EEVEE_NEXT'
    if 'CYCLES' in enum_items:
        return 'CYCLES'
    if enum_items:
        return enum_items[0]
    return wanted


def disable_problem_addons(out_fn):
    """Disable known problematic addons that may spawn popups or errors during scripted renders."""
    try:
        import addon_utils  # type: ignore
        # List of known addons that can interrupt renders with dialogs
        candidates = {'blenderkit'}
        for mod in addon_utils.modules():
            try:
                name = getattr(mod, "__name__", "")
                short = name.split('.')[-1]
                if short in candidates:
                    try:
                        addon_utils.disable(short, default_set=False, persistent=False)
                        out_fn(f"BL_REN:STATS text=addon_disabled:{short}")
                    except Exception:
                        pass
            except Exception:
                pass
    except Exception:
        pass

def set_render_display_window(rd, out_fn):
    """Try to force rendering to open in a separate window in GUI mode."""
    try:
        prefs = bpy.context.preferences
        # Prefer 'WINDOW' when available, else fall back to first available option
        try:
            enum_items = [e.identifier for e in prefs.view.bl_rna.properties['render_display_type'].enum_items]
            choice = None
            for cand in ('WINDOW', 'NEW_WINDOW', 'SEPARATE', 'IMAGE_EDITOR'):
                if cand in enum_items:
                    choice = cand
                    break
            if choice is None and enum_items:
                choice = enum_items[0]
            if choice:
                prefs.view.render_display_type = choice
                out_fn(f"BL_REN:STATS text=render_display_type_set:{choice}")
        except Exception:
            pass
        # Some versions have display_mode on Render settings
        try:
            if hasattr(rd, 'display_mode'):
                # Prefer WINDOW
                rd.display_mode = 'WINDOW'
        except Exception:
            pass
    except Exception:
        pass


def main():
    blend_path, params = parse_args()
    open_file_if_needed(blend_path or bpy.data.filepath)

    log_path = None
    try:
        log_path = params.get('log')
        if log_path:
            # Ensure directory exists
            try:
                os.makedirs(os.path.dirname(log_path), exist_ok=True)
            except Exception:
                pass
    except Exception:
        log_path = None
    out_fn = make_out(log_path)

    # Proactively disable problematic addons
    disable_problem_addons(out_fn)

    scene = get_scene()
    if not scene:
        out_fn("BL_REN:ERROR message=no_scene")
        return
    rd = scene.render

    # Params
    mode = params.get('mode', 'IMAGE').upper()
    wanted_engine = params.get('engine', 'BLENDER_EEVEE')
    try:
        # EEVEE ne fonctionne pas en mode background (-b). Si on est en headless, basculer sur CYCLES.
        if bpy.app.background and wanted_engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
            rd.engine = engine_fallback('CYCLES')
            out_fn("BL_REN:STATS text=engine_switched_to_cycles_for_headless")
        else:
            rd.engine = engine_fallback(wanted_engine)
    except Exception:
        pass

    try:
        w = int(params.get('w') or params.get('width') or 0)
        h = int(params.get('h') or params.get('height') or 0)
        if w > 0:
            rd.resolution_x = w
        if h > 0:
            rd.resolution_y = h
        rd.resolution_percentage = 100
    except Exception:
        pass

    # Compute safe output path and filename base
    out_dir = params.get('out') or params.get('output') or ''
    # Fix common POSIX-style paths on Windows (e.g., /tmp) by redirecting to Downloads
    try:
        if os.name == 'nt' and out_dir.startswith('/'):
            # Fallback to user's Downloads
            fallback = os.path.join(os.path.expanduser('~'), 'Downloads')
            out_dir = fallback
    except Exception:
        pass
    base_name = None
    try:
        # Derive a clean filename base from the blend filename (without extension)
        src_path = bpy.data.filepath or blend_path or ''
        if src_path:
            base_name = os.path.splitext(os.path.basename(src_path))[0]
    except Exception:
        base_name = None
    try:
        if out_dir:
            # Normalize separators and ensure folder exists (main process also tries)
            out_norm = out_dir.replace('\\', '/')
            if not out_norm.endswith('/'):
                out_norm += '/'
            # Build a concrete prefix instead of a bare folder to avoid Blender ignoring it
            prefix = out_norm + (base_name or 'render')
            try:
                os.makedirs(os.path.dirname(prefix), exist_ok=True)
            except Exception:
                pass
            rd.filepath = prefix
            base_prefix = prefix
    except Exception:
        pass
    # Fallback base prefix if not set above
    try:
        base_prefix
    except NameError:
        base_prefix = getattr(rd, 'filepath', '') or (base_name or 'render')

    # Image/video format
    try:
        rd.use_overwrite = True
        rd.use_file_extension = True
        if hasattr(rd, 'image_settings') and rd.image_settings:
            fmt = (params.get('format') or '').upper().strip()
            if mode == 'IMAGE':
                # Still: prefer PNG unless caller specifies otherwise
                rd.image_settings.file_format = fmt if fmt in {'PNG', 'OPEN_EXR', 'JPEG', 'TIFF', 'BMP'} else 'PNG'
            else:
                # Animation
                if fmt in {'FFMPEG', 'MPEG4', 'H264'}:
                    rd.image_settings.file_format = 'FFMPEG'
                    try:
                        container = (params.get('container') or 'MP4').upper()
                        codec = (params.get('codec') or 'H264').upper()
                        # Container mapping
                        if container == 'MKV':
                            rd.ffmpeg.format = 'MATROSKA'
                        elif container == 'AVI':
                            rd.ffmpeg.format = 'AVI'
                        else:
                            rd.ffmpeg.format = 'MPEG4'
                        # Codec mapping
                        if codec == 'HEVC':
                            rd.ffmpeg.codec = 'H265'
                        elif codec == 'MPEG4':
                            rd.ffmpeg.codec = 'MPEG4'
                        else:
                            rd.ffmpeg.codec = 'H264'
                        # Other sane defaults
                        rd.ffmpeg.gopsize = 12
                        rd.ffmpeg.use_max_b_frames = True
                    except Exception:
                        pass
                elif fmt in {'PNG', 'OPEN_EXR', 'JPEG', 'TIFF', 'BMP'}:
                    # Sequence of images
                    rd.image_settings.file_format = fmt
    except Exception:
        pass

    # Frame range
    total = 1
    # Define defaults so they are always available to handlers
    fs = int(getattr(scene, 'frame_start', 1) or 1)
    fe = int(getattr(scene, 'frame_end', 1) or 1)
    try:
        if mode == 'ANIMATION':
            fs = int(params.get('start') or params.get('fs') or scene.frame_start)
            fe = int(params.get('end') or params.get('fe') or scene.frame_end)
            if fs > fe:
                fs, fe = fe, fs
            scene.frame_start = fs
            scene.frame_end = fe
            total = max(1, fe - fs + 1)
        else:
            # still image at current or requested frame
            fs = int(params.get('frame') or params.get('start') or scene.frame_current)
            fe = fs
            total = 1
    except Exception:
        pass

    # Emit resolved output path (prefix) for debugging/visibility
    try:
        out_fn(f"BL_REN:PATH path={getattr(rd, 'filepath', '')}")
    except Exception:
        pass
    out_fn(f"BL_REN:INIT mode={mode} total={total}")
    # Extra diagnostics for troubleshooting no-output situations
    try:
        out_fn(f"BL_REN:STATS text=engine:{rd.engine}")
        out_fn(f"BL_REN:STATS text=background:{bpy.app.background}")
    except Exception:
        pass
    try:
        fmt_diag = getattr(rd.image_settings, 'file_format', '')
        out_fn(f"BL_REN:STATS text=file_format:{fmt_diag}")
    except Exception:
        pass
    try:
        out_fn(f"BL_REN:STATS text=filepath_prefix:{getattr(rd, 'filepath', '')}")
        out_fn(f"BL_REN:STATS text=frame_range:{fs}-{fe}")
    except Exception:
        pass

    # Should we show the render window? Only possible in GUI mode (not background)
    open_window = False
    try:
        ow = params.get('open_window')
        open_window = (str(ow).lower() in {'1', 'true', 'yes'}) if ow is not None else False
    except Exception:
        open_window = False

    # Progress tracking via handlers
    progress = {"done": 0, "total": total}
    used_frame_post = {"val": False}

    def on_render_pre(_scene):
        out_fn("BL_REN:START")

    def on_render_frame_post(*_args, **_kwargs):
        # Called after each frame is rendered, independent of file writing (works with FFMPEG)
        try:
            used_frame_post["val"] = True
            progress["done"] = min(progress["total"], progress.get("done", 0) + 1)
            out_fn(f"BL_REN:FRAME_DONE done={progress['done']} total={progress['total']}")
        except Exception:
            pass

    def on_render_write(_scene):
        # Fallback for image sequences; skip if frame_post is available to avoid double counting
        if used_frame_post["val"]:
            return
        progress["done"] = min(progress["total"], progress.get("done", 0) + 1)
        out_fn(f"BL_REN:FRAME_DONE done={progress['done']} total={progress['total']}")

    def on_render_complete(_scene):
        if progress["done"] < progress["total"]:
            progress["done"] = progress["total"]
            out_fn(f"BL_REN:FRAME_DONE done={progress['done']} total={progress['total']}")
        out_fn("BL_REN:DONE")

    def on_render_cancel(_scene):
        out_fn("BL_REN:CANCEL")

    try:
        bpy.app.handlers.render_pre.append(on_render_pre)
        # Per-frame progress regardless of file format
        try:
            bpy.app.handlers.render_frame_post.append(on_render_frame_post)
        except Exception:
            # Older Blender versions may not have render_frame_post; rely on render_write
            pass
        bpy.app.handlers.render_write.append(on_render_write)
        bpy.app.handlers.render_complete.append(on_render_complete)
        bpy.app.handlers.render_cancel.append(on_render_cancel)
        # Stats handler: emits render/saving time + memory etc.
        try:
            def _on_stats(stats):
                try:
                    s = str(stats)
                except Exception:
                    s = ''
                if s:
                    out_fn(f"BL_REN:STATS text={s}")
            bpy.app.handlers.render_stats.append(_on_stats)
        except Exception:
            pass
    except Exception:
        pass

    # Timer-based fallback: poll frame_current and emit progress when it advances
    try:
        if mode == 'ANIMATION':
            last_frame = {"val": None}
            def _poll_progress():
                try:
                    scn = get_scene()
                    if not scn:
                        return None
                    cur = int(getattr(scn, 'frame_current', fs) or fs)
                    # Consider a frame completed if it advanced beyond last seen
                    if last_frame["val"] is None:
                        last_frame["val"] = cur
                    elif cur != last_frame["val"]:
                        last_frame["val"] = cur
                        # If render_frame_post is in use, skip polling increments to avoid double counting
                        if not used_frame_post["val"] and progress["done"] < progress["total"]:
                            progress["done"] = min(progress["total"], progress["done"] + 1)
                            out_fn(f"BL_REN:FRAME_DONE done={progress['done']} total={progress['total']}")
                    # Stop when finished
                    if progress["done"] >= progress["total"]:
                        return None
                except Exception:
                    return None
                return 0.5  # poll again in 0.5s
            try:
                import bpy.app.timers as _timers  # type: ignore
                _timers.register(_poll_progress, first_interval=0.5)
            except Exception:
                pass
    except Exception:
        pass

    try:
        if not bpy.app.background and open_window:
            # Show in a separate render window and ensure operators run after UI is ready
            attempts = {"n": 0}
            def _deferred_render():
                try:
                    set_render_display_window(rd, out_fn)
                    # Try INVOKE_DEFAULT first to better integrate with UI, fall back to EXEC
                    attempts["n"] += 1
                    out_fn(f"BL_REN:STATS text=render_ui_attempt:{attempts['n']}")
                    ok = False
                    try:
                        if mode == 'ANIMATION':
                            bpy.ops.render.render('INVOKE_DEFAULT', animation=True)
                        else:
                            bpy.ops.render.render('INVOKE_DEFAULT', write_still=True)
                        ok = True
                    except Exception:
                        ok = False
                    if not ok:
                        if mode == 'ANIMATION':
                            bpy.ops.render.animation()
                        else:
                            bpy.ops.render.render(write_still=True)
                except Exception as e:
                    out_fn(f"BL_REN:ERROR message=render_invoke_failed:{e}")
                return None  # do not repeat
            try:
                import bpy.app.timers as _timers  # type: ignore
                _timers.register(_deferred_render, first_interval=0.3)
            except Exception:
                # Fallback: try immediate exec (may fail if context not ready)
                if mode == 'ANIMATION':
                    bpy.ops.render.animation()
                else:
                    bpy.ops.render.render(write_still=True)
        else:
            # Headless: ensure frame is positioned before rendering
            try:
                scene.frame_set(fs)
            except Exception:
                try:
                    scene.frame_current = fs
                except Exception:
                    pass
            if mode == 'ANIMATION':
                bpy.ops.render.animation()
            else:
                bpy.ops.render.render(write_still=True)
    except Exception as e:
        out_fn(f"BL_REN:ERROR message=render_failed:{e}")

    # Background safety: if not all frames were reported as done, render remaining frames manually
    try:
        if bpy.app.background and mode == 'ANIMATION' and total > 0 and progress.get('done', 0) < total:
            out_fn("BL_REN:STATS text=manual_fallback_render_start")
            start_f = fs + max(0, int(progress.get('done', 0)))
            for f in range(start_f, fe + 1):
                try:
                    scene.frame_set(f)
                except Exception:
                    try:
                        scene.frame_current = f
                    except Exception:
                        pass
                # Ensure unique file per frame for write_still by adjusting filepath
                try:
                    rd.filepath = f"{base_prefix}_{f:04d}"
                except Exception:
                    pass
                try:
                    bpy.ops.render.render(write_still=True)
                except Exception as ee:
                    out_fn(f"BL_REN:ERROR message=fallback_render_failed:{ee}")
                    break
                already = max(0, int(progress.get('done', 0)))
                progress['done'] = min(progress['total'], already + 1)
                out_fn(f"BL_REN:FRAME_DONE done={progress['done']} total={progress['total']}")
            if progress['done'] >= progress['total']:
                out_fn("BL_REN:DONE")
            out_fn("BL_REN:STATS text=manual_fallback_render_end")
            # Restore original prefix (without per-frame suffix)
            try:
                rd.filepath = base_prefix
            except Exception:
                pass
    except Exception:
        pass


if __name__ == '__main__':  # pragma: no cover
    main()
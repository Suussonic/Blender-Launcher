"""
Robust .blend metadata extractor for Blender-Launcher.

Usage:
  blender -b --factory-startup --python backend/blend_info.py -- <file.blend> --quit

Outputs exactly one line prefixed with BL_META: followed by a JSON payload.
"""
from __future__ import annotations
import sys
import os
import json

try:
    import bpy  # type: ignore
except Exception as e:  # pragma: no cover
    print("BL_ERROR: bpy not available: {}".format(e))
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


def open_file_if_needed(path: str) -> None:
    try:
        if not path:
            return
        if not os.path.exists(path):
            return
        cur = bpy.data.filepath
        if not cur or _norm(cur) != _norm(path):
            # In background (-b), this operator is available
            bpy.ops.wm.open_mainfile(filepath=path)
    except Exception:
        # If open fails, continue; we will read whatever is current
        pass


def resolve_output_path(rd) -> tuple[str, str]:
    # rd.filepath can be relative like //renders
    raw = getattr(rd, "filepath", "") or ""
    try:
        abspath = bpy.path.abspath(raw) if raw else raw
    except Exception:
        abspath = raw
    return raw, abspath


def main():
    # Read blend path after '--'
    blend_path = None
    if '--' in sys.argv:
        idx = sys.argv.index('--')
        if idx + 1 < len(sys.argv):
            blend_path = sys.argv[idx + 1]

    open_file_if_needed(blend_path or bpy.data.filepath)

    scene = get_scene()
    rd = scene.render if scene else None

    # Resolution
    rx = int(getattr(rd, "resolution_x", 0) or 0) if rd else 0
    ry = int(getattr(rd, "resolution_y", 0) or 0) if rd else 0
    rperc = float(getattr(rd, "resolution_percentage", 100.0) or 100.0) if rd else 100.0
    width = int(rx * (rperc / 100.0)) if rx else 0
    height = int(ry * (rperc / 100.0)) if ry else 0

    # Frames
    fs = int(getattr(scene, "frame_start", 1) or 1) if scene else 1
    fe = int(getattr(scene, "frame_end", 250) or 250) if scene else 250
    fc = int(getattr(scene, "frame_current", fs) or fs) if scene else fs

    # FPS
    fps = 24.0
    fps_num = int(getattr(rd, "fps", 24) or 24) if rd else 24
    fps_base = float(getattr(rd, "fps_base", 1.0) or 1.0) if rd else 1.0
    try:
        fps = (fps_num / fps_base) if fps_base else float(fps_num)
    except Exception:
        fps = float(fps_num)

    # Output path and format
    raw_out, abs_out = ("", "")
    if rd:
        raw_out, abs_out = resolve_output_path(rd)
    file_format = None
    color_mode = None
    try:
        if rd and hasattr(rd, 'image_settings') and rd.image_settings:
            file_format = getattr(rd.image_settings, 'file_format', None)
            color_mode = getattr(rd.image_settings, 'color_mode', None)
    except Exception:
        pass

    # Engine mapping
    engine = (getattr(rd, "engine", "") if rd else "") or ""
    engine_upper = engine.upper()
    engine_friendly = engine_upper
    if engine_upper.endswith('BLENDER_EEVEE'):
        engine_friendly = 'BLENDER_EEVEE'
    elif engine_upper.endswith('BLENDER_EEVEE_NEXT'):
        engine_friendly = 'BLENDER_EEVEE_NEXT'
    elif engine_upper.endswith('CYCLES'):
        engine_friendly = 'CYCLES'
    elif engine_upper.endswith('BLENDER_WORKBENCH') or engine_upper.endswith('WORKBENCH'):
        engine_friendly = 'BLENDER_WORKBENCH'

    payload = {
        "width": width,
        "height": height,
        "raw_width": rx,
        "raw_height": ry,
        "resolution_percentage": rperc,
        "frame_start": fs,
    "frame_end": fe,
    "frame_current": fc,
        "fps": fps,
        "fps_num": fps_num,
        "fps_base": fps_base,
        "output": raw_out,
        "output_abs": abs_out,
        "engine": engine_friendly,
        "engine_raw": engine,
        "file_format": file_format or "",
        "color_mode": color_mode or "",
        "blend_file": bpy.data.filepath or (blend_path or ""),
    }

    try:
        print("BL_META:" + json.dumps(payload, ensure_ascii=False))
    except Exception:
        # Fallback ASCII-safe
        safe = {k: (str(v) if not isinstance(v, (int, float)) else v) for k, v in payload.items()}
        print("BL_META:" + json.dumps(safe))
    sys.stdout.flush()


if __name__ == "__main__":  # pragma: no cover
    main()

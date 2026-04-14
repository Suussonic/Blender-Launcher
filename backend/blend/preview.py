"""Generate a PNG preview for a `.blend` file.

Usage:
    blender -b --factory-startup --python backend/blend/preview.py -- <blend_path> <out_png> <width> <height> --quit

The script emits one `BL_PREVIEW:` JSON line and uses multiple fallbacks:
embedded preview, render result, then lightweight object-mode render.
"""
from __future__ import annotations

import json
import os
import sys


def _save_render_result_preview(out_png: str) -> bool:
    """Try saving an already-available Render Result image from the blend."""
    try:
        import bpy  # type: ignore

        img = bpy.data.images.get("Render Result")
        if img is None:
            return False
        w, h = img.size[0], img.size[1]
        if int(w) <= 0 or int(h) <= 0:
            return False
        img.save_render(filepath=out_png)
        return os.path.exists(out_png)
    except Exception:
        return False


def _collect_renderable_objects(scene):
    """Collect visible objects that are meaningful for an object-mode preview."""
    try:
        import bpy  # type: ignore

        allowed = {
            "MESH", "CURVE", "SURFACE", "META", "FONT", "VOLUME", "POINTCLOUD",
            "GPENCIL", "GREASEPENCIL",
        }
        objs = []
        for obj in scene.objects:
            if getattr(obj, "type", "") not in allowed:
                continue
            if getattr(obj, "hide_render", False):
                continue
            try:
                if hasattr(obj, "visible_get") and not obj.visible_get():
                    continue
            except Exception:
                pass
            objs.append(obj)
        if objs:
            return objs

        # Last resort: include all non-camera/light objects.
        return [o for o in scene.objects if getattr(o, "type", "") not in {"CAMERA", "LIGHT"}]
    except Exception:
        return []


def _ensure_preview_camera(scene, targets):
    """Create and position a temporary camera framing target objects."""
    import bpy  # type: ignore
    from mathutils import Vector  # type: ignore

    cam_data = bpy.data.cameras.new("__bl_launcher_preview_cam_data__")
    cam_obj = bpy.data.objects.new("__bl_launcher_preview_cam__", cam_data)
    scene.collection.objects.link(cam_obj)

    points = []
    for obj in targets:
        try:
            for corner in obj.bound_box:
                points.append(obj.matrix_world @ Vector(corner))
        except Exception:
            continue

    if not points:
        cam_obj.location = (4.0, -4.0, 3.0)
        cam_obj.rotation_euler = (1.1, 0.0, 0.78)
        scene.camera = cam_obj
        return cam_obj

    min_v = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    max_v = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    center = (min_v + max_v) * 0.5
    span = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z)
    span = max(span, 0.5)

    distance = span * 2.2
    cam_obj.location = center + Vector((distance, -distance, distance * 0.9))
    direction = center - cam_obj.location
    try:
        cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    except Exception:
        cam_obj.rotation_euler = (1.1, 0.0, 0.78)

    cam_data.clip_start = 0.01
    cam_data.clip_end = max(1000.0, distance * 50.0)
    scene.camera = cam_obj
    return cam_obj


def _render_object_mode_fallback(out_png: str, width: int, height: int) -> bool:
    """Fallback preview in a Blender-like object style without heavy render settings."""
    import bpy  # type: ignore

    scene = bpy.context.scene
    if scene is None and bpy.data.scenes:
        scene = bpy.data.scenes[0]
    if scene is None:
        return False

    render = scene.render
    prev_engine = getattr(render, "engine", "")
    prev_camera = getattr(scene, "camera", None)
    prev_use_comp = getattr(render, "use_compositing", None)
    prev_use_seq = getattr(render, "use_sequencer", None)

    prev_cycles_samples = None
    prev_eevee_samples = None
    if hasattr(scene, "cycles"):
        try:
            prev_cycles_samples = int(getattr(scene.cycles, "samples", 0))
        except Exception:
            prev_cycles_samples = None
    if hasattr(scene, "eevee"):
        try:
            prev_eevee_samples = int(getattr(scene.eevee, "taa_render_samples", 0))
        except Exception:
            prev_eevee_samples = None

    temp_cam = None
    try:
        render.resolution_x = width
        render.resolution_y = height
        render.resolution_percentage = 100
        render.image_settings.file_format = "PNG"
        render.filepath = out_png

        # Prefer fast engines available in background mode.
        for cand in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES", "BLENDER_WORKBENCH"):
            try:
                render.engine = cand
                break
            except Exception:
                continue

        # Disable extra pipelines for speed and robustness.
        try:
            render.use_compositing = False
        except Exception:
            pass
        try:
            render.use_sequencer = False
        except Exception:
            pass

        if getattr(render, "engine", "") == "CYCLES" and hasattr(scene, "cycles"):
            try:
                scene.cycles.samples = 8
            except Exception:
                pass
        if getattr(render, "engine", "") in {"BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"} and hasattr(scene, "eevee"):
            try:
                scene.eevee.taa_render_samples = 8
            except Exception:
                pass

        targets = _collect_renderable_objects(scene)
        # Always use a temporary camera to frame objects consistently.
        temp_cam = _ensure_preview_camera(scene, targets)

        bpy.ops.render.render(write_still=True)
        return os.path.exists(out_png)
    except Exception:
        return False
    finally:
        try:
            if prev_engine:
                render.engine = prev_engine
        except Exception:
            pass
        try:
            scene.camera = prev_camera
        except Exception:
            pass
        try:
            if prev_use_comp is not None:
                render.use_compositing = prev_use_comp
        except Exception:
            pass
        try:
            if prev_use_seq is not None:
                render.use_sequencer = prev_use_seq
        except Exception:
            pass
        if hasattr(scene, "cycles") and prev_cycles_samples is not None:
            try:
                scene.cycles.samples = prev_cycles_samples
            except Exception:
                pass
        if hasattr(scene, "eevee") and prev_eevee_samples is not None:
            try:
                scene.eevee.taa_render_samples = prev_eevee_samples
            except Exception:
                pass
        if temp_cam is not None:
            try:
                cam_data = temp_cam.data
                bpy.data.objects.remove(temp_cam, do_unlink=True)
                if cam_data is not None:
                    bpy.data.cameras.remove(cam_data, do_unlink=True)
            except Exception:
                pass


def _save_preview_pixels_to_png(preview, out_png: str) -> bool:
    """Save an ImagePreview pixel buffer to a PNG file."""
    try:
        size = tuple(getattr(preview, "image_size", (0, 0)) or (0, 0))
        if len(size) != 2:
            return False
        w, h = int(size[0]), int(size[1])
        if w <= 0 or h <= 0:
            return False

        pix = getattr(preview, "image_pixels", None)
        if pix is None:
            return False

        raw = list(pix)
        expected = w * h * 4
        if len(raw) != expected:
            return False

        import bpy  # type: ignore

        img = bpy.data.images.new("__bl_launcher_preview__", width=w, height=h, alpha=True)
        try:
            # ImagePreview stores bytes 0..255, Image.pixels expects floats 0..1.
            img.pixels.foreach_set([v / 255.0 for v in raw])
            img.filepath_raw = out_png
            img.file_format = "PNG"
            img.save()
            return os.path.exists(out_png)
        finally:
            try:
                bpy.data.images.remove(img)
            except Exception:
                pass
    except Exception:
        return False


def _extract_fast_image_preview(out_png: str) -> bool:
    """Try extracting an existing ID preview before rendering."""
    try:
        import bpy  # type: ignore

        pools = [
            bpy.data.scenes,
            bpy.data.objects,
            bpy.data.collections,
            bpy.data.materials,
            bpy.data.worlds,
            bpy.data.textures,
            bpy.data.images,
        ]

        for pool in pools:
            for datablock in pool:
                prev = getattr(datablock, "preview", None)
                if prev and _save_preview_pixels_to_png(prev, out_png):
                    return True
                # preview_ensure may populate preview data for some IDs.
                try:
                    ensured = datablock.preview_ensure()
                except Exception:
                    ensured = None
                if ensured and _save_preview_pixels_to_png(ensured, out_png):
                    return True
    except Exception:
        return False
    return False


def _print_payload(success: bool, output: str, error: str = "") -> None:
    payload = {
        "success": bool(success),
        "output": output or "",
        "error": error or "",
    }
    try:
        print("BL_PREVIEW:" + json.dumps(payload, ensure_ascii=False))
    except Exception:
        print("BL_PREVIEW:" + json.dumps(payload))
    sys.stdout.flush()


def _parse_args() -> tuple[str, str, int, int]:
    if "--" not in sys.argv:
        return "", "", 320, 180
    idx = sys.argv.index("--")
    args = sys.argv[idx + 1 :]
    blend_path = args[0] if len(args) > 0 else ""
    out_png = args[1] if len(args) > 1 else ""
    try:
        width = int(args[2]) if len(args) > 2 else 320
    except Exception:
        width = 320
    try:
        height = int(args[3]) if len(args) > 3 else 180
    except Exception:
        height = 180
    return blend_path, out_png, max(64, width), max(64, height)


def main() -> None:
    blend_path, out_png, width, height = _parse_args()
    if not blend_path or not out_png:
        _print_payload(False, out_png, "invalid-args")
        return
    if not os.path.exists(blend_path):
        _print_payload(False, out_png, "blend-not-found")
        return

    try:
        import bpy  # type: ignore
    except Exception as exc:
        _print_payload(False, out_png, f"bpy-not-available: {exc}")
        return

    try:
        out_dir = os.path.dirname(out_png)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
    except Exception as exc:
        _print_payload(False, out_png, f"mkdir-failed: {exc}")
        return

    try:
        bpy.ops.wm.open_mainfile(filepath=blend_path)
    except Exception as exc:
        _print_payload(False, out_png, f"open-mainfile-failed: {exc}")
        return

    try:
        scene = bpy.context.scene
        if scene is None and bpy.data.scenes:
            scene = bpy.data.scenes[0]
        if scene is None:
            _print_payload(False, out_png, "scene-not-found")
            return

        # Fast path: reuse embedded datablock previews when available.
        if _extract_fast_image_preview(out_png):
            _print_payload(True, out_png, "")
            return

        # Try using an existing Render Result saved in the .blend.
        if _save_render_result_preview(out_png):
            _print_payload(True, out_png, "")
            return

        # Keep preview generation fast and deterministic.
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = out_png

        if scene.camera is None:
            cam_obj = None
            for obj in bpy.data.objects:
                if getattr(obj, "type", "") == "CAMERA":
                    cam_obj = obj
                    break
            if cam_obj is not None:
                scene.camera = cam_obj

        bpy.ops.render.render(write_still=True)
        if os.path.exists(out_png):
            _print_payload(True, out_png, "")
            return
    except Exception:
        # Intentionally continue to object fallback.
        pass

    # Fallback: Blender-like object/workbench preview instead of empty thumbnail.
    if _render_object_mode_fallback(out_png, width, height):
        _print_payload(True, out_png, "")
    else:
        _print_payload(False, out_png, "fallback-object-preview-failed")


if __name__ == "__main__":
    main()

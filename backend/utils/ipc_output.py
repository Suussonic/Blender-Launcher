#!/usr/bin/env python3
"""Helpers for consistent BL_* marker output from backend scripts."""

from __future__ import annotations

import sys
from typing import Any


def emit_marker(mark: str, tag: str, *, sep: str = "\t", **kv: Any) -> None:
    """Print a marker line with sanitized key/value pairs.

    Args:
        mark: Marker prefix, for example ``"BL_CLONE:"``.
        tag: Marker tag, for example ``"PROGRESS"``.
        sep: Field separator. Use ``"\t"`` when consumers parse paths with spaces.
        **kv: Additional key/value fields.
    """
    parts = [mark + tag]
    for key, value in kv.items():
        if value is None:
            continue
        text = (
            str(value)
            .replace("\n", " ")
            .replace("\r", " ")
            .replace("\t", " ")
            .strip()
        )
        parts.append(f"{key}={text}")

    msg = sep.join(parts)
    try:
        print(msg, flush=True)
    except Exception:
        try:
            sys.stdout.write(msg + "\n")
            sys.stdout.flush()
        except Exception:
            pass

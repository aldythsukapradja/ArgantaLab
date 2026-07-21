"""Shared evidence / source_id resolution for ArgantaEnergy O2 decoders.

source_id == the file's path key in mirror-manifest.json (relative to the raw
mirror root). It resolves to an evidence record {volumePath, size,
last_modified, sha256, retrievedAt}. No row is emitted without one.
"""
from __future__ import annotations
import json, os, sys

# repo root = two levels up from this file (apps/energy/scripts -> repo)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA_ROOT = os.path.join(ROOT, "data-energy")
RAW = os.path.join(DATA_ROOT, "raw")
MANIFEST = os.path.join(DATA_ROOT, "manifest", "mirror-manifest.json")

_manifest = None

def manifest() -> dict:
    global _manifest
    if _manifest is None:
        with open(MANIFEST, "r", encoding="utf-8") as fh:
            _manifest = json.load(fh)
    return _manifest

def to_source_id(abs_path: str) -> str:
    """Convert an absolute path under RAW into its manifest key (source_id)."""
    rel = os.path.relpath(abs_path, RAW).replace(os.sep, "/")
    return rel

def resolve(source_id: str) -> dict | None:
    m = manifest()
    e = m.get(source_id)
    if not e:
        return None
    return {
        "volumePath": e.get("path"),
        "size": e.get("size"),
        "last_modified": e.get("last_modified"),
        "sha256": e.get("sha256"),
        "retrievedAt": e.get("retrievedAt"),
    }

def evidence(abs_path: str) -> tuple[str, dict]:
    sid = to_source_id(abs_path)
    ev = resolve(sid)
    if ev is None:
        raise KeyError(f"source_id not in manifest: {sid}")
    return sid, ev

def _default(o):
    # coerce numpy scalar / array types to plain Python
    try:
        import numpy as np
        if isinstance(o, np.generic):
            return o.item()
        if isinstance(o, np.ndarray):
            return o.tolist()
    except Exception:
        pass
    if isinstance(o, (bytes, bytearray)):
        return o.decode("latin-1", "replace")
    return str(o)

def write_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"), default=_default)
    os.replace(tmp, path)

def log(*a):
    print(*a, file=sys.stderr, flush=True)

"""O2 · Depth-horizon decoder.

Parses the gridded interpreted depth surfaces under
  data-energy/raw/Geophysical_Interpretations/Horizons/Horizons_DEPTH/**/*.dat
These are OpenWorks point-grid exports: a '#'-commented header, then a section
name / attribute block, then comma-separated data rows. Observed column order:
  col0, col1, X(easting m), Y(northing m), Z(depth m, positive down)

Emits per surface: metadata + a DECIMATED preview grid (full grid stays in raw).
  processed/horizons/<name>.json
     { name, kind:'depth_horizon', points_count, columns_stats, bbox,
       preview:[[x,y,z]...], source_id, dataNature:'interpreted' }
dataNature = 'interpreted'.
"""
from __future__ import annotations
import os, sys, glob, re
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT, RAW, evidence, write_json, log

HDIR = os.path.join(RAW, "Geophysical_Interpretations", "Horizons", "Horizons_DEPTH")
PREVIEW_MAX = 4000
NUM_ROW = re.compile(r"^\s*-?\d+(\.\d+)?\s*,")  # starts with a number then comma

def safe(s):
    return re.sub(r"[^0-9A-Za-z_.+-]+", "_", s).strip("_")

def decode(path, summary):
    sid, ev = evidence(path)
    name = os.path.splitext(os.path.basename(path))[0]
    ncols = None
    count = 0
    mins = None; maxs = None
    preview = []
    # reservoir-sample decimation: keep every Nth after a first pass count is unknown,
    # so do a streaming reservoir with fixed stride estimated from file size.
    stride = 1
    # first pass: count lines cheaply
    with open(path, "r", encoding="latin-1") as fh:
        for line in fh:
            if NUM_ROW.match(line):
                count += 1
    stride = max(1, count // PREVIEW_MAX)

    i = 0
    with open(path, "r", encoding="latin-1") as fh:
        for line in fh:
            if not NUM_ROW.match(line):
                continue
            parts = [p.strip() for p in line.strip().split(",") if p.strip() != ""]
            try:
                vals = [float(p) for p in parts]
            except ValueError:
                continue
            if ncols is None:
                ncols = len(vals)
                mins = list(vals); maxs = list(vals)
            else:
                for j in range(min(ncols, len(vals))):
                    if vals[j] < mins[j]: mins[j] = vals[j]
                    if vals[j] > maxs[j]: maxs[j] = vals[j]
            if i % stride == 0 and len(vals) >= 5:
                # x=col2, y=col3, z=col4 (0-based)
                preview.append([vals[2], vals[3], vals[4]])
            i += 1

    col_stats = [{"col": j, "min": mins[j], "max": maxs[j]} for j in range(ncols or 0)]
    bbox = None
    if ncols and ncols >= 5:
        bbox = {"x_min": mins[2], "x_max": maxs[2], "y_min": mins[3], "y_max": maxs[3],
                "z_min": mins[4], "z_max": maxs[4]}
    out = {
        "name": name, "kind": "depth_horizon",
        "points_count": count, "n_columns": ncols,
        "column_stats": col_stats, "bbox": bbox,
        "column_note": "observed order: col0,col1,X(easting m),Y(northing m),Z(depth m, +down); full grid remains in raw only",
        "preview_points": len(preview), "preview": preview,
        "source_id": sid, "evidence": ev, "dataNature": "interpreted",
    }
    write_json(os.path.join(DATA_ROOT, "processed", "horizons", safe(name) + ".json"), out)
    summary.append({"name": name, "points": count, "ncols": ncols, "bbox": bbox, "source_id": sid})
    log(f"[horizon] {name}: {count} pts, {ncols} cols")
    return count

def main():
    files = sorted(glob.glob(os.path.join(HDIR, "**", "*.dat"), recursive=True))
    summary = []
    total = 0
    for p in files:
        total += decode(p, summary)

    qc = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc", "horizons.md"))
    with open(qc, "w", encoding="utf-8") as fh:
        fh.write("# QC · Depth horizons (interpreted surfaces)\n\n")
        fh.write(f"- surfaces decoded: **{len(files)}**  ·  total grid points: **{total:,}**\n")
        fh.write("- dataNature: `interpreted`. Metadata + decimated preview stored; full grid stays in raw.\n\n")
        fh.write("| surface | points | cols | X range | Y range | Z(depth m) range |\n")
        fh.write("|---|--:|--:|---|---|---|\n")
        for s in summary:
            b = s["bbox"] or {}
            fh.write(f"| {s['name'][:46]} | {s['points']:,} | {s['ncols']} | "
                     f"{b.get('x_min'):.0f}–{b.get('x_max'):.0f} | {b.get('y_min'):.0f}–{b.get('y_max'):.0f} | "
                     f"{b.get('z_min'):.1f}–{b.get('z_max'):.1f} |\n" if b else
                     f"| {s['name']} | {s['points']} | {s['ncols']} | - | - | - |\n")
    print(f"OK horizons={len(files)} points={total:,}")

if __name__ == "__main__":
    main()

"""O2 · Well-log decoder (LAS + DLIS).

Priorities (BUILD-PLAN §2.4 / O2): 05.PETROPHYSICAL INTERPRETATION (CPI),
04.COMPOSITE, 06.LFP, 01.MUD_LOG. All LAS + DLIS under Well_logs_pr_WELL are
decoded; the QC records per-well curve inventory.

LAS: parsed with `lasio` (CWLS LAS 2.0, handles WRAP=YES robustly). The NULL
sentinel is taken ONLY from the file header (well.NULL). Curve mnemonics +
units preserved verbatim (curve_source). An EXPLICIT alias map derives the
canonical curve name (curve_canonical) — never a silent rename. Every alias
applied is listed in the output + QC.

DLIS: parsed with `dlisio` (frames -> channels). Same long/columnar model.

Output per run (full fidelity, columnar to avoid 10x JSON key bloat while
preserving EVERY sample — this is a faithful long-format encoding):
  processed/log-samples/<well>__<run>.json
     { well, run, source_id, depth_unit, index_curve,
       curves:[{canonical,source,unit,alias_applied}],
       md:[...], values:{ <source>:[...] },   # NULLs -> null
       dataNature:'measured' }
  processed/log-samples-preview/<well>__<run>.json  (downsampled ~2000 pts)
"""
from __future__ import annotations
import os, sys, glob, re
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT, RAW, evidence, write_json, log

def col_to_list(arr, null=None):
    """Vectorized full-precision extraction: null sentinel + NaN -> None.
    Uses numpy .tolist() (C-speed) then a single list-comp; NO rounding, so
    source values are preserved byte-faithfully to double precision."""
    a = np.asarray(arr, dtype="float64")
    if null is not None:
        a = np.where(a == null, np.nan, a)
    lst = a.tolist()
    return [None if (x != x) else x for x in lst]

WELLLOGS = os.path.join(RAW, "Well_logs_pr_WELL")
PREVIEW_MAX = 2000

# Explicit, auditable alias map: source mnemonic -> canonical curve name.
# Applied case-insensitively on the bare mnemonic. Anything not listed keeps
# its source name as canonical (recorded as alias_applied=false).
ALIAS = {
    "DTC": "DT", "DTCO": "DT", "DT4P": "DT", "AC": "DT",
    "RDEP": "RT", "RD": "RT", "RT90": "RT", "RILD": "RT", "LLD": "RT",
    "RMED": "RM", "RM90": "RM", "LLS": "RM",
    "GR": "GR", "GRD": "GR", "SGR": "GR", "GRKT": "GR",
    "RHOB": "RHOB", "DEN": "RHOB", "ZDEN": "RHOB",
    "NPHI": "NPHI", "TNPH": "NPHI", "NEU": "NPHI",
    "CALI": "CALI", "CAL": "CALI", "HCAL": "CALI",
    "PEF": "PEF", "PE": "PEF",
    "SP": "SP", "DRHO": "DRHO",
    "PHIF": "PHIF", "PHIT": "PHIT", "PHIE": "PHIE",
    "SW": "SW", "VSH": "VSH", "KLOGH": "KLOGH", "KLOGV": "KLOGV",
    "BVW": "BVW", "PORD": "PORD",
    "DEPTH": "DEPT", "DEPT": "DEPT", "MD": "DEPT", "TDEP": "DEPT",
}

def canon(mnem):
    return ALIAS.get(mnem.strip().upper(), mnem.strip())

def run_label(path):
    rel = os.path.relpath(path, WELLLOGS).replace(os.sep, "/")
    parts = rel.split("/")
    well = parts[0]
    folder = parts[1] if len(parts) > 1 else ""
    base = os.path.splitext(parts[-1])[0]
    run = f"{folder.split('.')[-1] if '.' in folder else folder}__{base}"
    return well, run, folder

def safe(s):
    return re.sub(r"[^0-9A-Za-z_.-]+", "_", s).strip("_")

def downsample(md, values, keys):
    n = len(md)
    if n <= PREVIEW_MAX:
        return md, values
    step = max(1, n // PREVIEW_MAX)
    idx = list(range(0, n, step))
    return ([md[i] for i in idx],
            {k: [values[k][i] for i in idx] for k in keys})

# ---------------- LAS ----------------
def las_version(path):
    """Read the ~Version block's VERS value without loading the whole file."""
    try:
        with open(path, "r", encoding="latin-1") as fh:
            for _ in range(40):
                line = fh.readline()
                if not line:
                    break
                m = re.match(r"\s*VERS\s*\.\s*([0-9.]+)", line)
                if m:
                    try: return float(m.group(1))
                    except ValueError: return None
    except Exception:
        return None
    return None

def decode_las(path, per_well):
    import lasio
    sid, ev = evidence(path)
    well, run, folder = run_label(path)
    ver = las_version(path)
    if ver is not None and ver >= 3.0:
        # LAS 3.0 (time-indexed, multi-section, comma-delimited formation-pressure
        # recordings) are out of the "parse LAS 2.0 natively" scope and lasio
        # does not read them reliably. Inventoried, not decoded — never faked.
        per_well.setdefault(well, {"runs": [], "deferred": []})["deferred"].append(
            {"run": run, "source_id": sid, "reason": f"decode deferred: LAS {ver} (out of LAS-2.0 scope)"})
        return None
    try:
        las = lasio.read(path, ignore_header_errors=True)
    except Exception as e:  # noqa
        log(f"[las] FAIL {path}: {e}")
        per_well.setdefault(well, {"runs": [], "deferred": []})["deferred"].append(
            {"run": run, "source_id": sid, "reason": f"lasio error: {e}"})
        return None
    try:
        null = las.well.NULL.value
        null = float(null) if null is not None else None
    except Exception:
        null = None
    curves = las.curves
    if len(curves) == 0:
        return None
    index_mnem = curves[0].mnemonic
    md = col_to_list(las[index_mnem])  # index: NaN->None (null sentinel not applied to depth)
    depth_unit = curves[0].unit or None

    cmeta, values = [], {}
    for c in curves[1:]:
        src = c.mnemonic
        cn = canon(src)
        applied = cn.upper() != src.strip().upper()
        values[src] = col_to_list(las[src], null)
        cmeta.append({"canonical": cn, "source": src, "unit": c.unit or None,
                      "alias_applied": applied, "description": (c.descr or "").strip() or None})

    keys = list(values.keys())
    write_json(os.path.join(DATA_ROOT, "processed", "log-samples", f"{safe(well)}__{safe(run)}.json"), {
        "well": well, "run": run, "folder": folder, "format": "LAS",
        "source_id": sid, "evidence": ev,
        "null_sentinel": null, "depth_unit": depth_unit, "index_curve": index_mnem,
        "curves": cmeta, "md": md, "values": values,
        "dataNature": "measured",
    })
    pmd, pvals = downsample(md, values, keys)
    write_json(os.path.join(DATA_ROOT, "processed", "log-samples-preview", f"{safe(well)}__{safe(run)}.json"), {
        "well": well, "run": run, "format": "LAS", "source_id": sid,
        "index_curve": index_mnem, "depth_unit": depth_unit,
        "curves": [c["source"] for c in cmeta], "md": pmd, "values": pvals,
        "downsampled": len(md) != len(pmd), "full_samples": len(md),
    })
    info = {"run": run, "source_id": sid, "format": "LAS", "samples": len(md),
            "md_min": next((x for x in md if x is not None), None),
            "md_max": next((x for x in reversed(md) if x is not None), None),
            "depth_unit": depth_unit, "null": null,
            "curves": [{"source": c["source"], "canonical": c["canonical"],
                        "unit": c["unit"], "alias": c["alias_applied"]} for c in cmeta]}
    per_well.setdefault(well, {"runs": [], "deferred": []})["runs"].append(info)
    return len(md) * len(cmeta)

# ---------------- DLIS ----------------
def decode_dlis(path, per_well):
    import dlisio
    from dlisio import dlis
    sid, ev = evidence(path)
    well, run, folder = run_label(path)
    total = 0
    try:
        with dlis.load(path) as batch:
            fi = 0
            for lf in batch:
                for fr in lf.frames:
                    fi += 1
                    try:
                        idx_ch = fr.index  # mnemonic of index channel
                    except Exception:
                        idx_ch = None
                    chans = list(fr.channels)
                    if not chans:
                        continue
                    # curves() returns a structured array
                    try:
                        data = fr.curves()
                    except Exception as e:
                        log(f"[dlis] frame curves fail {path}: {e}")
                        continue
                    names = list(data.dtype.names) if data.dtype.names else []
                    if not names:
                        continue
                    index_name = idx_ch if idx_ch in names else names[0]
                    md = col_to_list(data[index_name])
                    unit_by = {c.name: (c.units or None) for c in chans}
                    cmeta, values = [], {}
                    for nm in names:
                        if nm == index_name:
                            continue
                        col = data[nm]
                        if col.ndim != 1:  # only 1-D numeric channels
                            continue
                        try:
                            values[nm] = col_to_list(col)
                        except (TypeError, ValueError):
                            continue
                        cn = canon(nm)
                        cmeta.append({"canonical": cn, "source": nm,
                                      "unit": unit_by.get(nm), "alias_applied": cn.upper()!=nm.strip().upper()})
                    if not cmeta:
                        continue
                    runf = f"{run}__f{fi}"
                    keys = list(values.keys())
                    idx_unit = unit_by.get(index_name)
                    write_json(os.path.join(DATA_ROOT, "processed", "log-samples", f"{safe(well)}__{safe(runf)}.json"), {
                        "well": well, "run": runf, "folder": folder, "format": "DLIS",
                        "source_id": sid, "evidence": ev, "null_sentinel": None,
                        "depth_unit": idx_unit, "index_curve": index_name,
                        "curves": cmeta, "md": md, "values": values, "dataNature": "measured"})
                    pmd, pvals = downsample(md, values, keys)
                    write_json(os.path.join(DATA_ROOT, "processed", "log-samples-preview", f"{safe(well)}__{safe(runf)}.json"), {
                        "well": well, "run": runf, "format": "DLIS", "source_id": sid,
                        "index_curve": index_name, "depth_unit": idx_unit,
                        "curves": [c["source"] for c in cmeta], "md": pmd, "values": pvals,
                        "downsampled": len(md)!=len(pmd), "full_samples": len(md)})
                    per_well.setdefault(well, {"runs": [], "deferred": []})["runs"].append({
                        "run": runf, "source_id": sid, "format": "DLIS", "samples": len(md),
                        "md_min": next((x for x in md if x is not None), None),
                        "md_max": next((x for x in reversed(md) if x is not None), None),
                        "depth_unit": idx_unit, "null": None,
                        "curves": [{"source": c["source"], "canonical": c["canonical"],
                                    "unit": c["unit"], "alias": c["alias_applied"]} for c in cmeta]})
                    total += len(md) * len(cmeta)
    except Exception as e:  # noqa
        log(f"[dlis] FAIL {path}: {e}")
        per_well.setdefault(well, {"runs": [], "deferred": []})["deferred"].append(
            {"run": run, "source_id": sid, "reason": f"dlisio error: {e}"})
    return total

def main():
    las_files = sorted(glob.glob(os.path.join(WELLLOGS, "**", "*.las"), recursive=True)) + \
                sorted(glob.glob(os.path.join(WELLLOGS, "**", "*.LAS"), recursive=True))
    las_files = sorted(set(las_files))
    dlis_files = sorted(set(glob.glob(os.path.join(WELLLOGS, "**", "*.dlis"), recursive=True) +
                            glob.glob(os.path.join(WELLLOGS, "**", "*.DLIS"), recursive=True)))

    per_well = {}
    las_ok = las_vals = 0
    for p in las_files:
        n = decode_las(p, per_well)
        if n is not None:
            las_ok += 1; las_vals += n
    dlis_ok = dlis_vals = 0
    for p in dlis_files:
        n = decode_dlis(p, per_well)
        if n:
            dlis_ok += 1; dlis_vals += n

    write_json(os.path.join(DATA_ROOT, "interim", "log-inventory.json"), {
        "las_files": len(las_files), "las_decoded": las_ok,
        "dlis_files": len(dlis_files), "dlis_decoded": dlis_ok,
        "las_values": las_vals, "dlis_values": dlis_vals,
        "alias_map": ALIAS,
        "per_well": per_well,
    })

    # QC per-well curve inventory
    qc = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc", "well-logs.md"))
    with open(qc, "w", encoding="utf-8") as fh:
        fh.write("# QC · Well logs (LAS + DLIS)\n\n")
        fh.write(f"- LAS files: {len(las_files)}  ·  decoded runs: {las_ok}  ·  values: {las_vals:,}\n")
        fh.write(f"- DLIS files: {len(dlis_files)}  ·  decoded frames: {dlis_ok}  ·  values: {dlis_vals:,}\n")
        fh.write("- dataNature: `measured`. NULL sentinel taken only from LAS header. No silent renames.\n\n")
        fh.write("## Alias map (source → canonical, explicit)\n\n")
        fh.write(", ".join(f"`{k}`→`{v}`" for k, v in ALIAS.items()) + "\n\n")
        fh.write("## Per-well curve inventory\n\n")
        for well in sorted(per_well.keys()):
            w = per_well[well]
            fh.write(f"### {well}\n\n")
            for r in w["runs"]:
                cs = ", ".join(f"{c['source']}({c['unit'] or '-'})" for c in r["curves"])
                fh.write(f"- **{r['run']}** [{r['format']}] {r['samples']} samples, "
                         f"MD {r['md_min']}–{r['md_max']} {r['depth_unit'] or ''}, null={r['null']}\n")
                fh.write(f"  - curves: {cs}\n")
            for d in w.get("deferred", []):
                fh.write(f"- ⚠ deferred: {d['run']} — {d['reason']}\n")
            fh.write("\n")

    log(f"[logs] LAS {las_ok}/{len(las_files)} vals={las_vals:,} | DLIS {dlis_ok}/{len(dlis_files)} vals={dlis_vals:,}")
    print(f"OK LAS {las_ok}/{len(las_files)} ({las_vals:,} vals) | DLIS {dlis_ok}/{len(dlis_files)} ({dlis_vals:,} vals) | wells={len(per_well)}")

if __name__ == "__main__":
    main()

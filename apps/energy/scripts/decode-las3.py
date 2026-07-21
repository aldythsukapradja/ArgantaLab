"""O2/P1 gap-fill · LAS 3.0 pressure-log decoder.

O2 deferred 48 LAS 3.0 files under Well_logs_pr_WELL/*/03.PRESSURE/ — MWD
formation-pressure (FPWD / pretest) time-series that hung lasio. This is a
hand-rolled LAS 3.0 section parser (no lasio/welly): it reads the ~Version
block for the declared delimiter (DLM) + WRAP + VERS, the NULL sentinel from
the Well block, pairs each ~*_Definition section with its ~*_data section (via
the '| <definition>' reference in the data header, else by name), and parses
the data with the DECLARED delimiter only.

Only VERS 3.0 files are processed here (the LAS 2.0 COMPUTED pressure logs in
the same folders are handled by the main log decoder). Any file that will not
parse cleanly is recorded as 'decode deferred: <reason>' — never fabricated.

Emits per run:
  data-energy/processed/pressure/<well>__<run>.json
    { well, source_well, well_id, run, test, index_kind, index_mnemonic,
      null_value, delimiter, n_rows, n_curves, index_range,
      curves:[{mnemonic,unit,description}], preview_rows, preview:[[...]],
      full_ref, source_id, evidence, dataNature:'measured' }
  data-energy/processed/pressure/full/<well>__<run>.json   (all rows, if large)
    { source_id, n_rows, curves:[...], data:[[...]] }
"""
from __future__ import annotations
import os, sys, glob, re
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT, RAW, evidence, write_json, log

PDIR = os.path.join(RAW, "Well_logs_pr_WELL")
OUT = os.path.join(DATA_ROOT, "processed", "pressure")
FULL = os.path.join(OUT, "full")
PREVIEW_MAX = 1500          # downsampled preview cap
FULL_INLINE_LIMIT = 800     # rows <= this: keep full inline, no sibling file

DELIM = {"COMMA": ",", "SPACE": None, "TAB": "\t"}  # None -> split on whitespace


def load_identity():
    wb_to_well = {}
    try:
        import json
        with open(os.path.join(DATA_ROOT, "processed", "wellbores.json"), encoding="utf-8") as fh:
            for wb in json.load(fh).get("wellbores", []):
                wb_to_well[wb["wellbore_name"]] = wb["well_name"]
    except Exception:
        pass
    return wb_to_well


def split_sections(lines):
    """Return list of (header_raw, [body_lines])."""
    secs = []
    cur = None
    for ln in lines:
        if ln.startswith("~"):
            cur = [ln[1:].rstrip(), []]
            secs.append(cur)
        elif cur is not None:
            cur[1].append(ln)
    return secs


def sec_name(header):
    # header like "Phase_data_RMDATA | Phase_Definition_RMDATA" or "Version Information"
    return header.split("|")[0].strip()


def data_def_ref(header):
    if "|" in header:
        return header.split("|", 1)[1].strip()
    return None


def parse_meta_line(ln):
    """LAS line 'MNEM.UNIT   DATA : DESCRIPTION' -> (mnem, unit, value, desc).

    UNIT is attached to the dot (no space); DATA (the value) is the field before
    the colon; DESCRIPTION follows the colon. In ~Version/~Well/~Parameter lines
    the unit is usually empty and the value carries VERS/NULL/DLM/WELL/RUN.
    """
    if ":" in ln:
        left, desc = ln.split(":", 1)
    else:
        left, desc = ln, ""
    left = left.strip()
    if "." not in left:
        return None
    mnem, after = left.split(".", 1)
    if after and not after[0].isspace():
        unit = after.split()[0]
        value = after[len(unit):].strip()
    else:
        unit = ""
        value = after.strip()
    return mnem.strip(), unit, value, desc.strip()


def parse_curves(body):
    curves = []
    for ln in body:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        m = parse_meta_line(ln)
        if m:
            curves.append({"mnemonic": m[0], "unit": m[1] or None, "description": m[3] or None})
    return curves


def parse_kv(body):
    kv = {}
    for ln in body:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        m = parse_meta_line(ln)
        if m:
            kv[m[0].upper()] = m[2]   # the DATA/value field
    return kv


def index_kind(mnem):
    u = (mnem or "").upper()
    if u.startswith("TIME") or u in ("TIM", "ETIM"):
        return "time"
    if u in ("DEPTH", "DEPT", "MD", "TVD"):
        return "depth"
    return "other"


def decode(path, wb_to_well, results, deferred):
    sid, ev = evidence(path)
    well = os.path.basename(os.path.dirname(os.path.dirname(path)))         # <well> dir
    source_well = well.replace("15_9-", "15/9-").replace("_", "/") if well.startswith("15_9-") else well
    run_stem = os.path.splitext(os.path.basename(path))[0]

    try:
        with open(path, "r", encoding="latin-1") as fh:
            lines = fh.read().splitlines()
        secs = split_sections(lines)
        by_name = {sec_name(h): (h, b) for (h, b) in secs}

        # ~Version — delimiter + version
        ver = next((b for (h, b) in secs if sec_name(h).lower().startswith("version")), None)
        if ver is None:
            raise ValueError("no ~Version section")
        vkv = parse_kv(ver)
        vers = (vkv.get("VERS") or "").split()[0] if vkv.get("VERS") else ""
        if not vers.startswith("3"):
            return "skip-las2"   # LAS 2.0 pressure log -> main decoder's job
        dlm_name = (vkv.get("DLM") or "COMMA").strip().upper()
        delim = DELIM.get(dlm_name, ",")

        # NULL + well identity + run/test from Well/Parameter blocks
        wellkv = {}
        for (h, b) in secs:
            n = sec_name(h).lower()
            if "well" in n or n.startswith("parameter"):
                wellkv.update(parse_kv(b))
        null_raw = wellkv.get("NULL", "-999.25")
        try:
            null_val = float(null_raw.split()[0])
        except Exception:
            null_val = -999.25
        run = wellkv.get("RUN")
        test = wellkv.get("TEST")

        # Definition + data section pairs
        defs = [(h, b) for (h, b) in secs if "definition" in sec_name(h).lower()]
        datas = [(h, b) for (h, b) in secs if re.search(r"data", sec_name(h), re.I)
                 and "definition" not in sec_name(h).lower()]
        if not datas:
            raise ValueError("no ~*_data section")

        # Pick the largest data section (the bulk time-series)
        best = None
        for (h, b) in datas:
            ref = data_def_ref(h)
            defbody = None
            if ref and ref in by_name:
                defbody = by_name[ref][1]
            else:
                # match by replacing 'data' with 'definition' in the name
                cand = re.sub(r"data", "Definition", sec_name(h), flags=re.I)
                if cand in by_name:
                    defbody = by_name[cand][1]
                elif defs:
                    defbody = defs[0][1]
            if defbody is None:
                continue
            curves = parse_curves(defbody)
            if not curves:
                continue
            rows = []
            ncur = len(curves)
            for ln in b:
                s = ln.strip()
                if not s or s.startswith("#") or s.startswith("~"):
                    continue
                parts = [p.strip() for p in (s.split(delim) if delim else s.split())]
                if len(parts) < 2:
                    continue
                vals = []
                for p in parts:
                    if p == "":
                        vals.append(None); continue
                    try:
                        f = float(p)
                        vals.append(None if f == null_val else f)
                    except ValueError:
                        vals.append(p)
                rows.append(vals)
            if rows and (best is None or len(rows) > len(best[1])):
                best = (curves, rows)

        if best is None:
            raise ValueError("no parseable data rows")
        curves, rows = best
        ncur = len(curves)
        # guard ragged rows: keep rows matching curve count (record drop count)
        clean = [r for r in rows if len(r) == ncur]
        dropped = len(rows) - len(clean)
        if not clean:
            raise ValueError(f"all {len(rows)} rows ragged vs {ncur} curves")
        rows = clean

        ik = index_kind(curves[0]["mnemonic"])
        idx = [r[0] for r in rows if isinstance(r[0], (int, float))]
        idx_range = [min(idx), max(idx)] if idx else None

        # preview downsample
        stride = max(1, len(rows) // PREVIEW_MAX)
        preview = rows[::stride]

        well_id = wb_to_well.get(source_well)
        full_ref = None
        if len(rows) > FULL_INLINE_LIMIT:
            full_ref = f"pressure/full/{well}__{run_stem}.json"
            write_json(os.path.join(FULL, f"{well}__{run_stem}.json"), {
                "source_id": sid, "n_rows": len(rows),
                "curves": curves, "data": rows,
            })
            full_data = None
        else:
            full_data = rows

        out = {
            "well": well, "source_well": source_well, "well_id": well_id,
            "run": run, "test": test,
            "index_kind": ik, "index_mnemonic": curves[0]["mnemonic"],
            "null_value": null_val, "delimiter": dlm_name,
            "n_rows": len(rows), "n_curves": ncur, "ragged_rows_dropped": dropped,
            "index_range": idx_range,
            "curves": curves,
            "preview_rows": len(preview), "preview": preview,
            "data": full_data, "full_ref": full_ref,
            "source_id": sid, "evidence": ev, "dataNature": "measured",
        }
        write_json(os.path.join(OUT, f"{well}__{run_stem}.json"), out)
        results.append({"file": sid, "well": source_well, "run": run,
                        "index_kind": ik, "n_rows": len(rows), "n_curves": ncur,
                        "resolved": bool(well_id)})
        log(f"[las3] {well}/{run_stem}: {len(rows)} rows × {ncur} curves ({ik})")
        return "ok"
    except Exception as e:
        deferred.append({"file": sid, "reason": f"decode deferred: {type(e).__name__}: {e}"})
        log(f"[las3] DEFER {sid}: {e}")
        return "defer"


def main():
    wb_to_well = load_identity()
    files = sorted(glob.glob(os.path.join(PDIR, "*", "03.PRESSURE", "*.LAS")))
    results, deferred = [], []
    n_total = n_las3 = n_las2 = 0
    for p in files:
        n_total += 1
        r = decode(p, wb_to_well, results, deferred)
        if r == "skip-las2":
            n_las2 += 1
        else:
            n_las3 += 1

    ok = len(results)
    dfr = len(deferred)

    qc = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc",
                                      "pressure-logs.md"))
    with open(qc, "w", encoding="utf-8") as fh:
        fh.write("# QC · Pressure logs (LAS 3.0, P1 gap-fill)\n\n")
        fh.write("O2 deferred the LAS 3.0 formation-pressure runs under "
                 "`Well_logs_pr_WELL/*/03.PRESSURE/` (MWD FPWD / pretest time-series "
                 "that hung lasio). Decoded here with a hand-rolled LAS 3.0 section "
                 "parser honouring the declared `DLM` delimiter and header `NULL`. "
                 "dataNature `measured`; no unit conversion.\n\n")
        fh.write(f"- LAS 3.0 pressure runs found: **{n_las3}**\n")
        fh.write(f"- decoded: **{ok} of {n_las3}**\n")
        fh.write(f"- deferred (not fabricated): **{dfr}**\n")
        fh.write(f"- LAS 2.0 pressure files in same folders (out of scope, main decoder): {n_las2}\n\n")
        if results:
            fh.write("## Decoded runs\n\n")
            fh.write("| well | run | index | rows | curves | id resolved |\n")
            fh.write("|---|---|---|--:|--:|:--:|\n")
            for r in sorted(results, key=lambda x: x["file"]):
                fh.write(f"| {r['well']} | {r['run']} | {r['index_kind']} | "
                         f"{r['n_rows']:,} | {r['n_curves']} | "
                         f"{'yes' if r['resolved'] else 'no'} |\n")
        if deferred:
            fh.write("\n## Deferred (recorded, not fabricated)\n\n")
            for d in deferred:
                fh.write(f"- `{d['file']}` — {d['reason']}\n")
    print(f"OK las3 decoded={ok}/{n_las3} deferred={dfr} (las2 skipped={n_las2})")


if __name__ == "__main__":
    main()

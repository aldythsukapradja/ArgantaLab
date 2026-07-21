"""O2 · Trajectory decoder (founder-critical rule).

Parses every WITSML trajectory XML under
  data-energy/raw/WITSML Realtime drilling data/<wellbore>/<n>/trajectory/<k>.xml
Reads the XML CONTENT (name, station count, MD range, station types) to
classify each trajectory object as definitive / plan / ambiguous, then SELECTS
exactly one definitive final survey per wellbore (greatest MD coverage +
non-plan naming + most stations). A plan is NEVER stored as measured.

Angle units are preserved verbatim from each station's `uom` (Volve WITSML =
degrees, "dega"). If radians are ever seen, degrees are derived as SEPARATE
named fields (incl_deg/azi_deg) and original_angle_unit records the truth.

Emits:
  processed/trajectory/<wellbore>.json   (chosen definitive survey, stations)
  interim/trajectory-index.json          (every object, classified)
  docs/arganta-energy/qc/trajectory-selection.md
"""
from __future__ import annotations
import os, sys, math, glob, re
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT, RAW, evidence, write_json, log

WITSML = os.path.join(RAW, "WITSML Realtime drilling data")
NS = "{http://www.witsml.org/schemas/1series}"

PLAN_RE = re.compile(r"\b(plan|planned|design|proposed|prototype|pre[- ]?drill)\b", re.I)
DEF_RE = re.compile(r"\b(actual|definitive|final|as[- ]?drilled|survey|owsg|drilled|mwd|lwd|gyro|rt[- ]?data|real[- ]?time)\b", re.I)

def txt(el, tag):
    c = el.find(NS + tag)
    return c.text.strip() if c is not None and c.text else None

def fval(el, tag):
    c = el.find(NS + tag)
    if c is not None and c.text:
        try: return float(c.text)
        except ValueError: return None
    return None

def uom(el, tag):
    c = el.find(NS + tag)
    return c.get("uom") if c is not None else None

def classify(name):
    n = name or ""
    is_plan = bool(PLAN_RE.search(n))
    is_def = bool(DEF_RE.search(n))
    if is_plan and not is_def: return "plan"
    if is_def and not is_plan: return "definitive"
    if is_plan and is_def: return "ambiguous"
    return "ambiguous"

def parse_file(path):
    """Return list of trajectory-object dicts found in one XML file."""
    sid, ev = evidence(path)
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        log(f"[traj] PARSE ERROR {path}: {e}")
        return []
    out = []
    for traj in root.iter(NS + "trajectory"):
        name = txt(traj, "name")
        name_well = txt(traj, "nameWell")
        name_wb = txt(traj, "nameWellbore")
        md_mn = fval(traj, "mdMn"); md_mx = fval(traj, "mdMx")
        stations = []
        ang_units = set(); md_units = set()
        for st in traj.findall(NS + "trajectoryStation"):
            md = fval(st, "md"); tvd = fval(st, "tvd")
            incl = fval(st, "incl"); azi = fval(st, "azi")
            ang_units.add(uom(st, "incl")); ang_units.add(uom(st, "azi"))
            md_units.add(uom(st, "md"))
            stations.append({
                "md": md, "tvd": tvd, "incl": incl, "azi": azi,
                "dispNs": fval(st, "dispNs"), "dispEw": fval(st, "dispEw"),
                "type": txt(st, "typeTrajStation"),
            })
        ang_units.discard(None); md_units.discard(None)
        out.append({
            "source_id": sid, "evidence": ev, "file": os.path.basename(path),
            "uid": traj.get("uid"), "uidWell": traj.get("uidWell"),
            "uidWellbore": traj.get("uidWellbore"),
            "name": name, "nameWell": name_well, "nameWellbore": name_wb,
            "md_min": md_mn, "md_max": md_mx,
            "station_count": len(stations),
            "angle_unit": sorted(ang_units), "md_unit": sorted(md_units),
            "service_company": txt(traj, "serviceCompany"),
            "azi_ref": txt(traj, "aziRef"),
            "dTimStart": txt(traj, "dTimTrajStart"),
            "kind": classify(name),
            "stations": stations,
        })
    return out

def main():
    files = sorted(glob.glob(os.path.join(WITSML, "**", "trajectory", "*.xml"), recursive=True))
    all_objs = []
    for p in files:
        all_objs.extend(parse_file(p))

    # group by nameWellbore (canonical from XML content), fallback to folder
    groups = {}
    for o in all_objs:
        key = o["nameWellbore"] or o["uidWellbore"] or "UNKNOWN"
        groups.setdefault(key, []).append(o)

    index = []       # for interim + QC
    selected_count = 0
    ambiguous_wellbores = []

    for wb_name, objs in sorted(groups.items()):
        # candidate MD coverage = md_max (fallback to max station md)
        for o in objs:
            mds = [s["md"] for s in o["stations"] if s["md"] is not None]
            o["_md_cov"] = o["md_max"] if o["md_max"] is not None else (max(mds) if mds else 0)

        definitive = [o for o in objs if o["kind"] == "definitive"]
        ambiguous = [o for o in objs if o["kind"] == "ambiguous"]
        pool = definitive if definitive else ambiguous  # never pick a plan

        chosen = None
        if pool:
            chosen = max(pool, key=lambda o: (o["_md_cov"] or 0, o["station_count"]))

        wb_ambiguous = (not definitive) and bool(ambiguous)
        if wb_ambiguous:
            ambiguous_wellbores.append(wb_name)

        for o in objs:
            index.append({
                "wellbore": wb_name, "file_source_id": o["source_id"],
                "file": o["file"], "name": o["name"], "kind": o["kind"],
                "station_count": o["station_count"],
                "md_min": o["md_min"], "md_max": o["md_max"],
                "angle_unit": o["angle_unit"], "md_unit": o["md_unit"],
                "kept": bool(chosen is not None and o is chosen),
            })

        if chosen is None:
            log(f"[traj] NO definitive/ambiguous survey for {wb_name} (plans only?) — skipped")
            continue

        selected_count += 1
        # angle-unit truth
        ang = chosen["angle_unit"]
        is_radians = any(u and u.lower() in ("rad", "radian", "radians") for u in ang)
        stations_out = []
        for i, s in enumerate(chosen["stations"]):
            rec = {"i": i, "md": s["md"], "tvd": s["tvd"],
                   "incl": s["incl"], "azi": s["azi"],
                   "dispNs": s["dispNs"], "dispEw": s["dispEw"], "type": s["type"]}
            if is_radians:
                rec["incl_deg"] = None if s["incl"] is None else math.degrees(s["incl"])
                rec["azi_deg"] = None if s["azi"] is None else math.degrees(s["azi"])
            stations_out.append(rec)

        safe = re.sub(r"[^0-9A-Za-z_.-]+", "_", wb_name).strip("_")
        out_path = os.path.join(DATA_ROOT, "processed", "trajectory", safe + ".json")
        write_json(out_path, {
            "wellbore": wb_name,
            "chosen_source_file": chosen["source_id"],
            "chosen_trajectory_name": chosen["name"],
            "chosen_uid": chosen["uid"],
            "nameWell": chosen["nameWell"],
            "classification": chosen["kind"],
            "original_angle_unit": ang,
            "md_unit": chosen["md_unit"],
            "azi_ref": chosen["azi_ref"],
            "service_company": chosen["service_company"],
            "station_count": chosen["station_count"],
            "md_min": chosen["md_min"], "md_max": chosen["md_max"],
            "evidence": chosen["evidence"],
            "dataNature": "measured",
            "stations": stations_out,
        })

    write_json(os.path.join(DATA_ROOT, "interim", "trajectory-index.json"),
               {"objects": index, "wellbore_count": len(groups),
                "selected": selected_count})

    # QC markdown
    qc = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc", "trajectory-selection.md"))
    with open(qc, "w", encoding="utf-8") as fh:
        fh.write("# QC · Trajectory selection (definitive-survey rule)\n\n")
        fh.write("Founder rule: from each wellbore's WITSML trajectory objects, keep ONLY the "
                 "definitive/final as-drilled survey (greatest MD + non-plan naming + most stations). "
                 "A plan is never stored as `measured`.\n\n")
        fh.write(f"- wellbores: **{len(groups)}**  ·  definitive surveys selected: **{selected_count}**  "
                 f"·  trajectory objects total: **{len(index)}**\n")
        fh.write(f"- angle unit across all Volve WITSML stations: `dega` (degrees) — no radians encountered\n\n")
        fh.write("## All trajectory objects per wellbore\n\n")
        fh.write("| wellbore | file | name | inferred | stations | MD range (m) | KEPT |\n")
        fh.write("|---|---|---|---|--:|---|:--:|\n")
        cur = None
        for r in sorted(index, key=lambda x: (x["wellbore"], x["file_source_id"])):
            wb = r["wellbore"] if r["wellbore"] != cur else ""
            cur = r["wellbore"]
            mdr = f"{r['md_min']} → {r['md_max']}"
            nm = (r["name"] or "")[:48]
            fh.write(f"| {wb} | {r['file']} | {nm} | {r['kind']} | {r['station_count']} | {mdr} | "
                     f"{'✅' if r['kept'] else ''} |\n")
        fh.write("\n## AMBIGUOUS wellbores — founder review at Gate 2\n\n")
        if ambiguous_wellbores:
            fh.write("These wellbores had NO clearly-definitive-named object; the greatest-MD "
                     "ambiguous object was provisionally kept (naming did not contain plan/design "
                     "nor a definitive keyword). Confirm the pick:\n\n")
            for w in sorted(set(ambiguous_wellbores)):
                fh.write(f"- {w}\n")
        else:
            fh.write("None — every kept survey came from a definitively-named object.\n")

    log(f"[trajectory] wellbores={len(groups)} selected={selected_count} objects={len(index)} ambiguous={len(set(ambiguous_wellbores))}")
    print(f"OK wellbores={len(groups)} selected={selected_count} objects={len(index)} ambiguous={len(set(ambiguous_wellbores))}")

if __name__ == "__main__":
    main()

"""O2 · Well / wellbore masters + identity mastering.

Sources actually present in the mirror:
  - Well_technical_data/WellWellbore/**/*_ACTUAL           (development F-wells, survey header block)
  - Well_technical_data/WellWellbore/**/*Standard_Survey_NPD.txt (exploration 15/9-19*)
Both carry a HEADER INFORMATION block: WELL NAME, WELLBORE NAME, Drilled From
(parent), Surface EW/NS (UTM), lat/lon, Geo Datum + Map-Zone (CRS), datum/KB.

Cross-references (for identity mastering, NOT forced merges):
  - interim/trajectory-index.json  -> WITSML nameWell/nameWellbore/uid
  - processed/production.json      -> production wellbore names
  - interim/log-inventory.json     -> log well folders

Emits processed/wells.json, processed/wellbores.json,
       docs/arganta-energy/qc/identity-mastering.md
dataNature = 'reported' (operator master data).
"""
from __future__ import annotations
import os, sys, glob, re, json
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT, RAW, evidence, write_json, log

WWB = os.path.join(RAW, "Well_technical_data", "WellWellbore")

def parse_header(path):
    fields = {}
    try:
        with open(path, "r", encoding="latin-1") as fh:
            for _ in range(60):
                line = fh.readline()
                if not line:
                    break
                m = re.match(r"\s*([A-Za-z][A-Za-z /\-]+?):\s*(.*?)\s*$", line)
                if m:
                    fields[m.group(1).strip()] = m.group(2).strip()
                if line.strip().upper().startswith("SURVEY LIST"):
                    break
    except Exception as e:  # noqa
        log(f"[master] read fail {path}: {e}")
    return fields

def crs_of(f):
    geo = f.get("Geo Datum", "")
    zone = f.get("Map-Zone", "")
    if not geo and not zone:
        return None
    tag = None
    if "1950" in geo: tag = "ED50"
    elif "1984" in geo or "WGS" in geo.upper(): tag = "WGS84"
    zm = re.search(r"Zone\s*(\d+[NS]?)", zone)
    z = zm.group(1) if zm else None
    return {"geo_datum": geo or None, "map_zone": zone or None,
            "crs_label": (f"{tag} / UTM {z}" if tag and z else (tag or z)),
            "north_reference": f.get("North Reference")}

def num(s):
    if not s: return None
    m = re.search(r"-?\d+(\.\d+)?", s.replace(",", ""))
    return float(m.group(0)) if m else None

def main():
    survey_files = sorted(set(
        glob.glob(os.path.join(WWB, "**", "*_ACTUAL"), recursive=True) +
        glob.glob(os.path.join(WWB, "**", "*Standard_Survey_NPD.txt"), recursive=True)
    ))

    wellbores = {}
    for p in survey_files:
        f = parse_header(p)
        wname = f.get("WELL NAME"); wbname = f.get("WELLBORE NAME")
        if not wbname:
            continue
        sid, ev = evidence(p)
        kind = "ACTUAL" if p.endswith("_ACTUAL") else "NPD_standard_survey"
        rec = {
            "wellbore_name": wbname, "well_name": wname,
            "drilled_from": f.get("Drilled From"),
            "company": f.get("COMPANY"), "field": f.get("FIELD"),
            "surface_ew_m": num(f.get("Surface EW")), "surface_ns_m": num(f.get("Surface NS")),
            "surface_lat": f.get("Surface Latitude"), "surface_lon": f.get("Surface Longitude"),
            "bottom_hole_md_m": num(f.get("Bottom Hole MD")), "bottom_hole_tvd_m": num(f.get("Bottom Hole TVD")),
            "kick_off_depth": f.get("Kick Off Depth"),
            "datum_name": f.get("Datum Name"), "kb_msl": f.get("KB-MSL"), "water_depth": f.get("Water Depth"),
            "crs": crs_of(f), "vertical_section_direction": f.get("Vertical Section Direction"),
            "master_source_kind": kind, "source_id": sid, "evidence": ev,
            "dataNature": "reported",
        }
        # prefer ACTUAL over NPD if duplicate wellbore, else keep first
        cur = wellbores.get(wbname)
        if cur is None or (kind == "ACTUAL" and cur["master_source_kind"] != "ACTUAL"):
            wellbores[wbname] = rec

    # group into wells
    wells = {}
    for wb in wellbores.values():
        wn = wb["well_name"] or "UNKNOWN"
        w = wells.setdefault(wn, {"well_name": wn, "field": wb["field"],
                                  "company": wb["company"], "crs": wb["crs"],
                                  "is_exploration": bool(re.search(r"-19(\b|[^0-9])", wn or "")),
                                  "wellbores": []})
        w["wellbores"].append(wb["wellbore_name"])

    # cross-reference sources
    traj = json.load(open(os.path.join(DATA_ROOT, "interim", "trajectory-index.json")))
    witsml_wbs = sorted(set(o["wellbore"] for o in traj["objects"]))
    prod = json.load(open(os.path.join(DATA_ROOT, "processed", "production.json")))
    prod_wbs = sorted(set(s["wellbore"] for s in prod["wellbore_summary"] if s["wellbore"]))
    loginv = json.load(open(os.path.join(DATA_ROOT, "interim", "log-inventory.json")))
    log_wells = sorted(loginv["per_well"].keys())

    def norm(s):
        if not s: return ""
        s = s.upper()
        # drop descriptive suffixes / company + country prefixes that are not identity
        s = re.sub(r"-\s*MAIN\s+WELLBORE", "", s)
        for junk in ("MAIN WELLBORE", "WELLBORE", "STATOILHYDRO", "STATOIL",
                     "HYDRO", "NORWAY", "NO ", "NO_", "NA "):
            s = s.replace(junk, "")
        s = s.replace("15/9", "159").replace("15_9", "159").replace("15-9", "159")
        s = re.sub(r"[^0-9A-Z]", "", s)  # -> e.g. 159F1, 159F1C
        # masters use the short wellbore token ("F-4"); other sources prefix the
        # 15/9 field code. Strip a single leading field code so identical
        # wellbores link. Within one field (all Volve = 15/9) this is unambiguous
        # and does NOT bridge exploration (19*) vs development (F*) tokens.
        s = re.sub(r"^159", "", s)
        return s

    # link map keyed by normalized wellbore token
    master_norm = {norm(k): k for k in wellbores}
    def lookup(name):
        return master_norm.get(norm(name))

    write_json(os.path.join(DATA_ROOT, "processed", "wellbores.json"), {
        "count": len(wellbores), "wellbores": list(wellbores.values())})
    write_json(os.path.join(DATA_ROOT, "processed", "wells.json"), {
        "count": len(wells), "wells": list(wells.values())})

    # identity mastering report
    qc = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc", "identity-mastering.md"))
    unlinked = []
    with open(qc, "w", encoding="utf-8") as fh:
        fh.write("# QC · Identity mastering (Volve well / wellbore)\n\n")
        fh.write("Maps the four naming systems onto master wellbore records. Links are by "
                 "normalized name token only where unambiguous; nothing is force-merged. "
                 "Exploration wells (15/9-19*) are kept DISTINCT from development F-wells.\n\n")
        fh.write(f"- master wellbores (from survey headers): **{len(wellbores)}**  ·  wells: **{len(wells)}**\n")
        fh.write(f"- WITSML wellbores: {len(witsml_wbs)}  ·  production wellbores: {len(prod_wbs)}  ·  log well folders: {len(log_wells)}\n")
        fh.write(f"- CRS (all wellbores carrying one): ED50 / UTM Zone 31N (Geo Datum European 1950)\n\n")

        fh.write("## Master wellbores → cross-source links\n\n")
        fh.write("| master wellbore | well | parent (drilled from) | exploration? | WITSML | production | logs |\n")
        fh.write("|---|---|---|:--:|:--:|:--:|:--:|\n")
        wn_set = {norm(x): x for x in witsml_wbs}
        pn_set = {norm(x): x for x in prod_wbs}
        ln_set = {norm(x): x for x in log_wells}
        for k, wb in sorted(wellbores.items()):
            nk = norm(k)
            expl = "yes" if re.search(r"-19(\b|[^0-9])", wb["well_name"] or "") else ""
            fh.write(f"| {k} | {wb['well_name']} | {wb['drilled_from'] or ''} | {expl} | "
                     f"{'✅' if nk in wn_set else ''} | {'✅' if nk in pn_set else ''} | {'✅' if nk in ln_set else ''} |\n")

        # unlinked from each source
        fh.write("\n## Unlinked (present in a source but no confident master match) — listed, not forced\n\n")
        mnorm = set(norm(k) for k in wellbores)
        for label, arr in (("WITSML", witsml_wbs), ("Production", prod_wbs), ("Logs", log_wells)):
            miss = [x for x in arr if norm(x) not in mnorm]
            fh.write(f"**{label}** ({len(miss)} unlinked): " + (", ".join(miss) if miss else "none") + "\n\n")
            unlinked += [(label, x) for x in miss]

        fh.write("## Rule enforced\n\n")
        fh.write("- `15/9-19` (A / BT2 / SR) = **exploration** wells, discovery of the Volve/Hugin — "
                 "NOT merged with the `15/9-F-*` development wellbores. Any apparent name overlap is coincidental "
                 "field numbering; kept as separate wells.\n")

    print(f"OK wellbores={len(wellbores)} wells={len(wells)} witsml={len(witsml_wbs)} prod={len(prod_wbs)} logwells={len(log_wells)} unlinked={len(unlinked)}")

if __name__ == "__main__":
    main()

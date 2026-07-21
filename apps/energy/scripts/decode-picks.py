"""O2/P1 gap-fill · Formation-tops (well picks) decoder.

Parses the interpreted formation-marker file
  data-energy/raw/Geophysical_Interpretations/Wells/Well_picks_Volve_v1.dat

Format (fixed-width, OpenWorks-style export):
  - '#'-commented legend for the Qlf (qualifier) column at the top
  - repeated per-well blocks:
        Well NO <wellbore id>
          <col-header line>
          <dashes separator line  ->  defines exact column spans>
          <data rows>            (start with '  NO ' i.e. the Well-name column)
  - a marker may repeat within a well (Obs#) when the bore re-enters a
    formation (faults / horizontal path) — preserved verbatim, never merged.

Columns (verbatim): Well name, Surface name, Obs#, Qlf, MD, TVD, TVDSS, TWT,
Dip, Azi, Easting, Northing, Intrp.

Emits data-energy/processed/formation-markers.json:
  { source_id, evidence, dataNature:'interpreted', depth_unit:'m',
    count, distinct_surfaces, distinct_source_wells, unresolved_wells,
    markers:[ {well, source_well, surface, obs, qlf, md, tvd, tvdss, twt,
              dip, azi, easting, northing, interpreter, depth_unit,
              well_id, wellbore_id, source_id, dataNature} ] }

Identity rule: source_well is carried VERBATIM. A resolved well_id / wellbore_id
is attached ONLY on an exact string match against the already-decoded
wellbores.json / wells.json — never a fuzzy/forced link. No unit conversion.
"""
from __future__ import annotations
import os, sys, json, re
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT, RAW, evidence, write_json, log

PICKS = os.path.join(RAW, "Geophysical_Interpretations", "Wells", "Well_picks_Volve_v1.dat")
PROCESSED = os.path.join(DATA_ROOT, "processed")

# Field order matching the separator-derived spans.
FIELDS = ["well_name", "surface", "obs", "qlf", "md", "tvd", "tvdss",
          "twt", "dip", "azi", "easting", "northing", "interpreter"]
NUM_FIELDS = {"md", "tvd", "tvdss", "twt", "dip", "azi", "easting", "northing"}


def load_identity():
    """Exact-match lookup tables from the already-decoded masters."""
    wb_to_well = {}   # wellbore_name -> well_name
    well_names = set()
    try:
        with open(os.path.join(PROCESSED, "wellbores.json"), encoding="utf-8") as fh:
            for wb in json.load(fh).get("wellbores", []):
                wb_to_well[wb["wellbore_name"]] = wb["well_name"]
    except FileNotFoundError:
        log("[picks] WARN wellbores.json not found — no wellbore resolution")
    try:
        with open(os.path.join(PROCESSED, "wells.json"), encoding="utf-8") as fh:
            for w in json.load(fh).get("wells", []):
                well_names.add(w["well_name"])
    except FileNotFoundError:
        log("[picks] WARN wells.json not found — no well resolution")
    return wb_to_well, well_names


def spans_from_separator(sep_line):
    """Return list of (start, end) char spans from a run-of-dashes line."""
    spans = []
    for m in re.finditer(r"-+", sep_line):
        spans.append((m.start(), m.end()))
    return spans


def num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return v  # preserve verbatim if non-numeric (never fabricate)


def main():
    sid, ev = evidence(PICKS)
    wb_to_well, well_names = load_identity()

    markers = []
    cur_well = None
    spans = None
    unresolved = set()

    with open(PICKS, "r", encoding="latin-1") as fh:
        lines = fh.read().splitlines()

    for line in lines:
        s = line.strip()
        if s.startswith("Well NO "):
            cur_well = s[len("Well NO "):].strip()
            spans = None  # a fresh separator will follow for this block
            continue
        if s and set(s) <= {"-", " "} and s.count("-") > 10:
            spans = spans_from_separator(line)
            continue
        if not spans or cur_well is None:
            continue
        # A data row: the Well-name column holds "NO <id>"; skip the col-header line.
        if not re.match(r"\s*NO ", line):
            continue
        vals = [line[a:b].strip() for (a, b) in spans]
        if len(vals) < len(FIELDS):
            vals += [""] * (len(FIELDS) - len(vals))
        rec = {FIELDS[i]: vals[i] for i in range(len(FIELDS))}

        surface = rec["surface"]
        if not surface:
            continue  # not a real marker row

        # Identity resolution — exact match ONLY.
        source_well = cur_well
        wellbore_id = source_well if source_well in wb_to_well else None
        if wellbore_id:
            well_id = wb_to_well[wellbore_id]
        elif source_well in well_names:
            well_id = source_well
        else:
            well_id = None
        if well_id is None:
            unresolved.add(source_well)

        markers.append({
            "well": well_id,
            "source_well": source_well,
            "surface": surface,
            "obs": num(rec["obs"]),
            "qlf": rec["qlf"] or None,
            "md": num(rec["md"]),
            "tvd": num(rec["tvd"]),
            "tvdss": num(rec["tvdss"]),
            "twt": num(rec["twt"]),
            "dip": num(rec["dip"]),
            "azi": num(rec["azi"]),
            "easting": num(rec["easting"]),
            "northing": num(rec["northing"]),
            "interpreter": rec["interpreter"] or None,
            "depth_unit": "m",
            "well_id": well_id,
            "wellbore_id": wellbore_id,
            "source_id": sid,
            "dataNature": "interpreted",
        })

    surfaces = sorted({m["surface"] for m in markers})
    src_wells = sorted({m["source_well"] for m in markers})
    mds = [m["md"] for m in markers if isinstance(m["md"], (int, float))]
    tvds = [m["tvd"] for m in markers if isinstance(m["tvd"], (int, float))]

    out = {
        "source_id": sid, "evidence": ev, "dataNature": "interpreted",
        "depth_unit": "m",
        "count": len(markers),
        "distinct_surfaces": len(surfaces),
        "distinct_source_wells": len(src_wells),
        "resolved_source_wells": len([w for w in src_wells if w not in unresolved]),
        "unresolved_wells": sorted(unresolved),
        "md_range": [min(mds), max(mds)] if mds else None,
        "tvd_range": [min(tvds), max(tvds)] if tvds else None,
        "surfaces": surfaces,
        "markers": markers,
    }
    write_json(os.path.join(PROCESSED, "formation-markers.json"), out)
    log(f"[picks] {len(markers)} markers, {len(surfaces)} surfaces, "
        f"{len(src_wells)} source wells, {len(unresolved)} unresolved")

    # ---- QC report ----
    qc = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc",
                                      "formation-markers.md"))
    with open(qc, "w", encoding="utf-8") as fh:
        fh.write("# QC · Formation markers (well picks / tops)\n\n")
        fh.write("Source: `Geophysical_Interpretations/Wells/Well_picks_Volve_v1.dat` "
                 "(P1 gap-fill mirror). dataNature `interpreted`. No unit conversion; "
                 "MD/TVD/TVDSS/TWT/Easting/Northing preserved verbatim (metres / ms TWT / "
                 "ED50 UTM 31N). Markers repeated within a well (Obs#) are the source's "
                 "own fault/horizontal re-entries — preserved, never merged.\n\n")
        fh.write(f"- picks decoded: **{len(markers)}**\n")
        fh.write(f"- distinct surfaces: **{len(surfaces)}**\n")
        fh.write(f"- distinct source wells: **{len(src_wells)}** "
                 f"({out['resolved_source_wells']} resolved to a master wellbore/well, "
                 f"{len(unresolved)} unresolved)\n")
        if mds:
            fh.write(f"- MD range: **{min(mds):.2f} – {max(mds):.2f} m** "
                     f"({len(mds)} picks carry MD)\n")
        if tvds:
            fh.write(f"- TVD range: **{min(tvds):.2f} – {max(tvds):.2f} m** "
                     f"({len(tvds)} picks carry TVD)\n")
        fh.write(f"- picks with no TVD (MD only): **{len(markers) - len(tvds)}**\n\n")

        fh.write("## Unresolved well names (carried verbatim, no forced link)\n\n")
        if unresolved:
            fh.write("These source-well identifiers have no exact match in "
                     "`wellbores.json` / `wells.json`, so `well_id` stays null "
                     "(exploration/appraisal bores outside the mirrored master set, "
                     "or a different naming form). Picks are retained with "
                     "`source_well` verbatim.\n\n")
            for w in sorted(unresolved):
                fh.write(f"- `{w}`\n")
        else:
            fh.write("_None — every source well resolved to a master entry._\n")
        fh.write("\n## Surfaces\n\n")
        for srf in surfaces:
            n = sum(1 for m in markers if m["surface"] == srf)
            fh.write(f"- {srf}  ·  {n} pick(s)\n")
    print(f"OK picks={len(markers)} surfaces={len(surfaces)} "
          f"wells={len(src_wells)} unresolved={len(unresolved)}")


if __name__ == "__main__":
    main()

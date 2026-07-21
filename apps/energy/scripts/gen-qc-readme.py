"""O2 · QC summary README generator. Reads all processed/interim outputs and
emits docs/arganta-energy/qc/README.md — one per-domain table + row-counts vs
source. Pure aggregation, no decoding."""
from __future__ import annotations
import os, sys, json, glob
sys.path.insert(0, os.path.dirname(__file__))
from _evidence import DATA_ROOT

def load(p, d=None):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d

def main():
    prod = load(os.path.join(DATA_ROOT, "processed", "production.json"), {})
    traj = load(os.path.join(DATA_ROOT, "interim", "trajectory-index.json"), {})
    loginv = load(os.path.join(DATA_ROOT, "interim", "log-inventory.json"), {})
    wells = load(os.path.join(DATA_ROOT, "processed", "wells.json"), {})
    wbs = load(os.path.join(DATA_ROOT, "processed", "wellbores.json"), {})
    horizons = glob.glob(os.path.join(DATA_ROOT, "processed", "horizons", "*.json"))
    hpts = 0
    for h in horizons:
        hpts += (load(h, {}) or {}).get("points_count", 0)

    out = os.path.abspath(os.path.join(DATA_ROOT, "..", "docs", "arganta-energy", "qc", "README.md"))
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("# ArgantaEnergy — O2 QC Summary\n\n")
        fh.write("Refinery product: decoded raw Volve bytes → canonical OSDU-aligned tables + per-file QC. "
                 "Every processed row carries a `source_id` resolving to `mirror-manifest.json` "
                 "(path + sha256). No unit conversion, no silent renames. Licence: Volve field dataset, "
                 "© Equinor (and Volve licence partners), Equinor Open Data Licence.\n\n")
        fh.write("## Per-domain decode results\n\n")
        fh.write("| Domain | Files decoded | Rows / values | dataNature | Units (source) | Deferred / anomalies |\n")
        fh.write("|---|---|---|---|---|---|\n")
        # production
        pd = len(prod.get("daily_rows", []))
        pm = len(prod.get("monthly_rows", []))
        fh.write(f"| Production | 1 xlsx (2 sheets) | {pd} daily + {pm} monthly rows | reported | "
                 f"Sm3, bar, hrs (verbatim) | multiple flow_kinds/day = expected dup keys |\n")
        # logs
        las_d = loginv.get("las_decoded", 0); las_f = loginv.get("las_files", 0)
        dl_d = loginv.get("dlis_decoded", 0); dl_f = loginv.get("dlis_files", 0)
        lv = loginv.get("las_values", 0); dv = loginv.get("dlis_values", 0)
        deferred = [d for w in loginv.get("per_well", {}).values() for d in w.get("deferred", [])]
        fh.write(f"| Well logs | LAS {las_d}/{las_f}, DLIS {dl_d}/{dl_f} | {lv+dv:,} values "
                 f"(LAS {lv:,} + DLIS {dv:,}) | measured | GAPI, V/V, OHMM, M, G/CM3, US/F… | "
                 f"{len(deferred)} run(s) deferred |\n")
        # trajectory
        fh.write(f"| Trajectory | {traj.get('selected',0)} definitive of {traj.get('wellbore_count',0)} wellbores "
                 f"({len(traj.get('objects',[]))} objects) | 1 survey/wellbore | measured | m, dega (degrees) | "
                 f"1 plan traj excluded; F-1 tie-in TVD>MD 3mm (source rounding) |\n")
        # horizons
        fh.write(f"| Depth horizons | {len(horizons)} .dat surfaces | {hpts:,} grid points | interpreted | "
                 f"m (ED50 UTM 31N, Z +down) | full grid stays in raw; decimated preview stored |\n")
        # masters
        fh.write(f"| Well masters | {wbs.get('count',0)} wellbores / {wells.get('count',0)} wells | survey headers | "
                 f"reported | m, ED50/UTM31N | exploration 15/9-19* kept distinct |\n")
        # formation markers
        fh.write(f"| Formation markers | 0 | — | interpreted | — | **deferred: no pick/tops .dat in selection "
                 f"(Geophysical/Wells not mirrored)** |\n\n")

        fh.write("## Row counts vs source\n\n")
        fh.write("| Item | Decoded | Source expectation | Match |\n|---|--:|---|:--:|\n")
        fh.write(f"| Daily production rows | {pd} | ~15,634 (xlsx Daily sheet, 15,635 incl header) | "
                 f"{'✅' if pd==15634 else '⚠'} |\n")
        fh.write(f"| Monthly production rows | {pm} | 526 (xlsx Monthly, minus header+units rows) | "
                 f"{'✅' if pm==526 else '⚠'} |\n")
        fh.write(f"| Trajectory objects | {len(traj.get('objects',[]))} | 63 WITSML trajectory XMLs | "
                 f"{'✅' if len(traj.get('objects',[]))==63 else '⚠'} |\n")
        fh.write(f"| LAS files | {las_f} | 164 in Well_logs_pr_WELL | {'✅' if las_f==164 else '⚠'} |\n")
        fh.write(f"| DLIS files | {dl_f} | 81 in Well_logs_pr_WELL | {'✅' if dl_f==81 else '⚠'} |\n")
        fh.write(f"| Depth horizons | {len(horizons)} | 6 .dat in Horizons_DEPTH | {'✅' if len(horizons)==6 else '⚠'} |\n\n")

        if deferred:
            fh.write("## Deferred decoders / runs\n\n")
            for d in deferred:
                fh.write(f"- `{d.get('source_id','')}` — {d.get('reason','')}\n")
            fh.write("\n")
        fh.write("## Detailed per-domain QC\n\n")
        fh.write("- [production.md](production.md) · [well-logs.md](well-logs.md) · "
                 "[trajectory-selection.md](trajectory-selection.md) · [horizons.md](horizons.md) · "
                 "[identity-mastering.md](identity-mastering.md)\n")

    print(f"OK qc readme: prod={pd}/{pm} logs LAS {las_d}/{las_f} DLIS {dl_d}/{dl_f} traj {traj.get('selected',0)} horizons {len(horizons)} deferred {len(deferred)}")

if __name__ == "__main__":
    main()

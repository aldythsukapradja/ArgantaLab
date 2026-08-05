# harvest_monograph_figures.py — extract figures from the USGS province GEOLOGY
# monographs (Bulletin 2201–2207, Professional Paper 1824, DDS-69 chapters).
#
# These are a different source class from the Fact Sheets harvested earlier. A Fact
# Sheet is 2–4 pages: a location map and a results table. A monograph is a full province
# geology report carrying the stratigraphic charts, cross-sections, burial histories and
# events charts a geologist reasons from. Bulletin 2204-C alone produced a stratigraphic
# summary and a set of burial curves for the North Sea.
#
# THE MEASURED CAVEAT (Phase 3 slice, B2204-C): 5 of its 10 figures were reproduced from
# third parties, and they were exactly the geology ones — the maps were USGS-original,
# the strat chart and burial curves were not. Expect the same split here. That is not a
# reason to skip these; it is the reason the rights classifier exists.
#
# Run: python docs/arganta-energy/knowledge-base/harvest_monograph_figures.py
import json
import os
import re
import sys
from collections import Counter, defaultdict

import fitz

ROOT = r"C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab"
sys.path.insert(0, os.path.join(ROOT, "docs", "arganta-energy", "knowledge-base"))
from harvest_basin_figures import (caption_figures, classify_type, classify_rights,  # noqa: E402
                                   render, TARGET_W)

MONO = os.path.join(ROOT, ".codex", "tmp-petsys", "monographs")
INDEX = os.path.join(ROOT, ".codex", "tmp-petsys", "monograph-index.json")
SPINE = os.path.join(ROOT, "apps", "energy", "public", "kb", "master-kb-spine.json")
OUT_OPEN = os.path.join(ROOT, "apps", "energy", "public", "basin-figures")
OUT_REST = os.path.join(ROOT, "apps", "energy", "public", "basin-figures-restricted")
OUT_JSON = os.path.join(ROOT, ".codex", "tmp-petsys", "monograph-figures.json")

# Only these types justify carrying an image. A monograph also contains résumé tables,
# graphs of assessment results and locator insets; those add weight without adding
# geological evidence.
KEEP = {"cross-section", "strat-chart", "depositional", "burial", "events-chart",
        "map", "creaming"}

STOP = {"basin", "province", "the", "of", "and", "area", "region", "shelf", "platform",
        "uplift", "high", "graben", "trough", "field", "sea", "north", "south", "east",
        "west", "central", "greater", "lower", "upper", "middle"}


def name_tokens(name):
    """Distinctive tokens of a province name — the generic words are useless for
    matching because half the catalogue is called '... Basin Province'."""
    return {w for w in re.findall(r"[a-z']{4,}", (name or "").lower()) if w not in STOP}


def main():
    kb = json.load(open(SPINE, encoding="utf-8"))
    provinces = [p for p in kb["province"] if p.get("name")]
    basin_by_prov = {b["province_id"]: b for b in kb["basin"] if b.get("province_id")}
    prov_tokens = [(p, name_tokens(p["name"])) for p in provinces]

    idx = {}
    if os.path.exists(INDEX):
        for p in json.load(open(INDEX, encoding="utf-8"))["publications"]:
            for f in (p.get("localFiles") or []):
                idx[f] = p

    files = sorted(f for f in os.listdir(MONO) if f.lower().endswith(".pdf")) if os.path.isdir(MONO) else []
    print(f"monograph PDFs on disk: {len(files)}")

    out, stats = [], Counter()
    matched_provinces = set()

    for fname in files:
        meta = idx.get(fname, {})
        title = meta.get("title") or fname
        # Match the publication to a province by distinctive title tokens. A monograph
        # names its province in the title — that is far more reliable than trying to
        # infer it from body text.
        ttok = name_tokens(title)
        best, best_score = None, 0
        for p, ptok in prov_tokens:
            if not ptok:
                continue
            overlap = len(ttok & ptok) / len(ptok)
            if overlap > best_score:
                best, best_score = p, overlap
        if not best or best_score < 0.5:
            stats["province-unmatched"] += 1
            continue
        basin = basin_by_prov.get(best["province_id"])
        if not basin:
            stats["no-basin-for-province"] += 1
            continue
        matched_provinces.add(best["code"])

        try:
            doc = fitz.open(os.path.join(MONO, fname))
        except Exception:
            stats["open-failed"] += 1
            continue
        if doc.page_count > 400:
            stats["skipped-oversize"] += 1
            doc.close()
            continue

        got = 0
        for n, cap, pno, clip in caption_figures(doc, fname):
            ftype = classify_type(cap)
            if ftype not in KEEP:
                stats["skipped-type"] += 1
                continue
            rights, credit = classify_rights(cap, source_authority="usgs")
            if rights == "rights-unknown":
                stats["quarantined"] += 1
                continue
            pix = render(doc[pno], clip)
            if pix is None:
                stats["render-failed"] += 1
                continue
            restricted = rights == "restricted"
            stem = re.sub(r"\.pdf$", "", fname, flags=re.I).lower()
            outname = f"{stem}-fig{n:02d}.png"
            outdir = OUT_REST if restricted else OUT_OPEN
            os.makedirs(outdir, exist_ok=True)
            try:
                pix.save(os.path.join(outdir, outname))
            except Exception:
                stats["save-failed"] += 1
                continue
            out.append({
                "figure_id": f"atlas:figure:{stem}-fig{n:02d}",
                "figure_type": ftype,
                "caption": cap,
                "basin_id": basin["basin_id"],
                "province_code": best["code"],
                "province_name": best["name"],
                "page": pno + 1,
                "figure_number": n,
                "restricted": restricted,
                "credit": credit,
                "file": outname,
                "w": pix.width, "h": pix.height,
                "publication": f"{meta.get('series','USGS')} {meta.get('number','')} — {title}".strip(),
                "publication_year": meta.get("year"),
                "source_url": meta.get("indexPage"),
                "match_confidence": round(best_score, 2),
            })
            stats[f"{'RESTRICTED' if restricted else 'open'}:{ftype}"] += 1
            got += 1
        doc.close()
        if got:
            stats["publications-yielding"] += 1

    json.dump(out, open(OUT_JSON, "w", encoding="utf-8"), indent=1)
    print(f"\nfigures extracted: {len(out)}")
    print(f"provinces matched : {len(matched_provinces)}")
    rest = sum(1 for f in out if f["restricted"])
    print(f"restricted        : {rest} / {len(out)}"
          + (f"  ({rest / len(out):.0%})" if out else ""))
    print()
    for k, v in sorted(stats.items()):
        print(f"  {k:34s} {v}")


if __name__ == "__main__":
    main()

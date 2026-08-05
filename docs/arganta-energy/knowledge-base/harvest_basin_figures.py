# harvest_basin_figures.py — pull PUBLISHED figures for every basin out of the USGS
# material already on disk, and classify each one by TYPE and by RIGHTS.
#
# WHY THIS EXISTS
#   The Basin Dossier's picture card must show the published cross-section,
#   stratigraphic chart or depositional map that a geologist expects — not a chart
#   drawn from our own tables. Those figures live in USGS publications.
#
# RIGHTS POSTURE (read before shipping anything this produces)
#   USGS publications are US Government works and therefore public domain
#   (17 U.S.C. § 105) — those figures MAY be committed and deployed.
#   BUT a figure reproduced INSIDE a USGS report from a copyrighted source is NOT
#   public domain; USGS credits it ("modified from Beydoun, 1991"). Those are
#   RESTRICTED: internal use only, gitignored, attribution mandatory — exactly the
#   posture already used for the Doust set.
#   This script decides which is which from the caption and writes them to separate
#   directories so the distinction is enforced by the filesystem, not by memory.
#
# Run:  python docs/arganta-energy/knowledge-base/harvest_basin_figures.py [--limit N]
import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

import fitz  # PyMuPDF

ROOT = r"C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab"
DDS60 = os.path.join(ROOT, ".codex", "tmp-petsys", "sources", "extracted")
PUBS = os.path.join(ROOT, ".codex", "tmp-petsys", "current-pubs")
REGISTRY = os.path.join(ROOT, ".codex", "tmp-petsys", "usgs-publication-registry.json")
SPINE = os.path.join(ROOT, "apps", "energy", "public", "kb", "master-kb-spine.json")

OUT_OPEN = os.path.join(ROOT, "apps", "energy", "public", "basin-figures")
OUT_RESTRICTED = os.path.join(ROOT, "apps", "energy", "public", "basin-figures-restricted")
MANIFEST = os.path.join(ROOT, "apps", "energy", "public", "basin-figures", "manifest.json")

TARGET_W = 1000          # enough for the enlarge view; the card renders at 104px
MAP_W = 700              # DDS-60 map sheets are the fallback plate — cheaper is fine
MIN_DRAWS = 120          # a page with fewer vector ops than this is a text/table page

# ── figure types, in the order the dossier card shows them ───────────────────
TYPE_ORDER = ["cross-section", "strat-chart", "depositional", "map",
              "events-chart", "burial", "creaming", "other"]

TYPE_RULES = [
    ("cross-section", (r"cross[\s-]?section", r"\bsection\s+(?:through|across)", r"structural\s+section",
                       r"seismic\s+(?:line|section)", r"schematic\s+section")),
    ("strat-chart",   (r"stratigraphic\s+(?:column|chart|section|correlation|framework|nomenclature)",
                       r"correlation\s+chart", r"generalized\s+strat", r"lithostratigraph", r"chronostratigraph",
                       # "Stratigraphic summary" is how USGS bulletins label the strat
                       # chart; without it the basin's actual chart is typed 'other'.
                       r"stratigraphic\s+summary", r"stratigraphic\s+nomenclature",
                       r"type\s+log", r"stratigraphy\s+of")),
    ("depositional",  (r"depositional\s+(?:environment|setting|model|system)", r"paleogeograph", r"palaeogeograph",
                       r"facies\s+(?:map|distribution|model)", r"lithofacies", r"paleoenvironment",
                       r"distribution\s+of\s+(?:postulated\s+)?\w+\s+(?:source|reservoir|seal)",
                       r"reconstruction\s+of", r"breakup\s+of\s+gondwana", r"plate\s+reconstruction")),
    ("events-chart",  (r"events?\s+chart", r"petroleum\s+system\s+events", r"burial\s+and\s+petroleum")),
    ("burial",        (r"burial\s+(?:history|curve|plot|diagram)", r"thermal\s+maturit",
                       r"1[\s-]?D\s+model", r"vitrinite", r"depth\s+to\s+base\s+of")),
    ("creaming",      (r"creaming", r"cumulative\s+(?:new[\s-]field|discover)", r"discovery\s+history",
                       r"field\s+size\s+distribution")),
    # Note the plural: USGS captions overwhelmingly read "Locations of N provinces
    # assessed in this study", which a `location of` pattern silently misses and
    # dumps into 'other' — where it sorts last instead of as the basin map it is.
    ("map",           (r"\bmap\b", r"locations?\s+of", r"index\s+map", r"province\s+(?:outline|boundary)",
                       r"assessment\s+unit", r"total\s+petroleum\s+system", r"extent\s+of",
                       r"assessed\s+area", r"assessed\s+provinces?", r"\bprovinces?\b.*\bassessed\b")),
]

# A caption crediting an outside author means the figure is NOT public domain even
# though the report around it is. This is the single most important rule here.
CREDIT_RE = re.compile(
    r"\b(?:modified\s+from|adapted\s+from|after|from|reprinted\s+from|courtesy\s+of|source:)\s+"
    r"([A-Z][A-Za-z'\-]+(?:\s+(?:and|&|et\s+al\.?,?)\s*[A-Za-z'\-]*)*[^;.)]{0,60}?\b(?:19|20)\d{2}[a-z]?)",
    re.I)
# USGS crediting itself is still public domain
SELF_RE = re.compile(r"\b(?:U\.?S\.?\s*Geological\s+Survey|USGS)\b", re.I)


def classify_type(text):
    low = (text or "").lower()
    for name, pats in TYPE_RULES:
        for p in pats:
            if re.search(p, low):
                return name
    return "other"


def classify_rights(caption, source_authority="unknown"):
    """Return (rights, credit_or_None).

    FAILS CLOSED. The previous version defaulted to 'usgs-public-domain' whenever no
    credit line was found, which meant anything unrecognised was assumed safe — fine
    while every input was a USGS report, wrong the instant anything else is ingested.

    The default now keys off the SOURCE rather than the caption, because that is what
    actually determines the licence: a USGS publication is a US Government work and IS
    public domain by default (17 U.S.C. § 105), whereas an unidentified source grants
    us nothing. A credit line naming an outside author overrides either way — citation
    is not a licence.
    """
    credit = None
    if caption:
        m = CREDIT_RE.search(caption)
        if m and not SELF_RE.search(m.group(1)):
            credit = m.group(1).strip()
    if credit:
        return "restricted", credit
    if source_authority == "usgs":
        return "usgs-public-domain", None
    if source_authority == "cc":
        return "cc-attribution", None
    return "rights-unknown", None    # quarantined: never ingested, never shown


def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-")


def render(page, clip=None, target_w=TARGET_W):
    rect = clip or page.rect
    if rect.width <= 1 or rect.height <= 1:
        return None
    # Clamp on BOTH sides: an oversize landscape plate (a foldout seismic section can
    # be several thousand points wide) must scale DOWN to the target, not sit at a
    # 0.8 floor and emit a 5000px file.
    zoom = max(0.18, min(3.0, target_w / max(rect.width, 1)))
    try:
        return page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
    except Exception:
        return None


def page_is_graphic(page):
    """A DDS-60 map sheet is a full-page vector drawing; a results page is a table."""
    try:
        return len(page.get_drawings()) >= MIN_DRAWS
    except Exception:
        return False


def graphic_bounds_above(page, caption_y, min_area=4000, pad=12):
    """Union of the real graphic content lying above `caption_y`.

    A figure page usually carries body text or a reference list as well as the
    figure. Vector drawings and raster images are the figure; text is not. Union
    only the graphic rects, drop hairlines and decorative marks, and require the
    result to be plausibly figure-shaped before accepting it.
    """
    rects = []
    try:
        for d in page.get_drawings():
            r = d.get("rect")
            if r and r.y1 <= caption_y - 2 and r.width > 8 and r.height > 8:
                rects.append(r)
    except Exception:
        pass
    try:
        for info in page.get_images(full=True):
            for r in page.get_image_rects(info[0]):
                if r.y1 <= caption_y - 2 and r.width > 20 and r.height > 20:
                    rects.append(r)
    except Exception:
        pass
    if not rects:
        return None
    u = rects[0]
    for r in rects[1:]:
        u = u | r

    # A figure's axis labels, scale bar and annotations are TEXT sitting just outside
    # the drawn artwork — losing them makes the plate unreadable ("Depth (kilometres)",
    # SW/NE, A-A'). Grow the box to swallow text blocks that hug it, while leaving
    # distant blocks (body prose, reference lists) outside.
    NEAR = 26
    try:
        halo = fitz.Rect(u.x0 - NEAR, u.y0 - NEAR, u.x1 + NEAR, u.y1 + NEAR)
        for blk in page.get_text("blocks"):
            br = fitz.Rect(blk[:4])
            if br.y1 > caption_y - 2:
                continue
            if br.height > 90:          # a tall block is prose, not a label
                continue
            if br.intersects(halo):
                u = u | br
    except Exception:
        pass

    u = fitz.Rect(max(page.rect.x0, u.x0 - pad), max(page.rect.y0, u.y0 - pad),
                  min(page.rect.x1, u.x1 + pad), min(page.rect.y1, u.y1 + pad))
    if u.width * u.height < min_area or u.height < 60 or u.width < 80:
        return None
    return u


def caption_figures(doc, src_label):
    """Caption-anchored extraction for reports that have real numbered figures.
    Yields (fig_no, caption, page_index, clip_rect)."""
    out = []
    for pno in range(doc.page_count):
        page = doc[pno]
        text = page.get_text()
        for m in re.finditer(r"Figure\s+(\d{1,2})\s*[\.—-]?\s*([^\n]{15,240})", text):
            n, cap = int(m.group(1)), m.group(2).strip()
            if not (1 <= n <= 40):
                continue
            rects = page.search_for(f"Figure {n}")
            if not rects:
                continue
            r = sorted(rects, key=lambda rr: rr.y0)[0]
            # The figure sits ABOVE its caption — but so does any body text or
            # reference list on the page. Clipping "everything above the caption"
            # drags that in, so instead union the actual GRAPHIC bounds (vector
            # drawings + raster images) lying above the caption and use those.
            clip = graphic_bounds_above(page, r.y0)
            if clip is None:
                continue
            out.append((n, cap, pno, clip))
    # keep the LAST caption per number (prose may reference it earlier)
    best = {}
    for n, cap, pno, clip in out:
        best[n] = (n, cap, pno, clip)
    return list(best.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    os.makedirs(OUT_OPEN, exist_ok=True)
    os.makedirs(OUT_RESTRICTED, exist_ok=True)

    kb = json.load(open(SPINE, encoding="utf-8"))
    prov_by_code = {}
    for p in kb["province"]:
        if p.get("code"):
            prov_by_code[str(p["code"])] = p
    basin_by_prov = {b["province_id"]: b for b in kb["basin"] if b.get("province_id")}
    tps_by_code = {str(t["code"]): t for t in kb["petroleumSystem"] if t.get("code")}

    figures = []
    stats = Counter()

    written = {}  # pixmap identity -> filename already on disk

    def emit(basin, prov, kind, ftype, caption, rights, credit, pub, page_no, pix, fid,
             share_key=None):
        if pix is None:
            stats["render-failed"] += 1
            return
        if rights == "rights-unknown":
            # Quarantine: no local copy, no manifest entry. Metadata-only handling for
            # these belongs in the Figure Registry, not in a directory we might ship.
            stats["quarantined-rights-unknown"] += 1
            return
        outdir = OUT_OPEN if rights != "restricted" else OUT_RESTRICTED
        # One figure in a multi-province assessment produces one manifest entry per
        # basin, but it is the SAME image. Writing it once and pointing every entry at
        # that file is the difference between ~380 MB and something a repo can carry.
        key = share_key or fid
        if key in written:
            rel = written[key]
            stats["image-deduped"] += 1
        else:
            rel = f"{fid}.png"
            try:
                pix.save(os.path.join(outdir, rel))
            except Exception:
                stats["save-failed"] += 1
                return
            written[key] = rel
        figures.append({
            "id": fid,
            "basin_id": basin["basin_id"] if basin else None,
            "basin_name": (basin or {}).get("name"),
            "province_code": prov.get("code") if prov else None,
            "type": ftype,
            "caption": caption,
            "rights": rights,
            "credit": credit,
            "source_publication": pub,
            "source_page": page_no + 1,
            "file": rel,
            "restricted": rights == "restricted",
            "w": pix.width, "h": pix.height,
        })
        stats[f"type:{ftype}"] += 1
        stats[f"rights:{rights}"] += 1

    # ── A · DDS-60 province map sheets (P####.pdf) ───────────────────────────
    import glob
    prov_pdfs = sorted(glob.glob(os.path.join(DDS60, "reg*", "*", "P*.pdf")))
    if args.limit:
        prov_pdfs = prov_pdfs[: args.limit]
    for path in prov_pdfs:
        code = os.path.basename(path)[1:-4]
        prov = prov_by_code.get(code)
        if not prov:
            stats["province-unmatched"] += 1
            continue
        basin = basin_by_prov.get(prov["province_id"])
        try:
            doc = fitz.open(path)
        except Exception:
            stats["open-failed"] += 1
            continue
        for pno in range(min(2, doc.page_count)):
            page = doc[pno]
            if not page_is_graphic(page):
                continue
            cap = (f"{prov.get('name')} — USGS geologic province and total petroleum "
                   f"system boundaries, with oil and gas field centrepoints")
            emit(basin, prov, "dds60-province", "map", cap, "usgs-public-domain", None,
                 "USGS DDS-60, World Petroleum Assessment 2000", pno, render(page, target_w=MAP_W),
                 f"p{code}-map-{pno + 1}")
            break  # page 1 and 2 are the same sheet at different scales
        doc.close()

    # ── B · DDS-60 TPS map sheets (t######.pdf) ─────────────────────────────
    tps_pdfs = sorted(glob.glob(os.path.join(DDS60, "reg*", "*", "tps", "t*.pdf")))
    if args.limit:
        tps_pdfs = tps_pdfs[: args.limit]
    for path in tps_pdfs:
        code = re.sub(r"\D", "", os.path.basename(path))
        tps = tps_by_code.get(code)
        prov = None
        tps_name = None
        if tps:
            for p in kb["province"]:
                if p["province_id"] == tps.get("province_id"):
                    prov = p
                    break
            tps_name = tps.get("name")
        else:
            # DDS-60 and DDS-69 subdivide petroleum systems differently, so a DDS-60
            # TPS code often has no DDS-69 twin. A TPS code is province + 2 digits,
            # though, so the map still belongs to a province we DO know — attach it
            # there rather than discarding a perfectly good published sheet.
            prov = prov_by_code.get(code[:4])
            if not prov:
                stats["tps-unmatched"] += 1
                continue
            stats["tps-recovered-by-province"] += 1
        basin = basin_by_prov.get((tps or {}).get("province_id") or prov["province_id"])
        try:
            doc = fitz.open(path)
        except Exception:
            stats["open-failed"] += 1
            continue
        for pno in range(min(2, doc.page_count)):
            page = doc[pno]
            if not page_is_graphic(page):
                continue
            cap = (f"{tps_name} Total Petroleum System {code} — extent and assessment units"
                   if tps_name else
                   f"Total Petroleum System {code} ({prov.get('name')}) — extent and assessment units, DDS-60 vintage")
            emit(basin, prov or {}, "dds60-tps", "map", cap, "usgs-public-domain", None,
                 "USGS DDS-60, World Petroleum Assessment 2000", pno, render(page, target_w=MAP_W),
                 f"t{code}-map-{pno + 1}")
            break
        doc.close()

    # ── C · Fact Sheets / OFRs — real captioned figures ──────────────────────
    reg = json.load(open(REGISTRY, encoding="utf-8"))["rows"]
    # The registry is publication x province: 454 rows over only 52 publications,
    # because one assessment commonly covers several provinces ("Bonaparte Basin,
    # Browse Basin, Northwest Shelf, and Gippsland Basin Provinces"). Keeping one row
    # per publication_id silently threw away every province but one, which is why
    # basins with a perfectly good published cross-section still showed nothing.
    by_pubid = {}
    provinces_of_pub = defaultdict(list)
    for r in reg:
        pid = str(r.get("publication_id") or "")
        if not pid:
            continue
        by_pubid.setdefault(pid, r)
        code = str(r.get("province_code") or "")
        if code and code not in provinces_of_pub[pid]:
            provinces_of_pub[pid].append(code)
    fs = sorted(glob.glob(os.path.join(PUBS, "*.pdf")))
    if args.limit:
        fs = fs[: args.limit]
    for path in fs:
        base = os.path.basename(path)
        pubid = base.split("-")[0]
        meta = by_pubid.get(pubid, {})
        codes = provinces_of_pub.get(pubid) or [str(meta.get("province_code") or "")]
        try:
            doc = fitz.open(path)
        except Exception:
            stats["open-failed"] += 1
            continue
        title = meta.get("title") or base
        series = meta.get("series") or "USGS publication"
        for n, cap, pno, clip in caption_figures(doc, base):
            ftype = classify_type(cap)
            rights, credit = classify_rights(cap, source_authority="usgs")
            pix = render(doc[pno], clip)
            # A figure in a multi-province assessment belongs to whichever province it
            # actually depicts. Where the caption names one, attach it there only;
            # otherwise attach to every province the publication covers rather than
            # arbitrarily picking one and losing the rest.
            named = [c for c in codes
                     if prov_by_code.get(c) and
                     (prov_by_code[c].get("name") or "").split(" Province")[0].lower() in cap.lower()]
            targets = named or codes
            for ci, code in enumerate(targets):
                prov = prov_by_code.get(code)
                if not prov:
                    continue
                basin = basin_by_prov.get(prov["province_id"])
                if not basin:
                    continue
                suffix = "" if len(targets) == 1 else f"-p{code}"
                emit(basin, prov, "usgs-report", ftype, cap, rights, credit,
                     f"{series} — {title}", pno, pix,
                     f"pub{pubid}-fig{n:02d}{suffix}",
                     share_key=f"pub{pubid}-fig{n:02d}")
                if len(targets) > 1:
                    stats["figure-shared-across-provinces"] += 1
        doc.close()

    # ── manifest ────────────────────────────────────────────────────────────
    by_basin = defaultdict(list)
    for f in figures:
        if f["basin_id"]:
            by_basin[f["basin_id"]].append(f)
    order = {t: i for i, t in enumerate(TYPE_ORDER)}
    for bid, lst in by_basin.items():
        lst.sort(key=lambda f: (order.get(f["type"], 99), f["id"]))

    out = {
        "generatedAt": None,
        "note": ("USGS publications are US Government works (public domain). Figures "
                 "REPRODUCED inside them from copyrighted sources are not — those are "
                 "marked restricted, written to basin-figures-restricted/ and gitignored."),
        "typeOrder": TYPE_ORDER,
        "counts": {
            "figures": len(figures),
            "basins": len(by_basin),
            "restricted": sum(1 for f in figures if f["restricted"]),
        },
        "figures": figures,
    }
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    json.dump(out, open(MANIFEST, "w", encoding="utf-8"), indent=1)

    print(f"figures extracted : {len(figures)}")
    print(f"basins covered    : {len(by_basin)} / {len(kb['basin'])}")
    print(f"restricted        : {out['counts']['restricted']}")
    print()
    for k, v in sorted(stats.items()):
        print(f"  {k:28s} {v}")


if __name__ == "__main__":
    main()

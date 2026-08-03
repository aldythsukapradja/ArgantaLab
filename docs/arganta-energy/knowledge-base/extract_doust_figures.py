# extract_doust_figures.py — extracts the 49 figure images from the Doust booklet
# into apps/energy/public/doust-figures/ so the Knowledge Bank tab can render them.
#
# COPYRIGHT POSTURE (read before running or shipping):
#   The source PDF is third-party copyrighted material. Of the 49 figures, 17 are
#   Doust's own uncited drawings and 31 name a specific external author/publisher
#   who holds the rights (citation is not a licence). NONE are cleared for
#   redistribution yet.
#   Therefore BOTH the source PDF and the extracted images are gitignored — they
#   exist only on this machine, for local development and for showing Doust a
#   working prototype when asking permission. Every figure carries a
#   permission_status field in figures.ts; the UI must show attribution and must
#   badge anything not cleared. Do not commit, deploy, or publish these images
#   until the corresponding rightsholder has said yes.
#
# Re-run:  python docs/arganta-energy/knowledge-base/extract_doust_figures.py
import json
import re
import sys

import fitz  # PyMuPDF

SRC = r"C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab\docs\arganta-energy\knowledge-base\doust-basin-figures\_source\Dissecting-Sedimentary-Basins-Doust.pdf"
OUT_DIR = r"C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab\apps\energy\public\doust-figures"
MANIFEST = r"C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab\docs\arganta-energy\knowledge-base\doust-basin-figures\extraction-manifest.json"

DPI = 200
BODY_START_PAGE = 8  # page idx 0-7 are cover / contents / List of Figures — skip so
                     # the List-of-Figures entries are never mistaken for captions.
MIN_IMG_PX = 40      # ignore 1x1 spacer images and hairline rules
MIN_RECT_AREA = 2500  # pt^2 — ignore tiny decorative marks

doc = fitz.open(SRC)


def find_caption_hits():
    """Locate each figure's real caption: page index + y of the caption's top.
    Searches the body only, and takes the LAST hit for a number (a figure is
    sometimes referenced in prose before its caption appears)."""
    hits = {}
    for pno in range(BODY_START_PAGE, doc.page_count):
        page = doc[pno]
        text = page.get_text()
        for m in re.finditer(r"Fig(?:ure)?\.?\s*(\d{1,2})\s*[\.,]", text):
            n = int(m.group(1))
            if not (1 <= n <= 49):
                continue
            # locate that caption string on the page to get its y coordinate
            needle = m.group(0)
            rects = page.search_for(needle)
            if not rects:
                continue
            # a caption is the occurrence whose text continues into a descriptive
            # sentence; take the lowest-on-page match as the caption anchor
            r = sorted(rects, key=lambda rr: rr.y0)[0]
            hits.setdefault(n, []).append((pno, r.y0, r.y1))
    return hits


def substantial_rects(page):
    """Real figure artwork on a page: raster images big enough to matter, plus EVERY
    vector drawing rect (individual strokes are tiny — they only become a figure once
    clustered, e.g. fig 11 is 93 vector strokes and zero rasters)."""
    out = []
    for im in page.get_images(full=True):
        xref, _, w, h = im[0], im[1], im[2], im[3]
        if w < MIN_IMG_PX or h < MIN_IMG_PX:
            continue
        for r in page.get_image_rects(xref):
            if r.get_area() >= MIN_RECT_AREA:
                out.append(fitz.Rect(r))
    for d in page.get_drawings():
        r = fitz.Rect(d["rect"])
        if r.is_empty or r.is_infinite:
            continue
        out.append(r)
    return out


def cluster(rects, gap=28):
    """Group rects into vertical bands so multi-panel figures and loose vector strokes
    stay together, but two figures on one page stay apart. Only bands big enough to be
    real artwork survive."""
    if not rects:
        return []
    rects = sorted(rects, key=lambda r: r.y0)
    bands = [[rects[0]]]
    for r in rects[1:]:
        cur_bottom = max(x.y1 for x in bands[-1])
        if r.y0 - cur_bottom <= gap:
            bands[-1].append(r)
        else:
            bands.append([r])
    merged = []
    for band in bands:
        u = fitz.Rect(band[0])
        for r in band[1:]:
            u |= r
        if u.get_area() >= 8000 and u.width > 80 and u.height > 60:
            merged.append((u, band))
    return merged


def prose_blocks(page):
    """Body-prose text blocks — wide, many-worded running text (and long captions).
    Figure-internal labels ('Early', 'Climax', legend entries) are short and narrow,
    so they never qualify and are preserved."""
    out = []
    page_w = page.rect.width
    for b in page.get_text("blocks"):
        x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], b[4]
        if (x1 - x0) > 0.55 * page_w and len(text.split()) > 25:
            out.append(fitz.Rect(x0, y0, x1, y1))
    return out


def render_clip(pno, clip):
    """Render a page region with BODY PROSE REMOVED.

    Several figures' own bounding boxes enclose or abut running text (fig 41's image
    rect spans nearly the whole page with prose overlaid inside it), so no amount of
    rectangle-trimming can separate them. Instead we redact the prose text runs and
    keep everything else: images are preserved (PDF_REDACT_IMAGE_NONE) and vector
    line art is preserved (PDF_REDACT_LINE_ART_NONE), so multi-panel and drawn
    figures survive intact, as do short figure-internal labels and legends.

    Done on a throwaway in-memory copy of the document — the source PDF on disk is
    never modified."""
    tmp = fitz.open(SRC)
    page = tmp[pno]
    for p in prose_blocks(page):
        page.add_redact_annot(p)
    img_none = getattr(fitz, "PDF_REDACT_IMAGE_NONE", 0)
    art_none = getattr(fitz, "PDF_REDACT_LINE_ART_NONE", 0)
    try:
        page.apply_redactions(images=img_none, graphics=art_none)
    except TypeError:  # older PyMuPDF without the graphics kwarg
        page.apply_redactions(images=img_none)
    pix = page.get_pixmap(clip=clip, dpi=DPI)
    tmp.close()
    return pix


def trim_prose(band, members, page):
    """Keep the full multi-panel union, but pull its edges in past any body-prose
    block that sits wholly outside the artwork. We render a PAGE REGION, so prose
    inside the union would otherwise be rendered as if it were part of the figure.
    Only trims where no artwork is lost."""
    band = fitz.Rect(band)
    if not members:
        return band
    art_x0 = min(r.x0 for r in members); art_x1 = max(r.x1 for r in members)
    art_y0 = min(r.y0 for r in members); art_y1 = max(r.y1 for r in members)
    for p in prose_blocks(page):
        if not (p & band).is_empty or p.intersects(band):
            if p.y1 <= art_y0 + 2:          # prose sits above every panel
                band.y0 = max(band.y0, p.y1)
            elif p.y0 >= art_y1 - 2:        # prose sits below every panel
                band.y1 = min(band.y1, p.y0)
            elif p.x0 >= art_x1 - 2:        # prose sits right of every panel
                band.x1 = min(band.x1, p.x0)
            elif p.x1 <= art_x0 + 2:        # prose sits left of every panel
                band.x0 = max(band.x0, p.x1)
    if band.is_empty or band.width < 40 or band.height < 40:
        return fitz.Rect(art_x0, art_y0, art_x1, art_y1)
    return band


def main():
    import os
    os.makedirs(OUT_DIR, exist_ok=True)
    hits = find_caption_hits()
    manifest = []
    claimed = {}  # pno -> list of already-used bands, so two figs on a page don't collide

    for n in range(1, 50):
        entries = hits.get(n)
        if not entries:
            manifest.append({"fig": n, "status": "no-caption-found"})
            print(f"fig {n:2d}: NO CAPTION FOUND", file=sys.stderr)
            continue
        pno, cap_y0, _ = entries[-1]  # last hit = the caption, not a prose reference
        page = doc[pno]
        bands = cluster(substantial_rects(page))
        used = claimed.setdefault(pno, [])

        # In this booklet the caption text is usually drawn INSIDE the figure's own
        # bounding box (not below it), so the primary rule is containment. Fall back
        # to nearest-above, then nearest-below.
        free = [(b, mem) for (b, mem) in bands if not any(b == u for u in used)]
        contains = [(b, m) for (b, m) in free if b.y0 - 6 <= cap_y0 <= b.y1 + 6]
        above = [(b, m) for (b, m) in free if b.y1 <= cap_y0 + 6]
        below = [(b, m) for (b, m) in free if b.y0 >= cap_y0 - 6]
        picked = None
        if contains:
            picked = max(contains, key=lambda t: t[0].get_area())  # the caption's own figure
        elif above:
            picked = max(above, key=lambda t: t[0].y1)             # closest above the caption
        elif below:
            picked = min(below, key=lambda t: t[0].y0)             # closest below
        band = None
        if picked is not None:
            used.append(picked[0])
            band = trim_prose(picked[0], picked[1], page)
        if band is None:
            manifest.append({"fig": n, "page_idx": pno, "status": "no-artwork-region"})
            print(f"fig {n:2d}: page {pno} — no unclaimed artwork region", file=sys.stderr)
            continue

        clip = fitz.Rect(band)
        clip.x0 = max(page.rect.x0, clip.x0 - 6)
        clip.y0 = max(page.rect.y0, clip.y0 - 6)
        clip.x1 = min(page.rect.x1, clip.x1 + 6)
        clip.y1 = min(page.rect.y1, clip.y1 + 6)

        pix = render_clip(pno, clip)
        name = f"fig-{n:02d}.png"
        pix.save(f"{OUT_DIR}\\{name}")
        manifest.append({
            "fig": n, "page_idx": pno, "printed_page": pno, "file": name,
            "px_w": pix.width, "px_h": pix.height,
            "clip": [round(clip.x0, 1), round(clip.y0, 1), round(clip.x1, 1), round(clip.y1, 1)],
            "status": "ok",
        })
        print(f"fig {n:2d}: page {pno} -> {name} ({pix.width}x{pix.height})")

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"dpi": DPI, "source": "Dissecting Sedimentary Basins, H. Doust",
                   "figures": manifest}, f, indent=1)
    ok = sum(1 for m in manifest if m.get("status") == "ok")
    print(f"\n{ok}/49 figures extracted -> {OUT_DIR}")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""match_assets.py — Phase A3 auto-linker (docs/BUILD-PLAN.md).

Links scraped NexusAtlas entities to real client sprites by image matching:
  * items:    data/core/items.json    x  data/client/items (5,879 icons)
  * monsters: data/core/monsters.json x  data/client/monsters (2,013 mobs)

The scraped GIFs were rendered from the same client art, so shape (tight
alpha mask) + color comparison gives near-exact matches. For icons whose
assigned client palette is a dye-base (the "purple garments"), the matcher
searches all ITEM.PAL blocks for the palette that reproduces the GIF —
recovering the item's true display palette.

Writes:
  data/links/item-links.json
  data/links/monster-links.json
  data/derived/match-report.json

Usage: python scripts/match_assets.py [--items] [--monsters]  (default: both)
"""
import json
import os
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
KINGDOM = os.path.normpath(os.path.join(HERE, '..'))
CORE = os.path.join(KINGDOM, 'data', 'core')
CLIENT = os.path.join(KINGDOM, 'data', 'client')
LINKS = os.path.join(KINGDOM, 'data', 'links')
DERIVED = os.path.join(KINGDOM, 'data', 'derived')

MSE_ACCEPT = 60.0      # avg squared channel error over matched pixels
MASK_IOU_MIN = 0.95


def load_json(*parts):
    with open(os.path.join(*parts), encoding='utf-8') as f:
        return json.load(f)


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1)


def gif_rgba(path):
    """Scraped GIF -> tight-cropped (rgb HxWx3, mask HxW bool) or None."""
    segs = gif_segments(path)
    return segs[0] if segs else None


def gif_segments(path):
    """Scraped GIF -> list of tight (rgb, mask) segments.

    NexusAtlas GIFs often stack multiple animation frames vertically in one
    image (e.g. a 21x53 rat = two ~24px frames). Split on fully-transparent
    row bands and tight-crop each part; also include the whole tight image.
    """
    try:
        im = Image.open(path).convert('RGBA')
    except Exception:
        return []
    a = np.asarray(im)
    mask = a[..., 3] > 0
    if not mask.any():
        return []

    def tight_of(y0, y1):
        sub, sm = a[y0:y1, :, :3], mask[y0:y1]
        ys, xs = np.where(sm)
        return (sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.int32),
                sm[ys.min():ys.max() + 1, xs.min():xs.max() + 1])

    rows = mask.any(axis=1)
    segs = []
    y = 0
    while y < len(rows):
        if rows[y]:
            y2 = y
            while y2 < len(rows) and rows[y2]:
                y2 += 1
            segs.append(tight_of(y, y2))
            y = y2
        else:
            y += 1
    if len(segs) > 1:
        segs.append(tight_of(0, len(rows)))  # whole image as fallback
    return segs


def tight(arr_idx):
    """Tight-crop an index array; returns (idx, mask) or None."""
    mask = arr_idx > 0
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return (arr_idx[ys.min():ys.max() + 1, xs.min():xs.max() + 1],
            mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


def mse(rgb_a, rgb_b, mask):
    if not mask.any():
        return 1e9
    d = (rgb_a - rgb_b)[mask]
    return float((d * d).mean())


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

def match_items(report):
    t0 = time.time()
    meta = load_json(CLIENT, 'items', 'items.json')
    palettes = np.asarray(load_json(CLIENT, 'items', 'palettes.json'), np.int32)  # (P,256,3)
    idx_sheet = np.asarray(Image.open(os.path.join(CLIENT, 'items', 'items_sheet.idx.png')))

    # index icons by tight size
    by_size = {}
    icons = []
    for i, m in enumerate(meta['icons']):
        if not m:
            icons.append(None)
            continue
        arr = idx_sheet[m['y']:m['y'] + m['h'], m['x']:m['x'] + m['w']]
        t = tight(arr)
        icons.append((t, m.get('palette_id') or 0))
        if t is not None:
            by_size.setdefault(t[0].shape, []).append(i)

    items = load_json(CORE, 'items.json')
    links, unmatched = [], []
    for item in items:
        best = None
        for img in item.get('images', []):
            for grgb, gmask in gif_segments(os.path.join(KINGDOM, img)):
                for cand in by_size.get(grgb.shape[:2], []):
                    (cidx, cmask), pal_id = icons[cand]
                    inter = (gmask & cmask).sum()
                    union = (gmask | cmask).sum()
                    if union == 0 or inter / union < MASK_IOU_MIN:
                        continue
                    m = gmask & cmask
                    # pass 1: the icon's own assigned palette
                    err = mse(palettes[min(pal_id, len(palettes) - 1)][cidx], grgb, m)
                    pal_used = pal_id
                    if err > MSE_ACCEPT:
                        # pass 2: search all palettes (dye-base recovery)
                        rendered = palettes[:, cidx]              # (P,h,w,3)
                        d = (rendered - grgb[None])[:, m]         # (P,n,3)
                        errs = (d * d).mean(axis=(1, 2))
                        pi = int(errs.argmin())
                        if errs[pi] < err:
                            err, pal_used = float(errs[pi]), pi
                    if err <= MSE_ACCEPT and (best is None or err < best['mse']):
                        best = {'iconIndex': cand, 'paletteId': int(pal_used),
                                'mse': round(err, 2), 'gif': img,
                                'paletteRecovered': pal_used != pal_id}
        if best:
            links.append({'itemId': item['id'], **{k: best[k] for k in
                          ('iconIndex', 'paletteId', 'paletteRecovered')},
                          'method': 'image-match',
                          'score': round(max(0.0, 1 - best['mse'] / 255.0), 3),
                          'status': 'auto'})
        else:
            unmatched.append(item['id'])

    save_json(os.path.join(LINKS, 'item-links.json'), links)
    report['items'] = {'total': len(items), 'linked': len(links),
                       'paletteRecovered': sum(1 for l in links if l['paletteRecovered']),
                       'unmatched': unmatched, 'seconds': round(time.time() - t0, 1)}
    print('items: %d/%d linked (%d palettes recovered) in %.1fs' % (
        len(links), len(items), report['items']['paletteRecovered'],
        report['items']['seconds']))


# ---------------------------------------------------------------------------
# Monsters
# ---------------------------------------------------------------------------

def mob_key_frames(mob, sheets_dir, cache):
    """Tight palette-INDEX arrays of the first frame of every animation the
    mob has — the scraped GIF may show any pose or direction. Index pixels
    (not RGB) because monster colors are server-assigned palette variants;
    identity is decided by shape, display palette recovered by search."""
    if not mob.get('sheet') or not mob.get('idx_sheet'):
        return []
    metas = mob.get('frames') or []
    path = os.path.join(sheets_dir, mob['idx_sheet'])
    seen, out = set(), []
    for seq in (mob.get('animations') or {}).values():
        if not seq:
            continue
        fi = seq[0]['frame']
        if fi in seen or not (0 <= fi < len(metas)) or not metas[fi]:
            continue
        seen.add(fi)
        fm = metas[fi]
        if path not in cache:
            cache[path] = np.asarray(Image.open(path))
        sh = cache[path]
        sub = sh[fm['y'] + fm['fy']:fm['y'] + fm['fy'] + fm['h'],
                 fm['x'] + fm['fx']:fm['x'] + fm['fx'] + fm['w']]
        m = sub > 0
        if not m.any():
            continue
        ys, xs = np.where(m)
        out.append(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy())
    return out


SIZE_TOL = 4        # px slack: NexusAtlas crops differ from client frames
AGREE_MIN = 0.96    # mask IoU after centroid alignment (shape identity)
MOB_MSE_MAX = 1500  # color tolerance after palette search (Atlas shading
                    # differs mildly from any client palette; identity is
                    # decided by shape, color only ranks candidates)
SAMPLE_PX = 2500


def shape_align(aidx_mask, gmask):
    """Centroid-align a client index mask to a GIF mask.
    Returns (windows, iou) where windows = (ay0,ax0,by0,bx0,h,w) or None."""
    ah, aw = aidx_mask.shape
    bh, bw = gmask.shape
    if abs(ah - bh) > SIZE_TOL or abs(aw - bw) > SIZE_TOL:
        return None, 0.0
    ay, ax = np.argwhere(aidx_mask).mean(axis=0)
    by, bx = np.argwhere(gmask).mean(axis=0)
    dy, dx = int(round(by - ay)), int(round(bx - ax))
    ay0, ax0 = max(0, -dy), max(0, -dx)
    by0, bx0 = max(0, dy), max(0, dx)
    h = min(ah - ay0, bh - by0)
    w = min(aw - ax0, bw - bx0)
    if h <= 0 or w <= 0:
        return None, 0.0
    am = aidx_mask[ay0:ay0 + h, ax0:ax0 + w]
    bm = gmask[by0:by0 + h, bx0:bx0 + w]
    inter = (am & bm).sum()
    union = aidx_mask.sum() + gmask.sum() - inter
    if union == 0:
        return None, 0.0
    return (ay0, ax0, by0, bx0, h, w), inter / union


def match_monsters(report):
    t0 = time.time()
    mobs = load_json(CLIENT, 'monsters', 'parts.json')
    sheets_dir = os.path.join(CLIENT, 'monsters')
    palettes = np.asarray(load_json(CLIENT, 'monsters', 'palettes.json'), np.int32)
    cache = {}
    buckets = {}   # (h//8, w//8) -> [(mobId, idx_array)]
    for mob in mobs:
        for idx in mob_key_frames(mob, sheets_dir, cache):
            h, w = idx.shape
            buckets.setdefault((h // 8, w // 8), []).append((mob['id'], idx))
        if len(cache) > 64:
            cache.clear()

    def candidates(h, w):
        for by in range((h - SIZE_TOL) // 8, (h + SIZE_TOL) // 8 + 1):
            for bx in range((w - SIZE_TOL) // 8, (w + SIZE_TOL) // 8 + 1):
                yield from buckets.get((by, bx), [])

    rng = np.random.default_rng(7)
    monsters = load_json(CORE, 'monsters.json')
    links, unmatched = [], []
    for mon in monsters:
        best = None   # (err, mobId, paletteId, iou)
        for img in mon.get('images', []):
            for grgb, gmask in gif_segments(os.path.join(KINGDOM, img)):
                gh, gw = grgb.shape[:2]
                for mid, cidx in candidates(gh, gw):
                    win, iou = shape_align(cidx > 0, gmask)
                    if win is None or iou < AGREE_MIN:
                        continue
                    ay0, ax0, by0, bx0, h, w = win
                    ci = cidx[ay0:ay0 + h, ax0:ax0 + w]
                    gr = grgb[by0:by0 + h, bx0:bx0 + w]
                    m = (ci > 0) & gmask[by0:by0 + h, bx0:bx0 + w]
                    if m.sum() < 30:
                        continue
                    flat_i = ci[m]
                    flat_g = gr[m]
                    if len(flat_i) > SAMPLE_PX:
                        sel = rng.choice(len(flat_i), SAMPLE_PX, replace=False)
                        flat_i, flat_g = flat_i[sel], flat_g[sel]
                    rendered = palettes[:, flat_i]           # (P,n,3)
                    d = rendered - flat_g[None]
                    errs = (d * d).mean(axis=(1, 2))
                    pi = int(errs.argmin())
                    err = float(errs[pi])
                    if err <= MOB_MSE_MAX and (best is None or err < best[0]):
                        best = (err, mid, pi, iou)
        if best:
            err, mid, pi, iou = best
            links.append({'monsterId': mon['id'], 'mobId': mid,
                          'paletteId': pi,
                          'method': 'shape-match+palette-search',
                          'score': round(iou, 3),
                          'colorMse': round(err, 1),
                          'status': 'auto'})
        else:
            unmatched.append(mon['id'])

    save_json(os.path.join(LINKS, 'monster-links.json'), links)
    report['monsters'] = {'total': len(monsters), 'linked': len(links),
                          'unmatched': unmatched,
                          'seconds': round(time.time() - t0, 1)}
    print('monsters: %d/%d linked in %.1fs' % (
        len(links), len(monsters), report['monsters']['seconds']))


if __name__ == '__main__':
    args = set(sys.argv[1:])
    report = {'generated': time.strftime('%Y-%m-%d %H:%M:%S')}
    if not args or '--items' in args:
        match_items(report)
    if not args or '--monsters' in args:
        match_monsters(report)
    save_json(os.path.join(DERIVED, 'match-report.json'), report)
    print('report -> data/derived/match-report.json')

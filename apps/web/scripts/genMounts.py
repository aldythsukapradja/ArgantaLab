#!/usr/bin/env python
# ============================================================
#  ARGANTALAB · PixelLab mount-sprite generator (data-driven)
#  Regenerates the 10 mount pixel-art sprites into
#  apps/web/public/assets/mounts/<render>.png from the catalog rows.
#
#  Usage:  PIXELLAB_TOKEN=<secret> python apps/web/scripts/genMounts.py
#  Deps:   pip install pixellab requests
#
#  NOTE: PixelLab Python SDK v1.0.5 crashes parsing the response (renamed
#  `usage` field), so we call the REST endpoint directly and reuse the SDK
#  only for auth (client.base_url + client.headers()).
# ============================================================
import os, base64, pathlib, time, requests, pixellab

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "assets" / "mounts"
OUT.mkdir(parents=True, exist_ok=True)

client = pixellab.Client(secret=os.environ["PIXELLAB_TOKEN"])

# LOCKED "cool mount" recipe (2026-07-03, tuned on arganterion): majestic,
# proportioned (NOT chibi, NOT gritty-retro), clear saddle for the riding avatar,
# clean bright art that lives happily next to the kawaii Buddy. 128px, seed 55.
STYLE = ("clean bright friendly game pixel art, smooth shading, cool and majestic, "
         "NOT chibi, proportioned adult creature, side view facing right, "
         "a clear ornate empty saddle on its back for a rider to sit on top, "
         "dramatic and heroic, transparent background")

# Driven by the mounts.ts catalog (name/blurb/color).
MOUNTS = {
    "sandstrider":   "a swift desert courser steed, tan and warm amber, light desert barding, flowing mane and tail",
    "meadowpony":    "a spirited meadow horse steed, soft green and cream coat, floral bridle, lush flowing mane",
    "stormfin":      "a sleek serpentine sea-dragon steed with fins and a finned crest, teal and cyan, aquatic and graceful",
    "emberfox":      "a blazing many-tailed fox steed, fiery orange and red, glowing flame accents, sleek and swift",
    "frostelk":      "a majestic frost elk steed, icy pale-blue and white, grand branching antlers, frosted fur",
    "updrift":       "a graceful winged sky-glider steed, violet purple, broad elegant feathered wings, airy",
    "thunderram":    "a powerful storm ram steed, golden yellow fleece, big curled horns, crackling lightning accents, sturdy",
    "shadowpanther": "a sleek shadow panther steed, deep indigo and black glossy coat, agile, glowing cyan eyes",
    "crystaldrake":  "a majestic crystal dragon steed, bright cyan crystal body, faceted gem wings and horns, radiant",
    "arganterion":   "a cool majestic legendary guardian steed mount, sleek powerful black horse-like body, "
                     "ornate golden plate armor, long flowing golden-orange mane and tail, an elegant spiral horn, "
                     "huge dramatic flame-gold feathered wings, glowing golden accents, regal and heroic",
}

for i, (key, subject) in enumerate(MOUNTS.items(), 1):
    try:
        r = requests.post(
            f"{client.base_url}/generate-image-pixflux",
            headers=client.headers(),
            json={"description": f"{subject}, {STYLE}",
                  "image_size": {"width": 128, "height": 128}, "no_background": True, "seed": 55},
            timeout=120,
        )
        r.raise_for_status()
        img = r.json()["image"]
        b64 = (img["base64"] if isinstance(img, dict) else img)
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        (OUT / f"{key}.png").write_bytes(base64.b64decode(b64))
        print(f"[{i}/10] OK  {key}")
    except Exception as e:
        print(f"[{i}/10] FAIL {key}: {e}")
    time.sleep(1)

print("DONE ->", OUT)

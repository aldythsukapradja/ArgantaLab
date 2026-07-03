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

# Shared house style keeps all 10 consistent.
STYLE = ("chunky cute pixel art, bold dark outline, soft simple shading, "
         "side view facing right, full body, riderless mount with an empty saddle, "
         "centered, transparent background")

# Driven by the mounts.ts catalog (name/blurb/color).
MOUNTS = {
    "sandstrider":   "a friendly desert runner mount like a slender sandy camel-horse, warm amber and tan",
    "meadowpony":    "a cheerful chubby little pony with a soft pastel green mane and tail",
    "stormfin":      "a sleek tidal sea-serpent mount with fins, teal and cyan, aquatic",
    "emberfox":      "a blazing fox-spirit mount with a flaming tail, fiery orange and red",
    "frostelk":      "a calm frost elk mount with icy branching antlers, pale ice-blue and white",
    "updrift":       "a graceful winged sky-glider mount with broad feathery wings, violet purple",
    "thunderram":    "a fluffy storm ram mount with big curled horns and a little lightning spark, golden yellow",
    "shadowpanther": "a sleek glossy night panther mount, deep indigo and black",
    "crystaldrake":  "a crystalline dragon mount with faceted gem wings and horns, bright cyan crystal",
    "arganterion":   "a legendary regal guardian beast mount with ornate golden armor and horns, majestic",
}

for i, (key, subject) in enumerate(MOUNTS.items(), 1):
    try:
        r = requests.post(
            f"{client.base_url}/generate-image-pixflux",
            headers=client.headers(),
            json={"description": f"{subject}, {STYLE}",
                  "image_size": {"width": 64, "height": 64}, "no_background": True},
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

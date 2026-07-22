"""F1.4 curation tooling.

  sheets  — tile candidates into labeled contact sheets (12/sheet) for visual review
  apply   — given keep-list slugs, copy keepers into dataset/images with captions
            (strategy A per-image txt: trigger + class + scene words from recipe),
            move the rest to dataset/rejected, write dataset-card.md

Usage:
  python workflows/curate.py sheets
  python workflows/curate.py apply front-00 threeq-l-03 ...
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

CHAR = Path(__file__).parent.parent / "characters/arganta"
CAND = CHAR / "dataset/candidates"

def sheets():
    files = sorted(CAND.glob("*.png"))
    out = CHAR / "dataset"
    per, cols, cell = 12, 4, 256
    for s in range(0, len(files), per):
        batch = files[s:s + per]
        rows = (len(batch) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), "white")
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(batch):
            im = Image.open(f)
            im.thumbnail((cell, cell))
            r, c = divmod(i, cols)
            sheet.paste(im, (c * cell + (cell - im.width) // 2, r * (cell + 18)))
            d.text((c * cell + 4, r * (cell + 18) + cell + 2), f.stem, fill="black")
        p = out / f"contact-sheet-{s//per:02d}.jpg"
        sheet.save(p, quality=88)
        print(p.name, len(batch))

def apply(keep):
    manifest = json.loads((CAND / "manifest.json").read_text()) if (CAND / "manifest.json").exists() else []
    recipes = {r["slug"]: r for r in manifest}
    imgs, caps, rej = CHAR / "dataset/images", CHAR / "dataset/captions", CHAR / "dataset/rejected"
    for d in (imgs, caps, rej):
        d.mkdir(exist_ok=True)
    kept = 0
    for f in sorted(CAND.glob("*.png")):
        if f.stem in keep:
            n = f"argx-{kept:03d}-{f.stem}"
            (imgs / f"{n}.png").write_bytes(f.read_bytes())
            r = recipes.get(f.stem, {})
            # caption strategy A: trigger + class + CHANGEABLE attributes only
            scene = r.get("prompt", "").split(", ", 7)[-1] if r else ""
            (caps / f"{n}.txt").write_text(f"photo of argxsoul, adult man, {scene}"[:400])
            kept += 1
        else:
            (rej / f.name).write_bytes(f.read_bytes())
    card = CHAR / "dataset/dataset-card.md"
    card.write_text(
        f"# ARGANTA dataset v0.1.0\n\nKept {kept} / {len(list(CAND.glob('*.png')))} candidates "
        f"(bootstrapped from 6 seed refs via IP-Adapter plus-face, wf02, weight 0.9).\n"
        f"Curated by Fable (self-gate) per handoff §8 rejection rules on 2026-07-17.\n"
        f"Captions: strategy A files in captions/ (trigger `argxsoul`).\n"
        f"Trainer note: diffusers DreamBooth-LoRA uses instance_prompt (strategy A); "
        f"caption files retained for a future per-caption trainer comparison.\n")
    print(f"kept {kept}, rejected {len(list(rej.glob('*.png')))}")

if __name__ == "__main__":
    if sys.argv[1] == "sheets":
        sheets()
    else:
        apply(set(sys.argv[1:] if sys.argv[1] != "apply" else sys.argv[2:]))

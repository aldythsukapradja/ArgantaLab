"""F1.5 winner selection — run a fixed validation suite across base + all three
LoRA candidates at CONSTANT seeds, so differences are the LoRA, not noise.
Builds one labeled contact sheet per candidate covering angle/expression/wardrobe/
distance, plus a same-seed cross-candidate strip for the front portrait.

Handoff §10/§13: don't declare a winner from the last checkpoint alone — compare.
"""
import sys, time
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import soul_graphs as sg
from run import queue_and_fetch

CHAR = Path(__file__).parent.parent / "characters/arganta"
OUT = CHAR / "evaluations/lora-validation"
OUT.mkdir(parents=True, exist_ok=True)

TRIG = "photo of argxsoul, adult man"
PHOTO = "professional editorial RAW photograph, realistic skin texture, accurate anatomy"
# (slug, scene, resolution) — fixed across every candidate
SCENES = [
    ("front-neutral",  "front view portrait, neutral expression, navy suit, white studio background", "portrait"),
    ("threeq-smile",   "left three-quarter view, natural smile, charcoal sweater, soft window light", "portrait"),
    ("profile",        "right side profile portrait, serious expression, white shirt, grey backdrop", "portrait"),
    ("halfbody-casual","half-body, relaxed stance, olive jacket over t-shirt, outdoor golden hour",   "half"),
    ("fullbody",       "full-body standing, formal navy suit, white seamless studio, whole figure",   "full"),
    ("wardrobe-sport", "half-body, black athletic training top, gym setting, high-contrast lighting",  "half"),
]
SEEDS = [101, 202]  # two fixed seeds per scene → repeatability read

CANDIDATES = [
    ("base",  None),
    ("v001-low",  "arganta-sd15-v001-low.safetensors"),
    ("v002-mid",  "arganta-sd15-v002-mid.safetensors"),
    ("v003-high", "arganta-sd15-v003-high.safetensors"),
]
# LoRA strengths tuned per rank (higher rank overfits faster → lower strength)
STRENGTH = {"v001-low": 0.9, "v002-mid": 0.8, "v003-high": 0.65}


def gen(cand, lora, scene_slug, scene, res, seed):
    dest = OUT / f"{cand}__{scene_slug}__s{seed}.png"
    if dest.exists():
        return dest
    prompt = f"{TRIG}, {scene}, {PHOTO}"
    if lora is None:
        g = sg.wf00_base(prompt, seed, res=res)
    else:
        s = STRENGTH[cand]
        g = sg.wf01_lora(prompt, seed, lora, lora_model=s, lora_clip=s, res=res)
    dest.write_bytes(queue_and_fetch(g, timeout=300))
    return dest


def contact_sheet(cand):
    """One sheet per candidate: rows = scenes, cols = seeds."""
    cell = 300
    cols, rows = len(SEEDS), len(SCENES)
    sheet = Image.new("RGB", (cols * cell + 130, rows * cell), "white")
    d = ImageDraw.Draw(sheet)
    for r, (slug, _, _) in enumerate(SCENES):
        d.text((6, r * cell + cell // 2), slug, fill="black")
        for c, seed in enumerate(SEEDS):
            p = OUT / f"{cand}__{slug}__s{seed}.png"
            if p.exists():
                im = Image.open(p); im.thumbnail((cell, cell))
                sheet.paste(im, (130 + c * cell + (cell - im.width) // 2, r * cell + (cell - im.height) // 2))
    out = OUT / f"SHEET-{cand}.jpg"
    sheet.save(out, quality=88)
    return out


if __name__ == "__main__":
    total = len(CANDIDATES) * len(SCENES) * len(SEEDS)
    n = 0
    for cand, lora in CANDIDATES:
        for slug, scene, res in SCENES:
            for seed in SEEDS:
                n += 1
                t0 = time.time()
                try:
                    gen(cand, lora, slug, scene, res, seed)
                    print(f"[{n}/{total}] {cand} {slug} s{seed} {time.time()-t0:.0f}s", flush=True)
                except Exception as e:
                    print(f"[{n}/{total}] FAIL {cand} {slug} s{seed}: {e}", flush=True)
        print("SHEET:", contact_sheet(cand).name, flush=True)
    print("done")

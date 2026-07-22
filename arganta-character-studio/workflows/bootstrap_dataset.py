"""F1.4 dataset bootstrap: generate LoRA-training candidates from the six seed
references via IP-Adapter (workflow 02), covering the handoff §8 distribution
(angles x expressions x lighting x wardrobe x framing). Outputs land in
dataset/candidates/ named by their recipe so curation + captioning are traceable.

Identity attributes are pinned in every prompt (strategy: generate WITH detailed
attributes; caption strategy A/B is decided later at training time).
"""
import itertools, json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import soul_graphs as sg
from run import queue_and_fetch

IDENT = ("photo of an adult man, short connected dark beard, thick dark side-parted hair, "
         "dark brown eyes, defined jawline, medium tan skin")
PHOTO = ("professional editorial RAW photograph, realistic skin texture, natural pores, "
         "accurate anatomy, high-detail camera capture")

# (slug, prompt fragment, framing res, best ref)
ANGLES = [
    ("front",      "front view portrait, looking at camera",              "portrait", "arganta-ref-01.png"),
    ("threeq-l",   "left three-quarter view portrait",                    "portrait", "arganta-ref-02.png"),
    ("threeq-r",   "right three-quarter view portrait",                   "portrait", "arganta-ref-01.png"),
    ("profile-l",  "left side profile portrait",                          "portrait", "arganta-ref-02.png"),
    ("profile-r",  "right side profile portrait",                         "portrait", "arganta-ref-02.png"),
    ("half",       "half-body shot, natural stance",                      "half",     "arganta-ref-03.png"),
    ("full",       "full-body shot, standing, whole figure visible",      "full",     "arganta-ref-06.png"),
]
EXPRESSIONS = ["neutral expression", "natural warm smile", "serious focused expression", "soft reflective expression"]
LIGHTING = ["white seamless studio background, soft studio lighting",
            "soft window light, neutral interior",
            "golden hour outdoor light",
            "high-contrast editorial lighting, grey backdrop"]
WARDROBE = ["navy tailored suit with black shirt", "white oxford shirt", "charcoal knit sweater",
            "black athletic training top", "olive field jacket over t-shirt"]

def recipes(target=60):
    """Weighted sampling of the matrix: every angle covered, extra weight on
    3/4s + profiles (the seed set lacks them), rotating expr/light/wardrobe."""
    weights = {"front": 8, "threeq-l": 11, "threeq-r": 11, "profile-l": 8, "profile-r": 8, "half": 8, "full": 6}
    ex, li, wa = itertools.cycle(EXPRESSIONS), itertools.cycle(LIGHTING), itertools.cycle(WARDROBE)
    out = []
    for slug, frag, res, ref in ANGLES:
        for i in range(weights[slug]):
            out.append({
                "slug": f"{slug}-{i:02d}", "res": res, "ref": ref,
                "seed": hash((slug, i)) % (2**31),
                "prompt": f"{IDENT}, {frag}, {next(ex)}, {next(wa)}, {next(li)}, {PHOTO}",
            })
    return out[:target]

if __name__ == "__main__":
    outdir = Path(__file__).parent.parent / "characters/arganta/dataset/candidates"
    outdir.mkdir(parents=True, exist_ok=True)
    manifest = []
    todo = recipes()
    print(f"{len(todo)} candidates")
    for n, r in enumerate(todo):
        dest = outdir / f"{r['slug']}.png"
        if dest.exists():
            print(f"[{n+1}/{len(todo)}] SKIP {r['slug']}"); manifest.append(r); continue
        t0 = time.time()
        g = sg.wf02_ipadapter(r["prompt"], r["seed"], r["ref"], weight=0.9, res=r["res"])
        try:
            dest.write_bytes(queue_and_fetch(g, timeout=300))
            print(f"[{n+1}/{len(todo)}] OK {r['slug']} {time.time()-t0:.0f}s")
            manifest.append(r)
        except Exception as e:
            print(f"[{n+1}/{len(todo)}] FAIL {r['slug']}: {e}")
    (outdir / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print("done:", len(manifest))

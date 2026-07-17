# Build Handoff — ARGANTA + LASHIRA portrait sets (Normal · Formal · Spicy)

> **Executor:** Sonnet (Opus only if QA fails 3× on the same character — see §8).
> **Status:** APPROVED PLAN — execute top-to-bottom. The founder's reference board (Arganta Creator Studio V1.0) is canon; every output must read as the same person shown there.
> **Scope:** 2 characters × 3 formats = 6 canonical images, then populate the AI Influencer Studio page.

---

## 1 · Non-negotiables

1. **Identity first, formats second.** Lock each character's face with the Normal shot before generating Formal/Spicy. The locked Normal output becomes the identity reference for the other two — never regenerate a face from scratch per format.
2. **Every generation is image-anchored.** Model: `nano_banana_pro` (accepts multiple reference images). Never run text-only — that's what caused the v1 drift.
3. **One variable per retry.** If QA fails, change exactly one thing (hair / light / wardrobe / crop) and rerun. Don't rewrite the whole prompt.
4. **Spicy = maximum allowable, IG-recommendation-safe.** Athletic/contextual, adult, confident — never explicit, never underwear-shoot framing, no suggestive posing detached from the character's world. If a model refuses a spicy prompt, soften the *garment* words, never add explicitness.
5. **Free-plan constraint:** 1 concurrent job. Generate → poll `job_display` → next. Preflight the first call with `get_cost:true`.
6. **Tool gotcha:** `generate_image` requires the model + prompt duplicated **inside `params`** (`params.model`, `params.prompt`) as well as top-level, or it fails validation.
7. Commits go to **main**, never a feature branch.

## 2 · Reference inputs

Preferred: original Creator Studio PNGs from the founder (1080×1080 profile pics V1–V3 + reference-sheet portrait). **If the founder hasn't supplied them, ask once**; if unavailable, crop from the board image (the 1536×1024 studio sheet in `docs/` context / founder's message).

Board crop regions (approximate, on the 1536×1024 board):
- **Arganta profile circles V1–V3:** row y≈90–190, x≈100–350 (three circles)
- **Arganta reference-sheet portrait:** y≈640–800, x≈95–200
- **Lashira profile circles V1–V3:** row y≈90–190, x≈370–630
- **Lashira reference-sheet portrait:** y≈640–800, x≈330–430

Crop with sharp-cli or a tiny Node script into the session scratchpad, upscale ×2 if faces are <200px (`upscale_image` tool), then `media_upload`/`media_import_url` → pass returned media ids in `medias:[{value, role:'image'}]`. Use **2–3 refs per generation** (best profile circle + reference-sheet portrait).

## 3 · ARGANTA — identity lock (canon from board)

East-Asian man, mid-30s. Short black hair swept back/up. **Groomed short beard + mustache** (defined, not stubble-only, not full). Strong jaw, calm serious eyes, **no smile with teeth** — at most a hint. Medium-athletic. World: night builder-workshop / founder office; **warm gold-amber key light** on charcoal black, faint teal spill allowed. Palette: gold `#e8c15a`, deep gold `#a97e2f`, bronze `#6e5720`, black.

Camera for all three: 85mm look, shallow depth, chest-up, square 1:1, face ~60–70% of frame height, low-key cinematic grade.

### A-1 · NORMAL (face-lock shot — run first)
> Use the reference images as the exact same person. Photorealistic portrait of this East-Asian man in his mid-30s, short black swept-back hair, groomed short beard and mustache, strong jaw, calm confident expression without smiling, wearing a black crew-neck tee. Dark builder workshop at night behind him, warm golden screen light and amber lamps against charcoal black, faint teal accent glow, soft rim light. 85mm lens, shallow depth of field, cinematic low-key grade, square crop, chest-up.

Negative: no toothy smile, no grey hair, no clean-shaven face, no daylight, no white studio backdrop, no tie, no youthful face, no palette drift to blue-dominant.

### A-2 · FORMAL
Refs: **locked A-1 output** + best board circle.
> Same person as the reference images. Photorealistic portrait, tailored black blazer over a black shirt with open collar, luxury wristwatch visible, adjusting his cuff, composed founder presence. Night city office behind him, floor windows with warm gold city bokeh, amber key light, charcoal shadows. 85mm, shallow depth, cinematic grade, square, chest-up.

Negative: as A-1 + no tie, no grey suit, no full-body.

### A-3 · SPICY (max allowable — contextual athletic)
Refs: locked A-1 output + board circle.
> Same person as the reference images. Photorealistic portrait after a late-night training session, athletic build, wearing a dark sleeveless training top with a towel over one shoulder, light sheen of effort, confident calm expression, checking a fitness tracker. Dim home gym meets workshop, warm amber practical lights against dark charcoal, faint teal monitor glow. 85mm, shallow depth, cinematic grade, square, chest-up.

Guardrail: torso context (post-training) — **keep the training top; do not prompt shirtless**. If the output reads as thirst-trap rather than discipline, add "modest framing, focus on face and posture."
Negative: as A-1 + no shirtless, no underwear, no flexing pose at camera, no gym mirror selfie.

## 4 · LASHIRA — identity lock (canon from board)

South/Southeast-Asian woman, late 20s. **Long sleek black hair pulled back** (length visible behind shoulders). Sharp elegant features, defined brows, composed near-neutral expression — no big smile. World: dark AI command room; **cyan-teal holographic key light**, navy falloff, thin cool rim on hair; never warm-dominant. Palette: teal `#39b8c9`, steel `#1f6f8a`, navy `#12303e`, black.

Camera for all three: 50–85mm, chest-up, square 1:1, direct composed gaze, face ~60–70% of frame.

### L-1 · NORMAL (face-lock shot — run first)
> Use the reference images as the exact same person. Photorealistic portrait of this South-Asian woman in her late 20s, long sleek black hair pulled back, sharp elegant features, composed neutral expression, wearing a fitted black technical top. Dark AI command center behind her with cyan-teal holographic displays and streaming data screens, cool teal key light with soft warm skin fill, thin rim light on her hair. 85mm lens, shallow depth of field, cinematic grade, square crop, chest-up.

Negative: no wide smile, no loose glamour waves, no warm golden lighting, no daylight office, no cleavage-focused framing, no palette drift to pink/violet.

### L-2 · FORMAL
Refs: **locked L-1 output** + best board circle.
> Same person as the reference images. Photorealistic portrait in an elegant black evening dress with a high neckline, minimal jewelry, hair pulled back sleek, standing in a dark command room during a high-stakes system decision, large teal holographic display casting cool light across her face, composed authority. 85mm, shallow depth, cinematic grade, square, chest-up.

Negative: as L-1 + no red carpet setting, no strapless-glam styling, no bright event lighting.

### L-3 · SPICY (max allowable — authority, not exposure)
Refs: locked L-1 output + board circle.
> Same person as the reference images. Photorealistic portrait wearing a fitted black technical bodysuit with a subtle collar, athletic elegant silhouette, standing with quiet command as a wall of displays ignites behind her, teal light tracing the contour of the suit, direct eye contact, completely in control of the room. 85mm, shallow depth, cinematic grade, square, chest-up.

Guardrail: the suit is **technical wear, opaque, full coverage** — desirability comes from silhouette, light and gaze. If output over-sexualizes: add "modest neckline, operator posture."
Negative: as L-1 + no latex/fetish styling, no lingerie, no wet-look, no low camera angle up the body, camera treats her as the operator not the object.

## 5 · QA gate (every image, before accepting)

Compare side-by-side with the board refs. ALL must pass:
- [ ] Face geometry + eyes read as the same person as the board
- [ ] Hair exact (Arganta: swept black + beard · Lashira: sleek pulled-back)
- [ ] Wardrobe matches the format spec above
- [ ] Lighting world correct (Arganta gold-on-charcoal · Lashira teal-on-navy)
- [ ] Palette chips visibly present
- [ ] 1:1, chest-up, face 60–70% of frame
- [ ] Spicy only: passes the "discipline/authority, not thirst-trap" read

Fail → change ONE variable → rerun (max 3 attempts per image, then escalate per §8).

## 6 · Post-processing + populate the page

1. Download winners (curl the `rawUrl`) → `apps/hq/public/influencer/`:
   `arganta-normal.png`, `arganta-formal.png`, `arganta-spicy.png`, `lashira-normal.png`, `lashira-formal.png`, `lashira-spicy.png`.
2. Convert each to 640×640 WebP q82 via `npx sharp-cli` (keep PNG originals out of git if >1MB — commit only the WebPs; add PNGs to .gitignore if needed).
3. **Page wiring** (`apps/hq/src/surfaces/influencer/`):
   - Add to the `Creator` type: `looks?: { normal: string; formal: string; spicy: string }` with the public paths for arganta + lashira.
   - Identity card: replace the initial-letter `.inf-portrait` circle with the **Normal** image when `looks` exists (img, `border-radius:50%`, keep the accent ring).
   - Below the identity header add a small **look switcher** — three thumbnails (Normal / Formal / Spicy) that swap the main portrait; label the strip "LOOKS". Keep it inside the existing card, no page scroll (the deck is non-scrollable).
   - Kinney/Bloom/Labz keep the letter portrait until their sets are built.
4. Typecheck (`npx tsc --noEmit` in apps/hq), verify in the browser on the `hq-offline` launch config (deck must stay non-scrollable, both themes), screenshot proof.
5. Commit to **main**: assets + code + any doc updates. Trailer: `Co-Authored-By:` per harness rules.

## 7 · Execution order

1. Crop/upload refs (both characters) → 2. A-1 lock → 3. A-2 → 4. A-3 → 5. L-1 lock → 6. L-2 → 7. L-3 → 8. Post-process → 9. Wire page → 10. Verify + commit.

## 8 · Escalation

- 3 failed attempts on one image → stop, post side-by-side comparison to the founder with what's drifting; suggest switching refs (original PNGs vs board crops) or escalating executor to Opus.
- Credit balance < 20 before starting → report and pause (check `balance` tool).
- Any model refusal on Spicy → use the softer garment fallback in §3/§4; never escalate explicitness.

# AI Influencer — Image Build Plan (v1, pre-generation)

> Goal: regenerate the five creator portraits so they match the **Arganta Creator Studio V1.0** board exactly — same faces, same wardrobe language, same lighting worlds, same palette — then populate the AI Influencer Studio page. **No generation happens until this plan is approved.**

## 0 · Why the first attempt drifted

The first portraits were **text-only prompts** — no reference image was passed to the model, so the faces, palettes and lighting were invented from scratch. The board is the canon; every future generation must be anchored to it.

## 1 · Pipeline (applies to all five)

| Step | What | Tool |
|---|---|---|
| 1 | **Source refs.** Best case: the original 1080×1080 PNGs from the Creator Studio pack (profile V1–V3 + reference-sheet portrait per character). Fallback: crop those regions from the board image — usable but soft (~150px faces), expect 1 extra iteration. | manual / crop script |
| 2 | **Identity generation.** 2–3 refs per character → `nano_banana_pro` (accepts multiple reference images, image-to-image) with the Character Lock prompt below. 1 image per run (free plan = 1 concurrent job). | nano_banana_pro |
| 3 | **QA gate.** Side-by-side vs board: face geometry, hair, wardrobe, palette, lighting each pass/fail. Fail → adjust one variable, rerun. Never batch before the face is locked. | eyeball + checklist |
| 4 | **Freeze.** Winning output becomes that character's **canonical face ref** (replaces board crops for all future generations). | repo `apps/hq/public/influencer/` |
| 5 | **Optional, later: train a Soul** per character (5–20 photos of the locked face, ~10 min) → reusable identity for the whole content pipeline (posts, reels frames). | show_characters(train) |
| 6 | **Populate page.** 512×512 WebP avatars into the Studio deck (portrait slot per character + tab thumbnails). | code change |

**Order:** Arganta → Lashira → Kinney → Bloom → Labz. One character fully locked before starting the next.

**Acceptance rule per portrait:** someone who has only seen the board must say "that's the same person." Specifically: ① face shape + eyes match, ② hair matches, ③ wardrobe is from the character's board wardrobe, ④ background/light is the character's world, ⑤ palette chips present, ⑥ square 1:1, face fills ~60–70% like the board circles.

---

## 2 · ARGANTA — Character Lock (from board)

**What the board actually shows:** East-Asian man, mid-30s, short black hair neatly swept back/up, strong jaw, groomed light beard-stubble (fuller than "light stubble" — defined mustache-goatee line), medium-athletic build. V1–V3 all wear **black**: crew tee, blazer-over-tee, and open blazer/vest variants. World = dark builder workshop / night city office, **warm gold-amber key light from screens/lamps against near-black charcoal**, subtle teal spill in some frames. Serious, composed expression — no smile wider than a hint.

- **Palette (board chips):** gold `#e8c15a`, deep gold `#a97e2f`, bronze-brown `#6e5720`, charcoal/black base
- **Lighting:** warm tungsten-gold key from lower-left screens, soft rim, deep black falloff; cinematic contrast
- **Camera:** 85mm portrait, f/2 depth, chest-up, eyes to lens, slight low-key vignette
- **Prompt draft (with 2–3 board refs attached as identity):**
  > Use the reference images as the same person. Photorealistic portrait of this East-Asian man in his mid-30s, short black swept-back hair, groomed short beard and mustache, strong jaw, calm confident expression, wearing a black crew-neck tee under an open black blazer. Dark builder-workshop at night behind him, warm golden screen-light and amber lamps against charcoal black, faint teal accent glow. 85mm lens, shallow depth of field, cinematic low-key grade, square crop, chest-up.
- **Negative:** no smile with teeth, no grey hair, no suit tie, no bright/daylight background, no clean studio backdrop, no youthful face
- **V1/V2/V3 variants (after face lock):** V1 black tee · V2 black blazer, closer crop · V3 open collar + vest, slight angle

## 3 · LASHIRA — Character Lock (from board)

**What the board shows:** South/Southeast-Asian woman, late 20s–early 30s, long straight **black hair pulled back sleek** (visible length behind shoulders in some frames), sharp elegant features, defined brows, composed near-neutral expression. Black fitted top / black technical wear in all three. World = dark AI command room, **cyan-teal holographic light**, monitors and data surfaces; her key light is cool teal-blue with soft warm skin fill.

- **Palette (board chips):** teal `#39b8c9`, steel blue `#1f6f8a`, deep navy `#12303e`, black base
- **Lighting:** teal-cyan hologram key from screens, thin cool rim on hair, dark navy falloff — never warm-dominant
- **Camera:** 50–85mm, chest-up, direct composed gaze, minimal expression
- **Prompt draft:**
  > Use the reference images as the same person. Photorealistic portrait of this South-Asian woman in her late 20s, long sleek black hair pulled back, sharp elegant features, composed neutral expression, wearing a fitted black technical top. Dark AI command-center behind her with cyan-teal holographic displays and data screens, cool teal key light with soft skin fill, thin rim light on hair. 85mm lens, shallow depth, cinematic grade, square crop, chest-up.
- **Negative:** no big smile, no loose flowing glamour hair, no warm golden lighting, no office daylight, no cleavage-focus framing
- **V1/V2/V3:** V1 sleek pull-back + black top · V2 hair over one shoulder, engineering jacket · V3 closer crop, hologram reflections in eyes

## 4 · KINNEY — Character Lock (from board)

**What the board shows:** East-Asian woman, mid-20s, **long dark-brown hair with soft curtain bangs/fringe**, warm open face, gentle genuine smile (soft, not laughing), delicate features. Wardrobe: black slip top in profiles; whites/creams in feed. Her world is **lifestyle**: cafés, city windows, golden light — but the board's profile circles are still the dark-cinematic house style with a **violet-mauve** cast around warm skin.

- **Palette (board chips):** lavender `#b58ae8`, violet `#8a5fd0`, deep plum `#4a2d73`, warm skin tones
- **Lighting:** soft beauty key, warm skin, violet-mauve ambient wash in background bokeh (city night / café lights)
- **Camera:** 50mm, chest-up, slight head tilt, gentle smile, eyes to lens
- **Prompt draft:**
  > Use the reference images as the same person. Photorealistic portrait of this East-Asian woman in her mid-20s, long dark-brown hair with soft curtain bangs, warm gentle smile, delicate features, wearing an elegant black slip top with thin straps. Evening city-café bokeh behind her with violet and warm lights, soft beauty lighting, warm skin against a cool violet ambient wash. 50mm lens, shallow depth, film-like grade, square crop, chest-up.
- **Negative:** no blonde/light hair, no heavy makeup, no laughing open mouth, no daylight flat lighting, no studio white backdrop
- **V1/V2/V3:** V1 hair down + bangs · V2 slight profile turn, softer smile · V3 warmer café key, hair tucked one side

## 5 · BLOOM — Character Lock (from board)

**What the board shows:** woman in her mid-20s with **long wavy golden-blonde hair**, bright open expression (the most smiley of the five), soft rounded features, idol-glam styling. Wardrobe: pink/floral slip tops, playful. World = **pink RGB gaming room / fantasy**: hot-pink and magenta neon key, purple secondary, glowing setup bokeh.

- **Palette (board chips):** blush `#f2a7c3`, hot pink `#e86cb0`, magenta-plum `#a2346f`, deep rose
- **Lighting:** pink-magenta RGB key + violet fill, glossy idol finish, glowing bokeh from screens/LEDs
- **Camera:** 50mm, chest-up, bright engaged expression, high polish
- **Prompt draft:**
  > Use the reference images as the same person. Photorealistic portrait of this young woman in her mid-20s with long wavy golden-blonde hair, bright playful expression with a soft smile, idol-grade glam styling, wearing a pink floral slip top. Pink and magenta RGB gaming-room glow behind her with violet accents and glowing bokeh. 50mm lens, shallow depth, crisp editorial finish, square crop, chest-up.
- **Negative:** clearly adult only — nothing youth-coded or school-styled, no dark moody grade, no teal/blue dominant light, no heavy cosplay armor
- **V1/V2/V3:** V1 hair down waves · V2 half-up style, brighter smile · V3 fantasy-violet backlight variant

## 6 · LABZ — Character Lock (from board)

**What the board shows:** East-Asian man, early–mid 20s, **black rectangular glasses** (defining feature), neat short black hair with light fringe, slim build, faint smart grin. Wardrobe: dark jacket/overshirt over tee, casual technical. World = **blue-violet neon lab**: monitors, rigs, experiment gear; cool blue key with violet secondary.

- **Palette (board chips):** azure `#4c8ce8`, royal blue `#2f5fb8`, indigo `#22346e`, near-black navy
- **Lighting:** cool blue monitor key, violet rim, documentary-crisp but still cinematic dark
- **Camera:** 50mm, chest-up, slight grin, glasses catching a faint screen reflection
- **Prompt draft:**
  > Use the reference images as the same person. Photorealistic portrait of this East-Asian man in his early 20s wearing black rectangular glasses, neat short black hair with a light fringe, slim build, faint confident grin, wearing a dark utility jacket over a tee. Blue-violet neon laboratory behind him with monitors and experiment rigs, cool blue key light and violet rim. 50mm lens, shallow depth, crisp cinematic grade, square crop, chest-up.
- **Negative:** no round or rimless glasses, no beard, no warm golden grade, no formal suit, nothing youth-ambiguous — clearly adult
- **V1/V2/V3:** V1 jacket + tee · V2 closer crop, screen reflection in glasses · V3 slight angle, holding small device

---

## 7 · Execution checklist (when approved)

1. [ ] Get identity refs — **ask founder for the original Creator Studio PNGs**; else crop the board (script: 5 × 3 profile circles + 5 reference-sheet portraits).
2. [ ] Arganta: refs → nano_banana_pro → QA gate → freeze canonical face.
3. [ ] Repeat for Lashira, Kinney, Bloom, Labz (sequential — 1 concurrent job on free plan).
4. [ ] Convert winners → 512×512 WebP → `apps/hq/public/influencer/`.
5. [ ] Wire portraits into InfluencerStudio (identity card portrait + colored tab avatars).
6. [ ] Later: 5 Souls trained from locked faces for the full content pipeline.

**Cost note:** nano_banana_pro is pricier per image than soul_2 — preflight with `get_cost` before the first run; expect ~2 attempts per character to pass QA (≈10 generations total for the lock pass).

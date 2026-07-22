# Higgsfield Sovereign Punchlist — COMPLETE

**Single source of truth** for every Higgsfield deliverable, its real cost, and its status.
Feeds → HTML tracker → Command Center `MCP` subtab. Add future MCPs as new sections.

_Last updated: 2026-07-22_

---

## 0. Account reality (check before every batch)

| Field | Value | Note |
|---|---|---|
| Plan | `free` | ~5.4 credits (after 2 proof renders) |
| Trial | ⏳ not activated | **1-day (24h) UNLIMITED** access to top 23 models |

### ⚡ How the trial actually works (this drives everything)
- **UNLIMITED generations for 24h — NOT a credit grant.** No credit meter during the trial.
- **Relaxed mode = 1 image + 1 video generating at a time** → two parallel lanes, each serial.
- **The binding constraint is TIME/throughput, not cost.** The **video lane is the scarce resource** (~5–8 min/clip). Never let it idle.
- Top models unlocked: Nano Banana Pro (2K), Seedream 5.0 Pro, Kling 3.0 + Motion Control, Seedance 2.0, FLUX.2 Pro, Eleven v3, etc. → **use the best, it's free.**
- **Billing:** $0 today (valid card required). Auto-renews to **Plus $49/mo at July 23, 08:19 local** unless cancelled. Cancel: Manage Account → Subscription → Cancel renewal (keeps unlimited until trial ends). ⚠️ **Set a reminder to cancel before 08:19 Jul 23.** (Founder action — not automatable.)

### Real costs — for POST-TRIAL / paid reference only (irrelevant during unlimited trial)
| Op | Model | Credits |
|---|---|---|
| Image 2K | `nano_banana` + Element | 2.0 |
| Image (trained Soul) | `soul_2` + soul_id | 0.12 |
| Image upscale → 4K | `upscale_image` | 2.0 |
| Video 5s — identity | `seedance_2_0` | 22.5 |
| Video 5s — multishot | `kling3_0` | 10 |
| Video 5s — fast | `kling3_0_turbo` | 7.5 |
| 3D mesh (base) | `image_to_3d` | 20 (texture/rig extra) |

The ~1,130 cr rollup below = the value of the full scope. On the trial it costs **$0**; the credit numbers only matter for what you make *after* the trial on free/paid plans.

---

## 1. The build seam (what the trial delivers vs. what gets coded)

| 🟣 Higgsfield makes the ASSET | ⚙️ Code builds the PRODUCT (me, $0, anytime) |
|---|---|
| 3D meshes (GLB), textures, hero renders, cinematic films, sprites | Live reactor, interactive 3D web, app components, deployed website that consume the assets |

Higgsfield can't hand you a running reactor — it hands you the mesh + films + texture maps, and I wire them into `apps/hq`.

---

## 2. Capability checklist (scope of the tool)

- **Identity:** Reference Element (instant, 0 cr) · Soul training (5–20 imgs, reusable, 0.12 cr/img after)
- **Images:** generate_image · outpaint · remove_background · upscale_image
- **Video:** generate_video · motion_control · reframe · upscale_video
- **3D:** image_to_3d · multi_image_to_3d · 3d_rigging (+animation)
- **Audio:** generate_audio · create_voice · voice_change · dubbing
- **Studios:** marketing_studio · shorts_studio · explainer_video · personal_clipper
- **Analysis:** virality_predictor · video_analysis
- **Web:** create_website → deploy_website
- **Audit:** job_display · balance · transactions

---

## 3. Master delivery — all tracks

Seam key: 🟣 Higgsfield asset · ⚙️ code (me) · 🟣→⚙️ asset feeds code.
Tier key: 🔥 premium-only (make on trial) · 💧 cheap/anytime.

### Track A — 5 AI Influencers (photoreal, reusable)
Identity canon = the 5 reference sheets (2026-07-22). Pipeline: Ref sheet → Element → renders → Soul → upscale → repo.
| Persona | Demo · stream | Status |
|---|---|---|
| BLOOM | Caucasian ♀ · woman | **PROOF ✅** |
| ARGANTA | SE-Asian ♂ · man | **PROOF ✅** ⚠ real-twin canon |
| LASHIRA | S-Asian ♀ · woman | queued |
| KINNEY | E-Asian ♀ · woman | queued |
| LABZ | E-Asian ♂ · man | queued |

| Item | Model | Qty | cr/ea | Total | Tier |
|---|---|---|---|---|---|
| Identity Reels (5s) | seedance_2_0 | 5 | 22.5 | 112.5 | 🔥 |
| Fast Reels (5s) | kling3_0_turbo | 10 | 7.5 | 75 | 🔥 |
| Video upscale (hero reels) | upscale_video | 5 | ~6 | ~30 | 🔥 |
| Reframe → 9:16/1:1/16:9 | reframe | 10 | ~2 | ~20 | 🔥 |
| Scene sets (5 ea) | nano_banana | 25 | 2 | 50 | 💧 |
| 3 canonical looks | nano_banana | 15 | 2 | 30 | 💧 |
| Upscale image winners → 4K | upscale_image | 20 | 2 | 40 | 💧 |
| **Subtotal** | | | | **~357** | |

### Track B — Arganta.ai corporate branding
Endorsed house: master Arganta + Life/Energy/Studio sub-brands. AI = iconography + brand-world + hero; wordmark vectorized in-repo.
| Item | Model | Qty | cr/ea | Total | Tier |
|---|---|---|---|---|---|
| Corp hero + 3 sub-brand loops | kling3_0 | 4 | 10 | 40 | 🔥 |
| Brand-world + sub-brand visuals | nano_banana | 14 | 2 | 28 | 💧 |
| Monogram / icon concepts | nano_banana | 10 | 2 | 20 | 💧 |
| OG / social cards | nano_banana | 4 | 2 | 8 | 💧 |
| Brand voices + music + landing | create_voice/audio/website | — | — | tbd | 🎙🌐 |
| **Subtotal** | | | | **~96** | |

### Track D — 3D assets *(selective — 20 cr each)*
| Item | Model | Qty | cr/ea | Total | Seam |
|---|---|---|---|---|---|
| Arganta 3D monogram mesh | image_to_3d | 1 | 20 | 20 | 🟣→⚙️ |
| App mascot meshes | image_to_3d | 3 | 20 | 60 | 🟣→⚙️ |
| Product / prop meshes | image_to_3d | 2 | 20 | 40 | 🟣 |
| *(optional)* Persona 3D busts | image_to_3d | 5 | 20 | (100) | 🟣 |
| **Subtotal** | | | | **~120** | |

### Track E — 3D Reactor *(fancier)*
| Item | Model | Qty | cr/ea | Total | Seam |
|---|---|---|---|---|---|
| Reactor core 3D mesh (textured) | image_to_3d | 2 | ~25 | 50 | 🟣→⚙️ |
| Reactor cinematic hero films | kling3_0 | 3 | 10 | 30 | 🔥 |
| 7-layer concept + emissive renders | nano_banana | 10 | 2 | 20 | 🟣→⚙️ |
| Reactor turntable loop (web) | kling3_0_turbo | 2 | 7.5 | 15 | 🔥 |
| **Fancier reactor build in HQ** | code | — | — | 0 | ⚙️ |
| **Subtotal** | | | | **~115** | |

### Track F — Website materials
| Item | Model | Qty | cr/ea | Total | Seam |
|---|---|---|---|---|---|
| Section ambient loops | kling3_0_turbo | 6 | 7.5 | 45 | 🔥 |
| Hero backgrounds (4K) | nano_banana | 6 | 2 | 12 | 🟣 |
| Texture / pattern library | nano_banana | 8 | 2 | 16 | 🟣 |
| OG cards + favicon set | nano_banana | 8 | 2 | 16 | 🟣 |
| **Landing build + deploy** | code / create_website | 1 | — | 0 | ⚙️ |
| **Subtotal** | | | | **~89** | |

### Track G — App components (×5 ArgantaLife apps)
| Item | Model | Qty | cr/ea | Total | Seam |
|---|---|---|---|---|---|
| App icon / store art | nano_banana | 15 | 2 | 30 | 🟣 |
| Empty-state / achievement art | nano_banana | 15 | 2 | 30 | 🟣 |
| Onboarding / hero illustration | nano_banana | 10 | 2 | 20 | 🟣 |
| Splash / loading art | nano_banana | 5 | 2 | 10 | 🟣 |
| **Wire assets into components** | code | — | — | 0 | ⚙️ |
| **Subtotal** | | | | **~90** | |

### Track H — Interactive 3D web + Cosmic/Scientific system = ArgantaEnergy language
| Item | Model | Qty | cr/ea | Total | Seam |
|---|---|---|---|---|---|
| Cosmic/energy ambient web loops | kling3_0_turbo | 4 | 7.5 | 30 | 🔥 |
| Atom / orbital renders + 1 atom mesh | nano_banana + image_to_3d | 4+1 | 2/20 | 28 | 🟣→⚙️ |
| Energy-field / plasma / flow textures | nano_banana | 8 | 2 | 16 | 🟣→⚙️ |
| Subsurface / reservoir / seismic visuals | nano_banana | 8 | 2 | 16 | 🟣 |
| Galaxy / nebula backgrounds (4K) | nano_banana | 6 | 2 | 12 | 🟣 |
| Particle sprite sheets | nano_banana | 6 | 2 | 12 | 🟣→⚙️ |
| **Interactive 3D web (galaxy/atom/reactor pages)** | code · Three.js/R3F | — | — | 0 | ⚙️ |
| **Subtotal** | | | | **~114** | |

### Track I — Cinematic Launch films (4 × ≤3 min)
Concept vault: `docs/arganta-design-system/` (Obsidian, wikilinked). Films: Arganta.ai · ArgantaLife · ArgantaEnergy · ArgantaStudio. Each = mostly REAL footage + reused reactor splash/outro (Track E) + creator clips (Track A) + energy/cosmic b-roll (Track H). Incremental Higgsfield spend below.
| Item | Model | Qty | cr/ea | Total | Tier |
|---|---|---|---|---|---|
| Extra cinematic b-roll shots | kling3_0 | 12 | 10 | 120 | 🔥 |
| Music stems / VO polish | generate_audio / create_voice | — | — | ~tbd | 🎵 |
| Reframe 4 masters → 9:16/1:1 + teasers | reframe | 12 | ~2 | ~24 | 🔥 |
| **Edit / assembly** | ArgantaStudio / Higgsfield edit | — | — | 0 | ⚙️ |
| **Subtotal (incremental)** | | | | **~150** | |

### Track C — Infrastructure (code, 0 cr)
- [ ] `higgsfield-tracker.html` (KPIs, checklist, asset table, cost audit)
- [ ] Command Center `MCP` subtab (Higgsfield first card; extensible)
- [ ] Design tokens package (`@arganta/design-tokens`) — the "build once" root (see `docs/arganta-design-system/Design-Language.md`)

---

## 4. Grand rollup

| Track | Credits |
|---|---|
| A · Influencers | ~357 |
| B · Corp branding | ~96 |
| D · 3D assets | ~120 |
| E · 3D Reactor | ~115 |
| F · Website materials | ~89 |
| G · App components | ~90 |
| H · Interactive 3D web + Cosmic/Energy | ~114 |
| I · Cinematic Launch films (4) | ~150 |
| J · ArgantaLab avatars — 3D (Higgsfield) | ~264 |
| J · ArgantaLab avatars — pixel (PixelLab, **separate sub**, ~112 gens) | $0 to Higgsfield |
| voices / music / Souls / web-deploy | ~tbd |
| **Named scope (1 variation each)** | **≈ 1,400 cr** |

### Scaling to the 3,000+ trial target
The trial is unlimited, so you over-generate — the named scope is the floor, not the goal:
| Multiplier | Effect | Running cr-equiv |
|---|---|---|
| Named scope × 1 | one of each | ~1,130 |
| **× 3–4 variations** (pick winners) | 3–4 options per hero item | ~3,000–3,800 |
| **+ reserve library** (~130 extra images, extra b-roll) | months of runway | **~4,000–5,000** |

**Trial target ≈ 4,000–5,000 cr-equivalent (~525–1,000 generations) at $0.**

Execution docs:
- `docs/higgsfield/TRIAL-RUNBOOK.md` — the human steps (4 one-time actions)
- `docs/higgsfield/AUTONOMOUS-RUN.md` — the Claude Code driver loop (unattended)
- `docs/higgsfield/TRIAL-RUN-QUEUE.md` — every prompt, ordered (~700 gens, ★ = campaign-core)
- `docs/higgsfield/DESIGN-COHERENCE.md` — anchor-first system: all visuals reference shared Elements/Souls so they "talk to each other"
- `docs/higgsfield/PIXELLAB-RUN.md` — separate dedicated-agent pixel-avatar run (own billing, design-feel locked)
- `docs/higgsfield/RUN.md` — **the one-page end-to-end quickstart** (start here to actually run it)

## 4b. HQ integration map — where every output lands (consistency backbone)

The run stages ALL raw output to `higgsfield-assets/<track>/…`; a later **curate** step copies the picks into the HQ consumer paths. Brand IDs are the WF1 endorsed house (`arganta`, `argantalife`, `argantaenergy`, `argantastudio` + products `kinetikcircle`, `argantalab`, `lashirabloom`, `geavision`) — same registry HQ Brand Studio reads, so nothing drifts.

| Track | Staged to | Curated into HQ | Consumed by |
|---|---|---|---|
| **D2 · Emissaries** (Kin/Volt/Muse flying avatars) | `higgsfield-assets/3d/emissaries/` | `apps/hq/public/3d/emissaries/` + landing | Website guides, app onboarding, films, stickers |
| A · Influencers | `higgsfield-assets/influencer/<persona>/` | `apps/hq/public/influencer/<persona>/` | Influencer Studio (`influencerData.ts`) |
| B · Branding | `higgsfield-assets/brand/<brandId>/` | `packages/brand/brands/<brandId>/assets/` (WF3 slot) | Brand Studio registry (`@arganta/brand`) |
| E · Reactor | `higgsfield-assets/reactor/` | `apps/hq/public/reactor/` | Reactor Builder (`apps/hq/src/reactor`) |
| D/J-3D · Meshes/avatars | `higgsfield-assets/3d/` | `apps/hq/public/3d/` | 3D viewers / avatar surfaces |
| F · Website | `higgsfield-assets/web/` | `apps/landing/public/` (or site repo) | Landing / website |
| G · App components | `higgsfield-assets/apps/<app>/` | `apps/<app>/public/` | each product app |
| H · Cosmic/Energy | `higgsfield-assets/energy/` | `apps/hq/public/energy/` | ArgantaEnergy / GeaVision surfaces |
| I · Films | `higgsfield-assets/films/` | (edit → publish) | Post/Video Studio |
| J-Pixel | PixelLab project | `apps/lashira` / `apps/web` sprites | ArgantaLab games |

**Consistency rule:** the run reads brand facts (names, palette, art-direction) FROM `@arganta/brand` and writes assets BACK to it — one registry, one source of truth, for both the automated flow and HQ.

---

## 5. Trial run plan — THROUGHPUT model (24h, unlimited)

Not a spend plan — a **throughput** plan. Two parallel lanes (1 image + 1 video at a time). Keep both running non-stop; the **video lane is the bottleneck**, so it leads and never idles.

### 3 golden rules
1. **Queue everything BEFORE activating** — the 24h is pure firing, zero thinking (see `TRIAL-RUN-QUEUE`, to build).
2. **Video lane starts on second 1, never stops** — ~95 clips × ~6 min ≈ 10h minimum.
3. **Max quality — it's free** — Nano Banana Pro 2K, Seedream 5.0 Pro, Kling 3.0, Seedance 2.0, Eleven v3.

### 🎬 Video lane (~95 clips, value-ordered — START HERE)
1. Reactor splash + outro + 3 ignitions + energy variant + loop (7) — crown jewels, reused everywhere
2. 3D meshes (reactor core, atom, logo, mascots, props) (~12) — shares this lane
3. Film b-roll — 4 films × ~10 shots (40)
4. Influencer identity reels — Seedance 5×3 (15)
5. Influencer fast reels 5×3 (15)
6. Website + cosmic/energy ambient loops (14)
7. Corp + 3 sub-brand hero films (4)

### 🖼️ Image lane (~450, parallel, never idle)
Influencer looks/scenes/variations (~80) · branding (~40) · reactor 7-layer + material maps (~20) · app components ×5 (~90) · website heroes/textures/OG (~40) · cosmic/energy/subsurface/atoms/particles (~50) · reserve variations (~130).

### 🎙️ Audio + ♻️ Souls
Hour 0: bootstrap 8 imgs/persona → **train 5 Souls** (persist after trial → future images 0.12 cr). Audio: 5 persona voices + corp voice (Eleven v3) + film music stems (~14).

### Timeline
| Window | Video lane | Image lane |
|---|---|---|
| Hr 0 | Reactor splash/outro | Bootstrap personas → train Souls |
| 0–4 | Reactor variants + 3D meshes | Influencer looks/scenes + branding |
| 4–10 | Film b-roll + influencer reels | App components + website + cosmic |
| 10–16 | Ambient loops + hero films | Reserve variations |
| 16–22 | Reframe cuts (finishing) | Upscale winners → 4K |
| 22–24 | Catch stragglers + **download everything** | same |

**Target ≈ 525+ generations ≈ 4,000–5,000 cr-equivalent at $0.** Even at ~12–16 active hrs, ~300–400.

### ⚠️ Two failure modes
- **Download winners to the repo as you go** — don't leave assets stranded on Higgsfield when the day ends.
- **Cancel renewal before 08:19 Jul 23** (unless keeping Plus) — else $49 auto-charges.

### ⚙️ Code is FREE and OFF the clock
The reactor build, interactive 3D web, app wiring, website deploy = my work, $0, anytime — **never spend trial time waiting on code.** The trial is only for generating assets.

---

## 6. Audit ledger (append every real generation)

| # | Date | Track | Item | Model | Credits | USD-eq | Free-pass? | Output |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-07-22 | A | BLOOM proof | nano_banana 2K | 2.0 | tbd | no | job `ca9485f7` |
| 2 | 2026-07-22 | A | ARGANTA proof | nano_banana 2K | 2.0 | tbd | no | job `9a0e9919` |

_Totals: 2 generations · 4.0 credits · balance 9.4 → 5.4_

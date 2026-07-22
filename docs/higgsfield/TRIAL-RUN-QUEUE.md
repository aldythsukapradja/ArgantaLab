# Higgsfield Trial — Run Queue (execution-ready)

The ordered content for the autonomous run (`AUTONOMOUS-RUN.md`). Seeds `queue.json`. Target **~700 generations ≈ 4,000–5,000 cr-equiv at $0**. `★` = campaign_core (front-loaded; enough to launch even if the day is cut short).

## 📊 Content yield — what you actually END with
~700 raw generations resolve into these **finished, publishable pieces**:
| Category | Finished pieces | Detail |
|---|---|---|
| **Influencer reels** (video) | **30** | 5 personas × 6 reels |
| **Cinematic film cuts** (video) | **12** | 4 films × (16:9 master + 9:16 + 15s teaser) |
| **Reactor / hero / ambient loops** (video) | **~25** | splash/outro/variants + web + cosmic + hero films |
| **→ Total finished videos** | **~67** | ×2–3 aspect reframes = **~150–200 platform placements** |
| **Influencer image posts** | **40** | 5 personas × (3 looks + 5 scenes); 4 variations each to pick |
| **Carousels** | **~10** | 5 personas × 2 |
| **Brand / announcement posts** | **~15** | monogram, brand-world, sub-brands |
| **Energy / cosmic posts** | **~15** | galaxy, atoms, subsurface, reactor |
| **→ Total finished posts** | **~80** | |
| Reserve library | ~130 | variations + months of runway |
| App / website assets | ~140 | components (not posts) |
| 3D meshes + avatars | ~9 + roster | see Track D/E/J |
| **The Emissaries** (3 flying workstream avatars: Kin/Volt/Muse) | 3 rigged + animated + 6 flight loops | VB2b |
| Voices + music | 14 | 6 voices + 8 stems |

**Headline: ~67 videos + ~80 posts + ~10 carousels ready to publish** — enough for **weeks of multi-platform campaign** across 5 personas + 3 brands. Per persona ≈ 8 posts + 6 reels + 2 carousels = ~16 pieces = a full launch grid each.

## Locked style (the "one design system" enforcer)
Every image/video prompt appends this suffix so all assets match `docs/arganta-design-system/Design-Language.md`:
```
STYLE = ", cinematic, premium, near-black #0B0D12 ground, {LIGHT} accent glow,
         fresnel rim light, volumetric depth, editorial finish, 2K, photoreal, no text artifacts"
LIGHT:  master=gold #E8B64C · Life=coral #FF7A59 · Energy=blue #2E7CF6/teal #3FB6C9 · Studio=violet #A06CE8
```
Reference sheets (uploaded media_ids): BLOOM `4bf8f56f…`, ARGANTA `e16ac019…`; LASHIRA/KINNEY/LABZ to upload in Phase 0. Persona full capsules live in `apps/hq/src/surfaces/influencer/influencerData.ts` (base + 5 scenes + negatives).

---

## 🎬 VIDEO LANE (~130 clips, top-down; video/3D share the lane)

### VB1 ★ Reactor core — `kling3_0` / `image_to_3d` — 14
Splash (ignite → 7-layer axial bloom), Outro (settle → mark), 3× ignition/explosion variants, Energy-subsurface variant (strata column, drill-down cam), Ambient loop. Each ×2 variations. Prompt base: *"Tony-Stark 7-layer arc reactor, gold core, {LIGHT} outer rings, energy particles, axial bloom, one slow hero camera move"* +STYLE. → `higgsfield-assets/reactor/`
### VB2 ★ 3D meshes — `image_to_3d` — 9
Reactor core ×2 (textured), atom, Arganta monogram, 3 app mascots, 2 props. From the best matching still (generate still first in IB, then convert). → `higgsfield-assets/3d/`

### VB2b ★ The Emissaries — 3 flying workstream avatars (Cognite-style) — ~15 lane slots
One cute flying companion per company, each with the shared gold core-spark + company light (coherence: all reference the Brand Element):
- **Kin** (Life, coral firefly-lantern) · **Volt** (Energy, blue reactor-probe droplet) · **Muse** (Studio, violet origami-spark)
Pipeline per avatar: concept stills ×4 (`nano_banana_2`, image lane, chibi/cute proportions, T-pose + hero pose) → pick → `image_to_3d` mesh (textured) → `3d_rigging` + flight animation (`animation_actions`: fly/hover/idle) → 2 hero flight loops (`kling3_0_turbo`, 5s: greeting orbit + section-guide flight).
→ `higgsfield-assets/3d/emissaries/{kin,volt,muse}/` · Consumed by: website section guides, app onboarding/empty states, film cutaways, stickers.
### VB3 Film b-roll — `kling3_0` — 50
4 films × ~12 hero/transition shots (see `docs/arganta-design-system/Film-*.md` storyboards). Hero shots ×2 var. → `higgsfield-assets/films/{arganta-ai,life,energy,studio}/`
### VB4 ★ Influencer identity reels — `seedance_2_0` (ref = persona sheet) — 15
5 personas × 3 signature scenes (from each capsule), 5s, 9:16. → `higgsfield-assets/influencer/{persona}/reels/`
### VB5 ★ Influencer fast reels — `kling3_0_turbo` — 15
5 personas × 3 more scenes, 5s, 9:16. → same
### VB6 Website + section ambient loops — `kling3_0_turbo` — 12
Master + 3 sub-brand hero loops ×2, section ambients. → `higgsfield-assets/web/loops/`
### VB7 Cosmic / energy loops — `kling3_0_turbo` — 6
Galaxy flythrough, plasma field, seismic shimmer, atom orbit, energy flow, subsurface column. → `higgsfield-assets/energy/loops/`
### VB8 Corp + sub-brand hero films — `kling3_0` — 4
One 5s signature per company (gold/coral/blue/violet). → `higgsfield-assets/films/heroes/`

---

## 🖼️ IMAGE LANE (~560, parallel, never idle)

### IB0 ★ Persona bootstrap (→ Soul training) — `nano_banana_2` (ref = sheet) — 40
5 personas × 8 varied photoreal frames → feed Soul training (SB1). → `higgsfield-assets/influencer/{persona}/bootstrap/`
### IB1 ★ Influencer looks — `nano_banana_2` (ref) — 60
5 × 3 canonical looks (normal/formal/spicy per capsule) × 4 variations. → `.../{persona}/looks/`
### IB2 ★ Influencer scenes — `nano_banana_2` (ref) — 100
5 × 5 capsule scenes × 4 var. Campaign feed content. → `.../{persona}/scenes/`
### IB3 ★ Branding — `nano_banana_2` — 60
Per the WF1 endorsed house (brand IDs `arganta` · `argantalife` · `argantaenergy` · `argantastudio`), reading each brand's palette + `kb.artDirection` from `@arganta/brand`:
- `arganta` (master): monogram concepts ×10, brand-world ×6, icon/favicon ×4, lockups ×4
- `argantalife` / `argantaenergy` / `argantastudio`: key visual ×4 + OG card ×2 + icon ×2 each (×3 = 24)
→ staged `higgsfield-assets/brand/<brandId>/` → curated into `packages/brand/brands/<brandId>/assets/` (WF3 registry slot). The reactor-ring mark stays the fallback until the real mark lands here.
### IB4 Reactor renders — `nano_banana_2` — 20
7-layer cross-sections ×2, emissive/material maps ×6 (for the code build). → `higgsfield-assets/reactor/stills/`
### IB5 App components (×5 apps) — `nano_banana_2` — 80
Per app: icon/store art ×3, empty-state/achievement ×3, onboarding/hero ×2, splash/loading ×2 → 16/app ×5. Apps: KinetikCircle, ArgantaLab, LashiraBloom, HQ, Studio. → `higgsfield-assets/apps/{app}/`
### IB6 Website materials — `nano_banana_2` — 40
Hero backgrounds ×6 (4K), texture/pattern library ×8, OG ×4, favicon set ×4, section stills ×18. → `higgsfield-assets/web/`
### IB7 Cosmic / energy / subsurface — `nano_banana_2` — 50
Galaxy/nebula ×6, atom/orbital ×6, energy-field/plasma ×8, subsurface/reservoir/seismic ×8, particle sprite sheets ×6, strata ×8, misc ×8. → `higgsfield-assets/energy/`
### IB8 Reserve library — `nano_banana_2` / `seedream_v5_lite` — 130
Extra variations across all above (pick-winner surplus + months of runway). Auto-filled when higher-priority image batches drain.

---

## 🎙️ AUDIO (opportunistic, fast) — `eleven_v3` / `generate_audio` — 14
5 persona voices + 1 ARGANTA/corp voice; 8 film music stems (gold/coral/blue/violet × intro/build). → `higgsfield-assets/audio/`

## ♻️ SOULS (Hr 0, persist after trial) — `show_characters(train)` — 5
SB1: train 5 persona Souls from IB0 bootstrap sets (8 imgs each). Enables 0.12 cr/img forever. → tracked in state.

---

## 🕹️ Track J — ArgantaLab Avatars (BOTH options, so you choose the direction)
ArgantaLab ("Grow" — kids learning + KinQuest/LashiraBloom games) needs a player-avatar roster. Two styles generated in parallel on **separate billing** so you compare and pick (or use both — pixel in the 2D games, 3D for profile/AR):

### J-PIXEL — pixel-art avatars · **SEPARATE RUN** → see `PIXELLAB-RUN.md`
Not part of this Higgsfield queue. Runs as its own dedicated PixelLab agent, own subscription/clock, but design-feel-locked to the same tokens. **Excluded from the Higgsfield overnight run.**

### J-3D — 3D character avatars · **Higgsfield** (FREE during the trial, video/3D lane)
- **12 base characters**: concept still (`nano_banana_2`, chibi/heroic proportions) → `image_to_3d` mesh → optional `3d_rigging` + animation. GLB for a 3D avatar viewer / AR / profile. (~12 stills + 12 meshes)
- Diverse roster to match J-PIXEL so the two styles map 1:1. → `higgsfield-assets/3d/avatars/`

**Billing note:** J-PIXEL = PixelLab subscription (independent, plentiful). J-3D = Higgsfield trial (free for 24h). They run on different clocks — pixel avatars are zero-risk to the Higgsfield throughput budget.

---

## Priority / campaign-ready cutline
If the day is short, `★` batches alone = a launchable campaign: **reactor splash/outro (VB1) + all influencer looks/scenes/reels (IB0–IB2, VB4–VB5) + branding (IB3) + 3D meshes (VB2)**. These are front-loaded so they finish by ~Hr 10–12. Everything after `★` is depth + reserve.

## Reframe pass (Phase 3)
All hero videos → 9:16 / 1:1 / 16:9 via `reframe`; all `★` image winners → 4K via `upscale_image`.

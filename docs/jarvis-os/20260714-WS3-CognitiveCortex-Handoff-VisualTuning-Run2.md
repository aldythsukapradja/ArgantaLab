---
title: WS3 Cognitive Cortex — Visual Tuning + Run 2 Handoff (Opus → Sonnet)
date: 2026-07-14
type: spec
project: Jarvis OS
workstream: WS3
status: ready-for-implementation
---

# WS3 Cognitive Cortex — Handoff Spec (Opus analysis → Sonnet implements)

Files: `apps/hq/src/knowledge/**`. Run 1 shipped (commit 68e40436): theme-aware
brain, 7 reactor regions, curved axons, firing sim, Command hub. This spec has
two parts: **(1) visual fixes** the founder asked for, **(2) Run 2** (cinematic
mirroring). Verify blind via the `window.__kg` hook (see [[ws3-knowledge-nodes]]):
`__kg.advance(t)` + `gl.readPixels`; screenshots time out on the headless tab.

---

## Part 1 — Visual fixes (founder feedback: "still concentrated", "long lines back→front")

### Root cause (analyzed)
Both symptoms come from ONE thing: **neurons + tissue sit on a thin cortical
SHELL**, not in a volume.

- `brain.ts corticalPoint(side,u,v)` returns a point on the dorsal SURFACE. Nodes
  (`regionPoint`) and tissue (`corticalTissue`) both use it.
- Each region occupies a narrow anterior→posterior band (`u0..u1`), so a region
  is a thin front-back STRIP → dense regions (Know = 221) clump into a band.
- **The "long lines back→front" = the shell's lateral silhouette.** At high `v`
  (lateral edge) the surface is tangent to the top-down camera, so points pile up
  per screen-pixel and trace a bright rim along the brain contour; across regions
  (u back→front) that rim is coloured green→violet→cyan = the streaks the founder
  sees. The small ±jitter isn't enough to hide it.

### Fix: fill the hemisphere VOLUME (kills both problems at once)
Rewrite `regionPoint` and `corticalTissue` to distribute points THROUGH the
hemisphere lobe (depth in Y and inward X), not on a 2-D surface. A solid lobe has
no sharp silhouette edge → no rim lines; and the volume spreads dense regions out.

**`regionPoint(id, region, hemi)` — new placement (keep `command` as the deep
central cluster; volume-fill the other 6):**
```
// front→back Z from the region band, with soft overlap into neighbours (±5%)
const zt = lerp(region.u0 - 0.05, region.u1 + 0.05, hb)      // hb = hash
const z  = (zt - 0.44) * 2 * BRAIN.length
// ellipsoid taper: how wide/tall the lobe is at this z (0 at poles, 1 mid)
const wf = pow(sin(PI * clamp(zt*0.86+0.09, 0, 1)), 0.72)
// lateral fill medial→lateral (sqrt biases outward for cortex density but FILLS)
const lat = (0.12 + sqrt(hc) * 0.88) * BRAIN.width * (0.35 + 0.65*wf)
const x = side * (BRAIN.hemiGap*0.6 + lat)
// dorsal-ventral DEPTH fill — this is the key line that removes the rim
const maxY = BRAIN.height * (0.45 + 0.55*wf) * (1 - lat/(BRAIN.width+0.001)*0.4)
const y = (hd - 0.5) * 2 * maxY + gyralNoise*0.5 - 0.2
```
- Sense: bias `lat` toward the outer 30% AND spread across all `z` (unchanged
  intent) but still volumetric in Y so its lone node isn't a floating dot.
- Remove the big post-hoc ±1.5 jitter (the volume fill replaces it); a small
  ±0.25 gyral wobble is fine.

**`corticalTissue(count)` — same volumetric fill** (reuse the formula above with
random z/lat/y). Tissue must fill the lobe, not the shell, or the rim line stays.
Bump `count` to ~16000 for a dense body. Colour by which region owns `zt`
(reuse `regionForUV`, keyed on `zt` = front-back only now, plus `lat>0.9 → sense`).

### Node size (founder: "circles too big")
`model.ts`: cap smaller + flatten degree influence so NO node is a balloon:
```
r: 0.10 + Math.min(0.10, Math.sqrt(deg) * 0.028)   // ~0.10–0.20
```
Heroes: `Math.max(r, 0.2)` (label + ring carry the emphasis, not size).

### Sparser feel
- The volume fill already spreads them. If still dense, lower tissue opacity a
  touch and reduce node count shown by hiding orphan/degree-0 notes behind a
  toggle (optional).
- Keep the fissure clear: ensure `x` never crosses 0 (the `side * (gap*0.6+lat)`
  guarantees it).

### Acceptance (Part 1)
Volumetric brain (no silhouette rim lines), neurons spread evenly through both
lobes, small uniform-ish dots, clear central fissure, litPct ~20–35% dark.
Re-verify in BOTH themes (`hq_theme` = light|dark). Bump `LAYOUT_KEY` → `_v3`
(discards saved shell positions).

---

## Part 2 — Run 2: cinematic mirroring (the brain lights up with the narration)

Goal: when the cinematic plays, the mapped brain region(s) activate in sync with
the audio. The brain only REACTS to a `SceneState` — it never reads audio.

### Contract (mock seam)
Create `knowledge/contract.ts` mirroring the reactor's `SceneState`
(`apps/hq/src/reactor/contract.ts`) — same shape so brain ⇄ reactor ⇄ cinema
speak one language. Fields the brain uses: `state` (CoreState), `intensity`
(0..1 audio envelope), `sceneId` ("4.2"), `focusProduct`. Add
`scene: SceneState | null` + `setScene` to `knowledge/store.ts`.

### `knowledge/activation.ts` — CoreState → region activation
Return `Record<RegionId, number>` (0..1) from the scene. Base mapping by
`state` (from the reactor CoreState enum), scaled by `intensity`:

| CoreState | Regions lit |
|---|---|
| `booting` / Act I | `command` (ignite) → ramp all |
| `think` (Act IV.2, VI) | command + think |
| `know` (Act IV.3, V.2, VI.3) | know + sense |
| `do` (Act IV.4, V.3, VI.5) | orchestrate + act + experience |
| `product-focus` (Act III) | experience (+ use `focusProduct`) |
| `vault-entry` (Act V enter) | know (+ camera push toward Know anchor) |
| `architecture-unfold` | all 7 bloom |
| `return` / `idle` (Act VII) | resting whole-brain firing |

Optional fine per-`sceneId` overrides for Act V spine trace
(5.1 command → 5.2 know → 5.3 orchestrate→act→experience) and Act VI proof sweep.
Cross-checked against `docs/…-NarrativeStudio-SceneManifest.md` (46 scenes) and
`reactor/model/layers.ts` — the 7 regions ARE the reactor spine, so this map is
consistent across all three surfaces.

### Wire into the scene
- `Neurons` firing loop: replace the ambient THINK→KNOW→DO sweep with
  `activation[region]` when `store.scene` is present (fall back to ambient when
  null). Active region → boost brightness + firing rate by `intensity`.
- Command-Core hub pulses harder on high `intensity`.
- `CameraRig`: on `vault-entry` frame the Know anchor; on `product-focus`/region
  states frame that region; on `return`/`idle` return to overview (deterministic).

### MockDirector (dev) + chrome toggle
`knowledge/mockDirector.ts`: steps through the 46 scenes on a timer (stand-in for
the audio clock), emitting `SceneState` into the store. Add a **"Cinematic"**
toggle next to "Firing" that starts/stops it, with a caption strip showing the
current act/scene idea. When WS1's real Director exists it emits the same
`SceneState` — swap the source, delete the mock. One seam.

### Acceptance (Part 2)
Running the MockDirector: regions light in the documented order through Acts
I→VII, brightness tracks `intensity`, camera moves on vault-entry/return, and it
returns cleanly to resting. Two full cinematic passes with no drift.

---

## Order for Sonnet
1. Part 1 volumetric fill + node size (visual, founder-blocking) → verify both themes → commit.
2. Part 2 contract + activation + wiring + mock director → verify 2 passes → commit.
Small module-scoped commits to main, pull before push.

# ArgantaStudio — Concept Hardening Plan

**Gap analysis of the Open-Generative-AI base (apps/studio) vs Higgsfield-grade, and the plan to close it.**
*2026-07-21 — conceptualization phase, nothing built yet. Base repo audited at v2.0.0 (MIT, cloned & de-gitted into apps/studio).*

---

## 0. Name decision: **ArgantaStudio**

`ArgantaForge` collides with the entire existing Forge family — Builder v2 **Forge** (`surfaces/forge`), Character **Forge**, Skill **Forge**, Pixel **Forge** — all of which mean "builder/maker of app-things." This product is a *media creation studio*; Studio is the honest noun and matches Higgsfield's own framing. One cleanup implied: the old "Arganta Studio v2" game-engine wizard gets renamed (candidate: **Game Forge**, joining the Forge family where it belongs).

## 1. What the base repo gives us (keep)

- 17 studio surfaces (Image, Video, Cinema, LipSync, Audio, Recast, VibeMotion, AI-Influencer, Marketing, Workflow, agents) in a shared React component library (`packages/studio`).
- `models.js` — a single-source-of-truth catalog pattern for 200+ models. The *pattern* is the asset, not the entries.
- Submit-and-poll generation client with CORS proxy pattern (`muapi.js` → Next `/api` routes).
- Reference-image conditioning (up to 14 refs), draw-on-image modal, upload picker.
- MIT license, clean component separation, active upstream to cherry-pick from.

## 2. Gap analysis (verified in code, not from README)

| # | Gap | Evidence in repo | Higgsfield has | Severity |
|---|-----|------------------|----------------|----------|
| G1 | **No persistence layer** — all history/library is browser `localStorage` (30 call sites across studio components). Clear cache = lose everything; no cross-device, no backup | `grep localStorage` → 30 hits; zero DB/Supabase/Prisma anywhere | Cloud asset library, permanent generations | **P0** |
| G2 | **Single-vendor engine room** — every generation hardwired to Muapi.ai with an API key; no provider abstraction, no fallback | `muapi.js` BASE_URL, all studios import it | Own multi-model backend | **P0** |
| G3 | **No job model** — fire-and-poll in component state; refresh mid-generation = orphaned job; no queue, no retry/backoff, no run ledger, no cost tracking | zero queue/retry code in `packages/studio` | Job history, credits ledger | **P0** |
| G4 | **No identity/character consistency** — nothing like Higgsfield **Soul** (persistent character across generations). Refs are per-request only | no character/identity store | Soul ID: train once, reuse everywhere | **P1 — the differentiator** |
| G5 | **Empty workspaces** — Workflow builder, Poe agents, Design agent are git submodules that ship empty; `npm run build:packages` fails | `packages/{Vibe-Workflow,Open-Poe-AI,Open-AI-Design-Agent}/` = 0 entries | n/a | **P0 (blocks boot)** |
| G6 | **No draft→final quality ladder** — one-shot generation at full price; no cheap-preview-then-upscale flow | no tiering in submit path | Preview → upscale/enhance pipeline | **P1** |
| G7 | **No brand/style memory** — prompts start from zero each time; no style recipes, no brand kits | no presets store beyond camera params | Style presets, motion presets library | **P1** |
| G8 | **Cinema grammar is shallow** — CinemaStudio exposes lens/aperture fields but no *compiled* camera language (movement arcs, shot sequencing) | CinemaStudio.jsx = param form | 50+ named camera motions (crash zoom, dolly, whip pan…) | **P1** |
| G9 | **No pipeline/output side** — generations dead-end in the browser; no publish, no post-processing chain | no export/publish integration | Export, socials-ready formats | **P2** |
| G10 | **No auth / multi-user / entitlements** — anyone with the URL generates on your key | no auth anywhere in `app/` | Accounts, credits, plans | **P2** |
| G11 | **Test coverage ≈ Electron only** — 4 test files, all local-inference path utils; zero tests on studios, client, or model catalog | `tests/` listing | n/a | **P2** |
| G12 | **Local inference lives only in the Electron fork** — the web app has no local path; and sd.cpp/Wan2GP ≠ your hardware reality | `src/`+`electron/` tree separate from `app/` | n/a (cloud-only) | **P1** |

## 3. Hardening plan — how ArgantaLab closes each gap

The theme: **the repo is a face without a body.** ArgantaLab already owns the body — Supabase, media-core, ComfyUI fabric, Cloudflare workers, camera grammar, Soul ID pipeline. Hardening = grafting the face onto the body.

### Phase A — Foundation (P0, makes it real)
- **A1. Boot & slim**: strip empty submodule workspaces from `package.json`, delete the Electron/Vite fork (`src/`, `electron/`, vite config), get `next dev` clean. Full rebrand: ArgantaStudio name, HQ design language, kill upstream branding/telemetry.
- **A2. Provider Fabric (kills G2, G12)**: replace `muapi.js` with a provider adapter interface aligned to the four-tier router (costClass 0–3): **ComfyUI** (Sovereign, local SD1.5 — images at $0) → **Cloudflare Workers AI** (Economy, already live) → **fal.ai** (Frontier, video/premium, approval-gated) → Muapi as optional BYO-key tier. `models.js` schema gains `provider` + `costClass` fields; catalog trimmed from 200 aspirational models to the ~20 that actually run on our tiers, each verified.
- **A3. Runs & Library (kills G1, G3)**: Supabase-backed `studio_runs` (job ledger: params, provider, cost, status, retry count) + `studio_assets` (R2/Storage bytes, DB metadata — bytes never in Postgres). One `useRunner()` hook replaces the 17 copies of fire-and-poll; survives refresh, resumable polling, per-run cost recorded. localStorage stays only as offline cache.

### Phase B — The moat (P1, what makes it "Higgsfield-grade")
- **B4. Soul layer (kills G4)**: first-class **Characters** — persistent identity entities (seed images + LoRA ref + trigger tokens) usable from any studio. Direct graft of the existing Soul ID pipeline (SD1.5 LoRA + IP-Adapter on ComfyUI) and Video Studio's Soul keyframe→i2v flow. This is the feature that makes it a Higgsfield clone rather than a model frontend.
- **B5. Camera Grammar (kills G8)**: port the `cameraGrammar` prompt compiler into CinemaStudio — named motions library (crash zoom, dolly-in, orbit, whip pan…) compiled into provider-specific prompt/param payloads, instead of raw lens fields.
- **B6. Quality ladder (kills G6)**: every generation defaults to cheapest capable tier (T0 draft on ComfyUI/CF); explicit **Polish** action re-runs/upscales on the paid tier — the Content OS draft→approve→polish ladder, now inside the studio.
- **B7. Style memory (kills G7)**: Style Recipes (Post Studio pattern) — save prompt+params+refs as named recipes; brand kits per Arganta brand feeding default styles.

### Phase C — Product finish (P2)
- **C8. Publish seam (kills G9)**: outputs push to Content Builder / Buffer pipeline and Kinetik moments — reuse the live arganta-core-content worker.
- **C9. Gate & ledger (kills G10)**: HQ-internal first (no public auth), but per-run cost ledger from A3 rolls up into CAPO/CFO reporting; entitlements only when it ever goes multi-user.
- **C10. Battle tests (kills G11)**: test the fabric adapter + runner + grammar compiler; a 20-task battle checklist per studio surface before calling any surface "shipped."

## 4. Sequencing & gates

```
A1 boot+rebrand → A2 provider fabric → A3 runs+library   ★ GATE: real gen through all 3 tiers, run persisted
→ B4 Soul characters → B5 camera grammar → B6 ladder → B7 recipes   ★ GATE: same character, image+video, drafted then polished
→ C8 publish → C9 ledger rollup → C10 battle tests
```

Rule carried over from the energy reset: each ★ gate gets founder sign-off before the next phase starts.

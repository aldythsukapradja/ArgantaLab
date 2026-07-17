---
title: The Fitting Room — Brand Kit Build Handoff
product: Circle HQ
type: handoff
status: shipped
version: 2.0
tags: [brand, brand-studio, brand-kit, platforms, handoff]
date: 2026-07-17
owner: Aldyth
implementation_owner: Opus (BK-2..BK-4) · Sonnet (BK-0, BK-1, BK-5)
confidence: high
---
# The Fitting Room — every platform, worn live

> **SHIPPED 2026-07-17.** BK-0..BK-5 all built and verified live. Files:
> `packages/brand/src/kit.js` (PLATFORM_KIT + kitStatus, 51 tests green) ·
> `apps/hq/src/surfaces/brand/{Branding,replicas,compose}.tsx|ts`.
>
> **What the surface caught on day one.** The first time a human opened EDIT on
> Instagram, the char counter read `32/30`: ArgantaLab's display name
> ("ArgantaLab · Play, Learn & Build") has been 2 chars over Instagram's limit
> the whole time. `registry.js`'s `matrix()` validates handle and bio but never
> `name`, so nothing was counting. `name` is now a kit asset for
> Instagram/LinkedIn/YouTube/X, the rack flags it (`! 2 over the 30 limit`,
> Instagram 8/9), and a regression test pins it. **Founder action: shorten that
> name** — the test's second assert is meant to be deleted when you do.
>
> **Three real bugs found by verifying rather than assuming:**
> 1. *Splash flash* — `useState(1)` painted one frame of the FINISHED splash
>    before rAF's first tick reset it to 0. Now lazily seeded (0 to animate, 1
>    under reduced motion) so the first paint is already correct.
> 2. *Silent copy failure* — `navigator.clipboard.writeText` rejects with
>    `NotAllowedError` without focus/activation, and `copyText` had no catch: the
>    operator clicked COPY and got nothing at all. Now `copyPlainText()` falls
>    back to `execCommand` and reports `COPY BLOCKED` when both fail.
> 3. *Rack duplication* — a ready raster's note IS its dimensions, so the row
>    read "320×320 · 320×320". Note now prints only when it carries news.
>
> **Verification gotcha (documented, cost ~15 min):** the preview pane runs at
> `visibility: hidden` and **rAF is fully paused — 0 frames in 600ms**. The
> splash animation cannot be timed there; a "not animating" reading is the
> harness, not the code. A 700ms backstop now sets t=1 if rAF never fires, so a
> hidden/throttled tab shows the finished splash rather than bare ground.
> Also: probe canvases with a FULL pixel walk — a coarse stride misses a 24px
> monoline mark's 1px strokes and reports a false "BLANK".

## The concept

A brand book tells you what the clothes look like folded in the drawer. The founder is asking for the **fitting room**: put the brand ON each platform and stand it in front of the mirror — the actual iPhone Instagram profile, the actual LinkedIn company page on desktop, the actual iOS home screen with our icon sitting between Messages and Maps, the actual splash screen lighting up. Not screenshots. Not mockups exported from Figma. **Replicas rendered live from the registry** — the same `brand.json` + Supabase overlay that publishes to Buffer. Change the bio in the DB, the phone in the mirror updates.

This is Law 03 ("The demo is real") applied to distribution: the surface that proves what the brand looks like *out there* is built from the code that puts it out there.

Three jobs on one surface:
1. **SEE** — pixel-faithful platform replicas per brand (the mirror).
2. **TAKE** — every asset copyable/downloadable at the exact required size (the rack).
3. **FIX** — founder-lane fields editable in place, saved to Supabase (the tailor). Agent-lane values (marks, palette) show a lock: `AGENT LANE · GIT`.

## Surface restructure (founder verdicts, locked 2026-07-17)

- Pills become **BRANDING (default) · OPERATOR · CINEMATIC**. The DOCTRINE pill is removed.
- **Doctrine folds into The Method's spine as item VI**, after V Voice. Selecting VI renders the existing `Doctrine.tsx` content in the middle+right area instead of law cards. `doctrineData.ts` untouched; only mounting moves.
- Keys: `1/2/3` map to the new pill order.

## Layout

```
HUD  [BRANDING·OPERATOR·CINEMATIC] [BRAND · ▾ARGANTALAB] ··· [REGISTRY · LIVE] [EDIT ✎ / SAVE ✓]
+--------------+--------------------------------------+------------------+
| PLATFORMS    |  THE MIRROR                          |  THE RACK        |
| 180px drawer |  device-faithful replica canvas      |  260px           |
|              |  (iPhone frame / desktop frame /     |  asset checklist |
| SOCIAL       |   launcher grid / splash sequence)   |  per platform:   |
|  Instagram   |                                      |  preview · dims  |
|  LinkedIn    |  device toggle where relevant:       |  · status ·      |
|  TikTok      |  [PHONE] [DESKTOP]                   |  [COPY]/[PNG]    |
|  YouTube     |                                      |                  |
|  X           |                                      |                  |
| APP          |                                      |                  |
|  iOS         |                                      |                  |
|  Android     |                                      |                  |
|  Splash      |                                      |                  |
| WEB          |                                      |                  |
|  Site/Favicon|                                      |                  |
+--------------+--------------------------------------+------------------+
```

- Drawer rows show a readiness dot per platform (derived from `matrix()` — never hand-maintained, Law 08).
- Brand selector in the HUD re-inks everything (existing `--bs-*` re-ink seam).
- Replicas are **hand-built DOM/canvas facsimiles** in our own code — platform *look-alikes* for preview purposes, never claiming to be the real app. No platform logos beyond what the preview needs to read truthfully.

## The replicas (BK-2/BK-3, Opus)

| Platform | Replica | Live-wired content |
|---|---|---|
| Instagram | iPhone frame: profile header + highlights + 3×4 grid; tap a tile → post view | avatar = `drawMark` in the gradient ring; name/handle/bio/link from overlay; grid tiles = real `LivePost` renders; highlight covers = mark variants |
| LinkedIn | desktop company page: banner 1584×396, logo 400×400, About | banner composed live (mark + tagline on brand ground); About = belief/promise from overlay |
| TikTok | iPhone frame: profile 200×200 avatar, bio (80 chars — enforce!), 3-col video grid | avatar mark; bio from overlay, char-counted against spec |
| YouTube | desktop channel: banner 2560×1440 **with the 1546×423 safe-area overlay drawn as an instrument line** — desktop/TV crops visualized | banner composed live; avatar 800×800; handle |
| X | iPhone frame: header 1500×500 + 400×400 avatar | same composition engine |
| iOS | home-screen grid, our icon among neutral dummy tiles; icon at 180/120/1024 | icon = mark `glyph` variant on brand ground, squircle-masked |
| Android | launcher + **adaptive icon mask preview** (circle · squircle · rounded — the 108dp layers with the 66% safe zone ring drawn) | foreground = mark glyph; background = brand ground; Play Store 512×512 |
| Splash | phone playing the launch sequence: ground → mark scales in (the ignition grammar, reused) | pure CSS/canvas animation from palette + mark; **this asset does not exist today — the replica IS the design** |
| Web | browser chrome: favicon 32/16 in a real tab strip + OG card 1200×630 preview | favicon = glyph variant; OG card composed live |

## The rack — asset registry as data (BK-1, the contract)

New `packages/brand/src/kit.js`: `PLATFORM_KIT` — every required asset as data (id, platform, label, px, kind: `raster-mark | raster-composed | text`, source path into the doc, `constraints` like TikTok bio ≤ 80 chars). `kitStatus(doc)` derives READY/GAP per asset. Extends `specs.js` — same pattern, one library, every brand auto-audited. **Sizes verified 2026-07 (Hootsuite/Sprout/Buffer/Apple HIG/Android docs):**

- IG: avatar 320×320 (renders ~110), post 1080×1350/1080×1080, story/reel 1080×1920
- LinkedIn: logo 400×400, banner 1584×396, feed 1200×627
- TikTok: avatar 200×200 min, video 1080×1920
- YouTube: avatar 800×800, banner 2560×1440 (safe 1546×423), thumbnail 1280×720
- X: avatar 400×400, header 1500×500
- iOS: master 1024×1024 PNG opaque sRGB (Xcode derives the other 10 sizes — ship master + 180/167/152/120)
- Android: adaptive fg/bg 108dp layers (432×432 px @4x), Play 512×512, splash icon 288dp inner
- Web: favicon 16/32/180 (apple-touch), OG 1200×630

## Copy / download / edit (BK-5, Sonnet)

- **Text assets**: `[COPY]` → `navigator.clipboard.writeText` — bio, handle, link, tagline, belief. One-click, toast `COPIED · BIO · 74/80`.
- **Raster assets**: `[PNG]` → offscreen canvas at the exact spec px → `toBlob` → clipboard (`ClipboardItem`) with download fallback. The mark is code; export is free.
- **EDIT mode** (HUD toggle): founder-lane fields become inputs in place, inside the replica itself (edit the bio *on the phone*). SAVE upserts `brand_registry.overlay` via the merge-patch seam; guard with `illegalOverlayPaths()`. Agent-lane values render a lock chip instead of an input. This finally lands BF-4b.

## Build order + LLM routing

| Phase | What | Model | Why |
|---|---|---|---|
| BK-0 | Pill reorder (BRANDING default) + Doctrine→VI fold | **Sonnet** | mechanical, fully specified above |
| BK-1 | `kit.js` PLATFORM_KIT + `kitStatus` + tests | **Sonnet** | schema work, pattern already exists in `specs.js` |
| BK-2 | Mirror shell: drawer, HUD brand selector, device frames (iPhone/desktop/launcher), rack column | **Opus** | new interaction model + device-frame craft; design-critical |
| BK-3 | The 9 replicas wired live (IG/LinkedIn/TikTok/YT/X/iOS/Android/Splash/Web) | **Opus** | composition quality is the whole point; safe-area/mask instruments need judgment |
| BK-4 | Splash sequence design (reuse ignition grammar) | **Opus** | it's a design act, not a port |
| BK-5 | Copy/PNG-export/EDIT-SAVE wiring | **Sonnet** | plumbing against a fixed contract |
| BK-6 | Verify gates + memory/KB updates | **Sonnet** | checklist work |

**Recommendation: one Opus run for BK-2→BK-4 (the surface is one design gesture — don't split it), Sonnet for the rest.** Opus first on BK-2 only after Sonnet lands BK-0/BK-1, so the contract exists before the canvas.

## Verify gates — all checked 2026-07-17 (BK-6)

1. ✅ `tsc --noEmit` + `npm run build` green; 51 brand tests green (45 base + 6 kit, including the display-name regression). The one CSS minify warning is pre-existing in `core.css`, unrelated to this build.
2. ✅ Brand Studio opens on **BRANDING**. All 9 platforms render with real ink (verified via full pixel walks, not screenshots — this surface times out on screenshot). Switching brands genuinely re-inks and re-derives: Kinetik Circle's Instagram correctly showed no handle/no name (its real seed gap) where ArgantaLab shows both — not a stale copy.
3. ✅ YouTube safe box measured 0.603×0.295 of the banner vs. the true 1546/2560 × 423/1440 = 0.604×0.294 — faithful within rounding. Android's 3 mask previews (circle/squircle/rounded) + 66% safe ring render.
4. ✅ TikTok bio: typing 95 chars live-showed `95/80` with the `.over` class firing. iOS master `[PNG]`: real export captured and decoded — `image/png`, exactly 1024×1024, 51KB.
5. ⚠️ Partially verified. `illegalOverlayPaths()` is unit-tested at the package level (`brand.test.js`); the UI only ever constructs `presence.*` patches, which are always founder-lane by `lanes.js`, so there's no code path in this surface that could attempt an agent-lane write. The "no cloud" honest-failure branch fires correctly (`NO CLOUD · REGISTRY IS ON SEED` on the offline dev server). **The actual Supabase upsert round-trip needs a live-credentialed instance to exercise — not run against real Supabase yet.**
6. ✅ Both themes verified live (`getComputedStyle` before/after toggle). Device screens (`.bk-screen`) confirmed literally identical background in both themes — dark-invariant by design, not by oversight.
7. ✅ Confirmed and extended: the preview pane runs `visibility: hidden` with rAF fully paused (0 frames/600ms) — cost real debugging time before I recognized it as the harness, not a bug. A coarse pixel-sampling stride also produced a false "BLANK" on a 24px monoline mark — verify with a full walk when the asset is small.

## Do not

- Do not fetch anything from the real platforms — replicas render from the registry only.
- Do not hand-maintain asset checklists — everything derives from `PLATFORM_KIT`.
- Do not let EDIT write agent-lane paths (marks, palette, templates) — `illegalOverlayPaths()` is the law.
- Do not export assets with platform trademarks baked in.

Related: [[The Method]] · [[Brand OS]] · [[Brand Studio Design Spec]] · [[F9 — Marketing Doctrine]]

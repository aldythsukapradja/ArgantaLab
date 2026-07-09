# Battle Builder — visual redesign (CONCEPT, no build)

Dated 2026-07-08. The tab works but looks generic. This is the redesign concept +
the plan to port the game's real animated animal sprites into the Enemies page.
No code changed — see the interactive mockup for the target look.

## What's ugly now (honest critique)

1. **Raw browser sliders.** 24 identical default-purple range inputs on Paths — a
   monotonous wall, and the purple thumb clashes with HQ's indigo `--acc`. No sense of
   each path's *shape* or identity.
2. **The Enemies page is a spreadsheet.** Plain number inputs in a grid — sterile, no
   animal identity, no sense of threat. The most characterful content (cute woodland
   monsters) reads as a tax form.
3. **Overview is flat.** Ring + bars are fine but under-use the space; the signature
   fairness view (the win-matrix heatmap) is missing.
4. **Off-brand chrome.** Inconsistent with HQ's refined card headers, semantic color,
   and tabular numerals used across Growth / Portfolio.

## Redesign direction (grounded in HQ's design language)

Light-first, flat, hairline borders, one indigo accent + semantic green/amber/red,
tabular numbers — same system as Growth/Portfolio, just applied with more care.

- **Paths → identity cards.** Each path is a 2×2-grid card led by a **radar** (the
  archetype shape, filled in the path's own color — Guardian amber, Shadow teal, Mystic
  violet, Arcanist pink), a **role tag** (Tank / Skirmisher / Attrition / Glass cannon),
  and a big **live win%** color-graded green→red. Sliders become **custom, refined
  controls** (thin track filled in the path color, tactile thumb) — quiet, not a wall.
- **Enemies → a living bestiary.** Each enemy is a **card with its real walking sprite**
  (the game's pixel art, animated), a threat-tier chip, a boss ribbon for the Tiger, and
  clean **stat steppers** (❤ HP · ⚔ ATK · ⭐ XP · 🌸 Bloom) — not a spreadsheet. Hover
  speeds the walk. This is where the cozy-cute identity finally shows.
- **Overview → command view.** Fairness ring + per-path bars **+ the win-matrix heatmap**
  (teal = fair, magenta = skewed) + the hottest-matchup callout.
- **Publish → a calm hero.** Fairness summary + one confident Publish action + the
  pipeline/provenance note.
- **Motion, restrained.** Sprite walk cycles, ring sweep, bar/​heatmap transitions. No
  gratuitous animation.

## Porting the real animal pixel + animation (the specific ask)

The sprites already exist and are tiny (~1–2 KB/frame):
```
apps/lashira/web/public/farm-art/creatures/<animal>/
    south.png · north.png · east.png · west.png        ← directional stills
    walk/<dir>/0.png … 8.png                            ← 9-frame walk cycle per direction
animals: squirrel · fox · badger · boar · deer · tiger  (1:1 with BESTIARY ids)
```
So an enemy row maps its `id` straight to a creature folder. The **mockup embeds the real
frames** (squirrel/fox/badger/boar/deer walk cycles; tiger uses a directional still) as
data-URIs and cycles them at ~8 fps with `image-rendering: pixelated` — that's exactly the
port, proven.

**For the real HQ surface (later, when we build it):**
1. A tiny shared **`<CreatureSprite animal="fox" />`** component (in a shared pkg or
   `@arganta/character`) that cycles `walk/south/0..8` on a timer, `pixelated`, with a
   still-frame → emoji fallback. HQ and the game both use it — one renderer.
2. **Where the frames come from in HQ** (HQ has no farm art): point at the game's art base
   via env, mirroring how HQ already reads `VITE_KINGDOM_DATA_BASE`. So
   `VITE_LASHIRA_ART_BASE=https://lashirabloom-game…/farm-art/creatures` and the component
   builds `${base}/${animal}/walk/south/${frame}.png`. No asset duplication.
3. Fallback chain: walk cycle → directional still → the woodland emoji (🐿️🦊🦡🐗🦌🐯).
   A new animal with no art yet just shows its emoji — never breaks the grid.

This keeps the "one source of truth" spine: the same sprites the game renders are the ones
the operator tunes against.

## Scope note
Concept only — the live `BattleBuilder.tsx` is unchanged. The mockup shows the target;
building it into the real surface is a follow-up (swap the number-grid for creature cards +
add the `CreatureSprite` component + the radar/custom-slider styling).

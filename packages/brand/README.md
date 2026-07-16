# @arganta/brand

The Brand OS contract. One `BrandDoc` per brand across seven layers; every consumer —
postEngine, Arganta Core, Buffer, Video Builder, the Landing site's meta, and any media AI —
reads a brand from here instead of hard-coding one. Adding a sixth brand is adding a sixth
document, never a code change.

Concept and decisions: `knowledge-base/brand/brand-os.md`. Wiring: `brand-os-integration-map.md`.

## The two lanes are enforced by storage

The founder's rule is that **visuals may only be changed by coding agents; text is founder-editable**.
That isn't an honour system here — the two lanes live in two different stores, so the boundary
cannot be crossed by accident:

| Lane | Layers | Store | Who writes |
| --- | --- | --- | --- |
| 🔵 agent | L0 identity · L0.5 KB · L3 content/ads · routing | git — `brands/<id>/brand.json` + assets | Claude Code / Codex / MCP |
| 🟢 founder | L1 voice · L5 spine | Supabase — `brand_registry.overlay` | HQ deck (agents may also patch) |
| 🟡 mixed | L2 presence · L4 discovery | split per field: art → git, text → DB | both |

`resolveBrand(base, overlay)` merges them. An overlay carrying agent-lane fields is **dropped**
(or throws in `strict` mode) so the database can never shadow git. `lanes.js` owns the field-level
rules; `migration_brand_registry.sql` has a check constraint as the backstop.

```js
import { BRAND_BASES, resolveBrand, readiness, matrix } from '@arganta/brand'

const { doc, errors } = resolveBrand(BRAND_BASES.argantalab, overlayFromSupabase)
readiness(doc)  // → per-layer %, overall, next 3 actions
matrix(doc)     // → platform × column cell states
```

## Marks are code, not pixels

A logo must be deterministic. `identity.mark` is declarative geometry (primitive shapes in a
viewBox) and `mark.js` renders it **two ways from that one source**: `drawMark()` onto a canvas
(postEngine stamps every slide) and `markToSvg()` to a string (logo files, press kits). They
cannot drift apart because there is only one definition.

ArgantaLab's mark is transcribed verbatim from the Instagram Profile Pack's SVG and verified
pixel-identical to it (mean channel difference **0.000%** against the original raster).

## The matrix is a derived audit, not a checklist

`specs.js` is the platform spec library **as data** — field limits and asset dimensions for
Instagram, TikTok, LinkedIn, Facebook, X and YouTube. Cell states are computed from it, so the
audit can never go stale: add a platform spec and every brand is re-audited on the next render.
Adding Threads or Bluesky later is one entry in that file.

Spec numbers carry `verified: null` until confirmed against the live platform — they are
founder-verifiable data, not gospel. `validateField()` **reports** overflow and never truncates;
silently cutting a bio would be worse than showing a warning.

## Honest readiness

`blankBrand()` starts every value `null` on purpose. If the shape shipped placeholder greys, a
brand nobody had designed yet would score progress. Renderers own their fallbacks; a brand only
ever *overrides*. A blank brand scores 0%.

## Layout

```
src/
  lanes.js      the governance rule (laneFor, canEdit, illegalOverlayPaths)
  schema.js     BrandDoc shape, blankBrand, deepMerge, validation
  specs.js      platform spec library (L2) + field/asset validation
  mark.js       declarative geometry → canvas + SVG
  registry.js   resolveBrand, createRegistry, matrix, readiness
brands/
  argantalab/
    brand.json         agent lane — source of truth for identity/KB/routing
    seed.overlay.json  ONE-WAY founder-lane seed (the DB is authoritative after first insert)
    BRAND.md           L0.5 knowledge base — what a media AI reads to "get" the brand
    refs/              canonical style anchors
    prompts/           ready generation briefs (ad-hero, reel-cover, og-image)
```

`npm test` (node --test) — 26 tests covering lanes, schema, specs, mark fidelity, resolve,
matrix and readiness.

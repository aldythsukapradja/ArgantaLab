# Kingdom — Full NexusTK Rebuild Strategy (data fusion, audits, React)

**Status: strategy only — no build.** Date: 2026-07-03.

This document defines how the two corpora — the **fanbase scrape** (NexusAtlas)
and the **real client data** (KRU NexusTK installation) — merge into one game
data model, how we audit that merge (orphans, gaps, conflicts), and the shape
of the React rebuild.

---

## 1. The three corpora and what each is truth for

### A. Real client (`C:\Program Files (x86)\KRU\NexusTK\Data`, 250 archives)

Fully decoded this session (parsers in `Baginda's App\Nexus\app\tools\kru_decode.py`,
extracted library at `Nexus\app\assets\extracted\`, 683 MB). **Truth for pixels,
animation, timing, rendering rules.**

| Asset | Count | State |
|---|---|---|
| Character paper-doll parts (17 categories) | 2,946 parts | ✅ extracted w/ per-motion animations |
| Motions (walk/swing/pierce/shoot/get/spell/ride/emotes…) | 68 named | ✅ incl. per-step **layer draw order** |
| Monsters (`monster.dna`) | 2,013 | ✅ stand/walk/hit/attack/death + per-mob palette |
| Mounts (`RIDINGS.*`) | 53 | ✅ |
| Spell effects (`effect.tbl`) | 648 | ✅ real per-frame delays, translucency |
| Item icons (`ITEM.EPF/TBL/PAL`) | 5,879 | ✅ per-icon palette (dye-base items render purple by design) |
| Ground/object tiles | ~101,600 | format solved; extraction opt-in (`--tiles`) |
| Map format (`.MAP`/`.CMP`) | 3 sample maps | ✅ format: per tile = ground id + **passability** + static-object id |
| Static-object table (`SObj.tbl`) | ~thousands | heights + movement blocking per object — real collision data |
| World-map art (`wm.dat`) | 5 images | ✅ rendered (2068×2400 etc.) |
| Region/field maps (`misc.dat FIELD1-18`) | 18 | ✅ renderable |
| UI kit (`bint0-2.dat`) | 63+ entries | fonts (9x11), buttons, bars, gauges, boat, alerts |
| Minimap symbols (`SYMBOLS.EPF`), login art (`baramst`) | — | renderable |
| Audio (`mus0-6.dat`, `snd.dat`) | 8 archives | not yet extracted; Mp3dec present → music is MP3-ish |

**What the client does NOT contain (server-authoritative, confirmed):**
monster XP/HP/stats, drop tables, spawn tables, item stats/prices, skill
mechanics, quest logic, world map tile grids (client streams `.cmp` maps at
runtime; this install never cached any — only the 3 char-creation rooms ship).

### B. Fanbase scrape (`Baginda's App\RPG`, NexusAtlas)

**Truth for names, numbers, economy, world topology.**

- 866 maps (typed: 342 cave rooms, 145 areas, 128 cave hubs, 80 shops, 17 main
  maps…), 829 map images, hierarchy + 2,768 edges + 2,768 image hotspots +
  world spine + path links
- 694 named monsters — **644 with XP values**, 579 with drops (4,243 drop rows),
  1,930 map appearances (= spawn locations)
- 644 items (37 weapons; icons/GIFs; **no combat stats** — see gaps)
- 227 skills with real mechanics: mana, aether (cooldown), duration, target,
  spell type, stat requirements (kwisin/mingken/ohaeng), 596 item/quest
  requirements, per-path (Warrior/Rogue/Mage/Poet)
- 73 shops with 866 inventory rows (= item availability + implicit economy)
- 22 known data gaps (already tracked in `data-gaps.json`)

### C. `apps/kingdom` (the fusion target — already right)

- `data/core/*.json` — immutable normalized scrape snapshot (`build-data.mjs`)
- `data/overrides/*.json` — hand-tuning layer, merged at load (currently empty)
- Kingdom Command explorer (vanilla JS) + `game/` engine prototype

**Verdict on "is the fanbase data helpful":** essential. The client gives a
mute, perfectly-animated world; the scrape gives it names, XP, drops, shops,
skills, and topology. Neither is sufficient alone. (Item combat stats exist in
*neither* — see §5.)

---

## 2. Unified data model

Add a third layer beside core/overrides — same philosophy, new provenance:

```
data/
  core/       (scrape snapshot — regenerated, never edited)      [exists]
  client/     (client extraction snapshot — regenerated)         [NEW]
  links/      (join tables: curated matches core↔client)         [NEW]
  overrides/  (hand tuning — wins over everything)               [exists]
  derived/    (build output: the merged game database)           [NEW]
```

### Layer rules

1. **Scraped ids stay canonical** (`monster.admiralblaze`, `item.amber`,
   `map.60.woodlands`). Client entities get stable ids (`mob:1042`,
   `part:hair:37`, `effect:212`, `icon:5012`).
2. **`links/` is the only place the two worlds join.** One file per join:

```jsonc
// links/monster-links.json (concept)
[{ "monsterId": "monster.admiralblaze",
   "mobId": 1042,                       // → client/monsters.json
   "paletteId": 17,                     // if variant-colored
   "method": "image-match|manual",
   "score": 0.97, "status": "auto|confirmed|rejected" }]
// same shape: item-links (item↔icon), skill-links (skill↔effect),
// map-links (map↔tileMap when built), mount-links, npc-links
```

3. **`derived/` is what the React game loads.** A build script merges
   core + client + links + overrides into one typed database (and emits the
   audit reports below as a side effect). Nothing downstream reads raw layers.

### Entity model of the merged database (target shape)

- **Monster** = scraped identity (name, XP, drops, spawns) + client body
  (sprite sheet, animations, palette) + *tuned* combat stats (overrides).
- **Item** = scraped identity (name, kind, sources) + client icon (+ palette)
  + equipment linkage (which paper-doll part it equips → `part:coat:12`).
- **Skill** = scraped mechanics + client effect animation + icon.
- **Map** = scraped node (type, hierarchy, edges, hotspots, image) + optional
  authentic **tile map** (built later in the real MAP format: ground /
  passable / sObj per tile).
- **CharacterPart / Mount / Effect / Motion / Layer** = client-only, already
  final in `assets/extracted`.

---

## 3. Matching plan (how links/ gets filled)

The scrape's GIFs were rendered from the same art we now extract — so
image matching can do most of the work automatically:

1. **Items (highest hit-rate first).** Render each of 5,879 icons; hash
   (exact + perceptual) against the 232 item + 254 armor + 67 weapon GIFs.
   Expect near-exact matches → auto-links with score 1.0. Garments whose
   client palette is the purple dye-base get their *true* palette recovered
   here: solve `argmin_pal |render(icon, pal) - scrapedGif|` over the item's
   palette blocks — this fixes the "purple shirts" permanently.
2. **Monsters.** Render each mob's `stand_down` first frame; match against
   1,215 monster GIFs (many monsters have 2 GIFs = alt frames). Same-art
   matching, expect >90% of the 694 to auto-link. Variants that share art but
   differ by palette (color families) disambiguate by palette-aware matching.
3. **Skills → effects.** Only 44 spell GIFs exist; most links will be manual
   (Effect Lab-style review UI: play effect, pick skill). Low volume (227).
4. **Maps.** No pixel matching possible (scrape has page renders, client has
   no world tile data). Links happen only when/if we build tile maps.

All matches land as `status:"auto"`; a small review UI (extend Kingdom
Command) flips them to `confirmed`/`rejected`. Overrides can hand-add.

---

## 4. Audit plan (orphans, gaps, conflicts)

One script (`scripts/audit.mjs`) runs after every data build and emits
`derived/audit.md` + `.json`:

**Orphans (expected and fine — but must be counted):**
- Client mobs with no scraped monster: expect ~1,300 of 2,013 (NPCs, event
  creatures, KR-only content). These become a *casting pool* for new content.
- Scraped monsters with no client mob match: should be ≈0; each one is a
  matching bug or a post-2016 monster (client data is 2015-16).
- Icons with no item: ~5,200 (quest/event items not on Atlas) — casting pool.
- Char parts never referenced by any item: normal (dye variants), but track.

**Gaps (things the game needs that no corpus has):**
- 50 monsters without XP, 115 without drops (scrape holes).
- **Item combat stats (damage/AC/might/will) — missing everywhere.** Decide:
  seed from community wiki tables later, or hand-tune in overrides with a
  spreadsheet-style editor. Flag every equippable item without stats.
- Monster HP/hit/damage — missing everywhere; must be *designed*. Anchor to
  the XP curve (XP is known for 644 monsters → fit HP/damage tiers to XP).
- 37 maps without images; 22 tracked requirement gaps; skills whose
  requirement items have no acquisition source.
- Map tile grids: only 3 authentic rooms. Strategy in §6.

**Conflicts:**
- Same GIF matched by 2+ mobs (palette twins) → needs palette-aware pass.
- Scrape name collisions (`rawNames` variants) already normalized in core —
  keep asserting uniqueness of `key`.

---

## 5. Game mechanics: what's real and reusable

| Mechanic | Source | Reusable as-is? |
|---|---|---|
| Paper-doll layer order per motion+step | client Motion.tbl | ✅ literally the render spec |
| Walk = 4 steps, standby = 6, cast/get = 1… | client Motion.tbl | ✅ animation driver |
| Monster anim timing (per-frame `duration`) | client DNA | ✅ |
| Effect timing (`delay` ms/frame, alpha phases) | client effect.tbl | ✅ |
| Tile size 48×48, 4-direction facing, tile-step movement | client | ✅ engine constants |
| Collision: per-tile passability + SObj heights | client MAP + SObj.tbl | ✅ movement/occlusion rules |
| Skill costs/cooldowns/durations/targets | scrape skills.json | ✅ combat system seed |
| Class/path system (4 paths, ranks, san levels) | scrape | ✅ progression skeleton |
| Monster XP values (644) | scrape | ✅ progression economy anchor |
| Drops + shop inventories + prices | scrape | ✅ loot/economy seed |
| Combat formulas (hit/dam/AC math) | ✗ nowhere | must design (anchor to XP curve) |
| Quests | ✗ (scrape has fragments in metadata) | design; metadata seeds flavor |

---

## 6. Maps: the honest answer

Real per-tile world maps are **not** in this install (the client streams
`.cmp` maps from the server; cache is empty). What IS real:

1. The **map format** (decoded): `w×h × {ground u16, passable u16, sObj u16}` —
   plus the complete 101K-tile art library and SObj collision table. We can
   build 100% authentic-looking, authentic-behaving maps.
2. **3 authentic rooms** (char creation) as format reference.
3. **World-map art** (wm.dat) + 18 field/region maps + minimap symbols.
4. The scrape's **topology**: 866 nodes, 2,768 edges, hotspots — the real
   world *graph*, without tile detail.

**Recommended hybrid:** world/travel layer uses scraped map images + hotspot
graph (Kingdom Command already renders this); playable zones get hand-built
tile maps in an editor that writes the authentic MAP format, starting with a
few flagship zones (Kugnae, a hunting cave chain). Optionally: community
NexusTK map archives (.cmp dumps) exist among fan projects — if one is
obtained later, the parser is already written and every map becomes real.

---

## 7. React rebuild — target architecture (build later)

```
apps/kingdom/
  data/…            (as §2 — framework-free JSON)
  scripts/          build-data.mjs (exists) + build-client.mjs + match.mjs + audit.mjs
  web/              React app (Vite)
    src/engine/     canvas/PixiJS: TileMap, PaperDoll, MobSprite, EffectPlayer,
                    MotionDriver (Motion.tbl), palettes (idx.png re-dye)
    src/codex/      React ports of Kingdom Command views (world/monsters/items/skills)
    src/game/       play mode: movement, combat, inventory, skills
    src/editor/     MapEditor (authentic MAP format), LinkReview (match curation)
```

- PixiJS v8 is already proven in-house (KinWorld); the extracted sheets +
  `parts.json`/`motions` JSON are engine-agnostic.
- The grayscale `.idx.png` sheets + `palettes.json` enable true client-style
  dyeing at runtime (one WebGL palette-lookup shader, or canvas LUT).
- Kingdom Command stays as the data cockpit until the React codex reaches
  parity; both read the same `derived/` database.

### Phasing (each phase independently shippable)

- **P0 — Data fusion**: `build-client.mjs` (client snapshot into
  `data/client/`), `match.mjs` (items+monsters auto-links), `audit.mjs`
  (orphans/gaps report). Pure data, no UI.
- **P1 — Codex in React**: port Kingdom Command views; every monster/item now
  shows its *real animated sprite* next to scraped stats.
- **P2 — Character & monster lab**: paper-doll composer (React) on the
  extracted library; mount riding; effect player.
- **P3 — World**: map editor + first playable zone; movement w/ real
  collision; travel layer over the scraped graph.
- **P4 — Game systems**: combat (XP-anchored formulas), drops, shops,
  skills with real costs/cooldowns; stat tuning via overrides.

---

## 8. Immediate open items (pre-build checklist)

1. Run `extract_all.py --tiles` (tiles pending; needed for map editor).
2. Extract audio (`mus*/snd.dat`) — trivial addition to the extractor.
3. Decide monster stat formula anchored to XP (design doc).
4. Item stats source: wiki tables vs hand-tuning (decide before P4).
5. Move/copy `assets/extracted` out of OneDrive before it becomes the
   app's asset source (683 MB, 11K files; OneDrive already corrupted
   `decisions.json` once).

# Character Forge — 🛍️ Shop tab (concept, no build yet)

Adds a monetized cosmetic shop to Character Forge (`apps/hq/src/surfaces/character/`),
gating a curated slice of the free-forge catalog behind diamonds. Decisions below are
locked in from a strategy pass; numbers are a proposed starting scale, not final.

## 1. Where it lives

**New 4th tab: 🛍️ Shop**, alongside Lab / Select / NPC Studio. Lab stays 100% free and
ungated — it's the admin/testing composer ("single source of truth" for real users) and
must not gain shop semantics. Shop is the curation + monetization layer on top:

- A curated catalog (below) — buy with 💎 diamonds.
- Ownership recorded server-side (`person_cosmetic_items`).
- Lab's `PartBrowser` gains a lock state: an item not in `person_cosmetic_items` (and
  not in the always-free starter set) shows 🔒 + "Unlock in Shop" instead of being
  freely pickable. This is the one behavior change to the existing free-forge flow.

## 2. Catalog scope — 4 categories, capped at 10 items each (40 total)

The raw "set" groupings (`frame_index ÷ bank`) are a technical browse-grouping, not a
shop-ready bundle — e.g. Sword Set 0 alone is 130 items. Capped each category to its
first 10 ids so the shop opens with a legible, individually-priced catalog:

| Category | Source set | Real part ids (capped to 10) |
|---|---|---|
| ⛑ Helmet | Helmet Set 1 (15 total) | 15–24 |
| 🧥 Coat | Coat Set 1 (32 total) | 33–42 |
| ⚔ Sword | Sword Set 0 (130 total) | 0–9 |
| 🛡 Shield | Shield Set 0 (56 total, only 1 set) | 0–9 |

Each of the 40 rows is individually priced and ownable — not one bundle-buy per
category. (Growing the shop later = more capped-10 batches from later sets, same shape.)

## 3. Pricing + stat bonuses — revised: 2,000–10,000 💎 range (confirmed)

Superseded the first pass. Confirmed range: **min 2,000 💎, max 10,000 💎**, with the
explicit rule **"the more expensive, the more stat."** At this price band (well above
the mount shop's 60–320 range) a shop piece needs to feel like a real power item, not a
flourish — so stats are now anchored HIGHER on the Blacksmith gear-tier ladder
(`packages/combat/src/gear.js`: weapon T2=+60→T5=+1000 ATK, armor T2=+20 DEF/+300 HP→
T5=+320 DEF/+6000 HP) instead of staying a token fraction of it.

Per category, item index `i` (0 = cheapest, 9 = priciest), 10 steps:

- **Price**: `[2000, 2900, 3800, 4700, 5600, 6500, 7400, 8300, 9200, 10000]` diamonds.
- **Sword → ATK only**: `+20` to `+200` (linear across the 10 steps). Entry price
  (2000💎) ≈ weapon T2 (+60 is close but a bit above +20 — instant convenience, still
  weaker than grinding T2); top price (10000💎) ≈ weapon T3 Steel (+180) — a real,
  serious upgrade, but real Blacksmith T4/T5 (+450/+1000, gated on ingot/shard/token
  from bosses) still stays out of diamonds' reach. Grinding always beats buying at the
  ceiling — buying just beats grinding at the *start*.
- **Coat → DEF + HP**: DEF `+10` to `+100`, HP `+100` to `+1000` — spans roughly armor
  T2 (+20 DEF/+300 HP) up toward T3 Chain (+60 DEF/+900 HP).
- **Helmet → DEF only**: `+5` to `+50` (smaller slot than coat, same ceiling logic).
- **Shield → DEF only**: `+8` to `+80`.
- A maxed-out full shop loadout (top helmet+coat+shield DEF, top sword ATK) lands
  roughly around a Chain/Steel (T3) real loadout — strong, buyable, but T4/Plate and
  T5/Aegis/Astral (the actual best gear) still require playing, not just paying.

**Open decision for the BUILD pass (not resolved here):** these stats should ship
*displayed* on the item card from day one, but whether they're actually summed into
`outgoingDamage`/`incomingDamage` (`packages/combat/src/gear.js`, shared by Kingdom +
LashiraBloom) is a separate, deliberate step — that file is load-bearing for battle
balance in both games and deserves its own review before diamonds can nudge real combat
numbers, even by a little.

## 4. Currency — diamonds only for v1 (confirmed)

Diamonds are the only currency that's actually global today (`profiles.diamonds`,
server-authoritative, works from any app). LashiraBloom's wood/stone are cloud-saved but
scoped to one farm/circle; ore/gem/ingot are `localStorage`-only per device (see the
gap flagged in `docs/lashirabloom/` — materials aren't a cross-app ledger yet). So:

- **Ship now**: diamonds unlock shop items, usable from HQ Forge, playable everywhere
  the composer spec renders (Kingdom, LashiraBloom).
- **Fast-follow (not this pass)**: once LashiraBloom's crafting mats are promoted to a
  synced ledger, layer a "diamonds unlock the shape, ore/ingot unlock the finish"
  dye-tier — reusing the DyePicker (already exists) gated on smelted ingot count. This
  keeps diamonds and crafting as two clean, separate axes instead of one blended price.

## 5. Data model (mirrors the mount shop precedent exactly)

```sql
-- server-priced catalog (tamper-proof; client mirrors it for art only)
create table shop_cosmetic_catalog (
  item_key   text primary key,     -- 'helmet:15', 'sword:0', …
  cat        text not null,         -- helmet | coat | sword | shield
  part_id    int  not null,         -- real char-part id from the extracted catalog
  set_label  text,                  -- 'Helmet Set 1' — display grouping only
  price      int  not null,
  atk        int  default 0,
  def        int  default 0,
  hp         int  default 0
);

-- ownership
create table person_cosmetic_items (
  owner_id    uuid references profiles(id) on delete cascade,
  item_key    text not null,
  acquired_at timestamptz default now(),
  primary key (owner_id, item_key)
);

-- one atomic RPC: checks balance, burns diamonds, records ownership together
-- (buy_cosmetic_item(p_item_key) — same shape as buy_mount())
```

## 6. Mirroring into LashiraBloom (concept — confirmed: same Supabase project)

Both apps point at the same project (`bdagdxgpnlialkppjwor` — checked `.env.local` in
each), so `shop_cosmetic_catalog` and `person_cosmetic_items` are **already** one shared
truth, not something to sync. Change a price in Supabase → both apps see it on next
load. Buy an item from either surface → `buy_cosmetic_item()` records it once, both
surfaces see it owned. No extra plumbing needed for catalog + ownership.

**The one real gap: equipping.** The only thing that currently writes a player's
composer spec (`hq_character_save`, `migration_hq_character_admin.sql`) is gated on
`hq_is_operator()` — a normal LashiraBloom player has no self-service door to actually
*wear* a purchase, only to own it. Closing that needs one new, narrow RPC:

```sql
-- equip_cosmetic_item(p_item_key) — mirrors equip_mount()'s safety shape: verifies
-- ownership, patches exactly ONE slot in the spec (never a full rewrite), writes the
-- same synced_spec_json/draft_spec_json/appearance_json.spec fields hq_character_save
-- already writes (per its own comment: written to all three so every reader,
-- including kingdom_get_player_state(), sees it). Callable by any authenticated
-- player for their OWN character — not operator-gated.
```

Slot mapping (catalog `cat` → composer spec key, from `composer.ts` SLOT_DEFS):
`helmet→spec.helmet`, `sword→spec.weapon` (weapon's `cat` field stays `'sword'`),
`shield→spec.shield`, `coat→spec.coat` **+ reset `spec.body` to skin id 0 if it's
currently an armor-body id** — same rule `pickArmor()` already applies in the Lab, or a
bought coat can render invisible under a full armor-body sprite.

**UI landing spot:** `apps/lashira/web/src/ui/Shop.jsx`'s existing **Cosmetics** tab —
currently a stub (`🎩 Farmer hat 💎 5`, not wired to real items). Replace its wares with
`shop_cosmetic_catalog` rows, gate Buy/Wear on `my_cosmetic_items`, call
`buy_cosmetic_item` (identical to HQ) and the new `equip_cosmetic_item` for Wear. Same
gallery shape the tab already has (featured item + thumbnail strip) — no new UI pattern.

## 7. Build order

### HQ side — DONE (built this pass)
1. ✅ Migration `migration_character_shop.sql`: `shop_cosmetic_catalog` +
   `person_cosmetic_items` + `buy_cosmetic_item()` + `my_cosmetic_items()`, seeded with
   the 40 rows above (mirrors `migration_mounts.sql` 1:1). **Not yet run against the
   live database** — needs a paste-and-run in Supabase → SQL Editor.
2. ✅ `CharacterForge.tsx`: Shop tab + `Shop.tsx` (gallery-style, reuses `PartThumb`
   from `PartBrowser.tsx` for real sprite previews).
3. ✅ `PartBrowser.tsx`: lock state for un-owned catalog items (🔒 + CTA), read from
   `my_cosmetic_items` for whichever roster user is selected.
4. ✅ `heroData.ts`: `loadShopCatalog()` / `loadOwnedCosmetics()` / `buyCosmeticItem()`
   / `getMyDiamondBalance()` client calls.
5. ⬜ Verify against the live DB once the migration is run: buy flow (balance check,
   insufficient-funds path, already-owned path), locked→unlocked handoff into the Lab
   picker. `tsc` + `vite build` both pass; UI-only smoke test done in offline mode
   (tabs render, Shop shows the "not deployed yet" message pre-migration, as designed).

### LashiraBloom side — next (this session's latest ask)
6. ⬜ New migration: `equip_cosmetic_item(p_item_key)` RPC (§6) — ownership-gated,
   patches one spec slot, writes `synced_spec_json`/`draft_spec_json`/
   `appearance_json.spec` together (same fields `hq_character_save` writes).
7. ⬜ `apps/lashira/web/src/ui/Shop.jsx`: replace the Cosmetics tab's stub wares with
   real `shop_cosmetic_catalog` rows + Buy (`buy_cosmetic_item`, same RPC as HQ) + Wear
   (`equip_cosmetic_item`, new).
8. ⬜ Verify: buy in LashiraBloom → shows owned in HQ's Shop tab (and vice versa,
   same `person_cosmetic_items` row); Wear in LashiraBloom → the equipped part renders
   immediately (spec change flows through `kingdom_get_player_state` on next load).

**Status update (live-tested, both real)**: 1,000,000 💎 operator top-up confirmed
working end-to-end; per-item sprite thumbnails confirmed rendering distinctly (real
`engine/data.js` sheets, not the placeholder emoji). Both are DONE, not just planned.

## 8. Fine-tune pass 2 (concept, no build yet)

### 8a. Cosmetics sub-tabs — Helmet / Coat / Weapon / Shield

Right now Cosmetics is one flat 40-item gallery — helmet, coat, sword, and shield all
mixed in a single ◀▶ swipe + one thumbnail strip (visible in the screenshot: a helmet
sits next to a sword next to a coat, no grouping). Add a second-level tab row **inside**
the Cosmetics panel, reusing the exact same `.ptabs`/`.ptab` component the shop already
uses for its top-level Seeds/Animals/Forge/General/Cosmetics/Sell row — one level down,
filtering `shopCatalog` to just that category:

`⛑ Helmet` · `🧥 Coat` · `⚔ Weapon` · `🛡 Shield`

("Weapon" not "Sword" — matches the composer's own `SLOT_DEFS` label, which already
groups sword/spear/bow/fan under "Weapon.") No new visual language, no architectural
risk — same pattern, one level deeper. Default lands on Helmet (array order); revisit
if a specific merchant deep-link should pre-select a category later.

### 8b. HQ's own Shop tab gets Wear too (confirmed: operator-only, symmetric with LashiraBloom)

`apps/hq/src/surfaces/character/Shop.tsx` currently only has **Buy** — when an item is
owned it just shows "Owned ✓" with no action. Add a **Wear** button there too, calling
the SAME `equip_cosmetic_item` RPC LashiraBloom's Shop already calls (new
`equipCosmeticItem()` in `heroData.ts`, mirroring `apps/lashira/web/src/net/cosmetics.js`
1:1). Scope stays exactly what it already is: self-referential, onto the **signed-in
operator's own account** — same as Buy already is, same as `equip_mount()`'s own
precedent. Not a new access tier, not opening HQ to non-operator players — purely "the
convenience LashiraBloom's shop already has, now in HQ too," so an operator testing from
HQ doesn't have to hop apps just to equip what they bought. Small: one new client
function + one button + the existing reload-to-show-it pattern.

### 8c. Forge item enhancement — Lv 1 → 2 → 3 → 4…

A new, **per-item** power axis, separate from the existing account-level
`weaponTier`/`armorTier` Blacksmith upgrade (that stays exactly as-is). Each cosmetic
item you *own* gets its own enhancement level, tracked per `(owner_id, item_key)` —
needs one new column:

```sql
alter table public.person_cosmetic_items add column if not exists enhance_level int not null default 0;
```

**Proposed scale** (tunable, same spirit as the base shop pricing — a proposal, not
final): **5 levels**, each level = **+10% of the item's own base stat**, cumulative (Lv5
= +50% over base). Percentage-of-base (not a flat bonus) is deliberate: it keeps pricier
items ahead of a maxed cheap item — e.g. a maxed Lv5 2,000💎 sword (+20 ATK base → +30)
still trails an un-enhanced 10,000💎 sword (+200 ATK), preserving the shop's price/rarity
signal instead of letting grinding flatten it.

**Cost — wood/stone/bloom, deliberately NOT diamonds.** Diamonds buy the *starting*
piece; enhancing it back into playing the game (grinding materials) is what makes that
specific piece stronger over time — same "buying never beats crafting at the ceiling"
principle from §3. Cost scales per level, mirroring the existing linear-in-tier pattern
already used for tools/house (`farm-mechanics.js`: `toolCost = { wood: t*4, stone: t*6 }`) —
e.g. `wood: lvl*8, stone: lvl*10, bloom: lvl*150` as a starting point.

**No fail/destroy risk** — guaranteed success on paying the cost. Matches this project's
consistent "gentle rules" design (the Dungeon panel already states the philosophy
outright: *"Faint = you just leave, keep what you gathered"*) — a punishing
enhance-can-fail-and-destroy-your-item system (classic in some MMOs) would be the wrong
tone here.

**Where it lives:** a new section in the Forge tab, "✨ Enhance your gear" — below the
existing Weapon/Armor/Tools/Refine sections, one row per item you *own* (empty + a hint
to visit Cosmetics first if you own nothing), showing current level, stat readout
(base → enhanced), and an Enhance button with its cost, disabled if unaffordable or
already Lv5. Visual: a small "+N" badge on the item's thumbnail once enhanced (reads
like a classic "+3 Sword"), visible in both the Forge list and the Cosmetics gallery.

**Trust model — matches the rest of the economy, not a new weak spot.** Unlike diamonds
(server-authoritative, atomic RPC — `buy_cosmetic_item` really checks the real balance),
wood/stone are **client-trusted everywhere already** in LashiraBloom today —
`mine()`/`chop()`/`toolCost()`/`houseCost()` are all local state mutations with no
server verification. So `enhance_cosmetic_item(p_item_key)` following that same pattern
(client deducts wood/stone locally, then a simple RPC bumps `enhance_level`) isn't a new
gap — it's consistent with how every other material spend in this game already works.
The alternative (promoting wood/stone to a real server-verified column so the RPC can
check+spend atomically like diamonds) is the same bigger, separate project already
flagged as a gap in an earlier pass — not required to ship enhancement.

**Honesty flag, inherited from §3's open decision:** like the base shop stats,
enhancement's ATK/DEF/HP bonus would be *displayed* immediately but is **not** summed
into real combat math (`packages/combat/src/gear.js`) until that separate, deliberate
wiring decision gets made — same deferred status as before, now just bigger numbers to
defer.

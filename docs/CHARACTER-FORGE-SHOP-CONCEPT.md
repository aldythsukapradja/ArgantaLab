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

## 6. Build order (when approved)

1. Migration: `shop_cosmetic_catalog` + `person_cosmetic_items` + `buy_cosmetic_item()`,
   seeded with the 40 rows above (mirrors `migration_mounts.sql` 1:1).
2. `CharacterForge.tsx`: add the Shop tab + `ShopBrowser` component (gallery-style,
   reuse `PartThumb` from `PartBrowser.tsx` for real sprite previews).
3. `PartBrowser.tsx`: lock state for un-owned catalog items (🔒 + CTA), read from
   `person_cosmetic_items`.
4. `heroData.ts`: `loadOwnedCosmetics()` / `buyCosmeticItem()` client calls.
5. Verify: buy flow (balance check, insufficient-funds path, already-owned path),
   locked→unlocked handoff into the Lab picker, spec still round-trips to
   Kingdom/LashiraBloom unchanged (diamonds/stats are metadata, not new spec fields —
   the composer spec shape (`{cat,id,palette}`) doesn't change).

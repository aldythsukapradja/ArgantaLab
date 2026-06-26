# KinetikCircle — Native Apps (Travel · Padel · Kitchen · Vault)

Replace the 4 iframe/CircleHQ apps with **native React apps** inside KinetikCircle, fully
linked to the active **circle** and signed-in **user**, data in **Supabase** (shared across
the family), styled from the attached mockups.

## 1. What the 4 apps are (audited from the bundles)

The mockups are a declarative framework (`<x-dc>` + a gzipped runtime) using `{{ }}` bindings
and **localStorage** (`kc:<app>:v1`). They're **light-themed, premium**, dark text `#0E1726`
on a soft light wash, each with its own accent gradient. The header already binds
`{{ person.circle }}` + `{{ person.initial }}` + a `💎 Soon` pill → designed for circle/user.

### ✈️ Travel Planner — accent `#0E9DC4 → #38BDF8` (teal/sky)
Trips list → trip detail with tabs: **Overview** (destination, dates, nights, travelers,
"Sync departure & return to Calendar", delete), **Itinerary** (Day N → time-slot activities),
**Packing** (smart-generated list, grouped, per-person, progress %), **Budget** (spent/total,
categories, log expense), **Discover** (curated ideas).
Entities: `trip`, `trip_day`/`activity`, `packing_item`, `trip_expense`, `traveler` (circle member).

### 🎾 Padel Matchday — accent `#2F6BFF → #54C7EC` (blue)
Tabs **Setup** (format, points-to-win, courts ±, "Add session to Calendar"), **Players**
(add many at once, from circle), **Matches** (per court, teams A/B, scores, edit/save),
**Board** (champion + W-L-T-Diff-Pts leaderboard, reset event).
Entities: `padel_session`, `padel_player`, `padel_match` (teamA/B, scoreA/B).

### 🍳 Kitchen — accent `#FF6A4D → #FF9F4D` (coral/orange)
Tabs **Recipes** (categories, cards: emoji/name/minutes/servings, ingredients), **Plan**
(this-week meal plan per day, "Send week's ingredients to Shop"), **Shop** (quick items +
list grouped by aisle, qty, check off, finish run), **Circle** (diamonds-soon, standings).
Entities: `recipe` (+ ingredients), `meal_plan` (date→recipe), `shop_item` (aisle/qty/done).

### 🔐 Family Vault — accent `#0E9D6B → #34D399` (green)
**Documents** (categories with counts + expiry alerts, doc detail = key/value fields + thumb +
expiry, delete) and **Finance** (month overview, top spending, budget per category, expenses,
subscriptions QAR/mo) and **Family** (members). Currency **QAR** (matches the user).
Entities: `vault_doc` (category, fields jsonb, expiry, file), `vault_budget`, `vault_expense`,
`vault_subscription`.

## 2. Audit — fit & risks

- **Reusability:** the bundles' runtime/markup can't be reused directly (custom framework). We
  re-implement in React, but the **design is faithfully portable** — it's the same light/accent
  language KinetikCircle already uses (`--c0/--c1`, cards, soft shadows, rounded).
- **Apps tab today:** grid from `hq_app` → full-screen `AppRunner` (iframe). We add a **native
  registry**: these 4 launch a React component full-screen (portal) instead of an iframe. Any
  real CircleHQ apps still run via the iframe path (keep both).
- **Circle/user linking:** every row carries `circle_id` + `created_by`; the app header shows
  the active circle + user (real, like the rest of the app). RLS via the existing
  `kinetik_is_member` / `kinetik_can_post` helpers (already in 04_moments).
- **Calendar link (the killer feature):** Travel "Sync to Calendar" and Padel "Add session to
  Calendar" create real `kinetik_events` → the apps feed the Calendar/Today we just built.
- **Storage:** Vault document files (and thumbnails) need a private Supabase bucket (`vault`),
  same pattern as the `moments` bucket.
- **Diamonds:** keep the `💎 Soon` placeholder; wire to the diamond economy later.
- **Risk:** scope is large (4 CRUD apps). Mitigate by shipping a shared foundation first, then
  one app at a time, each tsc+build verified, each behind the Apps tab so partial progress is
  isolated and non-breaking.
- **Offline:** apps are cloud-first (no localStorage data); show a friendly empty/error state.

## 3. Build strategy (phased, each phase verified)

**Phase 0 — Foundation**
- `supabase/kinetik/08_apps.sql` — all tables + RLS + any RPCs (one migration, user deploys).
- `src/repo/appsRepo.ts` — typed Supabase CRUD per app.
- `src/apps/AppShell.tsx` — shared header (accent icon, title, circle name, user initial,
  💎 Soon), themed scroll body, bottom tab bar, toast — matches the mockups.
- `src/styles/apps.css` — shared app design tokens + per-app accent vars.
- `src/pages/Apps.tsx` — native registry: the 4 launch React components full-screen; iframe
  path retained for external apps.

**Phase 1 — Travel** · **Phase 2 — Padel** · **Phase 3 — Kitchen** · **Phase 4 — Vault**
Each: repo types + queries, the screen components, wire into the registry, tsc + build green.
Calendar sync built in Phases 1–2.

**Order rationale:** Padel & Kitchen are mostly self-contained; Travel adds Calendar sync;
Vault adds Storage. Build Travel first (proves Calendar sync + the shell), then Padel, Kitchen,
Vault (Storage last).

## 4. Data model (Supabase, all `circle_id` + `created_by`, RLS = circle membership)

- Travel: `kinetik_trip`, `kinetik_trip_activity`, `kinetik_pack_item`, `kinetik_trip_expense`
- Padel: `kinetik_padel_session`, `kinetik_padel_player`, `kinetik_padel_match`
- Kitchen: `kinetik_recipe`, `kinetik_meal_plan`, `kinetik_shop_item`
- Vault: `kinetik_vault_doc`, `kinetik_vault_budget`, `kinetik_vault_expense`, `kinetik_vault_sub`

All read/write gated by `kinetik_is_member(circle_id)` / `kinetik_can_post(circle_id)`.

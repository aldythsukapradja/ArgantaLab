# MMORPG Implementation Roadmap

## Phase 0 - Freeze Contracts

Goal:

Define the data contracts before building server features.

Deliverables:

- Supabase schema draft.
- Static data import contract.
- Client asset metadata contract.
- Link/override/provenance contract.
- Adult vs kids progression policy.
- Diamond ledger policy.

## Phase 1 - Supabase Foundation

Goal:

Create the database foundation.

Deliverables:

- Supabase project.
- Auth setup.
- Core tables.
- RLS policies.
- Migrations in GitHub.
- Seed scripts from `apps/kingdom/data/core`.
- Asset metadata import from `apps/kingdom/data/client`.
- Link import from `apps/kingdom/data/links`.

## Phase 2 - Identity Sync

Goal:

Connect Google, Kinetik Circle, and ArgantaLabs identity.

Deliverables:

- Profiles.
- Account sync links.
- Guardian-child links.
- Circles.
- Account type rules.
- Session heartbeat.

## Phase 3 - Dashboards Shell

Goal:

Build dashboard foundations in Vercel.

Deliverables:

- GM Dashboard shell.
- User Control Dashboard shell.
- Admin auth/roles.
- Navigation.
- Audit Center placeholder.
- Read-only data views.

## Phase 4 - GM Tools

Goal:

Build the tools needed to create missing game truth.

Deliverables:

- Monster Manager.
- Spawn Manager.
- Loot Manager.
- Item Manager.
- Skill Manager.
- Skill Effect Lab.
- Quest Manager.
- Publish Center.

## Phase 5 - User Control Tools

Goal:

Monitor users, progression, ledgers, and safety.

Deliverables:

- Active user dashboard.
- Profile detail.
- Character detail.
- Adult progression dashboard.
- Kids education progression dashboard.
- EXP bank.
- Diamond ledger monitor.
- Milestone dashboard.
- Ranking dashboard.

## Phase 6 - Server Simulation API

Goal:

Move game authority out of the browser.

Deliverables:

- `move_character`
- `enter_map`
- `attack_monster`
- `cast_skill`
- `roll_loot`
- `pickup_ground_item`
- `buy_shop_item`
- `start_quest`
- `advance_quest`
- `complete_quest`

## Phase 7 - Adult Gameplay Loop

Goal:

Make adult combat progression real.

Deliverables:

- Server-owned monster instances.
- Server-owned HP/damage.
- Monster EXP ledger.
- Adult leaderboard.
- Loot drops.
- Inventory mutation.
- Basic skills.

## Phase 8 - Kids Education Loop

Goal:

Make kids progression education-led.

Deliverables:

- Education quest launch.
- ArgantaLabs completion sync.
- Kids education EXP ledger.
- Kids education ranking.
- Guardian visibility.
- Kids EXP source audit.

## Phase 9 - Diamond Integration

Goal:

Connect diamond economy safely.

Deliverables:

- ArgantaLabs diamond mirror.
- Diamond ledger refs.
- Spend request API.
- Purchase confirmation flow.
- Mismatch monitor.
- No local diamond mutation.

## Phase 10 - Realtime And Multiplayer

Goal:

Add live presence and multi-user map state.

Deliverables:

- Supabase Realtime presence.
- Map instance subscriptions.
- Character movement broadcast.
- Monster state broadcast.
- Combat event broadcast.
- Chat rules by account type.

## Phase 11 - Production Hardening

Goal:

Prepare for real users.

Deliverables:

- Rate limits.
- Audit logs.
- Error monitoring.
- Backup strategy.
- Admin permission review.
- Data export/recovery.
- Anti-cheat checks.
- Child safety checks.

## First Build Order

1. Supabase schema and migrations.
2. Static data import.
3. Identity sync.
4. GM Dashboard read-only views.
5. User Control Dashboard read-only views.
6. Skill Effect Lab.
7. Quest Manager.
8. Loot/Spawn/Monster managers.
9. Server action APIs.
10. Adult combat EXP ledger.
11. Kids education EXP sync.
12. Diamond ledger sync.
13. Realtime presence.

## Non-Negotiable Rules

- Client renders only.
- Server decides.
- Kids cannot gain monster EXP.
- Adult monster ranking uses monster EXP only.
- Diamonds come only from ArgantaLabs.
- Client animations come from client assets only.
- Scrape GIFs are references, not final animations.
- GM changes must be audited.
- Totals must be derived from ledgers.


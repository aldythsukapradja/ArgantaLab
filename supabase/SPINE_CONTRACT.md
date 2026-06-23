# Shared Identity & Family Spine — integration contract

One Supabase project backs **three apps** (ArgantaLab, KinetikCircle, Circle HQ),
and more circles/apps are coming. They all share **one** identity + family +
wallet spine. The rule: **the database is the only source of truth; clients are
disposable views.** Never store identity, membership, or diamonds locally.

## Canonical tables
| Table | Meaning |
|---|---|
| `profiles` | one row per human (1:1 `auth.users`). `role` = global role (`user`/`kid`/`admin`/`operator`). The spine. |
| `circles` | a group: `kind` ∈ `family`/`class`/`friends`/… (extensible), `owner_id`, `accent`. |
| `circle_members` | `(circle_id, member_id→profiles.id, role)` — `owner`/`admin`/`member`/`viewer`. Two+ adults per circle is supported. |
| `guardianships` | adult ↔ child, **M:N** (a child may have 2 parents). The authoritative parent↔kid link. |
| `diamond_ledger` | immutable double-entry wallet; `profiles.diamonds` is a cached balance. |

## RPCs every app should call (never query these tables ad-hoc)
**Family / circles**
- `my_children()` → all children of the caller (guardian_id mirror **or** guardianships). Use this for any "my kids" list.
- `my_circles()` → circles the caller owns/belongs to (`role`, `member_count`).
- `circle_roster(p_circle)` → members of a circle (adults + kids) the caller belongs to. **KinetikCircle: use this as the people list for a circle.**

**Linking**
- `link_kid(p_code)` / `adopt_kid(p_username,p_pin)` — attach an existing kid to the caller.
- `invite_to_circle(p_circle,p_code,p_role,p_as_guardian)` → invite a registered **adult** (consent-based).
- `my_invites()` / `respond_to_invite(p_invite,accept)` — invitee's inbox + accept/decline.
- `unlink_kid` / `leave_circle` / `remove_circle_member` / `reset_kid_pin`.

**Wallet (server-authoritative — clients reflect, never decide)**
- `wallet_balance(p_user?)` · `wallet_earn(amount,kind,reason)` (capped) · `wallet_spend(amount,reason)` · `grant_diamonds(p_to,amount,reason)` (parent→own kid) · `wallet_reconcile(p_user?)`.

**Operator (Circle HQ only — `hq_is_operator()` gated)**
- `hq_family_stats()` → circles by kind, members, guardianships, **kidsOrphaned**, multi-guardian kids, avg kids/guardian.
- existing: `hq_schema_insights()`, `hq_portfolio_rollup()`, `hq_dau_mau()`, …

## Security model
Every read/write is gated by RLS + SECURITY DEFINER helpers:
`is_member(circle)`, `is_guardian_of(child)`, `is_circle_admin(circle)`,
`hq_is_operator()`. Kids are isolated; guardians see their children; circle
members see their circle; operators see all.

## How each app plugs in
- **ArgantaLab** — already on the spine (kids, circles, wallet via the RPCs above).
- **KinetikCircle** — replace any local/`kinetik_people`-only roster with
  `circle_roster(circle_id)` (auth members) for shared families; keep
  `kinetik_people` only for non-auth display people, unioned client-side.
- **Circle HQ** — add a Family panel backed by `hq_family_stats()`.

## Migration run order (Supabase → SQL Editor)
`schema.sql` → `migration_analytics_rewards.sql` → `migration_auth_fix.sql` →
`migration_spine.sql` → `migration_circle_invites.sql` →
`migration_wallet_cleanup.sql` → `migration_hq_family.sql`.

All migrations are idempotent and were validated by running them in real
PostgreSQL (PGlite) with assertion suites (identity, M:N guardians, invites,
wallet guards, leak cleanup, family stats).

# Kinetik — Plans. People. Play.

A circle (family / friends / class) coordinates schedules, tracks the *energy*
of how time is spent, and celebrates moments. React + TypeScript + Vite, with
**Supabase as the single source of truth**.

## The one rule that keeps this clean

There is exactly **one** source of truth: the Supabase database. Authority is
strictly one-way:

```
Supabase  ──load──►  dataStore  ──mirror──►  localStorage cache
   ▲                     │                    (read-only fallback, offline only,
   └────write────────────┘                     NEVER seeded with sample data)
```

- **Real data** lives in Supabase tables (`kinetik_circles`, `kinetik_people`,
  `kinetik_routines`, `kinetik_events`, `kinetik_moments`).
- **The cache** (`localStorage["kinetik_cache_v1"]`) is only ever *read* when the
  cloud is unreachable. It is never the source of truth and never contains fake data.
- The little banner at the top of the app always tells you which you're seeing
  (`live` shows nothing; offline / empty / error show a strip). So "is this real
  or local?" is answerable at a glance, always.

No baked snapshot. No dummy seed. No JSON-blob mirror. Those are gone.

## Run

```bash
cd apps/kinetik
npm install
cp .env.example .env.local      # paste your real Supabase URL + anon key
npm run dev                     # http://localhost:5180
```

Without keys the app runs offline against the cache (empty on first run, with a
banner telling you so). With keys it loads your real circle live.

## First-time database setup

In the Supabase project's **SQL Editor**, run, in order:

1. `../../supabase/kinetik/01_schema.sql` — creates the tables + RLS (idempotent).
2. `../../supabase/kinetik/02_seed.sql` — loads the real family data (idempotent).

Both are safe to re-run.

## Architecture

| Folder | Responsibility |
|--------|----------------|
| `data/types.ts` | Domain types only. **No data.** |
| `data/energy.ts` | Energy taxonomy + pure helpers. Energy is *derived from titles*, never stored. |
| `lib/supabase.ts` | The client + `cloudReady` flag. |
| `repo/kinetikRepo.ts` | **The only file that touches Supabase tables.** Row↔domain mapping. |
| `store/dataStore.ts` | Domain data. Loads cloud-first, mirrors to cache. One-way authority. |
| `store/uiStore.ts` | UI state only (tab, theme, filters). Persists *preferences*, not data. |
| `lib/cal.ts` | Calendar math (merge events + routines, clashes). |
| `pages/` | Today · Calendar · Moments · Apps · Me. |
| `components/DataBanner.tsx` | The honesty strip (cloud / cache / empty / error). |

## Security follow-up (next step)

v1 RLS is intentionally open (read + write for anyone with the anon key) so the
family app "just works" with no login wall — acceptable for a single private
circle. When members sign in on their own devices, switch the write policy in
`01_schema.sql` to `to authenticated` + a circle-membership check and add an auth
flow. This is the only deliberate shortcut in the rebuild.

## Deploy

Vercel project, **root directory = `apps/kinetik`**, framework Vite. Set the two
`VITE_SUPABASE_*` env vars in the project settings.

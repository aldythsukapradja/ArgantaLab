# Circle HQ — Founder OS

Operator command center above KinetikCircle + ArgantaLab. Lives in the
ArgantaLab repo at `apps/hq` and shares the **one** Supabase project + schema.

## Run

```bash
cd apps/hq
npm install
# paste the real ArgantaLab Supabase URL + anon key:
cp .env.example .env.local   # then edit (same values as apps/web/.env.local)
npm run dev                  # http://localhost:5273
```

Without real keys it runs on demo data (mock source). With keys, the Pulse tree
pulls **live ArgantaLab numbers** via the operator RPCs.

## Supabase (one project, unified schema)

The `CIRCLE HQ` section at the end of `../../supabase/schema.sql` is **100%
additive** — only `hq_*` tables + read-only `SECURITY DEFINER` RPCs that read
ArgantaLab's tables. Run the whole `schema.sql` in the SQL editor, then grant
yourself operator access:

```sql
update public.profiles set role = 'operator' where email = 'you@example.com';
```

## Architecture (P0)

- `contract/` — the 3 plug-in contracts: `AppManifest`, `InsightRule`, `ProductNorthStar`.
- `data/` — `HQDataSource` seam → `MockDataSource` + `SupabaseDataSource` (real-where-exists, mock-where-empty).
- `insight/` — deterministic rule engine; `insight()` is the call every visual makes (LLM swaps in behind it later).
- `components/` — `InsightCard` kit: `MetricTree`, `Scorecard`, `InsightStrip`, `MetricCard`, `Sparkline`.
- `shell/` — rail, ⌘K command bar, responsive frame, theme store.
- `surfaces/` — Pulse + Portfolio live; the other 7 scaffolded with their planned widgets + rules.

## Deploy

New Vercel project, **root directory = `apps/hq`**, framework Vite. One `git push`
ships both apps.

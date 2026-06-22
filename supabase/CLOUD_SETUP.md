# ArgantaLab — Cloud activation (Step 2)

The cloud account stack is built and ships **gated** behind a real Supabase
connection. Until you do the 4 steps below, the app runs on the local cache
(everything still works). The moment real credentials are present, kids get
real cloud accounts (synthetic-email auth), parents link by friend-code, and
presence + kids-only leaderboard come online.

## 1. Create a Supabase project
- supabase.com → **New project** (free tier is fine). Wait for it to provision.

## 2. Run the schema
- Dashboard → **SQL Editor** → paste the entire `supabase/schema.sql` → **Run**.
  It's idempotent (safe to re-run). This adds the cloud-account columns,
  `friend_code`, the `handle_new_user` trigger, and the `link_kid` /
  `find_by_code` / `touch_presence` / `get_kid_leaderboard` RPCs.

## 3. Turn OFF email confirmation (critical for kids)
- Dashboard → **Authentication → Providers → Email**.
- Disable **"Confirm email"**. Kids have synthetic emails
  (`<username>@kids.argantalab.app`) they can never confirm, so confirmation
  must be off or they can't sign in.
- Leave **Email** provider **enabled**.

## 4. Paste your keys
- Dashboard → **Settings → API**. Copy the **Project URL** and the
  **anon public** key into `apps/web/.env.local` (replace the placeholders):
  ```
  VITE_SUPABASE_URL=https://YOURREF.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
  ```
- Restart the dev server. `cloudEnabled` flips to true automatically.

## How it works once on
- **Kid signs up from zero**: "Who's playing?" → **New player** → name + username
  + PIN + DOB + gender → a Supabase auth user `username@kids.argantalab.app`
  with the PIN as the (padded) password. No parent required. Role = `kid`.
- **Kid logs in** (any device): same username + PIN.
- **Parent** (Google sign-in) → Profile → **Link kid** → enter the kid's
  friend-code → that kid's `guardian_id` becomes the parent. The parent can now
  see the kid (and, in later steps, presence dots + time reports + controls).
- **Presence**: every signed-in account heartbeats `last_seen` each minute.
- **Leaderboard**: `get_kid_leaderboard()` returns kids only — no adults.

## Notes / follow-ups
- PINs are 4 digits, padded to a 6+ char password internally — fine for a kids'
  app with no sensitive data; raise to 6 later if you want.
- Parent-*created* kid accounts (vs kid self-signup) need a server-side admin
  call (service-role) so the parent's session isn't replaced — that's a small
  edge function, deferred. For now kids self-register and parents link.
- Friends graph, time-tracking, and access controls are later steps; their
  tables will be added the same way.

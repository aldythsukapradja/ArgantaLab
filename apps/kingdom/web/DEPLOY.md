# Kingdom web — deploy notes (MP-0)

## 1. Database (once)
Run `apps/kingdom/supabase/001_kingdom_mp0.sql` in the Supabase SQL editor
(KinetikCircle project `bdagdxgpnlialkppjwor`). It only ADDS `kingdom_*`
tables — the existing kinetik `profiles` (incl. `diamonds`) is used as-is.

## 2. Auth
- Kids login works immediately (same synthetic-email scheme as apps/kinetik).
- Google (adults): the provider is already enabled for kinetik. Add the new
  origins to Supabase → Auth → URL Configuration → Redirect URLs:
  `http://localhost:8322` and your Vercel URL.

## 3. Art library for production
The 900 MB `data/` folder is local-only (gitignored, IP policy). For a
deployed build, upload the needed subset (~600 MB) to Supabase Storage:

```bash
SUPABASE_URL=https://bdagdxgpnlialkppjwor.supabase.co \
SUPABASE_SERVICE_KEY=<service role key> \
node apps/kingdom/scripts/upload-client-data.mjs
```

Then set `VITE_DATA_BASE` to the bucket public URL it prints.

## 4. Vercel
Import the repo, set root directory to `apps/kingdom/web`. Env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DATA_BASE` (from step 3)

`vercel.json` already handles SPA rewrites, SW no-cache, and immutable
caching for `/data/`. PWA manifest + service worker ship in `public/`.

## 5. Two-player smoke test
Two browsers (or one normal + one incognito), both logged in (any mix of
adult/kid), both claim nicknames, both open Buya Arena: you should see each
other move, nameplates with 👑/🧒 badges, Space-attack each other (25 dmg,
victim referees), defeat → respawn at the gate + toasts.

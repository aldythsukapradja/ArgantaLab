# Kingdom web - deploy notes (MP-0)

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
The `apps/kingdom/data/` folder is tracked in Git and deployed with the app.
Do not set `VITE_DATA_BASE` for the normal GitHub -> Vercel flow; the client
loads assets from `/data/...` on the same Vercel deployment.

The Vite production build copies `apps/kingdom/data/` into `web/dist/data/`.
Local dev still serves the same folder through the Vite middleware.

Current local size is roughly 953 MB across 14.7k files. This keeps the deploy
simple, but expect slower clones/builds. If Vercel rejects the deployment for
size, move only then to object storage or a Pro plan.

## 4. Vercel
Import the repo, set root directory to `apps/kingdom`. Env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The root `vercel.json` runs `web`'s install/build commands, outputs
`web/dist`, and handles SPA rewrites, SW no-cache, and immutable
caching for `/data/`. PWA manifest + service worker ship in `public/`.

## 5. GitHub push
The data bundle is no longer ignored, so a normal add/commit includes it:

```bash
git add apps/kingdom
git commit -m "Add Kingdom app and tracked game assets"
git push
```

## 6. Two-player smoke test
Two browsers (or one normal + one incognito), both logged in (any mix of
adult/kid), both claim nicknames, both open Buya Arena: you should see each
other move, nameplates with 👑/🧒 badges, Space-attack each other (25 dmg,
victim referees), defeat → respawn at the gate + toasts.

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

Current local size is roughly 953 MB across 14.7k files. This keeps the deploy
simple, but expect slower clones/builds. If Vercel rejects the deployment for
size, move only then to object storage or a Pro plan.

## 4. Vercel — deployed site layout (2026-07-04)
The deployment serves **two apps as one static site**, matching local dev
(where Kingdom Command is the entry point and the Character Lab is reached
through its own nav tab):

```
dist_site/            <- outputDirectory, assembled by scripts/build-deploy.mjs
  command/            <- Kingdom Command (vanilla JS dashboard) — unmodified
  data/                <- shared game data, sibling of both apps
  lab/                 <- built Character Lab React app (web/dist)
```

`/` redirects to `/command/` (the dashboard, matching local dev's landing
page). The dashboard's own "Character Lab" nav tab embeds `/lab/` via an
iframe (`command/views-vault.js`'s `Views.lab` picks `/lab/` in production vs
`http://localhost:8322/` in local dev, based on `location.port`).

Import the repo, set root directory to `apps/kingdom`. Env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The root `vercel.json`:
```
installCommand: cd web && npm ci
buildCommand:   cd web && npm run build && cd .. && node scripts/build-deploy.mjs
outputDirectory: dist_site
```
It also handles the `/` → `/command/` redirect, `/lab/*` SPA fallback, SW
no-cache, and immutable caching for `/data/`. PWA manifest + service worker
ship in `web/public/` and are registered with paths RELATIVE to `/lab/`
(not the site root) since the app is deployed under that subpath.

`dist_site/` is a build artifact (gitignored) — never commit it; Vercel
regenerates it on every deploy via the build command above.

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

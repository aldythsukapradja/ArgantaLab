# Kingdom deploy — domains & auth bridge

Two surfaces ship from **one** Vercel project (`apps/kingdom`, output `dist_site/`):

| Surface | Path in the deploy | Domain | Login |
|---|---|---|---|
| **Kingdom Command Center** (admin data-ops) | `/command/` | `kingdom.arganta.app` | Google, admin-only (you) |
| **Kingdom Heroes** (Character Lab + Buya Arena) | `/lab/` | `heroes.arganta.app` | Google / kid username+PIN |

Client art (`/data/`) is served from this same project with open CORS, so both
Heroes (standalone) and the ArgantaLab arena embed can fetch it.

## How the login binds Command → the Lab

Google OAuth **cannot** run inside an iframe (Google returns 403). So:

1. You sign into **Command** at the top level (`kingdom.arganta.app`) — Google works there.
2. Command loads the Lab in an iframe as `…/lab/?embed=command`.
3. The Lab posts `kingdom-lab-ready`; Command replies with its Supabase session
   (`access_token` + `refresh_token`) via `postMessage`.
4. The Lab calls `supabase.auth.setSession(...)` on its own client and runs
   framed — **no login prompt of its own**.

This works cross-origin, so `kingdom.arganta.app` (Command) and
`heroes.arganta.app` (Lab) can be different origins. Kids never see Command;
they sign into `heroes.arganta.app` directly.

Files: `command/auth.js` (gate + bridge, sender) · `web/src/main.jsx`
(receiver) · `command/views-vault.js` (`?embed=command` + `attachFrame`).

## Adding the two domains (Vercel dashboard — manual, one-time)

1. Vercel → the `apps/kingdom` project → **Settings → Domains**.
2. Add **`kingdom.arganta.app`** and **`heroes.arganta.app`**.
3. Vercel shows a DNS target (usually `cname.vercel-dns.com`). In your DNS
   provider for `arganta.app`, add two records:
   - `CNAME  kingdom  → cname.vercel-dns.com`
   - `CNAME  heroes   → cname.vercel-dns.com`
4. `vercel.json` already routes by host:
   - `heroes.arganta.app/` → `/lab/` (Kingdom Heroes)
   - everything else `/` → `/command/` (Command Center)

   Deep paths (`/lab/*`, `/command/*`, `/data/*`) work on both domains as-is.

> The Heroes URL will read `heroes.arganta.app/lab/`. If you want the Lab at the
> bare root (`heroes.arganta.app/` with no `/lab/`), split into **two Vercel
> projects** — one per app, each built with Vite `base: '/'` — and point one
> domain at each. The postMessage bridge above already supports that (it's
> origin-agnostic); only `/data/` must live with the Heroes project, and
> ArgantaLab's arena data host (the `KINGDOM_DATA_HOST` default in
> `apps/web/scripts/sync-arena.mjs`) should then point at `heroes.arganta.app`.

## Env / keys

The public Supabase anon key is embedded in `command/auth.js` (safe by design —
same key already in the Heroes bundle; RLS protects data). Admin allowlist is
`ADMIN_EMAILS` in that file.

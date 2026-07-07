# LashiraBloom — Sync + Art Handoff (for the next agent)

Date: 2026-07-07 · Written by the session that rebuilt the sync spine (Fable).
Read `.claude` memory `lashirabloom` (v2.11 → v3.1) for the full war story.

---

## 0. Non-negotiable working rules (these stopped a 2-hour regression spiral — keep them)

1. **Harness before humans.** Any change to sync code must pass BOTH harnesses
   before the user is asked to test:
   - `node tests/sync-harness.mjs baginda:1234 keyla:1234` — raw wire protocol
   - `node tests/presence-harness.mjs baginda:1234 keyla:1234` — the REAL
     `joinFarmPresence` module via vite ssrLoadModule
   (run from `apps/lashira/web`; kid password scheme = `${pin}#aLab`)
2. **Never join the live circle as a player.** Test accounts on THROWAWAY topics
   only. The real circle is `farm:f5082b2f-815f-47ca-858c-c5faf4f6d25e`
   ("Keluarga Cerah Ceria"). A rogue agent client logged in as baginda earlier
   caused presence chaos in the family's real session. Listen-only observers
   with a distinct presence key are OK.
3. **Test against the production build**, not vite dev. The user's Kinetik
   iframe hardcodes `http://localhost:5185`. Serve with:
   `cd apps/lashira/web && npx vite build && npx vite preview --host 127.0.0.1 --port 5185 --strictPort`
   Dev-mode HMR + StrictMode double-mount produced multiple false diagnoses.
4. **One change per phase, commit per phase, revert a phase — never patch a patch.**
5. Kinetik production (`circle.arganta.app`) is a LIVE family app. Deploys are
   the user's call. `lashirabloom-game-one.vercel.app` is the deployed game
   (old `lashirabloom-game.vercel.app` is dead).

## 1. Current state (all committed on `main`)

| Commit | What |
|---|---|
| `90093e96` | Checkpoint before rebuild (heartbeat/timestamp era — superseded) |
| `8c08bfb0` | **Sync rebuild**: session singleton (`farm-session.js`), granular intents, rev snapshots, owner Kins (max 6) with owner tags, save reconciliation |
| `719381bd` | Day-FIRST snapshot ordering (rev only breaks same-day ties), New Day splash on every screen, premium Settings (circle NAME pill, Active Kin chips, zoom to 0.1×) |
| (uncommitted this session → commit next) | `setauth-probe.mjs`, `presence-harness.mjs`, live `sync-debug` line in Settings |

**Proven by harness (10/10 + 6/6 green):** transport, presence, ordering,
no-echo, ~300ms latency, session kick, one-session-per-user, intent delivery,
rev-tagged snapshot exchange — all through the real shipped module.

**Architecture** (files in `apps/lashira/web/src/game/`):
- `farm-session.js` — PURE session-singleton logic (harness imports it directly)
- `farm-presence.js` — channel `farm:<circleId>`: presence (key
  `userId:sessionId`), `session-claim`, `player-state` (position + mount +
  owner-simulated Kins + host-simulated animals in `actors`), `farm-intent`
  (granular changes), `state-request`/`farm-state` (rev-gated snapshots)
- `farm-logic.js` — mutations emit intents via `intentSink`; `applyIntent`
  (per-field), `applySnapshot` (day-first, rev tiebreak), `rev` counter,
  `_load()` reconciles cloud vs localStorage and pushes the winner up,
  `freeze()` for kicked sessions, `dayEvent` drives the New Day splash
- `FarmRoom.jsx` — wires it all; `presenceCtrlRef`; 2s presence-only heartbeat
  (background tabs); kicked overlay; day splash; kin owner labels in draw

## 2. P0 — the open field bug: embed shows "0 live (solo)" on both windows

**Evidence:** two Kinetik windows (baginda + keyla, same circle, v3.1 build,
pills show correct circle name + `circle-cloud`) see NO peers. Everything else
(REST, saves, name lookup) works. All sync symptoms (cows/tiles/day/kins
diverging) cascade from this single delivery failure.

**Eliminated by battle test — do not re-investigate:**
- ~~Repeated `realtime.setAuth()` (parent re-posts auth on tab focus)~~ —
  `tests/setauth-probe.mjs` verdict: HARMLESS (channel stays joined, delivery
  continues after 4× setAuth).
- ~~`joinFarmPresence` itself~~ — `tests/presence-harness.mjs` runs the real
  module in node: ALL GREEN including mutual presence and kick.
- ~~RLS/auth/topic~~ — authed↔authed broadcast on the real topic verified.

**The instrument is already in place:** Settings → Circle sync now renders a
live debug line (updates 1/s while open):
`ch:<status><✓|✗> · ws:<socket> · peers:<n> · heard:<x>s ago · s:<session>`

**Decision tree — ask the user for a screenshot of that line in BOTH windows:**
| Debug line shows | Meaning | Fix direction |
|---|---|---|
| `ch:init` or no line | joinFarmPresence never ran | guard failing in embed: check `circleId`/`profile.guest` at presence-effect time; log the guard values |
| `ch:CHANNEL_ERROR/TIMED_OUT` | join rejected in browser | compare WS request in devtools vs node; check apikey/token on the socket URL |
| `ch:CLOSED✗` after being joined | channel died later, no rejoin | add auto-rejoin with backoff in `farm-presence.js` (recreate channel when `!closed && status ∈ {CLOSED, TIMED_OUT, CHANNEL_ERROR}`) — this resilience is worth adding regardless |
| `ch:SUBSCRIBED✓ · peers:0 · heard:never` on BOTH | both joined but isolated | verify both lines show the SAME circle id (pill) and different `s:` sessions; if same session → both windows share one browser profile (bat launchers exist: `KinetikPlayer1/2.bat` use separate `--user-data-dir`) |
| `SUBSCRIBED✓` + peers>0 | wire fine, render/applyPeers bug | inspect `applyPeers` filters (readTile, names) |

**Likely overall fix** once located: small + add the auto-rejoin resilience.
After the fix: both harnesses green → rebuild → user two-window test:
same day within ~2s, till/water appears instantly, Day splash fires on both,
third login as baginda kicks the old window.

## 3. P1 — art reskin to the "Top-Down Component Sheet" reference

User-approved reference: Stardew-style warm pixel sheet (farmhouse, red barn,
shed/coop, market stall, horse, 2 cows, sheep, chicken, trees, signpost,
fences, dirt paths, grass-with-flowers tiles, crop plots: pumpkin/carrots/
wheat/cabbage/turnips/tomatoes/seedlings). Ask the user to save it at
`apps/lashira/web/art/reference/component-sheet.png` (it lives in chat).

**Use the EXISTING override seam — no new engine work:**
- `farm-art-runtime.js` → `loadFarmArtOverrides()` reads table
  `lashira_pixel_art` (VERIFIED live in Supabase; RLS: any authed user reads,
  `public.is_admin()` writes — use the parent account) rows
  `{slot_key, image_data (data-URL), status ∈ active|published|wired}`.
- Every draw function in `farm-map.js` already calls
  `drawOverride(ctx, art, key, x, y, w, h)` first and falls back to procedural.
- **Step 1:** `grep -n "drawOverride" src/game/farm-map.js` → enumerate the
  exact slot keys + their target pixel sizes.
- **Step 2:** map sheet components → slot keys (horse → mount placeholder slot;
  market stall → shop building; coop → shed slot; cow/sheep/chicken → animal
  sprites — note animals need L/R facing: mirror-flip is fine).
- **Step 3:** produce per-slot PNGs. Two sources, combinable:
  (a) slice the reference sheet (small node script with `sharp`, crop boxes);
  (b) PixelLab MCP (`create_map_object`, `create_topdown_tileset`,
  `create_character` for animals) style-matched to the sheet — REQUIRED for
  what the sheet lacks: per-crop GROWTH STAGES (4 stages × 6 crops in
  `data/crops.js`) and animal walk facings.
- **Step 4:** upsert rows into `lashira_pixel_art` (authed as the admin
  account), statuses `active`.
- **Step 5:** verify in guest-mode preview (guests never touch the circle
  channel) — screenshot vs reference.
- Order: terrain tiles (grass/dirt) → buildings → animals → trees/fences/
  signpost → crops. Terrain defines the look; do it first.

## 4. P2 — remaining features (small, do after P0)

1. **Kin loadout picker** (user req): `activeKinIds` (≤6) chosen by the player.
   Store per-USER (personal `lashira_farm_saves` slot `kinloadout` or
   localStorage keyed by profile id for v1). UI: Kin panel (`Panels.jsx`) —
   "Active" toggle per kin + 6-cap counter; `FarmLogic.activeKins()` filters by
   it (currently first-6). Settings "Active Kin" card already displays chips.
2. **Mount verification**: payload already carries `mounted` + mount actor;
   remote render path exists (`remoteMotion` 'Riding'+facing, `drawKingdomMount`).
   Verify visually with two windows once P0 is fixed.

## 5. Test accounts & env

- Kids: `baginda` / `keyla`, PIN `1234` (password `1234#aLab`), both members of
  circle f5082b2f… ("Keluarga Cerah Ceria"). baginda = ABDILDASIGMA.
- Supabase URL/anon in `apps/lashira/web/.env.local`.
- `KinetikPlayer1.bat` / `KinetikPlayer2.bat` (repo root): two isolated-profile
  Edge windows + both dev servers for two-player testing.
- QC pills: in-game ⚙ Settings → Circle sync (circle name, live count, save
  source, and the live channel debug line).

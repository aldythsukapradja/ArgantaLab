# HANDOVER → Opus · Portfolio "Mission Control" pixel-perfect pass

> **STATUS: SUPERSEDED.** The founder asked whether Sonnet could do this pass
> instead of switching to Opus — it did, in-session, same day. See the commit
> after 73b73874 for the actual pixel-perfect pass (north-star strip
> extracted into `NorthStarStrip`, sparse-data states, `McEmpty` unified
> empty-state language, fleet-matrix zebra rows, a real `.mc { flex:1 }` vs
> `.mc-wrap { height:auto }` sizing bug found and fixed at the stacking
> breakpoints, full desktop/tablet/phone/dark-mode battle test). This doc is
> kept as a historical record of the audit findings below, which are still
> accurate — only the "needs Opus" framing is stale.

> For the next session (Opus). State as of commit on 2026-07-12, branch `main`.
> The founder's verdict on v1 of Mission Control: **"still very ugly, not
> responsive, not pixel perfect."** Your job is the design-quality pass — the
> data layer, layout skeleton and chart kit are built, audited and working.

---

## 1 · System state (verified live, don't re-derive)

- **Supabase migration v3 IS RUN.** `app_usage_beats` exists with all sensor
  columns; anon insert probe → 201. RPCs live: `hq_engagement`, `hq_power_curve`,
  `hq_audience`, `hq_geo` (file: `supabase/migration_hq_engagement_v3.sql`,
  self-contained, idempotent).
- **Beats are flowing** from HQ, Landing, ArgantaLab, KinetikCircle (founder's
  screenshot: 57m total). One junk row exists: `client_id='audit_probe'`,
  `page='audit-probe'`, 1s — ignore or delete.
- **LashiraBloom sent no beats — ROOT CAUSE FOUND AND FIXED** in this commit:
  lashira's Vercel build does a subfolder `npm install` with **no workspace
  symlinks**, so `@arganta/usage` failed to resolve → **its production deploys
  were failing since the tracker commit**, and the deployed game (which
  KinetikCircle's KinFarm embeds) never contained the tracker. Fix = explicit
  alias in `apps/lashira/web/vite.config.js` (same pattern as combat/character/
  audio). **Verify after this push: lashira's Vercel project deploys green, then
  open the farm once — the LashiraBloom fleet column flips from "awaiting
  beats" to Connected.** If the founder's lashira Vercel project doesn't
  auto-deploy from main, tell them to redeploy it manually.
- All apps typecheck + build (`npm run type-check` / `build` in apps/hq;
  lashira/web builds).

## 2 · Where everything lives

| Thing | Path |
|---|---|
| Mission Control surface | `apps/hq/src/surfaces/Portfolio.tsx` (+ `portfolio.css`) |
| Exported panels (for the harness) | `FunnelRail`, `AttentionPanel`, `WhoWhen`, `FleetMatrix` |
| D3 kit | `apps/hq/src/components/d3/` — chartkit, AreaTrend, DonutD3, HBars, StackedCols, PunchCard, micro (Meter/VCols/Spark) |
| **Visual test harness** | `apps/hq/charts-dev.html` → `src/dev/charts-dev-main.tsx`. Renders the ENTIRE Mission Control with sample data. **`?sparse=1` = day-one real data shape** (single day, one dominant app, no lashira) — the founder sees sparse data, so test BOTH modes, sparse first. |
| Launch config | `hq-v3` (offline env, port 5294) in `.claude/launch.json`; `hq` (5178) has the real anon key |
| RPC client | `apps/hq/src/data/live.ts` (`engagement/powerCurve/audience/geo`) |
| Types | `apps/hq/src/data/types.ts` |
| Growth v2 additions | `apps/hq/src/surfaces/Growth.tsx` — `UsersActivity` (per-app switcher), `LashiraSnapshot` |
| Concept + benchmarks | `docs/portfolio-v2-concept.md` (a16z/Amplitude framing, sensor audit, COPPA guardrails) |
| Theme tokens | `apps/hq/src/theme.css` — chart palette `--ch1..6`, CVD-validated per mode (dataviz skill validator); **don't invent colors**, use slots. `appColor()` maps app→slot permanently. |

## 3 · Already fixed in this commit (don't redo)

- Axis tick-label pileup on short AreaTrends (adaptive tick budget by height +
  baseline tick label dropped).
- Punch-card day labels overlapping (font 8).
- Top-pages gap map: dropped the app-name prefix (color = app), labelWidth 110.
- Device split: 'unknown' (pre-v3 beats) filtered out.
- Verified: **zero SVG text collisions** in both sparse and rich harness modes
  at 1600×900; no NaN/Infinity anywhere; mc height ≈ 900px (fits 1080p).

## 4 · YOUR TASK — the founder's bar

"Pixel perfect, responsive, not ugly." Concretely, the audit says v1 fails on
*composition*, not correctness. Design debt list, highest impact first:

1. **The north-star strip is cramped and shapeless** — hero number, 5 chips
   (wrapping to 2 ragged rows), a squeezed trend, range seg and live tick all
   compete. Give it a real composition: fixed 3-zone layout (identity zone /
   inputs zone / trend+controls zone) with aligned baselines; consider moving
   the input chips to a single quiet row UNDER the hero. Chips should read as a
   system (equal heights, aligned numerals, maybe delta arrows).
2. **Sparse data looks broken, and sparse is the default reality.** One lone
   stacked column floating in a big empty plot reads as a bug. Design the
   sparse states deliberately: e.g. when `daily` has < 3 days, switch the
   attention chart to an hourly view of today / a "first days of data" framing
   with the total front and center. Same thinking for punch card (3 lit cells
   in a sea of grey) and power-user curve (two bars).
3. **Vertical rhythm & alignment.** Panel titles, section labels (`.mc-sec`),
   note text and chart edges don't sit on a consistent grid. Establish one
   spacing scale (4/8/12) and align every chart's left edge with its panel
   title. The funnel meter rows, retention curve and note stack in `mc-fu`
   feel like three unrelated widgets — unify.
4. **The fleet matrix is the best part — finish it.** Row label column reads
   small vs the cells; consider subtle row zebra or hover-row highlight,
   right-align numeric values on a tabular-nums column grid, and give the
   header sparklines a shared baseline. "XP→learn" as a Value cell wraps
   oddly at some widths.
5. **Responsive is untested territory between 700–1180px** — the two
   intermediate grid layouts exist in `portfolio.css` but got zero design
   attention. Check 768 (iPad portrait), 1024 (iPad landscape), 1366 (small
   laptop, page may scroll — decide and OWN the behavior), and phone 375.
6. **Dark mode pass** — tokens flip, but nobody has judged the dark
   composition (shadows, strip contrasts, punch alpha ramp on `--ch1`).
7. **Empty/awaiting states** — "awaiting beats", the sparse hints, and grey
   `—` cells should share one visual language (currently three ad-hoc styles).
8. Consider a **WorldMap panel** (d3-geo already in repo, `surfaces/WorldMap.tsx`)
   for the regions section once tz data accumulates — concept doc has the spec.

**Constraints (locked, from the founder + prior sessions):**
- ONE page, NO scroll ≥1180px wide (mobile stacks + scrolls; matrix h-scrolls
  in its own container). D3 only — no Recharts on this surface. All numbers
  live (45s refresh already wired). Fixed slot palette, color follows the app.
  Labels in FULL WORDS — truncation was the explicit reason v1 was rejected.
- Commits go to **main**, never feature branches.
- HQ visual language: light-first, hairline borders, `--r-lg` cards, no new
  fonts/colors outside theme.css tokens.

## 5 · How to battle-test (the loop that caught everything so far)

1. `preview_start` config `hq-v3` → open `http://localhost:5294/charts-dev.html?sparse=1`
   (then without `?sparse`). NOTE: this preview window sometimes reports
   `window.innerWidth = 0` (no painting) — call `preview_resize` (e.g.
   1600×900, then 1366×768, 1024, 768, 375) BEFORE trusting any layout
   measurement; screenshots time out in that state, so verify via DOM probes:
   - text-collision scan (bounding-box overlap of all svg text) — must be `[]`
   - `.mc` height ≤ viewport-54 at each desktop size
   - no `NaN`/`Infinity` in body text, no clipped `.u` labels (scrollWidth check)
2. Real data: config `hq` (5178, real anon key) — sign-in is the founder's;
   without it the surface shows the offline Empty (that's correct).
3. `npm run type-check` + `npm run build` in `apps/hq` before commit.
4. The other-chat gotcha: multiple Claude sessions share this repo's git
   index. `git status` before staging; stage ONLY your paths; check
   `git diff --staged` before commit (a Music Builder WIP got swept into
   commit 19f80acc this way).

## 6 · Open items beyond design (backlog, not this pass)

- Growth: app-scope switcher for Retention/Acquisition tabs (currently
  ArgantaLab-only, honestly labeled); ecosystem-WAU overlay on the north star.
- `hq_audience` SQL could exclude null devices server-side (client filters now).
- Delete `client_id='audit_probe'` row; consider a beats retention policy
  (e.g. 180d) before the table grows.
- Landing referrer panel (data now collected via `ref`).

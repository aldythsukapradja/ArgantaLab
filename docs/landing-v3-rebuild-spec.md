# Landing v3 — "The Living Company Page" · Total Rebuild Spec

> **Status**: FOUNDATION — approved for execution. Built by Opus sessions, one phase per session.
> **Owner**: Aldyth Sukapradja · **Authored**: 2026-07-11 (research sessions: cinematic audit → content audit → persona battle-test → this spec)
> **Prime directive**: the landing stops being a brochure *about* the products and becomes a window *into* them. Every product slide hosts the real deployed app in a device frame. The Jarvis cockpit (ported from HQ) is the living proof of "a company that runs itself." One operator login (Aldyth) flips the whole site from demo mode to the live company, including full HQ access.

---

## 0. Non-negotiable rules (read before every phase)

1. **Honesty rule** (inherited from the HQ knowledge graph): every displayed number carries a provenance chip — `● live` / `◐ modeled` / `○ pending`. NEVER present a modeled/simulated number as measured. Words before numbers.
2. **Domain-agnostic**: no hardcoded deployment domains anywhere in landing source. All embed URLs come from env (`VITE_EMBED_*`) with `*.vercel.app` project-URL fallbacks. postMessage origin allowlists are **derived from the configured embed URLs**, never hardcoded.
3. **Every app demo has BOTH a mobile and a desktop frame** (`DeviceFrame kind="phone" | "desktop"`, user-toggleable chip on every embed; default matches the visitor's viewport).
4. **Embed modes (owner decision 2026-07-11 — NO demo accounts)**: public visitors get **posters + the Lashira guest-path embed only** (Lashira needs no account); the Lab/Kinetik/HQ embeds go live **only in operator mode** — the founder logs in with his own credential when presenting. Consequence: unauthenticated embeds must render a clean poster, never a login wall inside the frame. Note: operator-mode presenting shows the real family's data (names, routines) to whoever is watching — acceptable to the owner, but P3 should add a one-key "blur names" presenter toggle to the deck as a courtesy. No real kid names in *static* public copy, ever.
5. **Single source of truth**: all static copy in `src/lib/site.ts`, all modeled numbers from `src/lib/econ.ts`, all live numbers via `src/lib/hq.ts`. No inline fact literals in components.
6. **OAuth never runs inside an iframe** (Kingdom lesson, `apps/kingdom/command/auth.js`). Login happens on the landing top window; sessions reach embeds via the bridge.
7. Preview gotcha: the Claude preview tab runs hidden → rAF paused → GSAP/three won't animate there. Verify via `preview_eval`/snapshot state, not screenshots.
8. Commits go to `main` only (owner rule). `tsc -b && vite build` green before every commit.

---

## 1. Architecture

### 1.1 New information architecture (tabs)

| Tab | Audience | Content |
|---|---|---|
| Home | everyone | hero + trust block + waitlist + proof counters |
| Products | families, hires | 4 product cards (adds **LashiraBloom**) → live embeds → flights |
| About | hires, angels | founder story · Jarvis-lite (orb + agent ticker + OrgFlow) · "The humans" panel + careers CTA |
| Pitch | investors | 26-slide deck v3 (§4) with live embeds + charts |
| **Command** (operator-only) | Aldyth | full Jarvis cockpit + embedded HQ (session-bridged). Public sees a blurred teaser card in About |

Launch overlays stay: Editorial deck (story) · General deck (camera flights, +Bloom flight).

### 1.2 Embed system (`src/embed/`)

- **`embeds.ts`** — config (fallbacks = the CONFIRMED live deployments, 2026-07-11; env always wins):
  ```ts
  // env first, live deployment fallback second. Fallbacks are config, not logic —
  // changing a domain later is an env edit, never a code edit.
  export const EMBEDS = {
    lab:     env.VITE_EMBED_LAB     ?? 'https://lab.arganta.app',
    kinetik: env.VITE_EMBED_KINETIK ?? 'https://circle.arganta.app',
    lashira: env.VITE_EMBED_LASHIRA ?? 'https://lashirabloom-game-one.vercel.app',
    hq:      env.VITE_EMBED_HQ      ?? 'https://hq.arganta.app',
  }
  export const EMBED_ORIGINS = Object.values(EMBEDS).map(u => new URL(u).origin)
  ```
- **`bridge.ts`** — postMessage protocol `arganta:embed@1`:
  - parent → child: `{ t:'arganta:init', nonce, mode:'demo'|'operator', scene?:string, frame:'phone'|'desktop' }`
  - child → parent: `{ t:'arganta:ready', nonce }` · `{ t:'arganta:nav', scene }` · `{ t:'arganta:metric', k, v }` (optional)
  - parent → child (operator only): `{ t:'arganta:session', access_token, refresh_token }` → child calls `supabase.auth.setSession`
  - Handshake: parent appends `?embed=<nonce>` to the iframe URL; child echoes the nonce; parent validates `event.origin ∈ EMBED_ORIGINS` **and** nonce. All other messages ignored.
- **`AppEmbed.tsx`** — `<AppEmbed app scene poster>`: renders a static poster (screenshot/recreation) + "▶ tap to go live"; mounts the iframe lazily only when the hosting slide/card is active AND the user opts in (saves bundle + battery); unmounts when slide leaves.
- **`DeviceFrame.tsx`** — two chromes:
  - `phone`: 390×844 viewport, rounded bezel, notch, scaled via `transform: scale()` to fit slot.
  - `desktop`: 1280×800 viewport inside a minimal browser chrome (traffic dots + URL pill showing the app name, not the raw domain), scaled likewise. Desktop width MUST be ≥ 1080 so target apps render their desktop layouts (kinetik/hq switch ≥ 821px).
  - Toggle chip `📱 / 🖥` on every embed. Default: match visitor viewport. Frame choice is passed to the child via `arganta:init.frame` so apps can adapt.

### 1.3 Auth (`src/auth/`)

Port from `apps/hq`: `lib/auth.ts` (Google OAuth via shared Supabase project) + gate `profiles.role ∈ (operator, admin)`. UI: a small `◆` button in the top bar → login modal; public visitors never see a wall. On operator login:
- Command tab appears; Jarvis switches from public aggregates to live `hq_*` RPCs.
- Embeds receive the session via `arganta:session` (bridge), flipping them to operator mode.
- HQ embed only ever mounts in operator mode.

Landing env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same project `bdagdxgpnlialkppjwor`).

### 1.4 Jarvis port (`src/jarvis/`)

Port from `apps/hq`, adapted stand-alone (no HQ store dependency):
- `ReactorOrb.tsx` (R3F + drei + postprocessing bloom) + the lite-SVG fallback (mobile / `prefers-reduced-motion`).
- `Cockpit.tsx` — the CEO command layout (panels: Reach/Performance/North Star/Insights/AARRR/Agent OS/AI-ML/Activity mix) fed by a `JarvisData` interface with two providers: `publicProvider` (hq_public_pitch + static) and `operatorProvider` (live hq_* RPCs).
- `AgentTicker.tsx` — NEW: streams deterministic agent events (Sense→Compute→Match→Generate→Deliver per office) as a typewriter feed; deterministic schedule seeded from the clock so it always looks alive without faking data claims (events describe *what the agents compute*, values badge-provenanced).
- Boot sequence (GSAP): frame DrawSVG → label scramble → value count-up, staggered per panel.
- Placements: Pitch slide 22 (mini), About panel 2 (orb + ticker), Command tab (full).

### 1.5 Cinematic stack (from the motion audit — applied during P6)

GSAP 3.15 + now-free plugins (SplitText, ScrollSmoother, DrawSVG, MorphSVG, MotionPath, Flip, Observer, ScrambleText, CustomEase) · Lenis 1.3 · d3 (scale/shape/array/interpolate/geo) · three.js + R3F (React 19-compatible line) · shared `src/lib/motion.ts` (eases, durations, reduced-motion guard).

---

## 2. Deployment matrix — all apps on Vercel, domain-agnostic

ALL PROJECTS CONFIRMED DEPLOYED (owner dashboard, 2026-07-11). Remaining actions:

| Vercel project | Live URL | Code changes needed | Dashboard actions (owner) |
|---|---|---|---|
| `landing` | landing-delta-flax.vercel.app | env plumbing (`VITE_EMBED_*`, Supabase) | set env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ optional `VITE_EMBED_*` overrides — fallbacks already point at the live URLs) |
| `arganta-lab` | lab.arganta.app | `?embed` param handling + bridge listener + scene router; **headers** (below) | ✅ deployed |
| `kinetikcircle` | circle.arganta.app | same embed patch; headers | ✅ deployed |
| `lashirabloom-game` | lashirabloom-game-one.vercel.app | embed patch (guest path already verified); headers | ✅ deployed |
| `circlehq` | hq.arganta.app | embed patch incl. `arganta:session` handler; headers with **tight** allowlist | ✅ deployed |
| `kingdom` | heroes.arganta.app | none (not embedded in v3) | none |

**Frame headers** (add to each embedded app's `vercel.json`):
```json
{ "source": "/(.*)", "headers": [{ "key": "Content-Security-Policy",
  "value": "frame-ancestors 'self' https://*.vercel.app" }] }
```
- Demo apps (lab/kinetik/lashira): `https://*.vercel.app` wildcard is acceptable — they hold no secrets in demo mode and this keeps the system domain-agnostic across preview deployments. When custom domains are attached later, append them — one line, no code change.
- **HQ**: same header is tolerable ONLY because HQ has its own auth wall + operator gate; the bridge nonce + origin check adds a second layer. Still, HQ's embed listener must ignore `arganta:session` unless `event.origin` is in **its own** allowlist env (`VITE_PARENT_ORIGINS`).
- The naming above is a suggestion; whatever the real Vercel project URLs are, they go in the landing's `VITE_EMBED_*` env — code never cares.

**Root-repo note**: the repo-root `vercel.json` builds `apps/hq` — that is the "hq" Vercel project pinned to repo root. Leave it; landing project must keep Root Directory = `apps/landing`.

---

## 3. Page-by-page build spec (tabs)

### 3.1 Home
- Hero: SplitText line-mask reveal; Buddy idle loop; kicker/lede from `site.ts`.
- **Problem stat corrected**: replace `2.5 hrs` with `~5.5 hrs/day` (Common Sense Media, tweens; keep "directional" footnote), derived copy "≈ 2,000 hours a year".
- **Trust block** (new, above the fold on mobile scroll 2): "No ads · No strangers · Private by design · COPPA/GDPR-K posture" — 4 chips + one line.
- **Waitlist capture** (new): email input → `mailto:` fallback now, Supabase `waitlist` table when available. CTA pair: "Join the waitlist" (primary) + "Watch the story".
- Proof counters count up on entrance (gsap).

### 3.2 Products
- **4 cards** (order): ArgantaLab (violet, "The kid's pull") · **LashiraBloom** (leaf-green `#65a30d`, "The family plays together — adults play, kids learn") · KinetikCircle (cyan, "The parent's stick") · Circle Apps (emerald, "4 live · 9 planned").
- Each card: hover/tap = live `AppEmbed` mini-preview (phone frame); "Enter" = Flip morph into that product's flight (Bloom flight is new, §6).
- `site.ts` gains the Bloom product entry + `EMBEDS` scene mapping.

### 3.3 About (3 panels)
1. **Founder** — story below (§8), no photo (typographic portrait: initials monogram in the halo instead of an image). Stats strip stays (1 human · 27 agents · 6 offices · 24/7).
2. **The machine** — Jarvis-lite: orb (lite mode) + `AgentTicker` + OrgFlow with DrawSVG edge cascade + office legend.
3. **The humans** (new) — what the human does (taste, judgment, curriculum direction, parenting insight), stack chips (React 19 · Supabase · GSAP · d3 · PixiJS · R3F · agent OS), "Work with us → hello@arganta.app" CTA. Blurred Command-tab teaser card: "Operator cockpit · access gated".

### 3.4 Command (operator-only)
- Full `Cockpit` + boot sequence; d3-geo rotating orthographic globe replaces the flat WorldMap panel; verdict interrupts (from `hq_*` when operator).
- "Open full HQ" panel → `AppEmbed app=hq` in desktop frame with `arganta:session` handoff; also a plain "Open in new tab" link (belt and braces).

---

## 4. Pitch Deck v3 — 26 slides, every figure and chart

Chapters: OPEN (1–7) · PROOF (8–13) · NUMBERS (14–21) · MACHINE (22–24) · CLOSE (25–26).
Every metric renders through a `<Fact>` component: value + provenance chip + one-line definition on hover/tap.

| # | id | Copy (headline · sub) | Figure / chart spec | Data |
|---|---|---|---|---|
| 1 | cover | "Turn screen time into **intelligence time**." · "Live where measured, badged where modeled — never faked." | provenance legend chips draw in (DrawSVG + scramble) | — |
| 2 | thesis | "Kids see play. Parents see growth. **The family plays together.**" | 3-beat SplitText reveal | site |
| 3 | northstar | "Weekly **Two-Hook** Families." · definition + two hook cards | live W2F sparkline (d3 area, 12wk) + `◐` household-D30 formula chip | hq_public_pitch + econ |
| 4 | problem | "~5.5 hrs a day. **Building nothing.**" | count-up bignum + hour-block pictogram (d3, 24 blocks, 5.5 filled) | site (fixed) |
| 5 | market | "A generational market — and **nobody owns both halves**." · landscape table: each incumbent owns ONE half (learning OR coordination), none owns the family graph across both | competitor landscape figure (2-axis: learning depth × family coordination; plot Roblox/Duolingo/Khan-Kids/Prodigy on one axis, Life360/Skylight/Cozi/Maple on the other, Arganta alone in the upper-right) + benchmark chips from §11.2 | site + §11.2 |
| 6 | whynow | "Every pillar is already proven." | 3 cards (Roblox 124B hrs · Duolingo 50M+ DAU · Life360 80M+ users) + AI-cost mini-curve | site |
| 7 | wedge | "Don't fight the screen. **Redirect it.**" | attention-flow figure: arrow re-routed mid-path (MotionPath draw) | — |
| 8 | map | "One OS, four surfaces — one brain above." | interactive d3-force mini-constellation (4 product nodes + HQ hub); node click → jump to slide 9–12 | registry |
| 9 | lab-live | "ArgantaLab — **the kid's pull.**" · one-line: six worlds, KinQuest, build-and-ship · **wedge chip**: "Roblox has the hours, Duolingo has the habit — neither shows a parent what grew" | **AppEmbed lab** · scene `kinquest` · phone/desktop toggle · poster for public, live in operator mode | EMBEDS |
| 10 | bloom-live | "LashiraBloom — **adults play, kids learn.** Same world." · XP rule in one line: "grown-up playtime converts into the kids' learning fuel" · **wedge chip**: "the first family game where a parent's playtime funds the kid's learning — no incumbent has this loop" | **AppEmbed lashira** · scene `farm` · GUEST PATH — live even for public visitors · both frames | EMBEDS |
| 11 | kinetik-live | "KinetikCircle — **the parent's stick.**" · **wedge chip**: "Skylight/Cozi organize the week; none of them know what your kid learned today" | **AppEmbed kinetik** · scene `today` · poster for public, live (real circle) in operator mode · both frames | EMBEDS |
| 12 | circleapps | "Every family task, covered." · "**4 live · 9 planned**" · **wedge chip**: "every app inherits the trusted circle — no new graph to build, ever" | 13-dot app grid, 4 lit (stagger pop) | site |
| 13 | engagement | "The pre-revenue truth." | 4 `<Fact>` cards: W2F · WAU · stickiness · depth — all `● live` (REQUIRES §9.1 SQL) | hq_public_pitch |
| 14 | growth | "Weekly growth is the whole game." | d3 line, 7% vs 10% WoW, log toggle, draw-in + end labels | econ growthCurve |
| 15 | intelligence | "The graph parents pay for." | 3 Facts + accuracy gauge with 55–85 healthy band (d3 arc) | live |
| 16 | retention | "Two hooks keep them." | d3 retention curves + 35% ref line · chips: `● D30` `● D1` `◐ 47% household` | live + econ |
| 17 | flywheel | "Circles make it grow itself." | k-factor **with shown numerator/denominator** ("x of y invites accepted") + invite mini-Sankey | live |
| 18 | economy | "Kids already spend. Parents will pay." | mint-vs-burn bars + float + coverage donut | live |
| 19 | unitecon | "Break-even ≈ **462 families** — and the per-payer truth." | cash curve w/ break-even marker **+ NEW per-payer LTV:CAC fan: Low 0.7× / Mid ~2.9× / High ~14×** (d3 bar trio) · framing line: "conversion is the one lever; invite-led CAC ($1.50) de-risks it while we fix it" | econ (+ NEW `ltvPerPayer()` in econ.ts) |
| 20 | model | "A defensible fan of outcomes." | ARR band chart Low/Mid/High, `◐` | econ |
| 21 | scale | "A whole company for ~$3/mo." | cost/active log-curve + $0.08 ref line | econ |
| 22 | **jarvis** | "One human. **27 agents. Six offices.** Watch it run." · substrate line: "**Seven front-ends. One spine.** One Supabase project (71 tables · 147 RPCs), one identity/circle model, one wallet, shared `packages/*` engines — every product is a skin on the same substrate" | **live mini-Cockpit embed** (orb + AgentTicker + office health dials) + substrate figure: one spine node fanning to 7 app nodes (DrawSVG) | jarvis publicProvider + substrate facts in site.ts |
| 23 | velocity | "What the agent OS shipped in 12 months." | d3 timeline: products (Lab, Kinetik, Bloom, KinQuest, Studio v2) + 10 builder surfaces + engines, one founder swimlane | curated ship log in site.ts |
| 24 | valuation | "Valuation — **computed, not negotiated**." · the LADDER: today **$1.73–2.27M** ◐ (pre-traction weights) → first paying families flip the engine (+$1.28M Berkus + weights shift to RFS/Scorecard) → **$3.5–5.3M** ◐ → at ~$1M ARR, market comps price 6–10× (Duolingo ≈6×, Life360 ≈9×, Maple ≈3×) → **$6–10M** realistic | d3: 6-method dumbbell plot + a 3-step ladder figure with the levers labeled on each step; EVERY bar `◐ modeled` | §11.1 snapshot (mirror to static JSON, date-stamped) |
| 25 | gtm-vision | "From one circle to every family." · invite k-loop → classrooms → **Doha + Indonesia** communities → one OS for every family | d3-geo map, two highlighted regions + loop diagram | site |
| 26 | ask | "Built by a parent. **Raising [AMOUNT] to reach 10,000 families.**" · 3 use-of-funds cards · mailto CTA | — (AMOUNT: owner input pending; ship with "Raising a pre-seed" until set) | site |

Deck chrome: progress bar · chapter rail · Observer-driven nav (replaces wheel accumulator) · per-slide GSAP timelines · all slides fit non-scroll mobile (390×844) + desktop.

---

## 5. Editorial deck v3 (12 slides)
Keep hero → thesis → problem(stat fixed) → product → make. **Insert `bloom`** after `family`: "Then the whole family plays." + Bloom poster/embed. `agents` slide: OrgChart → OrgFlow + orb-lite. `founder`: story §8, delete the `note` render. `cta`: + waitlist form. P6 later restores true scroll-narrative mode (ScrollSmoother), structure unchanged.

## 6. General deck (flights)
- **NEW Bloom flight** (product lane, laneY ≈ 6100 — between circleapps 5200 and vision 6900): scenes `arrive` (farm vista poster) → `grow` (plant/water/harvest loop) → `together` (adults-play-kids-learn XP rule figure) → `realms` (RealmRoom art) → `live` (AppEmbed, both frames).
- Company flight: replace the two placeholder scenes — `model` gets modeled tiers + `◐` chips; `ask` gets real headline; `builders` scene becomes the Jarvis teaser (orb-lite + "operator cockpit").
- Circle Apps `overview`: "Nine apps" → "4 live · 9 planned".

---

## 7. Content truth punch-list (execute first — P1)

| id | Fix | File |
|---|---|---|
| C1 | Founder story in (§8); delete `note:'add photo + story'` and every render of it | site.ts, appscreens.tsx, EditorialDeck |
| C2 | Kill "Placeholder pricing/Real metrics to be supplied" scenes (replace per §6) | scenes.tsx |
| C3 | Run `HQ_PUBLIC_PITCH.sql`; set landing Supabase env; soften cover claim (slide 1 copy above) | Supabase + Vercel + PitchDeck |
| C4 | `ltvPerPayer()` + per-payer fan (slide 19) | econ.ts, PitchDeck |
| C5 | GTM/competition content (slides 5, 25) | site.ts, PitchDeck |
| C6 | Velocity ship log data | site.ts |
| C7 | Ask amount placeholder-safe copy until owner sets it | site.ts |
| C8 | `<Fact>` provenance chip component used everywhere | new component |
| C9 | Problem stat ~5.5h; Life360 "80M+ users"; seat-claim rewrite | site.ts |
| C10 | agents.ts: comment "25"→27; MODEL_META "Sonnet 4.6"→"Sonnet 5"; note LLM-backed C-suite (one seam, deterministic-first) | agents.ts |
| C11 | Waitlist capture on Home | appscreens.tsx |
| C12 | Trust block + The-humans panel | appscreens.tsx |
| C13 | "4 live · 9 planned" | scenes.tsx, site.ts |
| C14 | Editorial demo date un-freeze (derive from `new Date()`); OrgChart→OrgFlow | EditorialDeck |
| C15 | Delete `Hub.tsx`; convert `OnePagerDeck` → press-kit page or delete | src/ |
| C16 | **Live-data quality pass** (RPC verified working 2026-07-11; first real payload exposed these): ① `depth` reads 97.6 because `hq_activity` counts every touchpoint, not questions — either relabel the card "actions / active / wk" or recompute from learning-kinds only; ② `econCoverage` reads 1169% (recurring mint is tiny vs spend) — reframe the card as "demand outstrips recurring earn — sinks are working" or show spent-vs-minted instead of the ratio; ③ `kids` reads 0 — count `profiles where role='kid'`, not `child_profiles`; ④ `spentPerActiveKid` 39,615 needs Argon-compact formatting ("39.6k ⬦"); ⑤ small-n framing everywhere: "household-scale pilot — real usage, tiny denominator" so WAU 5 reads as honest, not broken | HQ_PUBLIC_PITCH.sql + PitchDeck |

## 8. Founder story (approved draft — owner may replace anytime)

> **Aldyth Sukapradja · Founder & human CEO**
> "I'm a parent who watched the same battle every family knows — the screen always wins. So instead of fighting it, I rebuilt what's on the other side of it. Every evening after work I shipped another piece: a learning world my own kids actually ask to open, a calendar my household actually runs on, a farm we play together on weekends. I couldn't hire a team, so I built one — twenty-seven AI agents across six offices, run from a command deck I also built. Arganta is my answer to one question: what if the hours our kids already spend on screens quietly became the hours that build them?"

Short form (About stats strip context): "One parent, building the company his own family runs on."

## 9. Owner actions & inputs (the only blockers)

1. ~~Run `HQ_PUBLIC_PITCH.sql`~~ ✅ DONE + VERIFIED 2026-07-11 — anon RPC returns real data (wau 5, mau 15, d1 62%, lessons/kid/day 3.3, items 912, gamesPublic 34, flywheel 4/4 circles). Data-quality follow-ups → §7 C16.
2. **Set Vercel env on the `landing` project** — NOT DONE (verified 2026-07-11: the deployed bundle at landing-delta-flax.vercel.app contains zero Supabase references, so no env was baked at build). Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (same values as apps/web/.env.local) in Vercel → landing → Settings → Environment Variables, then redeploy. Local dev: `apps/landing/.env.local` created 2026-07-11 (gitignored ✓).
3. ~~Demo accounts~~ DROPPED by owner decision — operator presents logged-in; public gets posters + Lashira guest embed (rule §0.4).
4. Ask amount + instrument for slide 26 (deck ships placeholder-safe without it).
5. (Optional, later) real founder story/photo to replace §8.

## 10. Phase plan — one Opus session each

| Phase | Scope | Status (2026-07-11) |
|---|---|---|
| **P1 Content truth** | §7 C1–C15 + §8 story + §9.1 SQL wiring | ✅ SHIPPED (commit c40d3394) — verified: zero placeholder leaks, all facts fixed, SQL live (hq_public_pitch→200), founder monogram, trust/waitlist/humans, LashiraBloom product. Remaining: C16 live-data-quality relabels (depth/econCoverage/kids) — deferred into P4 |
| **P0 Foundation** | §1.2 embed system + §1.3 auth + §1.5 deps + §2 code-side | ✅ SHIPPED (f97198d7) — verified: embeds.ts (domain-agnostic), bridge.ts (nonce/origin), DeviceFrame phone+desktop, AppEmbed poster→go-live, auth ◆ button, supabase/d3 chunks. Lashira loads in-frame (200). **NOT done: cross-app bridge listeners** (`?embed` handler in web/kinetik/hq) — needed for Lab/Kinetik/HQ operator-live embeds → P4 |
| **P3 Deck v3** | §4 slides + d3 charts + `<Fact>` chips | ✅ SHIPPED (fc4acb1a) — 25 slides verified: LashiraBloom live embed, valuation RangePlot+ladder, velocity swimlane, competition ScatterMap, per-payer PayerBars, provenance legend. DeckCharts.tsx (d3). Remaining: Observer nav (still wheel-accumulator), C16 relabels |
| **P2 Jarvis** | §1.4 Orb + ticker + placements | ◐ CORE SHIPPED (d78a3af5) — JarvisOrb (CSS-SVG reactor) + live agent ticker in About panel 2, verified advancing. **NOT done: full R3F orb, operator Command tab (embedded HQ), pitch-slide-22 mini-cockpit** → P2-follow |
| **P4 Tabs & flights** | Products live embeds + Bloom flight + cross-app patches + C16 | ☐ TODO — Products 4-card live embeds; Bloom flight in General deck (laneY≈6100); cross-app `?embed` listeners in web/kinetik/hq (each needs its own repo + deploy + verify); C16 data relabels |
| **P5 Deploy pass** | poster images, env verify, perf | ☐ TODO — landing Vercel env (owner set it; redeploys on each push now); poster screenshots for embeds; mobile perf pass |
| **P6 Cinematic layer** | SplitText/Flip/DrawSVG/ScrollSmoother/MotionPath, sky shaders | ☐ TODO — the motion-rebuild table, on top of finished content |

Session kickoff prompt template: *"Read docs/landing-v3-rebuild-spec.md. Execute phase Pn exactly as specced. Do not renegotiate architecture decisions in §1–2. Verify per the phase's definition of done. Commit to main."*

---

## 11. Market intelligence pack (researched 2026-07-11 — refresh quarterly)

### 11.1 Valuation — now and the realistic ladder (all ◐ modeled unless noted)

Source: the HQ knowledge graph's six-method valuation engine (`valuation_estimate` / `valuation_levers`) + July-2026 public comps.

- **Today (pre-payment)**: recommended **$1.79–2.36M** pre-money (REFRESHED 2026-07-11: cost-to-duplicate re-measured at $0.35–0.60M — 122k source LOC incl. the post-quarter LashiraBloom/Kingdom/forge work, × $3–5/LOC contractor replication; constant updated in `apps/hq/src/data/graph/valuation.ts`). Pre-traction weighting favors Cost-to-Duplicate and Berkus ($0.81–1.11M); the traction methods already sit higher (RFS $4–5.25M, Scorecard $4–5M, VC $3.5–4.38M, First Chicago $2.6–3.41M) but get low weight until payment is live. NOTE: the read-only MCP graph deployment still serves the pre-refresh seed ($1.73–2.27M) until redeployed — the deck must snapshot from valuation.ts, not the MCP.
- **Levers, ranked by deterministic $ impact** (from `valuation_levers`):
  1. **Wire stage.pay live — first real paying families**: +$1.28M direct Berkus impact AND flips the synthesis weights toward the $4–5M methods. THE lever.
  2. Close CTO instrumentation gap 69%→70%+: +$0.25M (RFS technology-risk factor).
  3. Instrumentation coverage 78%→100%: +$0.11M (Berkus prototype score).
- **The ladder** (what slide 24 draws): today $1.7–2.3M → payment live + first cohort retained ≈ **$3.5–5.3M** (the engine's own post-flip range) → ~$1M ARR with W2F retention proven ≈ **$6–10M** (private multiple 6–10× anchored to compressed 2026 public comps below; Maple's real 3.3× is the bear anchor). The engine's own bull-case exit assumption ($25M ARR × 7× revenue) is CONSISTENT with 2026 public multiples — defensible in diligence.
- Never present any rung as measured. The ladder is the honesty story: "our valuation is an output of the same graph that runs the company."

### 11.2 Competitor benchmark table (slide 5 landscape + wedge chips)

| Competitor | Owns | Scale (Jul 2026) | What they DON'T have | Our wedge |
|---|---|---|---|---|
| Roblox | kids' hours, UGC games | **$40.4B** mkt cap | zero learning signal, zero parent trust surface | kids build & ship games that *report growth to parents* |
| Duolingo | daily learning habit | **$6.04B** (≈6× rev — note: compressed from ~$13B, multiples are DOWN) | single-player habit; family is an afterthought | learning lives inside the family circle, two-hook retention |
| Khan Kids / Prodigy / SplashLearn | curriculum content | free/low-ARPU | no family OS, weak game pull | six-intelligence worlds + real game economy |
| Life360 | family location graph | **$4.62B** (≈9× rev) | safety-only; no learning, no daily joy | the circle graph that *does* something together daily |
| Skylight | family calendar hardware+app | 9.3M users, bootstrapped, $50M debt, 99% YoY | organizes the week; no idea what the kid learned | "the calendar that knows what your kid learned" |
| Cozi / Maple / Hearth | family organizer apps | Maple ≈ $1.28M rev ≈ **$4.2M** val (the realistic early-stage anchor) | commodity features, no moat graph | circle graph + wallet + learning = compounding, not commodity |
| Google Family Link / Apple Screen Time | screen-time policing | platform defaults | punitive framing; measure time, not growth | redirect the screen instead of policing it |

Positioning figure (slide 5): 2-axis map — x = learning depth, y = family coordination. Every incumbent clusters on ONE axis; Arganta alone upper-right. This is the market slide's whole argument.

### 11.3 Persona priority matrix (what each audience needs, ranked — drives slide emphasis + tab routing)

| Priority | Angel | VC | Future employee | Parent |
|---|---|---|---|---|
| 1 | founder story (slide 26/About) | retention + W2F (16, 3) | mission + what humans do (About) | safety/trust (Home block) |
| 2 | velocity proof (23) | per-payer unit econ (19) | tech stack + builders (22, Command teaser) | "does my kid learn" (9, 15) |
| 3 | one repeatable number (23 or 10) | wedge vs incumbents (5, 9–12) | momentum/velocity (23) | price + try now (10 guest embed, waitlist) |
| 4 | simple concrete ask (26) | GTM + market (25, 5) | working product (embeds) | — |
| anti-priority (don't lead with) | methodology detail | cinematics, org chart | valuation, unit econ | anything investor-flavored |

Routing rule: About tab optimizes for employee+angel, Pitch for VC, Home+Products for parent. The deck's OPEN chapter is persona-neutral; PROOF leans parent-evidence, NUMBERS leans VC, MACHINE leans angel+employee.

### 11.4 Substrate facts (slide 22 + site.ts constants — from the owner's platform doc)

One Supabase project: **71 tables · 147 RPCs** · one identity/circle model · one wallet · shared `packages/*` (audio, character, combat, heroes-engine) · **seven front-ends** on the spine (web, kinetik, lashira, kingdom, hq, landing, mcp). Line: "Competitors would have to rebuild the spine, not clone an app." Keep counts as site.ts constants — refresh when the platform doc updates.

Sources (refresh these when re-benchmarking): [Duolingo mkt cap](https://companiesmarketcap.com/duolingo/marketcap/) · [Life360 mkt cap](https://companiesmarketcap.com/life360/marketcap/) · [Roblox mkt cap](https://www.macrotrends.net/stocks/charts/RBLX/roblox/market-cap) · [Skylight $50M + 9.3M users](https://www.nasdaq.com/press-release/skylight-fuels-family-first-innovation-50-million-financing-sg-credit-partners-and) · [Maple revenue/valuation est.](https://prospeo.io/c/maple-family-app-revenue) · [Skylight Calendar 2 launch](https://techcrunch.com/2026/01/07/skylight-debuts-calendar-2-to-keep-your-family-organized/)

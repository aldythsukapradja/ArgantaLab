# Biography Studio v3 — Audit & Update Plan (EXECUTED ✅ 2026-07-17)

## v3.1 — "make it read like a person" (EXECUTED, same day)

Founder feedback: *where are the hobbies · make it look like an actual profile including the
writing · use the Arganta formal photo · ensure consistency between Aldhyt and Arganta.*

**Parity audit found four gaps** — the twin had no Education, no Awards, no Publications, and
neither profile had Interests. The twin also mixed biography with marketing ops (content pillars,
launch posts), which is *why* it read like a deck rather than a person.

Fixed:
- **Interests on both profiles** — padel, swimming, the gym, RPGs (Pokémon/Suikoden/FF and what
  each taught him), racing sims, the two Land Cruisers, after-hours building, teaching, family
  first. Written as a person writes, per the Character Bible. No invented details (children's
  number/gender deliberately not stated — the bible doesn't).
- **Twin gained Education, Publications, Honors & Awards** and now carries all 8 human sections.
- **`playbook: true`** flag on the 9 canon sections. They render below a "Brand playbook" divider,
  and are excluded from the LinkedIn copy and the printed profile — brand ops are not biography.
  The `Non-negotiables` block was likewise dropped from the PDF (stays on screen + Core export).
- **Structural parity enforced**: both profiles now use LinkedIn's own order — About → Experience →
  Education → Skills → Projects → Publications → Honors → Interests. The twin keeps only its
  narrative subtitles ("the five eras", "the worlds"). Verified `parity: true`.
- **`AWARDS_TWIN`** authored separately: scrubbing the real list produced "the operator's innovation
  award — the operator, three consecutive years" — accurate but obviously machine-mangled. Same
  facts, phrased once, properly. (Same reason `ABOUT_TWIN` / `INTERESTS_TWIN` exist.)
- **Twin display photo** = `/biography/arganta-formal.png`, copied from the Influencer Studio's
  `arganta-formal.webp` (the persona's own portrait; the founder's real photos carry employer
  branding, which canon forbids exposing).
- **New: `profileToLinkedIn()`** + a "Copy for LinkedIn" action — plain text, LinkedIn's section
  names, playbook stripped, twin scrubbed. Generated file: `knowledge-base/arganta-linkedin.txt`.

Gates re-run: parity true · LinkedIn + KB leak gate 0/12 on both files · real profile keeps 11 names ·
all 5 CV templates still 297.1mm one page · print excludes playbook · tsc + build clean.

## v3.2 — Intro Deck & Journey follow the HQ theme (EXECUTED, same day)

Founder feedback: *Journey and Intro Deck are not following the app theme — ensure readability
for all, do not only change the background blindly.*

v3 shipped these two cinematic stages hard-coded dark in both HQ themes ("a cinema screen doesn't
change with the room lights"). Wrong call — a founder using light HQ got a jarring dark island with
no way out, and reverting to a naive `background: var(--paper)` swap would have made most of the
~35 hand-picked muted text tones (`#8A97AA`, `#7C8AA0`, `#55617A`, …) nearly invisible on a light
background, because they were tuned as light-on-dark only.

Fixed with a dedicated **stage token family**, separate from the dossier's `--paper`/`--ink`/`--hair`
(the two surfaces have different needs — giant low-opacity watermark numbers, glass panels, physical
photo prints — that the paper tokens were never tuned for):

- Only **`--stage-bg`** and **`--stage-ink`** are set per theme (light: `#F5F3EC`/`#14171D`; dark:
  `#0B0E14`/`#E8EDF5`, unchanged from before). Every hierarchy tier below —
  `--stage-ink-85/-70/-55/-40/-28`, `--stage-line`, `--stage-line-soft`, `--stage-fill`,
  `--stage-fill-2` — is `color-mix()`'d from `--stage-ink`, so it recomputes automatically in both
  themes instead of needing a hand-tuned light/dark pair per tone.
- Two genuine exceptions, set directly per theme rather than derived: **`--stage-vignette`** (a
  vignette needs a different *strength* per theme, not just a different hue — `rgba(0,0,0,.6)` dark,
  `rgba(20,22,27,.10)` light) and **`--stage-giant-op`** (the watermark year number's opacity — `.045`
  dark, `.07` light, since dark ink reads fainter at the same opacity than light ink does).
- The physical photo print (`.jt-photo`) stays literal white regardless of theme — a printed photo on
  a desk doesn't change color with the room, same reasoning as the A4 page staying paper.

**"Ensure readability, don't just swap background blindly"** — audited every replaced tone by
computing real WCAG contrast ratios (relative luminance, alpha-composited over the actual stage
background) rather than assuming a hue swap was enough:
- The original `#8A97AA`/`#7C8AA0` tier (secondary meta text) measured a healthy ~5.5:1 in the old
  dark-only design, but naively mapped at the same 55% mix would only hit **3.87:1 in light theme** —
  below WCAG AA (4.5:1) for small text. Raised to 62%: **6.69:1 dark / 4.84:1 light.**
- The eyebrow-caption tier (`#6B7B90`/`#55617A`) was the worst offender — **2.51:1 in light theme**,
  functionally unreadable. Raised to 58%: **5.97:1 dark / 4.26:1 light.**
- `.jt-era` (inactive era-tick year labels) had been wired to the icon/dot tier (28%, non-text,
  3:1-class) even though it renders actual navigational text; moved it to the readable 58% tier.
- Icons and dots (non-text, WCAG 1.4.11's 3:1 class rather than 4.5:1) kept a lower, distinct tier,
  nudged 28%→34% for a bit more presence without over-fixing what isn't body text.

Verification note: a same-value oklab color surfaced once during testing on a `.jt-era em` that had
been repeatedly hover/clicked by the automated test itself (a stale mid-`transition` artifact, not a
theme bug) — confirmed clean (contrast 5.97 dark) on a freshly reloaded, untouched element and on
every other measured tier.

Gates: tsc + build clean · no raw hex/rgba remaining in the deck/journey CSS block except the
intentional always-white photo print · both stages verified to flip with `data-theme` while holding
≥4.2:1 contrast on every text tier in both themes.


> **STATUS: BUILT + VERIFIED by Opus, end-to-end. T1–T8 all done.**
> Verified numbers: theme flips chrome (ivory `#EFECE4` ↔ charcoal `#0B0E14`) while the A4 stays
> paper `rgb(253,252,249)` in BOTH themes · Journey rail lands on exact targets (slide 5 = −4272px
> vs −4272 expected, slide 10 = −9612 vs −9612), year 2010→2014→2022, line draws 1003→0 and
> reverses · autoplay silent while `document.hidden`, then advances 1→2→3 on the 7s timer ·
> twin = 5 eras + 13 sections + 15 rules · leak gate 0/12 · all 5 CV templates 297.1mm one page in
> both themes · print 210×297mm · 6 real logos load, NOC degrades to monogram · tsc + build clean.
> Bundle **shrank 116kB → 87.5kB** (ScrollTrigger removed with the scroll runway).
>
> **Bugs found and fixed while executing (not in the plan):**
> 1. **`gsap.context()` + `ctx.revert()` with `idx` in the deps** reverted the tweens' inline styles
>    on *every slide change* — the rail snapped back to zero before each transition. Tweens in a
>    slide deck must persist; they are killed on unmount instead. This is why the rail read
>    `transform: none` in testing.
> 2. **The new persona could never have shipped.** The store loads from localStorage, so a changed
>    `DEFAULT_PROFILES` is invisible to anyone with a saved payload — the founder already had
>    `hq_biography_v2`. Added a **v2→v3 migration**: the real record keeps every founder edit, the
>    twin is replaced by the new seed (the old one was a scrubbed mirror the Character Bible retires).
> 3. Eras 4 and 5 shipped without their brand lines; added.
> 4. The era brand line was missing from the Core export — it is the payoff a post is written
>    around, so it now appears as a blockquote per era in the KB.
>
> **Deviations from the plan, and why:**
> - **T4 eras are NOT derived onto the real profile.** Aldhyt's record is a list of jobs; forcing a
>   narrative era structure onto the factual CV would invent structure the record doesn't have. The
>   Journey degrades gracefully (no era chip, no era line) and reads correctly either way.
> - **The Journey and Intro Deck stay dark in both themes** — they are cinematic stages, not panels.
>   The room lights don't change the screen.
> - **Photos are referenced from the record, not auto-discovered** from the era folders: a file
>   appearing on disk must not silently rewrite the story. See `public/biography/journey/README.md`.
> - `--jt-vh` survives only as slide height; the pin/crop problem it solved no longer exists.

> **Executor: Opus, end-to-end.** One LLM, no split. Sonnet is not used for this round —
> the twin persona rewrite is voice-critical and the theme/motion work touches the same files,
> so splitting would cost more in context handoff than it saves.
> Built base (v2.1) is verified and documented in `docs/biography-studio-design.md` — read its
> deviation log first; every gotcha there still binds (print portal, LogoChip probe, `--jt-vh`,
> one-page CV budget, twin scrub).

## Canon (read in this order)

1. `knowledge-base/brand/arganta-founder-persona-handoff.md` — **NEW, wins on conflict.** The
   Character Bible: Arganta = Aldhyt's digital twin, same person, Earth Scientist → World Builder.
2. `knowledge-base/brand/arganta-creator-handoff.md` — v1 canon. Still valid: first person, no
   AI-disclosure lead, name is Arganta Core, never simulated-as-live, employer aliases.
3. `docs/biography-studio-design.md` §8 — the real CV ground truth (aldhyt profile). Untouched.

**Conflict resolutions (decided, do not relitigate):**
- Content pillars: v1's six (Journey/Subsurface Intelligence/…) → **replaced** by v2's six
  (Earth / Build / Play / Move / Endure / Create Worlds).
- Highlights: v1 `JOURNEY·BUILDS·CORE·OPERATOR·BTS` → **replaced** by v2
  `START·JOURNEY·EARTH·BUILD·PLAY·MOVE·WORLDS`.
- Public title: "Senior Geologist" stays on the aldhyt profile; the twin's public title is
  **Earth Scientist / World Builder** vocabulary — never "subsurface engineer".
- "Fabricate the CV" means **fabricate the framing, never the facts**: same real journey, same
  real numbers, persona voice, era structure, de-identified employers. Both handoffs forbid
  invented achievements/companies/revenue. `twinText.ts` scrub stays mandatory.

## Audit findings (what's wrong today)

| # | Finding | Evidence |
|---|---|---|
| A1 | **Theme clash.** `.bio` hardcodes the ivory dossier; HQ was in dark mode → light top bar floating in a dark shell (founder screenshot, 2026-07-17). | `biography.css` tokens are static |
| A2 | **Journey is scroll-scrub; founder wants slide left/right + autoplay.** Scroll also fights the HQ pane (needed `--jt-vh` surgery) and can't be screenshotted in the preview pane (rAF-dead). A timed slide deck is simpler AND matches the ask. | JourneyTimeline.tsx |
| A3 | **Arganta profile is a scrubbed mirror, not a persona.** It renders the aldhyt record with aliases. The new bible demands era-structured, first-person narrative with lifestyle identity (gaming, padel/swim/gym, LX570s, Submariner, family priority, war-context restraint). | biography.ts ARGANTA |
| A4 | **Missing origin chapters.** The persona's two founding eras — the university sedimentology expedition and the Papua flying camps — exist in no profile. They are the twin's opening act. | §Origin Story |
| A5 | Logos: 6/7 REAL logos now downloaded ✅ (totalenergies, pertamina, emp, ifp, itb, qatarenergy — Wikimedia Commons, normalized 512px RGBA). **NOC remains a monogram** — northoilcompany.com is unreachable from this environment and NOC is not on Commons; founder drops `noc.png` in when he has it. | public/biography/logos/ |
| A6 | Twin dark "persona mode" now collides with A1's theme work — needs to become one coherent system, not a special case. | `.bio-twin` overrides |
| A7 | `knowledge-base/brand/arganta-profile.md` will be stale the moment T3 lands — regenerate. | exportCore |

## Tasks (T1–T8, in order)

### T1 — Theme system (fixes A1, A6)
`.bio` becomes theme-aware. Tokens split into **chrome** (follows HQ `data-theme`) and **artifact**
(always ivory — the A4 page is paper, print never inverts):
- `[data-theme='light'] .bio` → current ivory dossier (unchanged).
- `[data-theme='dark'] .bio` → charcoal dossier: `--studio:#0B0E14 --paper:#12161F --ink:#E8EDF5
  --hair:rgba(255,255,255,.09) --muted:#8A94A6`; accent/gold unchanged.
- `.a4-page`, `.a4-flow`, `.bio-print` keep hardcoded paper values — **never** tokenized.
- `.bio-twin` no longer forces dark; instead the twin gets a persona **accent** (`#22D3EE`) and the
  pinned rules card. Theme follows HQ in both profiles.
- Listen to the existing HQ theme mechanism (`data-theme` attribute on `<html>`); no new store state.

### T2 — Journey v2: cinematic slides + autoplay (fixes A2)
Rewrite `JourneyTimeline.tsx` as a **horizontal slide experience** (keep filename):
- One slide per chapter (era). Transition: current slide's text exits left / next enters right,
  photos parallax-stagger 60ms, background year cross-morphs (GSAP timeline per transition,
  600ms, `power3.inOut`). No scroll container at all — kills the `--jt-vh` pin complexity
  (keep the var for slide height only).
- **Autoplay**: 7s per slide, thin gold progress bar on the active era tick; pauses on hover,
  on any manual nav, and when `document.hidden`; resumes after 10s idle. `prefers-reduced-motion`
  → no autoplay, instant cuts, static spine fallback stays for non-JS/reduced.
- Nav: ←/→ keys, click zones left/right, era rail at the bottom (year ticks, click to jump),
  `Space` pauses/resumes, `F` fullscreen.
- The SVG journey line stays: draws segment-by-segment as slides advance (DrawSVG is installed).
- Chapters remain **derived from the active profile's experience entries** (+`era` field, T3) —
  Aldhyt, Arganta and future AI influencers all render through it unchanged.

### T3 — The Arganta persona profile (fixes A3, A4) — THE voice-critical task
Rebuild `ARGANTA` in `biography.ts` from the Character Bible. First person throughout.
- **Identity:** name Arganta · headline "I spent fifteen years reading the Earth. Now I build
  worlds above it." · tagline "Earth Scientist turned AI builder and world creator." ·
  location "Indonesia · France · Qatar" · formal headshot (unchanged).
- **Experience = the five eras** (each entry gets `era: 1..5` + the era's brand line as `team`):
  1. *The Student Expedition Leader* — led a scientific sedimentology expedition at university
     (a leading Indonesian technical institute). 2–3 first-person bullets on reading incomplete
     evidence, leading a field team. `[geology, leadership]`
  2. *The Papua Field Geologist* — flying camps in the forests of Papua at career start; first
     office had no walls; survival, logistics and geology inseparable. (Grounded: early
     unconventional/exploration years — keep employers as the existing aliases.) `[geology, operations]`
  3. *The Earth Scientist* — the field moved underground: reservoirs, models, wells, geomechanics,
     operations across a French supermajor, the Mahakam JV and a giant offshore operator; real
     numbers stay (60+ horizontal wells, 4 FDPs, 20+ publications). `[reservoir-mgmt, geomodeling, fdp]`
  4. *The Digital Transformation Leader* — taught machines to read signals: RMO 360, the Guard
     family, WellWatch & WellNova, the operator's first agentic AI matured to production. Real
     products, real recognition, de-identified employer. `[ai, ml, bi, innovation]`
  5. *The World Builder* — after the kids sleep: the Arganta ecosystem (ArgantaLab, KinetikCircle,
     LashiraBloom, Circle HQ) from a practical Doha family apartment. `[software, leadership]`
- **New master sections (custom kind, reserved ids):**
  - `canon-method` — the 7-step expedition method.
  - `canon-pillars` — Earth/Build/Play/Move/Endure/Create Worlds (replaces old pillars).
  - `canon-highlights` — START·JOURNEY·EARTH·BUILD·PLAY·MOVE·WORLDS (replaces old).
  - `canon-play` — gaming identity: Pokémon→ArgantaLab, Suikoden→Circle HQ, FF→LashiraBloom,
    racing sims→simulation mindset.
  - `canon-move` — padel/swimming/gym + the two LX570s + Submariner, framed exactly per the bible
    (engineered objects, never flex).
  - `canon-endure` — building through regional uncertainty; priority order family→work→health→build.
  - `canon-lines` — the 11 key brand lines verbatim.
  - `canon-launch` — the 9 launch posts + recurring series names.
- **publicRules** — merged guardrails of BOTH handoffs (war restraint, family/residence privacy,
  no luxury flexing, never "left geology", employer de-identification, no invented achievements,
  Arganta Core naming, no AI-disclosure lead, not-a-software-engineer-by-training).
- **deckStats** persona cut: `15+ yrs reading the Earth · 2 worlds (physical→digital) · 8 AI/ML
  products · 20+ publications · 4 giant-field development plans · 5 products in the ecosystem`.
- **journey.openerTagline:** "His first office had no walls."
- Everything still passes `scrubTwin` at seed (extend `TWIN_REPLACEMENTS` if any new prose names
  an employer/school) — acceptance: 0 leaks across the 12-identifier list.

### T4 — Era-aware Journey content
- `ExperienceEntry.era?: number` + per-era photo slots
  (`public/biography/journey/arganta/era-1/…`). Aldhyt profile: eras derived from years (no
  authored change). Ghost slides keep the era's brand line as the caption, so the deck is
  cinematic even before Higgsfield assets exist.

### T5 — Logos polish (closes A5)
- Wire `qatarenergy.png` where relevant (publications venue chip is NOT needed — logos appear only
  on experience/education; keep it available for future use).
- Update `logos/README.md`: 6 real files present, only `noc.png` outstanding, keep the
  content-type-probe note. Twin continues to render monograms **by design**.

### T6 — Regenerate the public knowledge base (fixes A7)
After T3: rebuild `knowledge-base/brand/arganta-profile.md` via `profileToMarkdown` (the build
script pattern from v2.1 — esbuild bundle, `Module._compile`). Acceptance: leak-grep = 0 for all
identifiers; the file reads as the Character Bible's voice.

### T7 — Intro Deck era slide
Deck slide 3 ("The journey") groups by era on the twin — five era stops with brand lines instead
of eight employer stops. Aldhyt deck unchanged.

### T8 — Verify + docs + memory
- /verify pass: theme in both modes × both profiles; slide nav + autoplay (pause/resume/idle);
  reduced-motion; CV one-page fit unchanged (T1 must not touch `.a4-*` metrics!); twin leak-grep;
  Export PDF both tabs; production build.
- Update `docs/biography-studio-design.md` status header + the memory file `biography-studio.md`.

## Acceptance checklist

- [ ] Dark HQ theme → Biography Studio chrome is dark; light → ivory; A4 preview/print stays paper.
- [ ] Journey slides left/right with autoplay + progress, pause-on-hover, keys, era rail; static
      spine under reduced-motion.
- [ ] Arganta profile reads as the Character Bible in first person; five eras; lifestyle canon
      sections present; merged guardrails pinned.
- [ ] `grep` leak check on arganta profile + regenerated KB file: 0 hits for North Oil Company /
      Total E&P / Pertamina / EMP / IFP School / ITB / Al Shaheen / Nahr Umr / QatarEnergy / BP /
      LAPI-ITB / TotalEnergies.
- [ ] Real logos render on the aldhyt profile (6 companies); NOC monogram until `noc.png` dropped.
- [ ] All five CV templates still ≤ 297mm.
- [ ] `tsc --noEmit` + `npm run build` clean.

## Out of scope (unchanged from v2.1)

AI CV tailoring (the `composeCv` seam), wiring `content_draft` to the KB file, Higgsfield asset
production, the broader five-creator system.

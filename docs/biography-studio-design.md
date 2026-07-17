# Biography Studio — Design Spec v2.1 (BUILT ✅ 2026-07-17)

> **STATUS: BUILT + VERIFIED.** Shipped in `apps/hq/src/surfaces/biography/`. All 13 tasks in §10 are done.
> Deviations from spec, and why — read these before trusting the spec text below:
> 1. **No Lenis.** GSAP's full club plugins (incl. ScrollSmoother/DrawSVG) are already a dependency; a second smooth-scroll lib would fight the HQ shell. Used GSAP ScrollTrigger + **CSS sticky** instead of `ScrollTrigger.pin` — pin-spacer fights nested scrollers.
> 2. **`--jt-vh`, not `100vh`.** The Journey pane is not the viewport; `100vh` cropped every chapter. The container measures itself via ResizeObserver.
> 3. **CV templates gained `maxRoles` + `maxAwards`.** Without them the "1-page" CV printed **520mm ≈ 1.75 pages**. Now all five measure **≤297mm — one true A4 page** with 20–36mm slack; older roles condense into an "Earlier career" line instead of vanishing.
> 4. **`MasterPrint.tsx` added.** Master Profile's Export PDF printed a **blank sheet** (print CSS hides `#root`; only `CvMaker` portalled into `#print-root`). The full record now prints as a flowing A4 doc (~2.25 pages).
> 5. **`twinText.ts` added — the important one.** Aliasing only covered the company *field*; real employers still leaked through bullet prose, all 11 awards, education and venues into the **public** Arganta export. Now de-identified at seed time (so the founder sees/edits exactly what the public would) with an export-time guard. Verified: **0 leaks across 12 identifiers on the twin, 11 names retained on the real profile.**
> 6. **Logos are monogram chips.** No network in the build env, so no real logo bitmaps. `LogoChip` probes content-type (a dev/static server answers a missing PNG with `index.html` + **200**, so `onError` alone leaves a permanently broken image). Drop real PNGs into `apps/hq/public/biography/logos/` — see the README there — and every surface upgrades with no code change.
> 7. **Icon is `BookUser`,** not `IdCard` (absent from lucide 0.408).
>
> Known limit: the preview pane reports `document.hidden`, so rAF never fires and GSAP motion could not be *visually* screenshotted. The scrub was verified numerically instead (17 triggers bound to the right scroller, start/end 607→4856, rail/line/year all converging to their true targets, direction reversing).

> v2.1 audit log (2026-07-17): added 2025 achievements (outstanding rating, first-agentic-AI recognition, 3 new papers incl. GasShield/EAGE); Guard family corrected to 6 products, AI-product count 5→8; print-CSS visibility approach replaced with a print-root pattern; A4 pagination made explicit; `composeCv` param renamed; `sectionOrder` typed to section kinds; twin canon sections clarified as `custom` kind; QatarEnergy alias added for the twin.

> Status: **DESIGN ONLY — not built.** Opus executes the design; Sonnet does the mechanical follow-ups (§10 to-do table).
> Surface id: `biography` · Nav group: **Studio** · Label: **Biography Studio** · Icon: `IdCard` (lucide).
> Ground truth = founder's real CVs (2025 PDF + 2026 PPTX), fully transcribed & world-class-rephrased in §8.
> Companion canon for the Arganta twin: `knowledge-base/brand/arganta-creator-handoff.md` (ChatGPT Sol strategy note, 2026-07-17).

## 1. Concept

Biography Studio is the **identity engine of the Arganta ecosystem**: one editable Master Profile per persona, and everything else (CVs, intro deck, timeline, Instagram knowledge base) is a deterministic lens over it.

```
Profile selector (Aldhyt | Arganta | +future)
        │
   Master Profile  ←— the single editable source (LinkedIn-grade, complete, bullets)
        ├── CV Maker      — 5 role templates, deterministic now, AI-driven later
        ├── Intro Deck    — investor/introduction presentation (auto-derived)
        ├── Timeline      — founder journey visual (auto-derived)
        └── Knowledge feed — Arganta profile = canonical KB for the Arganta IG account
```

Tabs across the top: **Master Profile · CV Maker · Intro Deck · Timeline**. A profile switcher (avatar chip + dropdown) sits left of the tabs; every tab renders the active profile.

## 2. Profiles — the multi-persona model

```ts
type ProfileId = 'aldhyt' | 'arganta'   // extensible

type Profile = {
  id: ProfileId
  kind: 'real' | 'twin'
  identity: {
    name: string; headline: string; tagline?: string
    email?: string; phone?: string; location: string
    photo: string                        // both use /biography/aldhyt-headshot.png (formal photo)
    links: { label: string; url: string }[]
  }
  master: MasterSection[]                // §3
  deck: { accent: string }
  publicRules?: string[]                 // twin only: the non-negotiables, shown as a pinned card
}
```

- **`aldhyt` (real)** — complete professional record, real employer names, private. Feeds CV Maker + Intro Deck.
- **`arganta` (digital fiction twin)** — the public creator persona per the canonical handoff. Same real journey, same facts, **but employer names are genericized, never invented**: the handoff forbids inventing employers/achievements, and the founder wants no real company names publicly. Resolution (decision, frozen): the twin uses *descriptive aliases* — "a French supermajor (Indonesia)", "the national energy company's Mahakam JV", "a giant offshore operator (Qatar)", "an Indonesian independent E&P", "a university research group × a British supermajor". Everything else (years, fields-as-descriptions, publications count, awards count, products RMO 360 / Guard family / WellWatch & WellNova renamed only if employer-confidential — keep as-is unless flagged) stays factual.
- Alias registry (twin): NOC → "a giant offshore operator (Qatar)" · Total E&P Indonésie → "a French supermajor (Indonesia)" · Pertamina Hulu Mahakam → "the national energy company's Mahakam JV" · EMP → "an Indonesian independent E&P" · LAPI-ITB × BP → "a university research group × a British supermajor" · QatarEnergy → "the state energy major". Product names (RMO 360, Guard family, WellWatch, WellNova) stay as-is unless the founder flags them employer-confidential.
- The twin profile carries the handoff's canon verbatim in dedicated master sections (implemented as `custom`-kind sections with reserved ids `canon-bio`, `canon-pillars`, `canon-highlights`, `canon-mental-model`; the Non-Negotiables live in `publicRules`, not a section): positioning line, IG bio (3 directions, "Recommended" default), 6 content pillars, highlight order (JOURNEY/BUILDS/CORE/OPERATOR/BTS), and `publicRules` = the Non-Negotiables list (first person, no AI-disclosure lead, canonical name **Arganta Core**, never simulated data as live, never employer-confidential screens, no Iron Man imitation, "did not leave geology for AI").
- **Knowledge feed**: a read-only "Export for Core" button on the Arganta profile serializes the master profile to markdown → clipboard + `knowledge-base/brand/arganta-profile.md`, which Post Studio / content_draft use as the IG ground truth. (Mechanical: Sonnet later wires content_draft to read it.)

Persistence: localStorage **`hq_biography_v2`** `{ version: 2, activeProfileId, profiles: Profile[] }`; per-profile "Reset to ground truth".

## 3. Master Profile tab — the complete, editable record

LinkedIn-grade completeness, **everything in bullets**, everything editable inline (click-to-edit, Enter/blur commits, Ctrl+Z undo ×20, autosave pulse). Section rail on hover: drag-reorder, add/remove sections, entries, and bullets; `+ Add section` ghost button with kinds: `about · experience · education · skills · awards · publications · projects · training · languages · interests · canon(custom)`.

```ts
type MasterSection =
  | { kind:'about';        id:string; title:string; bullets:string[] }
  | { kind:'experience';   id:string; title:string; entries:ExperienceEntry[] }
  | { kind:'education';    id:string; title:string; entries:EducationEntry[] }
  | { kind:'skills';       id:string; title:string; groups:{ label:string; items:string[] }[] }
  | { kind:'awards';       id:string; title:string; items:{ text:string; year?:string }[] }
  | { kind:'publications'; id:string; title:string; entries:{ title:string; venue:string; url?:string; tags:Tag[] }[] }
  | { kind:'projects';     id:string; title:string; entries:{ name:string; desc:string; tags:Tag[] }[] }
  | { kind:'custom';       id:string; title:string; bullets:string[] }

type ExperienceEntry = {
  id:string; role:string; company:string; companyAlias?:string   // alias renders on the twin
  companyLogo?:string; place:string; years:string; team?:string
  bullets:{ text:string; tags:Tag[] }[]                          // EVERY bullet tagged (fuels CV Maker)
  highlight?:boolean
}

type Tag = 'geology'|'geomodeling'|'reservoir-mgmt'|'operations'|'fdp'|'geomechanics'
         | 'data'|'bi'|'ml'|'ai'|'software'|'leadership'|'training'|'publication'|'innovation'
```

Visual: same "executive dossier" system as v1 (warm paper `#FDFCF9`, ink `#16181D`, NOC-blue accent `#0E4C92`, gold `#C89B3C` for awards; serif display Fraunces/Georgia + Inter body + mono eyebrows). Master Profile is a single long scroll (not A4) with a sticky mini-TOC on the right. The Arganta profile renders the same layout on the dark studio background (`#0B0E14`) to signal "public persona mode", with the pinned Non-Negotiables card at top.

## 4. CV Maker tab — deterministic now, AI later

**Purpose**: generate a tailored 1–2 page A4 CV from the Master Profile for a target role. v1 is fully deterministic; the AI seam is one function so @arganta/ai can replace it later without UI change.

```ts
type CvTemplate = {
  id:'senior-geologist'|'senior-data-scientist'|'lead-geologist'|'head-geology'|'head-digital-petroleum'
  label:string
  headline:string                       // replaces master headline on this CV
  summary:string                        // role-angled summary, pre-written (§9)
  includeTags:Tag[]                     // bullets kept
  boostTags:Tag[]                       // bullets sorted first within an entry
  maxBulletsPerEntry:number
  sectionOrder:MasterSection['kind'][]  // section kinds, not ids — e.g. leadership roles put awards above skills
  sidebar:('education'|'skills'|'awards'|'publications')[]
}

// THE seam — deterministic today, LLM tomorrow:
function composeCv(profile: Profile, tpl: CvTemplate): CvDoc   // pure function, no store access
```

Deterministic algorithm: filter every experience bullet by `includeTags` (a bullet passes if any tag matches), sort by boost, truncate to `maxBulletsPerEntry`, drop entries left with 0 bullets (except the 2 most recent — always kept with their best bullet), swap headline/summary, reorder sections. Output `CvDoc` renders in the v1 A4 page design (header band with headshot, 64/36 two-column, logo chips, print-perfect).

UI: left rail = 5 template cards (icon, label, one-line angle, "n bullets selected" count); center = live A4 preview; right = per-template overrides panel (toggle individual bullets on/off — overrides persist per template in the store). Top-right: **Export PDF** and `Copy as text`.

**Print pipeline (audited)**: do NOT use the `visibility:hidden` trick — it leaves layout boxes in flow and breaks pagination in Chromium. Instead render the A4 pages into a dedicated `#print-root` portal appended to `document.body`, and in `@media print` use `body > *:not(#print-root){ display:none } @page { size:A4; margin:0 }`. **Pagination**: measure section heights with a hidden probe render (ResizeObserver on `.a4-flow`), greedily pack sections/entries into 297mm pages, never split a single experience entry across pages; each page is its own `.a4-page` with `page-break-after: always`. Same pipeline serves Master Profile's "Export PDF" (multi-page) and CV Maker (1–2 pages). A quiet "AI tailor — coming soon" pill marks the future seam.

The five templates' angles (full summaries in §9):

| Template | Angle | boostTags |
|---|---|---|
| Senior Geologist | the classic full-strength technical CV | geology, geomodeling, reservoir-mgmt |
| Senior Data Scientist | reframes 15 yrs as applied data science on subsurface data | data, ml, ai, bi, software |
| Lead Geologist | senior IC + focal-point leadership, well delivery | reservoir-mgmt, operations, leadership |
| Head Geology | discipline leadership, FDP ownership, standards & mentoring | leadership, fdp, training, innovation |
| Head Digital Petroleum | digital transformation exec — product owner of agentic AI | ai, ml, bi, software, leadership, innovation |

## 5. Intro Deck & Timeline (carried from v1, now profile-aware)

Unchanged design (8 auto-composed slides; dark cinematic; ←/→, dots, `F` fullscreen; stagger fade-rise 400ms; reduced-motion respected) with two changes:

- Renders the **active profile** — on Arganta, slide 1 uses the canonical positioning line "I spent fifteen years modelling invisible worlds beneath the earth. Now I build intelligent systems above it.", employer aliases replace names, and slide 7 becomes the **Arganta Core** slide (mental-model chain: Geology → systems thinking → … → agentic AI → Arganta Core).
- `deckStats` lives per profile: `15+ yrs · 20+ publications (3 in 2025 alone) · 4 major FDPs · 60+ horizontal wells · 3× innovation awards · 8 AI/ML products shipped` (Guard family ×6 + WellWatch + WellNova — keep this count in sync with §8 Projects).

### 5.1 Journey Timeline tab — cinematic scrollytelling (v2.1 upgrade)

**Library decision (researched 2026-07)**: the off-the-shelf React timeline components (react-chrono, react-beautiful-timeline, react-horizontal-timeline) are corporate-generic — none deliver a wow effect. The industry-standard cinematic stack is **GSAP 3 + ScrollTrigger** (now 100% free for commercial use) **+ Lenis** for buttery momentum smooth-scroll. Build the timeline as a custom scrollytelling scene on that stack — this is what award-level sites actually do; no timeline library in between.

```
deps: gsap (ScrollTrigger plugin), lenis        // both free, tree-shaken ~30KB total
file: apps/hq/src/surfaces/biography/JourneyTimeline.tsx + journey.css
```

**The scene** — vertical scroll drives a pinned cinematic sequence, one **chapter per experience entry** (auto-derived from the active profile — works identically for Aldhyt, Arganta, and any future AI-influencer profile):

- **Opening title card**: profile photo in a slow Ken Burns drift, name in huge serif, positioning line typed on; a giant translucent year (`2010`) behind everything.
- **Pinned chapter sequence**: ScrollTrigger pins the stage; scrubbing moves a horizontal "film strip" of chapters. Per chapter: era year counter ticking (2010 → 2026, tabular-lining numerals, huge, 8% opacity behind), company logo/alias-monogram chip sliding in, role + place in serif, 2–3 `highlight`-tag bullets staggering up, and a **photo stack** — 1–3 photos with parallax offsets (each moves at a different scrub rate), soft shadows, slight random rotation like prints on a desk, Ken Burns inside their frames.
- **Connective tissue**: a single SVG path (the "journey line") draws itself continuously across chapters via `strokeDashoffset` scrub — it is the spine that makes it one story; chapter nodes light up gold as the line passes.
- **Milestone confetti moments**: award chapters (Nahr Umr, 2025 outstanding rating) get a brief gold particle shimmer + the award text in mono caps — subtle, 600ms, no cartoon confetti.
- **Finale card**: "Now" — current role + the 8-product wall + deckStats counters counting up on enter, then the Arganta Core mental-model chain drawing in (twin profile) or the Arganta-founder bridge (real profile).
- **Atmosphere**: film grain overlay (CSS, 3% opacity), vignette, dark stage `#0B0E14` regardless of profile, chapter accent = profile accent. Right edge: thin progress rail with year ticks — click to jump (ScrollTrigger `scroll()` to label).
- **Accessibility/perf**: `prefers-reduced-motion` → fall back to a clean static vertical timeline (the v1 spine design, kept as the fallback renderer); ScrollTrigger killed on unmount; images lazy-loaded; pin-spacing works inside the HQ shell scroll container (use a dedicated scroll container + `scroller:` option — the HQ shell must not double-scroll; remember the rAF-paused-preview gotcha family).

**Data**: extend `ExperienceEntry` with `media?: { photos: string[]; caption?: string }` and `Profile` with `journey?: { openerTagline?: string; photos: string[] }`. Founder drops journey photos into `apps/hq/public/biography/journey/<profileId>/…`; entries without photos render logo-chip + typographic chapters (still cinematic — the year counter and journey line carry it). AI-influencer profiles plug in the same way: their generated photos + fictional chapters, zero code changes.

## 6. Studio group renames (unchanged from v1)

Everything in Studio ends in **Studio** — labels only, ids unchanged, mirrored in `Rail.tsx`, `MobileNav.tsx` MGROUPS, CommandPalette (hard-coded surfs gotcha), in-surface headers, Landing tiles:
`biography` **Biography Studio** (new, first) · `influencer` **Influencer Studio** · `video` **Video Studio** · `music` **Music Studio** · `media` **Media Studio** · `pixel` **Pixel Studio** · Brand Studio / Post Studio unchanged.

## 7. Assets

- DONE: `apps/hq/public/biography/aldhyt-headshot.png` (formal square headshot — profile picture for **both** profiles) + `aldhyt-avatar.png`.
- Logos → `apps/hq/public/biography/logos/`: `noc.png`, `totalenergies.png`, `pertamina.png`, `emp.png`, `itb.png`, `ifp.png` (download once; monogram-chip fallback; real logos render only on the `aldhyt` profile — the twin renders alias monograms by design).

## 8. Ground truth — Master Profile content (transcribe into `biography.ts` DEFAULT_PROFILES)

World-class rephrase: consistent voice (strong verb first, scope, quantified outcome), no orphan fragments, unified spellings (Total E&P Indonésie, Institut Teknologi Bandung, Pertamina Hulu Mahakam). Nothing invented; everything below traces to the two CVs.

**Identity (aldhyt)** — Aldhyt Sukapradja · **Senior Geologist — North Oil Company, Qatar** · headline "Senior Geologist · Reservoir Management & Digital Innovation" · tagline "15+ years turning subsurface complexity into decisions — from giant fields to agentic AI." · aldhyt.sukapradja@gmail.com · +974 666 8989 2 · West Bay, Doha, Qatar · photo `/biography/aldhyt-headshot.png` · links: LinkedIn (placeholder, editable).

### About (bullets)
- Petroleum geoscientist with 15+ years across NOC, IOC, JV and consulting environments in Indonesia, France and Qatar.
- Deep dual expertise: giant clastic gas fields (Mahakam Block, Indonesia) and giant carbonate oil fields (Al Shaheen, Qatar).
- Deeply involved in 4 major Field Development Plans as focal point for reservoir geology and geomodeling: Al Shaheen (NOC, offshore oil), Tunu (Total/Pertamina, swamp gas), Sisi Nubi & Jumelai (Total, offshore gas), Seng & Segat (EMP, onshore biogenic gas).
- Product owner of tens of digital use cases, delivering next-generation agentic AI for North Oil Company.
- Recognized cross-discipline collaborator: focal point for 3G synthesis, 3D earth modelling, geohazard assessment, regional synthesis, reservoir management, business intelligence and data technology in geoscience studies.
- 20+ technical papers, reports and user manuals published internally and at IAGI, HAGI, IPA, SPE and AAPG; 30+ advanced Petrel automation scripts.
- In-house facilitator: integrated reservoir synthesis training, regional field trips, business-intelligence fundamentals.
- Beyond the day job: full-stack web & mobile developer, former tourism ambassador of East Jakarta.

### Experience
1. **Senior Geologist — North Oil Company** (alias: *a giant offshore operator, Qatar*) · Reservoir Management & Opportunity · Doha · 2022 – Present · `highlight`
   - Lead geologist for reservoir management and opportunity maturation across the UER, Khatiyah, Mauddud, Hith and Arab reservoirs of the Al Shaheen giant oil field. `[reservoir-mgmt, geology]`
   - Steward 60+ extended-reach and multilateral horizontal wells — surveillance, opportunity screening and reservoir strategy. `[reservoir-mgmt, operations]`
   - Architect of **RMO 360**, a unified reservoir-management ecosystem integrating 20+ workflows into one operating picture. `[bi, software, innovation]`
   - Inventor of the **Guard AI/ML family** — FlowGuard, StimGuard, TerraGuard, FracGuard, SweepGuard, GasShield — applied ML for flow, stimulation, geomechanics, frac, sweep and gas surveillance. `[ml, ai, innovation]`
   - Product owner of **WellWatch & WellNova**, the company's first subsurface agentic-AI products for daily monitoring and post-drill intelligence. `[ai, leadership, innovation]`
   - Matured the company's **first agentic AI** from concept to production — recognized by the CEO and the VP Digital Solutions at the company townhall, featured in an internal article, and presented to QatarEnergy VIPs. `[ai, leadership, innovation]`
   - Published 3 papers in 2025: *GasShield for Reservoir Management* (EAGE), *Digitally Enabled Reservoir Management* and *3D Mechanical Earth Model for Waterflood Optimization & Reservoir Management* (both QatarEnergy LNG Forum). `[publication, innovation]`
   - Focal point for business intelligence and geomechanics projects across the asset. `[bi, geomechanics]`
   - Nahr Umr Award for Innovation & Business Efficiency, three consecutive years; "exceeds expectations" rating 2024; **outstanding rating 2025** for first-agentic-AI maturation. `[innovation]`
2. **Senior Geologist — North Oil Company** · Underdeveloped Reservoirs & Exploration · Doha · 2020 – 2022
   - Focal point for the Upper Mauddud Field Development Plan, matured from Conceptual to Pre-FEED — 80+ extended-reach-drilling wells. `[fdp, geology, leadership]`
   - Asset geologist and geosteering focal point for 5 ERD long-horizontal wells and 3 static + dynamic appraisal wells. `[operations, geology]`
   - Delivered reservoir synthesis and strategic opportunity identification for underdeveloped reservoirs. `[reservoir-mgmt, geology]`
   - "Exceeds expectations" rating two years in a row. `[innovation]`
3. **Reservoir Geologist, Tunu Field — Pertamina Hulu Mahakam** (alias: *the national energy company's Mahakam JV, Indonesia*) · 2018 – 2020
   - Reservoir geologist for Tunu, Indonesia's biggest gas field; focal point for Shallow Zone future-development and alternative-technology studies. `[geology, reservoir-mgmt, fdp]`
   - Built automated workflows, statistical models and a business-intelligence platform for reservoir surveillance and post-mortem efficiency. `[bi, data, software]`
   - Delivered AVO-based well-candidate scouting for 35+ future wells. `[data, geology]`
   - Well design and drilling monitoring across 3 concurrent swamp-rig operations. `[operations]`
   - Partnered with Contracts & Procurement on a cost-awareness and contractual-strategy study; contributor to an early machine-learning pilot. `[data, ml, leadership]`
4. **Wellsite Geologist & Pore-Pressure Specialist — Total E&P Indonésie** (alias: *a French supermajor, Indonesia*) · Mahakam Operations · 2017 – 2018
   - Focal point for the regional Mahakam pore-pressure model and synthesis — candidate for Total E&P's Best Innovator 2017. `[geology, innovation]`
   - Developed a 3D geostatistical pore-pressure method spanning 7 Mahakam fields (published, SPE 2017). `[geomodeling, data, publication]`
   - Wellsite geologist for swamp-rig drilling operations. `[operations]`
5. **Reservoir Geologist, Sisi Nubi & South Mahakam — Total E&P Indonésie** · 2014 – 2016
   - Reservoir geologist for two offshore gas fields; focal point for reservoir management system (GeoSEA '16), field synthesis (IPA '15) and geomodeling (AAPG '17). `[geology, geomodeling, reservoir-mgmt, publication]`
   - Built the Sisi Nubi business-intelligence dashboard and web-GIS automation (SPE-APOGCE '17). `[bi, software, publication]`
   - Fault-seal analysis, static–dynamic synthesis, simulation, well proposals and platform siting for a future Plan of Development. `[geomodeling, fdp]`
   - Operations geologist across 5 offshore fields: 3D trajectories, slanted wells, real-time geosteering — 2 offshore rigs, 5+ wells. `[operations]`
6. **Petroleum Geologist, Handil Field — Total E&P Indonésie** · Total Global Scholarship · 2012 – 2013
   - Assessed step-out potential for one of the world's most mature deltaic oil fields. `[geology]`
   - Prospect maturation, well design, petroleum-system and spectral-decomposition studies. `[geology, geomodeling]`
7. **Exploration Geologist — Energi Mega Persada** (alias: *an Indonesian independent E&P*) · Bentu & Korinci Baru PSCs · 2011 – 2012
   - Exploration geologist for 2 PSCs and 7 fields; focal point for lead & prospect maturation (IAGI-HAGI '11) and reservoir synthesis (IPA '12). `[geology, publication]`
   - Geomodeling and geohazard characterization (IPA & AAPG '12); long-range exploration planning — deep potential and basement fracture — and reserves certification. `[geomodeling, geology, publication]`
   - Recognition Award for first-service-year performance. `[innovation]`
8. **Research Geologist (Unconventional) — LAPI-ITB × BP** (alias: *a university research group × a British supermajor*) · West Sanga Sanga CBM · 2010 – 2011
   - Joint Geodynamic Research Group / BP study of regional CBM potential in the Upper Kutei Basin. `[geology]`
   - Focal point for CBM petrophysics, basin-scale synthesis, geomodeling and reserves calculation; field geologist. `[geomodeling, data]`

### Education
- **M.Sc. Petroleum Geosciences — IFP School, France** · 2012 · Total Global Scholarship laureate.
- **B.Eng. Petroleum Geology — Institut Teknologi Bandung, Indonesia** · 2010 · Dean's List, outstanding academic achievement.

### Skills (groups)
- **Subsurface**: reservoir geology · geomodeling & reservoir synthesis · reservoir management · field development planning · geosteering & well delivery · pore pressure & geohazards · reservoir geomechanics · carbonate & clastic systems.
- **Digital & Data**: subsurface AI/ML product ownership · agentic AI · business intelligence (Power BI) · statistical modelling · data analytics · Petrel advanced automation (30+ scripts) · full-stack web & mobile development · web-GIS.
- **Leadership & Communication**: multi-discipline focal point · FDP maturation lead · in-house trainer & field-trip facilitator · 20+ conference publications · multinational team player.

### Awards & Recognition
- Outstanding performance rating — NOC `2025` · for maturing the company's first agentic AI; cited by the CEO and VP Digital Solutions at the company townhall (internal feature article); presented to QatarEnergy VIPs
- 3× Nahr Umr Award for Innovation & Business Efficiency — North Oil Company `2022–2024`
- "Exceeds expectations" performance rating — NOC `2020–22, 2024`
- Outstanding performance rating (highest possible) two consecutive years — Total E&P `2015–2016`
- Best Innovator candidate, Pore-Pressure Modelling — Total E&P `2017`
- Total Global Scholarship — IFP School, Paris `2011`
- Runner-up, EAGE Field Development Challenge — London `2013`
- Runner-up (team leader), Indonesian Geological Olympiad `2010`
- Recognition Award, 1st service year — Energi Mega Persada `2012`
- Dean's List — Institut Teknologi Bandung
- Tourism Ambassador of East Jakarta (former)

### Publications (selected — keep URLs; tag all `[publication]`)
- *GasShield for Reservoir Management* — EAGE `2025` `[ml, reservoir-mgmt]`
- *Digitally Enabled Reservoir Management* — QatarEnergy LNG Forum `2025` `[bi, reservoir-mgmt]`
- *3D Mechanical Earth Model for Waterflood Optimization & Reservoir Management* — QatarEnergy LNG Forum `2025` `[geomechanics, reservoir-mgmt]`
- *Sisi Nubi Dashboard: Implementation of Business Intelligence in Reservoir Modelling & Synthesis* — SPE-APOGCE, SPE-186907-MS · onepetro.org/conference-paper/SPE-186907-MS `[bi]`
- *Integrated 3D Pore Pressure Characterisation and Modeling: Methodology & Application in Sisi Nubi Field, Mahakam* — SPE-APOGCE, SPE-186310-MS · onepetro.org/conference-paper/SPE-186310-MS `[geomodeling]`
- *Integrated Reservoir Study in Bentu–Seng–Segat Fields, Central Sumatra Basin: A Conceptual Approach* — IPA12-G-087 · archives.datapages.com `[geology]`
- *3D Pore Pressure Prediction Model in Bentu Block, Central Sumatra Basin* — IPA12-G-104 · archives.datapages.com `[geomodeling]`
- *Integration of Static & Dynamic Synthesis with Iterative Workflow to Enhance Reservoir Understanding* — IPA '15 · archives.datapages.com `[reservoir-mgmt]`
- *Unlocking Potential Resources at Shallow Zone for Future Development* — AAPG Search & Discovery `[fdp]`
- *An Integrated Reservoir Characterization & Model to Locate Future Potential of Sisi Nubi Fields* — GeoSEA XIV / 45th IAGI `[geomodeling]`
- *Ancient Mahakam Virtual Outcrop Project: A Breakthrough in Preserving Indonesia's Precious Outcrops* — GeoSEA XIV / 45th IAGI `[innovation]`
- *The Reservoir Management System of Sisi Nubi Fields and Its Implication to Future Development Planning* — GeoSEA XIV / 45th IAGI `[reservoir-mgmt]`
- Plus internal reports, user manuals and national-conference papers — 20+ total.

### Projects (products)
- **RMO 360** — unified reservoir-management ecosystem, 20+ integrated workflows. `[bi, software, innovation]`
- **Guard AI/ML family** — FlowGuard · StimGuard · TerraGuard · FracGuard · SweepGuard · GasShield (published at EAGE 2025). `[ml, ai]`
- **WellWatch** — agentic-AI daily well monitoring. `[ai]`
- **WellNova** — agentic-AI post-drill intelligence. `[ai]`
- **Arganta ecosystem** — founder: KinetikCircle, ArgantaLab, Circle HQ — 5 apps, one HQ (after hours). `[software, leadership]`

### Identity (arganta twin) — deltas only
- Name **Arganta** · archetype "The Systems Builder" · headline = canonical positioning "I spent 15 years modelling worlds underground. Now I build intelligent systems above it." · location "Indonesia · France · Qatar" · photo = same formal headshot · no phone/email; links → IG.
- Master sections = aldhyt's with `companyAlias` rendered, plus twin-only canon sections: **IG Bio** (3 directions from the handoff, Recommended default), **Content Pillars** (Journey / Subsurface Intelligence / Digital Evolution / Arganta Core / Founder After Hours / Operator Discipline), **Highlights** (JOURNEY · BUILDS · CORE · OPERATOR · BTS), **Mental Model** (the 9-step chain), **Non-Negotiables** (verbatim from handoff → `publicRules`).

## 9. CV Maker template summaries (pre-written, editable per template)

- **Senior Geologist** — "Senior petroleum geologist with 15+ years across giant carbonate and clastic fields in Qatar and Indonesia. Focal point for reservoir management, geomodeling and FDP maturation on 4 major developments, with 60+ horizontal wells stewarded and 20+ publications."
- **Senior Data Scientist** — "Data scientist grown inside the subsurface: 15 years applying statistical modelling, machine learning and BI to some of the world's largest oil and gas datasets. Inventor of a six-product applied-ML family and product owner of agentic-AI systems in daily industrial operation — recognized by the CEO for maturing the company's first agentic AI; 30+ automation tools shipped."
- **Lead Geologist** — "Lead-level geologist combining deep technical mastery with focal-point leadership: FDP maturation of 80+ wells from Conceptual to Pre-FEED, geosteering leadership across ERD campaigns, and multi-rig operations in swamp and offshore environments."
- **Head Geology** — "Geoscience leader with 15+ years across NOC, IOC and JV environments, 4 major FDPs, and a record of raising team capability — in-house trainer, field-trip facilitator, 20+ publications, and consistent top-tier performance ratings at two supermajors."
- **Head Digital Petroleum** — "Digital-petroleum leader who bridges the reservoir and the algorithm: architect of a 20-workflow reservoir-management ecosystem, inventor of six applied-ML products, and product owner of the first subsurface agentic AI at a giant offshore operator — matured to production and recognized by the CEO and VP Digital Solutions, presented to QatarEnergy VIPs. Proven at turning geoscience workflows into adopted digital products."

## 10. Execution to-do (Opus = design-critical, Sonnet = mechanical)

| # | Task | Owner | Notes |
|---|---|---|---|
| 1 | `biography.ts` — types (§2–3), DEFAULT_PROFILES transcribed from §8 (both profiles, all tags), store + localStorage `hq_biography_v2`, undo | Opus | Nothing summarized — full capture |
| 2 | Surface registration: SurfaceId, Rail (first in Studio), MobileNav MGROUPS, Shell switch, CommandPalette | Sonnet | Keep Rail/MGROUPS mirrors in sync |
| 3 | `BiographyStudio.tsx` shell — profile switcher, 4 tabs, header actions (Export PDF / JSON, Reset, Export for Core) | Opus | Dossier design system §3 |
| 4 | `MasterProfile.tsx` — long-scroll editable record, inline editing, section rail, add/remove/reorder, TOC | Opus | The core editing experience |
| 5 | `CvMaker.tsx` + `cvTemplates.ts` — 5 templates (§4, §9), `composeCv()` pure fn, template rail + A4 preview + bullet overrides | Opus | Deterministic; keep `composeCv` as the single AI seam |
| 6 | A4 print pipeline — `.a4-page` component, `#print-root` portal print CSS, greedy pagination (§4) | Opus | Never split an experience entry across pages |
| 7 | `IntroDeck.tsx` — 8 slides, profile-aware (Arganta positioning + Core slide), keyboard/fullscreen/motion | Opus | §5 |
| 8 | `JourneyTimeline.tsx` — cinematic GSAP ScrollTrigger + Lenis scrollytelling (§5.1): pinned chapters, journey line, photo parallax, year counter, reduced-motion vertical fallback | Opus | Add `gsap` + `lenis` deps; profile-agnostic (works for future AI-influencer profiles) |
| 9 | Arganta twin canon sections + Non-Negotiables pinned card + alias rendering | Opus | Source: knowledge-base/brand/arganta-creator-handoff.md |
| 10 | "Export for Core" → `knowledge-base/brand/arganta-profile.md` serializer (markdown) | Sonnet | Feeds IG content pipeline later |
| 11 | Studio renames (§6) across Rail, MobileNav, CommandPalette, surface headers, Landing tiles | Sonnet | Labels only, ids unchanged |
| 12 | Logos download to `public/biography/logos/` + monogram fallback component | Sonnet | Real logos only on `aldhyt` profile |
| 13 | /verify — acceptance: edit persists, CV Maker filters correctly per template, A4 export clean, deck reflects edits + profile switch, renames everywhere | Sonnet | |

Out of scope for this build: AI tailoring (uses `composeCv` seam later), wiring content_draft to arganta-profile.md, the broader five-creator system (handoff says: one credible Arganta account first).

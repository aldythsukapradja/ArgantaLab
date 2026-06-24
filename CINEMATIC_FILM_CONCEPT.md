# CIRCLE — A Portfolio Film
### Cinematic Three.js + GSAP concept for Circle HQ · KinetikCircle · ArgantaLab

> **Status:** Concept locked, no build yet (2026-06-23).
> **Format:** Standalone cinematic web experience (own route, e.g. `/film`). NOT inside the HQ operator app — the HQ "Present" deck is the live-data boardroom view; *this* is the vision film that makes someone **feel** the portfolio before they see a number.
> **Inspiration / craft bar:** `RMO COSMO / COSMO_Intro.html` (Guardians of Al Shaheen) — Three.js cosmic scene + GSAP act-machine, ignition flashes, camera fly-throughs, emotional inversion at the end.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| **Audience & tone** | **Investor opener.** Vision-first and emotional, but it lands on the unicorn/portfolio argument — Circle HQ as proof this is run like a holding company, not a single app. |
| **Emotional center of the reveal** | **The child, the family & the friends you choose** — the *circle of people*. The closing image resolves the central star into a small warm constellation of human lights, not one. |
| **Build scope (this phase)** | **Concept doc first** (this file). Lock the story + scene spec + asset list before any 3D. |

---

## 2. Logline

> Modern life scattered the people who matter most across a hundred apps. So we built two worlds on one circle — **KinetikCircle** for the life a family shares, **ArgantaLab** for the child becoming who they'll be — and one mind, **Circle HQ**, that watches it all. The film ends where it began: not on the products, but on the people they give your time back to.

---

## 3. The metaphor — a portfolio as a solar system

| Cosmo's universe | CIRCLE's universe |
|---|---|
| Cosmo = the sun (synthesizer) | **Circle HQ** = the operating star — the brain that holds & watches everything |
| 8 agents = planets | **KinetikCircle** & **ArgantaLab** = two living systems in orbit |
| Tables = satellites | KinetikCircle's ~41 micro-apps · ArgantaLab's 6 learning worlds = moons |
| Relationships = gravity | **Circles of people** = the constellations that bind it |
| The warm core | **Diamonds** = the light/energy flowing between the two systems |
| "The guardian is you" | **The reveal:** the star dims, a constellation of human lights (child · family · friends) rises — the products were never the point |

---

## 4. Palette & typography

**Palette**
- Deep space base: `#04060f` (bg), `#020308` (void), `#0a1228` (near-camera nebula)
- **Circle HQ** (central star): gold `#ffd27f`, bright `#fff2d0`, amber `#ffb347`
- **KinetikCircle** system: magenta `#ff3d72`, indigo `#818cf8`, cyan `#6ee7f9` (its real brand spectrum)
- **ArgantaLab** system: its six world colors — NUM `#f59e0b` · WRD `#3b82f6` · WON `#10b981` · LOG `#8b5cf6` · WLD `#ef4444` · LIF `#f472b6`
- The human reveal: cream `#fff4e2`, warm gold `#ffd9a0`
- Accents / data: cyan `#6ee7f9`, muted `#8497b8`, faint `#4b5a78`

**Type** (softer than Cosmo's Orbitron — this is consumer/family, not field-ops)
- **Fraunces** (serif italic, 300/400) — the emotional & vision lines, the hero beats
- **Space Grotesk** (or Montserrat, 400/500) — kickers, labels, body, UI chrome
- A mono (**Space Mono** / **JetBrains Mono**) — numbers, data, the "answer card"

**Motion grammar**
- Caption reveal: word-by-word, `opacity 0→1` + `translateY(18px)→0` + `blur(8px)→0`, stagger ~0.35s, ease `cubic-bezier(.16,1,.3,1)`
- Camera: `GSAP` tweens on `camera.position` + a `lookAt` target vector, `power2.inOut` for drifts, `power3.out` for dives
- Ignition: white `#flash` overlay `opacity 0.9→0`, star `scale 0.001→1` `elastic.out(1,0.6)`
- Vignette + subtle film grain overlay; `ACESFilmicToneMapping`, exposure ~1.25, `FogExp2`

---

## 5. The scene system (Three.js world)

Built once at boot; acts manipulate it via the GSAP act-machine.

- **Starfield** — ~2,600 additive points on a sphere shell, slow `rotation.y`, glow-sprite texture, 4-color stellar palette.
- **Dust** — ~700 near-camera motes drifting opposite the stars (parallax depth).
- **The central star = Circle HQ** — bright core sphere + 3 additive shells + corona particles + 2 glow sprites. Hidden until **ignition**. A pre-ignition **ember** (single gold glow sprite at origin) is the quiet focal point of Acts 0–3.
- **Two system-cores** orbiting the star on tilted orbit rings:
  - **KinetikCircle** — magenta/indigo core, glow, ~6–8 satellite motes (its micro-apps), optional halo ring.
  - **ArgantaLab** — cyan/multi core, glow, **6 colored satellites** = the six worlds.
- **Orbit rings** — thin `RingGeometry`, per-system color, low opacity (the "gravity").
- **The circle of people (constellations)** — faint shimmering lines linking the systems through the center; brightens in Act 7 (the bridge) and Act 10 (the reveal).
- **The human core** — a warm, slow-*breathing* light (distinct cadence from the star's pulse) revealed in Act 10. For the locked reveal it resolves into a **small constellation of 3–5 human lights** (child · parents · friends), not a single sphere.

Camera tracking helper: a `camTarget` vector the camera `lookAt`s every frame; acts lerp it (and optionally lock onto a system during its passport).

---

## 6. The act script (the heart)

> Copy below is **draft-final** — tighten in a copy pass. `[serif]` = Fraunces italic hero line · `[sub]` = Space Grotesk body · `[kick]` = tracked kicker · `[num]` = mono figures.

### Act 0 — Cold open
- **Scene:** void + starfield, single gold ember at center, slow 8s push-in.
- `[kick]` CIRCLE
- `[serif]` *Every family is a small universe.*
- *Beat: the ember pulses once; faint flash.*

### Act 1 — The scatter (the human truth)
- **Scene:** camera drifts past cold, scattered blue-white points (no warmth, no order).
- `[kick]` THE SCATTER
- `[serif]` *But ours got scattered.*
- `[sub]` Across a hundred apps and a dozen screens — the people who matter most, getting the leftovers of our attention.

### Act 2 — The cost (numbers)
- **Scene:** two/three figures rise in mono; ember dims slightly.
- `[kick]` THE COST
- `[num]` **100+** apps to run one family's life · **7 hrs/day** of screens, almost none of it shared · **~12** years a child is truly small
- `[serif]` *Time we don't get back.*

### Act 3 — The turn
- **Scene:** the ember warms and steadies; camera eases in.
- `[kick]` WHAT IF
- `[serif]` *What if the people you choose / had one place?*
- `[sub]` What if a family ran on one rhythm — plan, live, remember? What if a child learned in worlds, not worksheets?

### Act 4 — Ignition
- **Scene:** **flash.** The star fires (`elastic.out`); two systems bloom outward from one spine (`back.out` planet-births, staggered).
- `[serif]` *So we built two worlds. / On one circle.*
- `[sub]` KinetikCircle, for the life a family shares. ArgantaLab, for the child becoming who they'll be.

### Act 5 — Tour · KinetikCircle
- **Scene:** orbit freezes; camera **dives** into the KinetikCircle system (left-of-frame), passport slides in left, product-tour panel slides in right, system-bar appears.
- **Passport:** `KINETIKCIRCLE` · *The family life-OS* · loop **Plan → Live → Remember** · the `@kin` agent · *N circles · M moments · the micro-apps as moons*
- `[serif]` *Plan it. Live it. Remember it.*

### Act 6 — Tour · ArgantaLab
- **Scene:** camera arcs across to the ArgantaLab system; its six worlds light in turn.
- **Passport:** `ARGANTALAB` · *Where kids learn in worlds* · 6 worlds · the mastery loop · the diamond economy · *N learners · 6 worlds · K live items*
- `[serif]` *Mastery, disguised as play.*

### Act 7 — The bridge (one economy)
- **Scene:** light visibly flows along the constellation lines between the two systems; the circle of people brightens.
- `[kick]` ONE ECONOMY
- `[serif]` *Two worlds, one current.*
- `[sub]` Diamonds earned in learning, spent in life. The same circle of people, the same trust — flowing between both.

### Act 8 — Circle HQ ascends (the investor-credibility beat)
- **Scene:** camera pulls **way** back; the central star asserts — the operating brain above it all. Cinematic flythrough of the north-star curve + unicorn scorecard tiles forming in space.
- `[kick]` THE BRAIN
- `[serif]` *And one mind watches it all.*
- `[sub]` Circle HQ — north-star, a unicorn scorecard, an insight engine reading every signal across both products. Run like a holding company from day one.

### Act 9 — Live proof (ask once)
- **Scene:** a Circle HQ "answer card" materializes (the Cosmo-consultation beat), pulling a live read from both worlds.
- `[kick]` ASK ONCE
- **Card — "How is the portfolio today?"**
  - `ARGANTALAB` — weekly active learners + retention signal
  - `KINETIKCIRCLE` — circles completing the core loop
  - `ECONOMY` — diamonds earned vs spent, float healthy
  - **Verdict:** *Engagement-stage today — unicorn-track. The revenue scorecard activates next.*
- *(Can wire to the real `hq_growth_overview()` data, or use a curated snapshot for a deterministic film.)*

### Act 10 — The reveal (child · family · friends)
- **Scene:** the star dims; the center resolves into a **small warm constellation of human lights** — a child, parents, friends — slow-breathing. The two systems quiet and orbit in harmony around them.
- `[serif]` (staggered, one line at a time):
  - *You came for the products.*
  - *The two worlds. The dashboards. The numbers.*
  - *But the center was never the apps.*
  - **(hero)** *It's the child. The family. The friends you choose.*
  - *The hour we give back — so you can spend it on them.*

### Finale
- **Scene:** the whole portfolio orbits the human constellation in harmony; gentle pull-back; sign-off.
- `[serif sig]` *Circle.*
- `[sub]` Build. Learn. Live. — together.
- **Investor end-card (tone-specific):** *A portfolio built on a human truth — and a venture-scale opportunity.* (north-star + the unicorn ambition, one line.)

---

## 7. Chrome & UX
- **Loader** → `Begin` button (ignites the experience).
- **Brand** (top-left), **prev/next** nav (top-right), **progress dots** (bottom), **replay (R)**.
- **System-bar** (top-center, like Cosmo's guardbar) to jump **KinetikCircle ⇄ ArgantaLab ⇄ Circle HQ**.
- **Controls:** `→ / Space` advance · `←` back · click-to-advance · `R` replay · dot-jump.
- **Connector** SVG line from passport pill → live system node (tracks in 3D).
- Responsive: passports/panels reflow to bottom sheets on mobile; reduced particle counts.

---

## 8. Tech & architecture
- **Stack:** Three.js (r128+) + GSAP 3.12+, single HTML or a React route (`/film`) with the scene in a `useEffect`. No bund.
- **Pattern (from the reference):** `initScene()` builds the world; `animate()` rAF loop; a `STEPS[]` array of `{ on() }` acts; `goto(n)` drives camera + captions; reusable `cap()` caption nodes, `passport()`, `showTour()`, `showAnswer()`, `flash()`, `ignite()`, `birthPlanet()`, `tweenOrbit()`.
- **Data hooks (optional, Act 8–9):** read `hq_growth_overview()` for a *live* answer card, or ship a curated JSON snapshot so the film is deterministic for pitches.
- **Performance:** `setPixelRatio(min(dpr,2))`, additive blending + `depthWrite:false` for glows, particle counts scaled by viewport, `prefers-reduced-motion` fallback (static hero + captions).

---

## 9. Asset list (to prep before build)
- **Fonts:** Fraunces, Space Grotesk, a mono — via Google Fonts.
- **Textures:** radial glow sprite (canvas-generated, like the reference), optional soft grain PNG.
- **Copy:** finalize all act lines (Section 6) + the three "cost" figures + the answer-card numbers.
- **Brand data:** confirm KinetikCircle micro-app count, ArgantaLab world/learner/item figures for the passports.
- **Logo/sign-off:** the "Circle" wordmark treatment for the finale.
- **Music/SFX (optional but huge for cinema):** one ambient pad + an ignition swell + soft UI ticks.

---

## 10. Build phasing (when greenlit)
- **P0 — Concept doc** ✅ (this file). Lock story + copy.
- **P1 — Vertical slice:** boot + scene + Acts 0→4 (cold open → ignition) to prove the craft.
- **P2 — Tours:** Acts 5–7 (KinetikCircle, ArgantaLab, the bridge) + passports/panels/system-bar.
- **P3 — Investor beats:** Acts 8–9 (Circle HQ ascends + live answer card).
- **P4 — Reveal + finale:** Act 10 human-constellation + finale + sign-off; full polish, sound, mobile.

---

## 11. Open decisions / TODO
- Music: license a track or commission? (biggest single lift in perceived production value)
- Act 9 data: live `hq_growth_overview()` vs curated snapshot for pitches.
- Length target: ~90–120s auto-play cut vs self-paced (both — auto-play with manual override).
- Where it deploys: a `circle.*` landing route vs a private investor link.
- Finale wordmark: "Circle" vs the holding-company name.

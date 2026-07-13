# Jarvis Digital Twin — Design Audit and Build Blueprint

**Status:** superseded by the ultrawide single-orb revision
**Scope:** separate standalone prototype at `apps/hq/prototypes/jarvis-digital-twin.html`  
**Production landing:** unchanged until design lock  
**Audit date:** 2026-07-13

> **Superseded:** Founder review of the first working prototype removed the rail, founder kernel, persistent sensor wings, headline/brief block, and five-lens pill from the center composition. The current design/build direction is [Jarvis Digital Twin v2 — Ultrawide Single-Orb Revision](./jarvis-digital-twin-v2-ultrawide-plan.md).

## 0. Executive verdict

The handoff is strategically excellent and visually over-specified.

It correctly defines Arganta as one founder-governed organism, preserves the three-product truth, makes provenance mandatory, and gives Jarvis a real operating anatomy. The weakness is that it asks the first frame to explain almost every part of that anatomy at once: memory graph, command ring, six executives, three products, five architecture layers, provenance ring, world map, activity charts, full workforce, voice, and founder state.

That will likely produce a beautiful systems diagram, but not a singular experience.

The recommended redesign is **The Living Aperture**: a calm, unmistakable Jarvis presence that opens and reveals the company only when the founder asks a question. The wow moment is not “many things are glowing.” It is watching one truthful signal travel through memory and command, reach the correct agent, stop at the founder boundary, and return as a learned outcome.

The prototype should make this sentence self-evident:

> Aldyth governs. Jarvis sees the whole company, explains what it knows, and turns evidence into supervised action.

## 1. What was audited

### 1.1 Source material

- The 2026-07-13 Jarvis Digital Twin handoff.
- Current HQ landing, reactor, shell, rail, theme, data, graph, Vault, Portfolio, Growth, Architecture, and Agent OS source.
- Current Agent OS v2 gap audit and build plan.
- Existing Jarvis CEO and Architecture “wow” research.
- The live local HQ rendered at 1440×900 in its intentional offline-preview mode.
- The current landing at a 390×844 mobile viewport.

### 1.2 Verified repository facts

- The generated Vault contains **319 knowledge entries**.
- The legacy agent roster contains **27 agent identities**.
- Command has **6 governing offices**.
- The current product philosophy is **3 products + Circle HQ**, not seven equal apps.
- The current landing hardcodes `27 agents` and visually implies a core status even when most Agent OS capabilities cannot act.
- The current Agent OS audit states that agents mostly diagnose, builder agents are missing, memory is not persisted, convening is cosmetic, and model labels do not reflect runtime truth.

These facts must not be compressed into “27 agents online.” The prototype should distinguish:

```text
27 roster identities · snapshot
20 mapped company capabilities · mixed readiness
6 governing offices · structural fact
0 implied autonomous workers unless a real run exists
```

## 2. Audit findings

### 2.1 Critical: the experience has no dominant question

The current desktop landing is a balanced cockpit: central reactor, two side stacks, four bottom panels, and a full-width control strip. It is tidy, but every region asks for attention. In offline mode most values become honest dashes, leaving a strong orb surrounded by visually equal empty containers.

The handoff increases the number of simultaneous systems. Without progressive disclosure, the result will read as an advanced HUD rather than a founder relationship.

**Correction:** the first frame answers only three questions:

1. What needs Aldyth’s attention?
2. What does Jarvis currently know?
3. What can Jarvis do next?

Everything else is one interaction away.

### 2.2 Critical: mobile is a reflow, not a mobile product

At 390×844, the current desktop composition expands to roughly 1,822px of content inside a fixed-height cockpit. The shell remains overflow-constrained, making most content unreachable and producing an effectively blank first-frame capture in the in-app browser despite the DOM being populated.

The proposed mobile sections in the handoff are directionally right, but they need to be treated as a separate information architecture rather than CSS stacking.

**Correction:** render a dedicated mobile tree below 760px. Do not mount desktop charts on the Jarvis home. Use five explicit mobile destinations and bottom sheets for inspectors.

### 2.3 High: the reactor is generic, not yet Arganta-owned

Concentric rings, a bright sphere, radar ticks, and blue glow create polish but also look familiar. The visual says “advanced AI core”; it does not yet say “this is Arganta, its products, its memory, and its founder.”

**Correction:** replace the generic sphere language with an asymmetric living aperture:

- A small founder kernel at the center.
- Three unequal product membranes that open like an iris.
- A memory field that becomes visible through the aperture.
- A governance boundary that physically stops unapproved action.
- A distribution membrane outside the product body, visibly thin and underpowered when reach is weak.

### 2.4 High: anatomy is being confused with simultaneous visibility

The eight core layers are a good ontology, not a good default composition. If every layer is always visible, the eye sees decoration rather than meaning.

**Correction:** preserve the anatomy as selectable lenses:

| Lens | Visible emphasis |
|---|---|
| Company | Founder, Jarvis, three products, current priority |
| Evidence | sensors, memory path, provenance |
| Decision | Command Cortex, consulted offices, approval boundary |
| Workforce | active agent path, mission state, autonomy |
| Architecture | five exoskeleton bands, constraints, blind spots |

Only one lens can dominate at a time. Inactive layers remain as quiet geometry or disappear.

### 2.5 High: ambient motion lacks a strict semantic budget

The current landing continuously rotates multiple ring groups, sweeps the core, pulses the microphone, and animates background blobs. Each effect is individually light, but together they normalize motion. When an important event occurs, there is little remaining contrast.

**Correction:** use motion as punctuation:

- One slow “breath” in idle.
- No continuously travelling signal particles.
- No constant executive orbit.
- No animated blur, shadows, or large gradients.
- Full-speed motion only during a state transition or user request.
- A state change must be understandable from the final static frame.

### 2.6 High: data honesty exists but is visually secondary

The code is disciplined about `—` and offline states. The design still makes an empty chart look like an unfinished chart. Provenance is currently explanatory microcopy, not a first-class operating signal.

**Correction:** treat missing data as an intentional blind spot in the organism:

- A missing signal creates a visible break in the evidence path.
- The provenance ring names the gap: `AWAITING REACH SIGNAL`, not just `—`.
- A blind sensor is hollow and quiet; it never pulses.
- Selecting the gap opens the exact integration requirement.

### 2.7 Medium: typography is below comfortable operator scale

The current cockpit uses many 7–9.5px labels. At 1440×900 they are decorative texture rather than comfortably readable interface text.

**Correction:** minimum 12px for actionable or explanatory text, 11px only for tertiary instrumentation, and 14–16px for the founder brief. Uppercase tracking is reserved for short status labels.

### 2.8 Medium: the organization has two unresolved vocabularies

The 27-persona roster and the six-office command graph are only loosely reconciled. The handoff adds a capability-based spine. This is the right direction, but the prototype must not imply that a capability agent is operational simply because a matching workspace exists.

**Correction:** one normalized prototype registry with separate fields for:

```ts
identityKind: 'chief' | 'capability' | 'persona'
surfaceId: string | null
officeId: OfficeId
readiness: 'live' | 'read-only' | 'prototype' | 'planned'
autonomy: 'manual' | 'assist' | 'delegate' | 'autopilot'
source: Provenance
```

### 2.9 Medium: visual customization risks weakening authorship

An always-visible hue slider makes the experience feel themeable rather than authored. It also complicates contrast, product color, provenance color, and cinematic tuning.

**Correction:** Arganta Blue is the authored default. Keep accent presets and custom hue inside settings for requirement coverage; do not place the slider in the primary command dock.

## 3. Decisions that should change from the handoff

| Handoff proposal | Recommended change | Reason |
|---|---|---|
| 4–6 second boot | 2.4–2.8 seconds on first visit; 0.6-second re-entry; always skippable | A founder OS should feel ready, not theatrical before useful. |
| 180–320 visible force nodes | 96–140 default desktop, up to 180 high tier; 32–48 mobile | Density should imply memory without becoming texture or consuming the frame budget. |
| Live force simulation in the core | Precompute/cool the layout, then render a mostly static field; reheat only the selected neighborhood | Preserves the intelligent-lattice look without constant CPU cost. |
| Both sensor wings visually present | Sensors remain low-contrast edge fields until focus | Protects the core hierarchy and makes activation meaningful. |
| Eight simultaneous core layers | Five progressive lenses over one persistent founder/Jarvis core | Anatomy remains complete; comprehension improves. |
| Full accent control in primary UI | Settings-only | Keeps brand authorship and reduces visual QA combinations. |
| Continuous rotations and particles | One idle breath; event motion only | Restores contrast between calm and important. |
| Equal visual weight for every executive node | Show only consulted offices during a thought; full council in Workforce lens | The executive model stays truthful without clutter. |

## 4. Refined design north star

### 4.1 Concept: The Living Aperture

Jarvis is not a ball floating in a dashboard. Jarvis is the aperture through which the founder sees the company.

At rest, the aperture is nearly closed: a luminous founder kernel, a restrained blue iris, and three faint product membranes. When Jarvis senses something, the relevant membrane opens. Evidence streams inward from a sensor. Memory illuminates behind the iris. Command segments assemble. A work path exits toward the correct capability. If approval is required, the path stops at a thin amber founder boundary. Approval releases it. Completion returns a green learning trace into memory.

This visual creates an Arganta-owned signature because it combines:

- Three products as living membranes.
- Circle HQ as governance, not a fourth product.
- Founder authority as a physical boundary.
- Memory as depth revealed through the aperture.
- Distribution as the thin outer membrane where the current company is weakest.

### 4.2 Emotional qualities

- **Intelligent, not busy.** The interface appears to know what matters.
- **Cinematic, not game-like.** Motion has staging, pauses, and consequence.
- **Living, not mystical.** Every visual maps to a real system or explicit model.
- **Powerful, not autonomous by implication.** The founder boundary is always legible.
- **Premium in light and dark.** Dark is an observatory; light is a precision laboratory.

### 4.3 Success test

Within eight seconds, a first-time viewer should be able to say:

1. This is one company, not a group of apps.
2. Jarvis sees evidence across three products.
3. Aldyth remains in control.
4. The system knows what is live, modeled, and missing.

## 5. Experience architecture

### 5.1 Five interaction modes

| Mode | Purpose | Primary UI |
|---|---|---|
| Observe | Daily situational awareness | core, priority, one brief, quiet sensors |
| Focus | Investigate a product, region, metric, agent, or knowledge node | expanded sensor/inspector, synchronized highlights |
| Act | Run a deterministic prototype command | visible Sense → Recall → Reason → Delegate sequence |
| Review | Approve, reject, or inspect a proposed outcome | founder boundary, evidence summary, approval controls |
| Explain | Understand why Jarvis believes something | provenance trail, sources, timestamps, assumptions |

These modes replace “show everything” with a coherent operating rhythm.

### 5.2 Desktop first frame

```text
┌─ spine ─┬──────────────────────────────────────────────────────────────┐
│         │ ARGANTA / JARVIS                         TRUST · SNAPSHOT    │
│ FACE    │                                                              │
│ BRAIN   │       faint reach field     LIVING APERTURE     rhythm field │
│ SENSE   │                                 ◉                            │
│ MEMORY  │                    “Distribution is the constraint.”         │
│ HANDS   │                                                              │
│         │             [Ask Jarvis…] [Daily brief] [Approvals 2]        │
└─────────┴──────────────────────────────────────────────────────────────┘
```

Rules:

- The core occupies 44–56vh, not the entire canvas.
- The founder brief is one sentence, 70–110 characters.
- Reach and activity are visible as dormant fields, not framed cards.
- The left spine is 48–56px collapsed and expands only on explicit click.
- The bottom command dock is 56–64px and never competes with the core.
- No four-card bottom row.
- No floating status badges disconnected from a visual layer.

### 5.3 Desktop focus state

Selecting Reach, Activity, a product, or a command produces a 60/40 composition:

```text
┌─ spine ─┬──────────────────────── stage ─────────────────┬─ evidence ─┐
│         │ aperture remains visible and synchronized      │ map/chart  │
│         │ active path + relevant product membrane        │ insight    │
│         │ founder brief updates                          │ provenance │
└─────────┴────────────────────────────────────────────────┴────────────┘
```

The evidence panel may be on the left or right based on source location, but only one primary panel is open at a time. Secondary detail uses tabs inside the inspector.

### 5.4 Mobile information architecture

Below 760px, mount `MobileExperience`, not `DesktopExperience`.

#### Jarvis

- Top: Arganta mark, current phase, theme/settings.
- Center: 58–68vw reduced aperture.
- Below: founder priority and a two-line daily brief.
- Primary control: 56px Talk/Ask button.
- Secondary: approval pill.
- No charts and no desktop rail.

#### Reach

- Full-height map with a bottom filter tray.
- Coarse-timezone privacy label always visible.
- Region details in a draggable bottom sheet.

#### Activity

- Two tabs: Average access / Visit rhythm.
- Four-hour bins at widths below 390px; 24-hour horizontally scrollable view otherwise.

#### Workforce

- Offices first, capability groups second.
- Active missions and approvals pinned above the roster.

#### Vault

- Search first.
- Small representative lattice only after a query.
- Results and provenance in a bottom sheet.

### 5.5 Empty/offline state

Offline is a designed state, not a disabled dashboard.

The first sentence becomes:

> Jarvis can see the company structure. Live reach and activity are awaiting signal.

The product membranes, office structure, Vault snapshot, and architecture remain visible with `SNAPSHOT` provenance. Sensors without data become open circuits with a direct “What must be wired?” action.

## 6. Visual system

### 6.1 Color roles

| Role | Dark | Light | Notes |
|---|---|---|---|
| Canvas | navy-black, not pure black | ice-white / blue-grey | Avoid large animated gradients. |
| Jarvis | electric Arganta blue → white | saturated cobalt → white | Highest chroma belongs to Jarvis. |
| Memory | violet | deep indigo | Semantic; not user-customizable. |
| Sensing | cyan-blue | royal blue | Semantic. |
| Working | amber | ochre-amber | Semantic. |
| Complete | green | deep green | Used sparingly. |
| Blocked | red | deep red | Local path only. |
| Founder boundary | warm white + amber | navy + amber | Authority, not danger. |

Product colors are low-saturation identifiers, not status colors:

- ArgantaLabs: azure.
- LashiraBloom: violet/rose.
- KinetikCircle: teal.
- Circle HQ: neutral blue-white governance halo.

### 6.2 Shape language

- Use apertures, membranes, arcs, and open circuits.
- Avoid equal rounded rectangles.
- Panels have one anchored edge and one open edge.
- Cropped corners indicate instrumentation, not decoration on every element.
- A circle means identity or governance; a lobe means product; a line means evidence or action.

### 6.3 Typography

- UI: existing system sans stack for zero font payload.
- Metrics/code: existing mono stack.
- 32–42px: one hero statement only.
- 18–22px: founder brief headline.
- 14–16px: body and inspector copy.
- 12px: controls, provenance, axis labels.
- 11px: tertiary instrumentation only.
- Never rely on wide-tracked 8–9px uppercase as readable content.

### 6.4 Light mode

Light mode is not dark mode with a white background:

- Replace glow with crisp line-density and contrast.
- Use shadow only for elevated inspectors, never every field.
- Keep the memory lattice 20–35% opacity until active.
- Use cobalt rather than cyan for readable signals.
- Remove additive blend modes that turn into haze.

## 7. Motion direction

### 7.1 Motion principles

1. Motion must reveal cause and effect.
2. The interface spends more time still than moving.
3. Important motion starts from the selected evidence or command, not the screen edge.
4. Spatial movement is used for state; opacity is used for hierarchy.
5. Reduced motion preserves the same sequence as discrete highlighted states.

### 7.2 First-visit boot film: 2.6 seconds

| Time | Event |
|---:|---|
| 0.00–0.25 | Quiet field; `ARGANTA OS` resolves without typewriter effect. |
| 0.20–0.65 | Founder kernel appears. |
| 0.45–1.10 | Three product membranes grow from the kernel. |
| 0.75–1.45 | Memory points resolve behind the closed aperture. |
| 1.05–1.75 | Jarvis iris draws around the kernel. |
| 1.45–2.05 | Six office marks and the collapsed spine register. |
| 1.75–2.35 | Sensor fields fade into the edges. |
| 2.10–2.60 | Founder priority and command dock appear. |

The experience is interactive by 1.2 seconds. Skip jumps to the fully composed static state. Replay lives in settings.

### 7.3 Thought choreography

```text
select signal
  → sensor brightens
  → evidence trace enters relevant product membrane
  → 3–7 memory nodes resolve
  → Command segments step once
  → consulted office marks move inward
  → mission path exits to one capability
  → founder boundary holds if approval is required
  → completion returns one learning trace to memory
```

Suggested timings:

- Sensing: 500–800ms.
- Remembering: 700–1,000ms.
- Reasoning: 900–1,300ms.
- Delegation: 450–700ms.
- Approval hold: static boundary with one restrained 2.4s pulse.
- Completion: 600–900ms.

Do not fake duration for “working.” The demo adapter uses explicit scripted step durations and labels the run `DETERMINISTIC DEMO`.

### 7.4 Ambient motion budget

- Core breath: scale 1.000 → 1.018, 4.2s, opacity only on two layers.
- One radar scan every 12–16s, disabled in light mode if visually noisy.
- Memory drift stops after layout cooling.
- No more than 12 moving DOM/SVG elements in idle.
- Active sequence may temporarily reach 40 moving primitives.
- `will-change` is applied shortly before animation and removed afterward.

For performance, animate compositor-friendly `transform` and `opacity`; avoid layout- and paint-triggering properties except for short, measured SVG stroke sequences. See [web.dev’s animation guidance](https://web.dev/articles/animations-guide).

### 7.5 Reduced motion

Start from static styles, then enable motion under `prefers-reduced-motion: no-preference`. In reduced mode:

- No boot convergence.
- No continuous breath or scan.
- Each thought stage changes highlight and copy with a 120–160ms crossfade.
- No travelling paths; use completed segments.
- Voice waveform becomes a level meter without spatial expansion.

This follows the W3C technique for suppressing interaction motion when the user requests it: [WAI C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## 8. Interaction and content contracts

### 8.1 Shared selection contract

One selection state synchronizes every visualization:

```ts
interface SelectionState {
  kind: 'none' | 'product' | 'region' | 'activityCell' | 'agent' | 'office' | 'knowledge' | 'provenance'
  id: string | null
  sourceSurface: 'core' | 'reach' | 'activity' | 'spine' | 'vault' | 'command'
}
```

A selection always updates:

- relevant product membrane;
- related agent marks;
- founder brief context;
- inspector title and provenance;
- map/activity filter where applicable.

### 8.2 Provenance language

| Code | Visible label | Visual behavior |
|---|---|---|
| live | LIVE | solid signal; may pulse on refresh |
| partial | PARTIAL | interrupted/dashed signal |
| snapshot | SNAPSHOT · date | solid but static |
| simulated | MODEL | patterned fill; never “live” animation |
| placeholder | AWAITING SIGNAL | hollow node/open circuit; no numeric zero |

Every inspector begins with an answer, then evidence:

```text
Distribution is the weakest company layer.
SNAPSHOT · 2026-07-11
Evidence: L7 maturity ≈ zero; external users recorded as 0.
Assumption: repository snapshot, not current telemetry.
```

### 8.3 Copy style

- Short, direct, founder-level.
- No “AI confidence.”
- No anthropomorphic claims beyond observable state.
- No fake urgency.
- No decorative jargon such as neural throughput, system integrity, or cognition load unless it maps to a real contract.

Recommended first-frame copy:

```text
JARVIS · ARGANTA DIGITAL TWIN
Priority: Prove distribution before expanding the product surface.
Brief: The company spine is mature. Reach remains the highest-leverage blind spot.
```

## 9. Technical design

### 9.1 Rendering stack

- React 18 + ReactDOM production build, bundled inline.
- GSAP for master timelines and state choreography.
- D3 modules only: force, geo, scale, shape, array, color as required.
- SVG for crisp rings, membranes, map, and accessible chart marks.
- One Canvas 2D layer for the memory lattice when node count exceeds 80.
- CSS transforms/opacity for UI motion.
- No WebGL, Three.js, runtime CDN, runtime JSX compiler, or remote imagery.

### 9.2 Refined component tree

```text
JarvisDigitalTwinApp
├── ExperienceProvider
├── DataProvider
├── MotionProvider
├── BootFilm
├── DesktopExperience
│   ├── AgenticSpine
│   ├── SensorField side="reach"
│   ├── LivingApertureStage
│   │   ├── FounderKernel
│   │   ├── ProductMembranes
│   │   ├── JarvisIris
│   │   ├── MemoryField
│   │   ├── CommandSegments
│   │   ├── OfficeMarks
│   │   ├── GovernanceBoundary
│   │   └── TrustRing
│   ├── SensorField side="activity"
│   ├── FounderBrief
│   ├── EvidenceInspector
│   └── CommandDock
├── MobileExperience
│   ├── MobileJarvis
│   ├── MobileReach
│   ├── MobileActivity
│   ├── MobileWorkforce
│   ├── MobileVault
│   └── MobileNav
└── VoiceSessionOverlay
```

### 9.3 State architecture

Use a reducer or small external-style store contract rather than many independent `useState` calls:

```ts
interface ExperienceState {
  theme: 'light' | 'dark'
  quality: 'low' | 'medium' | 'high'
  phase: JarvisPhase
  lens: 'company' | 'evidence' | 'decision' | 'workforce' | 'architecture'
  selection: SelectionState
  inspector: 'closed' | 'peek' | 'open'
  activeCommandId: string | null
  activeMissionId: string | null
  rangeDays: 7 | 14 | 30
  accessMetric: AccessMetric
  reducedMotion: boolean
  introComplete: boolean
}
```

### 9.4 Registry truth

Create one `prototypeRegistry` containing offices, capabilities, workspaces, readiness, autonomy, and source. Derive the spine, executive marks, counts, and inspector content from it. Do not scatter names across components.

The visible top-line count is generated from registry facts, for example:

```text
6 offices · 20 mapped capabilities · 11 draft-only builders · SNAPSHOT
```

The exact number must be recalculated during P0 and not copied from this plan if the registry changes.

### 9.5 D3 layout strategy

- Build the representative memory-node set deterministically.
- Run `forceSimulation(...).stop()` and a bounded manual tick sequence during initialization.
- Cache the resulting positions for the session.
- Reheat only a 3–12 node neighborhood during a remembering interaction.
- Use a worker only if the representative graph exceeds the measured main-thread budget.

D3 explicitly supports stopped/manual simulations and recommends workers for large static layouts: [D3 force simulation documentation](https://d3js.org/d3-force/simulation).

### 9.6 Responsive strategy

- Use `matchMedia`/`gsap.matchMedia()` for desktop, mobile, pointer, and reduced-motion timelines.
- Use `ResizeObserver` per map/chart container rather than global window measurements.
- Unmount the desktop tree on mobile and vice versa.
- Never compute “lite mode” only once at initial mount.

GSAP’s media-query context provides automatic animation cleanup when conditions change: [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/). `ResizeObserver` is widely available and intended for performant element-size responses: [MDN Resize Observer](https://developer.mozilla.org/en-US/docs/Web/API/Resize_Observer_API).

## 10. Performance budgets and degradation

### 10.1 Artifact and loading

| Budget | Target | Hard fail |
|---|---:|---:|
| Final HTML, raw | ≤ 2.5 MB | > 4 MB |
| Final HTML, gzip | ≤ 900 KB | > 1.5 MB |
| Source maps in artifact | 0 | any |
| Remote runtime requests | 0 | any dependency request |
| Time to useful static frame, modern desktop | ≤ 1.2s | > 2.0s |

If the measured bundle exceeds the target, report module sizes before changing the single-file requirement.

### 10.2 Runtime

| Budget | Desktop | Mobile |
|---|---:|---:|
| Animation target | 60fps | 30–60fps |
| Frame budget, p95 during choreography | ≤ 16.7ms | ≤ 33.3ms |
| Long task during boot | none > 50ms | none > 50ms |
| Memory nodes | 96–140 default | 32–48 |
| Canvas DPR cap | 1.5 | 1.25 |
| Idle moving primitives | ≤ 12 | ≤ 4 |
| Interaction visual response | < 100ms | < 100ms |

Production port targets should remain within the “good” Core Web Vitals thresholds: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; the prototype should aim for CLS ≤0.05. Current thresholds are documented by [web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds).

### 10.3 Quality tiers

| Tier | Core | Memory | Effects |
|---|---|---|---|
| High | full SVG aperture | 140–180 canvas nodes | scan + active path bloom |
| Medium | full aperture | 80–120 nodes | no animated blur; fewer paths |
| Low | simplified SVG | 32–64 nodes | opacity state changes only |
| Reduced motion | static SVG | static representative nodes | crossfades only |

Quality may be user-selected in settings. Automatic downgrade may use a short, non-visible frame-time sample, but must never continuously poll FPS.

### 10.4 Lifecycle cleanup

- Pause GSAP timelines and any canvas loop on `document.hidden`.
- Stop D3 simulations after cooling.
- Disconnect observers on unmount.
- Cancel animation frames and audio analysers.
- Avoid React state writes on every frame.

The Page Visibility API exists specifically to avoid work when content is hidden: [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API.).

## 11. Detailed build plan

The build is design-gated. Do not start production porting during this plan.

### D0 — Design lock package · 0.5–1 day

**Deliverables**

- Three static keyframes: Observe, Thought in progress, Approval hold.
- Dark and light color proof for the aperture.
- Desktop 1440×900 wireframe.
- Mobile 390×844 Jarvis and Reach wireframes.
- Motion storyboard using the 2.6-second boot and one full signal-to-action sequence.
- Final copy for the first frame.

**Founder decisions**

- Approve “Living Aperture” versus a literal spherical reactor.
- Approve on-demand evidence panels versus permanently visible dashboard cards.
- Approve settings-only accent customization.

**Acceptance**

- The company anatomy can be explained from the static Observe frame.
- Dark and light both feel authored.
- The founder boundary is unmistakable.
- No implementation begins until these frames are accepted.

### P0 — Baseline and contracts · 0.5 day

**Build**

- Recalculate Vault, roster, office, capability, surface, and readiness facts.
- Create prototype directories and a reproducible temporary bundling path.
- Define data, registry, provenance, mission, voice, selection, and state contracts.
- Write deterministic sample data with explicit `SNAPSHOT`, `MODEL`, or `AWAITING SIGNAL` labels.

**Acceptance**

- Production landing files unchanged.
- No stale hardcoded count appears in the prototype.
- Every number has provenance.

### P1 — Static shell and visual tokens · 1 day

**Build**

- App shell, desktop grid, mobile router, settings, theme, quality, and reduced-motion preferences.
- Collapsed spine, founder brief, command dock, provenance control, and empty inspector.
- Dark/light tokens and semantic colors.
- Static aperture geometry without animation.

**Acceptance**

- 1440×900, 1920×1080, 1280×800, 768×1024, and 390×844 have no overflow.
- Mobile Jarvis contains no chart DOM.
- Keyboard order follows visual order.

### P2 — Living Aperture core · 1.5 days

**Build**

- Founder kernel, three product membranes, Jarvis iris, HQ halo, governance boundary, and trust ring.
- Representative memory field with deterministic layout.
- Command segments and office marks.
- Lens switching with static state changes first.

**Acceptance**

- Every visual primitive has one documented meaning.
- The core reads in grayscale and without motion.
- Light mode uses no illegible bloom.
- Default-tier idle stays within runtime budget.

### P3 — Data adapter and honest states · 1 day

**Build**

- `StaticPrototypeAdapter` with dated snapshot facts.
- Reach, access, heatmap, workforce, brief, mission, and approval payloads.
- Derived-insight functions with unit tests or inline deterministic assertions.
- Designed blind-spot states.

**Acceptance**

- Missing values render `—` plus `AWAITING SIGNAL`.
- No zero is substituted for missing data.
- Average daily people is calculated as mean of daily distinct counts.
- Changing filters recomputes the headline.

### P4 — Sensor fields and evidence inspector · 1.5 days

**Build**

- Equal Earth world map, coarse-timezone label, region points, product filter, and empty state.
- Horizontal average-access bars.
- Day/hour heatmap with four-hour mobile aggregation.
- One shared filter and selection contract.
- Evidence inspector with answer, provenance, source, updated time, and assumption.

**Acceptance**

- Selecting any sensor updates the same product, brief, memory path, and inspector.
- No region arc appears without a real or explicitly modeled point.
- Tooltips stay within the viewport.

### P5 — Agentic spine and workforce truth · 1 day

**Build**

- Render FACE/BRAIN/SENSE/MEMORY/STRUCTURE/HANDS/EVOLVE from the normalized registry.
- Readiness, autonomy, approval, and mission states.
- Capability inspector.
- Active Jarvis-to-agent path.

**Acceptance**

- A workspace does not imply a live agent.
- Every capability shows readiness and provenance in text, not color alone.
- Builder actions remain clearly draft/demo only.

### P6 — Cinematic choreography · 1.5 days

**Build**

- First-visit boot timeline and short re-entry.
- Sensing, remembering, reasoning, delegating, approval, completed, and blocked sequences.
- Skip, replay, interruption, and cleanup.
- Demo command scripts and mission-step synchronization.

**Acceptance**

- Every animation corresponds to a state transition.
- Skip leaves no hidden or partially transformed elements.
- Replaying does not duplicate listeners/timelines.
- Reduced motion is fully functional and information-equivalent.

### P7 — Mobile product · 1.5 days

**Build**

- Dedicated Jarvis, Reach, Activity, Workforce, and Vault trees.
- Bottom navigation and safe-area handling.
- Bottom-sheet inspectors.
- Touch map interactions and accessible chart alternatives.

**Acceptance**

- 320, 360, 390, 430, and 768px widths pass without page-level horizontal overflow.
- All targets are at least 44×44px.
- Browser chrome and safe-area insets do not cover navigation.
- Mobile first frame is useful without scrolling.

### P8 — Voice seam and deterministic showcase · 0.75 day

**Build**

- `VoiceAdapter` contract and `DemoVoiceAdapter`.
- Text input and command chips as first-class alternatives.
- Listening/speaking visuals driven by adapter events.
- Eight scripted founder commands.

**Acceptance**

- No network voice request and no secret in the file.
- Demo responses are labelled deterministic.
- Voice interruption returns the UI to a valid phase.

### P9 — Performance, accessibility, and packaging · 1–1.5 days

**Build**

- Bundle React, ReactDOM, GSAP, selected D3 modules, CSS, topology, and app into one IIFE HTML.
- Remove sourcemaps and dev code.
- Add visibility pause, observers, focus management, and cleanup.
- Run desktop/mobile performance traces and keyboard/reduced-motion checks.
- Measure raw and gzip sizes.

**Acceptance**

- Direct file open works with zero runtime dependency requests.
- Size and runtime budgets are reported.
- No console error after boot, replay, theme change, resize, filter change, or repeated command runs.
- All interactive elements have names, focus styles, and keyboard access.

**Estimated focused build:** 10–12 working days after D0 approval. The largest uncertainty is not component construction; it is visual tuning of the aperture and choreography across light mode and lower-powered mobile devices.

## 12. Verification matrix

### 12.1 Visual

- 1440×900 light/dark.
- 1920×1080 light/dark.
- 1280×800 light/dark.
- 768×1024 portrait.
- 390×844 and 430×932 mobile.
- High, medium, low, and reduced-motion quality.
- Empty, snapshot-only, simulated, partial, and live-like demo payloads.

### 12.2 Interaction

- Product → map → activity synchronization.
- Region → brief → memory path.
- Heat cell → derived headline.
- Agent → mission path → inspector.
- Approval hold → approve/reject.
- Blocked state → architecture/GC constraint.
- Boot skip and replay.
- Resize across desktop/mobile breakpoint while animation is active.
- Page hide/show while a timeline is active.

### 12.3 Accessibility

- Full keyboard pass.
- Visible focus at 200% zoom.
- Screen-reader names for the core, charts, controls, and provenance.
- Text alternative summarizing each chart.
- Status/provenance never color-only.
- Reduced motion at OS level and in prototype settings.
- Contrast check for every theme/accent combination that remains exposed.

### 12.4 Performance

- Boot trace with cold cache.
- Three repeated thought sequences.
- Memory selection and reheat.
- Map pan/zoom and filter change.
- Mobile low tier.
- Background/foreground pause.
- Heap check after 20 replay cycles.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Looks like an Iron Man/Jarvis imitation | Use the product membranes, founder boundary, asymmetric aperture, and Arganta blue geometry; avoid helmet/HUD motifs and generic sci-fi copy. |
| Becomes a knowledge-graph hairball | Hide labels, cap nodes, precompute layout, reveal only the relevant neighborhood. |
| Wow consumes performance | Build static core first, define quality tiers, animate transform/opacity, measure every phase. |
| Offline looks broken | Make blind spots part of the organism and explain exactly what is awaiting signal. |
| “27 agents” overstates capability | Separate roster count, mapped capability count, readiness, and active missions. |
| Light mode looks washed out | Use line density and cobalt contrast, not bloom. Tune light as a separate art direction. |
| Single HTML becomes bloated | Import only required D3 modules, production builds only, no sourcemaps, measured bundle report. |
| Mobile repeats desktop failure | Separate render tree, mobile-first acceptance gates, no desktop charts mounted on Jarvis home. |
| Motion obscures meaning | Static-frame comprehension gate and reduced-motion parity. |
| Prototype terminology drifts from Agent OS v2 | Use `AgentSpec`, tool pack, mission, run, artifact, review queue, autonomy, and runtime-truth language. |

## 14. Design-lock checklist

The design is ready to build only when all answers are yes:

- Does the core look like Arganta rather than a generic AI sphere?
- Can the three products be identified without reading a legend?
- Is Circle HQ clearly governance rather than a fourth product?
- Is Aldyth visibly the final authority?
- Does the first frame have one dominant message?
- Does a thought sequence show cause and effect?
- Are evidence and provenance more important than decorative telemetry?
- Can the experience become fully still without losing meaning?
- Is mobile useful on the first screen with no charts?
- Do empty data states feel intentional and honest?
- Can a low-power device receive the same information with fewer effects?

## 15. Final design sentence

> Jarvis is a living aperture into Arganta: evidence enters through the company’s senses, memory resolves behind the iris, Command turns it into supervised work, and every consequential path stops at Aldyth.

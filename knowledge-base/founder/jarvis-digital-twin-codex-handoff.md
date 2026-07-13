---
title: Jarvis Digital Twin — Codex Build Handoff
type: implementation-handoff
status: approved-concept
date: 2026-07-13
owner: Aldyth Sukapradja
repo: https://github.com/aldythsukapradja/ArgantaLab
target: apps/hq
prototype: apps/hq/prototypes/jarvis-digital-twin.html
tags:
  - arganta
  - circle-hq
  - jarvis
  - digital-twin
  - agent-os
  - react
  - gsap
  - d3
  - prototype
---

# Jarvis Digital Twin — Codex Build Handoff

## 0. Directive to Codex

Build a single-file, maximum-wow React prototype for the Circle HQ landing page. The page must embody the entire Arganta company as one founder-governed digital twin. It must not look like an AI org chart, a collection of SaaS cards, or a generic glowing sphere.

The prototype must make the following operating model visible:

> Jarvis is the face and voice. Command is the brain. Portfolio, Growth and Reach are the senses. Data and Vault are memory. Architecture is the skeleton. Supabase/events are the nervous system. Provenance and approvals are reflexes and immune protection. Builder Agents are the hands. The rail is the agentic spine. ArgantaLabs, LashiraBloom and KinetikCircle are the living products in the world. Aldyth is the final governing authority.

The immediate deliverable is a **separate prototype**, not a replacement for the current production landing:

```text
apps/hq/prototypes/jarvis-digital-twin.html
```

Do not overwrite `apps/hq/src/surfaces/Landing.tsx` in this phase. The prototype is for founder review and design lock. Production porting happens only after approval.

## 1. Repository context to inspect first

Before writing code, inspect the current versions of:

```text
apps/hq/src/surfaces/Landing.tsx
apps/hq/src/surfaces/ReactorOrb.tsx
apps/hq/src/surfaces/landing.css
apps/hq/src/surfaces/Portfolio.tsx
apps/hq/src/surfaces/Growth.tsx
apps/hq/src/surfaces/Architecture.tsx
apps/hq/src/surfaces/WorldMap.tsx
apps/hq/src/surfaces/landingCharts.tsx
apps/hq/src/shell/Rail.tsx
apps/hq/src/shell/store.ts
apps/hq/src/components/AgentOrb.tsx
apps/hq/src/data/graph/agents.ts
apps/hq/src/data/graph/types.ts
apps/hq/src/data/graph/scaleModel.ts
apps/hq/src/data/growth.ts
apps/hq/src/data/live.ts
apps/hq/src/vault/types.ts
apps/hq/src/vault/graph.ts
apps/hq/src/vault/seed.ts
apps/hq/src/vault/kb.generated.ts
docs/agent-os-v2-grand-design.md
```

Also read any applicable `AGENTS.md` files before editing. Preserve unrelated user changes in a dirty worktree.

## 2. Product truth

### 2.1 This is an embodied agentic company

Every left-rail capability is all of the following:

1. An agent identity.
2. A manual workspace.
3. A registered tool pack.
4. A specific memory context.
5. A permission boundary.
6. A set of permitted outputs.
7. A measurable company capability.

Do not reduce the rail to the six C-level offices. The C-level agents govern; the complete rail workforce senses, remembers, constrains and executes.

### 2.2 The three products plus one HQ

The customer-facing product model is:

| Product | Verb | Strategic role |
|---|---|---|
| ArgantaLabs | Learn | Kids' learning, acquisition and mastery engine |
| LashiraBloom | Bloom | Reward, world, retention and shared family play |
| KinetikCircle | Organize | Parent/family coordination, utility and expansion |
| Circle HQ | Observe · Decide · Build | Founder operating system governing the three products |

Supporting systems must not appear as additional equal products:

- Kingdom Heroes is a character/combat engine and lab beneath LashiraBloom.
- Arganta Landing is the distribution membrane outside the product triad.
- Supabase, PostgreSQL, shared packages, telemetry and delivery are the common company spine.

### 2.3 The executive layer versus the workforce

The source-of-truth executive offices remain the six existing offices:

| Office | Agent | Responsibility |
|---|---|---|
| The Bridge | Jarvis / CEO | Orchestration, synthesis and founder escalation |
| Operations | COO | Retention, frequency, product depth and pruning |
| Technology | CTO | Architecture, instrumentation, activation and reliability |
| Treasury | CFO | Revenue, economy, costs, runway and valuation |
| Legal | GC | Child safety, consent, UGC, IP and blocking holds |
| The Guild | CAPO | Agent workforce, cost, ROI, improvement and replacement |

Aldyth is the seventh governing seat and final approver. Do not create a seventh AI executive merely to complete a visual symmetry.

## 3. Digital-twin anatomy

The visual hierarchy must communicate this anatomy:

| HQ element | Body metaphor | Agentic responsibility |
|---|---|---|
| Jarvis CEO Core | Face and voice | Understands, communicates, explains and represents the company |
| Command Center | Brain / decision cortex | Reasons, prioritizes, creates missions, delegates and resolves conflicts |
| Portfolio | Internal sensor | Company-wide health, product balance and North Star |
| Growth | External sensor | Acquisition, retention, behavior, funnels and market response |
| Reach | External field of view | Where people are, which app they access and when |
| Builder analytics | Local sensors | Measures whether an individual Builder Agent's work succeeded |
| Data | Working memory | Live metrics, events, tables, current state and recent activity |
| HQ Vault | Long-term memory | Decisions, strategy, evidence, lessons and institutional context |
| Architecture | Skeleton | Contracts, dependencies, permissions and safe operating boundaries |
| Supabase/events | Nervous system | Carries signals, actions and outcomes |
| Provenance/approval | Reflexes and immune system | Prevents false claims and unsafe actions |
| Builder surfaces | Hands | Create, modify, test and publish artifacts |
| Agent Builder | Stem cell | Creates and evolves agent capabilities |
| Rail | Agentic spine | Shows the complete workforce and its current state |

## 4. UX goals and non-goals

### 4.1 Goals

- Create an original, cinematic Arganta founder OS.
- Make the central core visibly represent company memory, products, infrastructure and workforce.
- Preserve the blue Arganta identity with adjustable accent color.
- Support complete light and dark themes.
- Make world reach a major operational visualization.
- Show average daily people accessing each app.
- Show the day/hour visitation rhythm as a heatmap.
- Keep data provenance visible and honest.
- Make every visual respond to the same Jarvis operating state.
- On mobile, show only Jarvis on the home screen; move charts into dedicated sections.
- Leave a secure integration seam for ElevenLabs voice.

### 4.2 Non-goals

- Do not implement the full Agent OS v2 persistence migration in this prototype.
- Do not connect real publish/write tools.
- Do not replace Command, Portfolio, Growth, Vault or Architecture production surfaces.
- Do not expose Supabase, OpenAI, Anthropic or ElevenLabs secrets in the HTML.
- Do not invent CPU/GPU, threat-detection, PFLOPS or generic AI-confidence metrics.
- Do not make demo or snapshot values appear live.
- Do not render all 319 Vault labels at once.
- Do not use Three.js, React Three Fiber, ECharts, Recharts, Chart.js or React Flow in the prototype.
- Do not turn every surface into a chatbot.

## 5. Prototype technical architecture

### 5.1 Single-file requirement

The final deliverable must be one browser-openable HTML file with:

- React and ReactDOM bundled into the file.
- GSAP bundled into the file.
- D3 modules required by the visualizations bundled into the file.
- All CSS inline.
- All SVG definitions inline.
- No local image dependencies.
- No runtime JSX compiler.
- No runtime CDN dependency in the final artifact.

Use a temporary build directory or `/tmp` source files if needed, bundle to one IIFE with the available Node runtime, then inline the generated CSS/JS into the final HTML. Do not commit temporary build output unless it is required to reproduce the single file.

If fully inlining the library bundle causes an unreasonable artifact size, report the measured size before changing the requirement. Do not silently switch to CDN scripts.

### 5.2 Recommended React component tree

```text
JarvisDigitalTwinApp
├── BootSequence
├── ThemeController
├── ProvenanceLegend
├── DesktopExperience
│   ├── AgenticSpine
│   │   ├── SpineGroup
│   │   └── SpineAgentButton
│   ├── ReachSensorWing
│   │   ├── WorldReachMap
│   │   └── ReachSummary
│   ├── JarvisTwinStage
│   │   ├── FounderKernel
│   │   ├── MemoryLattice
│   │   ├── JarvisIdentityCore
│   │   ├── CommandCortex
│   │   ├── ExecutiveOrbit
│   │   ├── ProductTriad
│   │   ├── ArchitectureShell
│   │   └── ProvenanceHealthRing
│   ├── ActivitySensorWing
│   │   ├── AppAccessBars
│   │   ├── VisitHeatmap
│   │   └── DerivedInsight
│   └── CommandDock
├── MobileExperience
│   ├── MobileJarvisHome
│   ├── MobileReach
│   ├── MobileActivity
│   ├── MobileWorkforce
│   ├── MobileVault
│   └── MobileBottomNav
├── ContextInspector
└── VoiceSessionOverlay
```

### 5.3 Application state

Use React state/context for the prototype. Keep the contract portable to Zustand later.

```ts
type Theme = 'light' | 'dark'
type JarvisPhase =
  | 'booting'
  | 'idle'
  | 'listening'
  | 'sensing'
  | 'remembering'
  | 'reasoning'
  | 'working'
  | 'speaking'
  | 'completed'
  | 'blocked'
  | 'approval'

type MobileSection = 'jarvis' | 'reach' | 'activity' | 'workforce' | 'vault'
type RangeDays = 7 | 14 | 30
type AccessMetric = 'avgDailyPeople' | 'avgDailySessions' | 'avgDailyMinutes' | 'avgSessionMinutes'

interface PrototypeState {
  theme: Theme
  accentHue: number
  phase: JarvisPhase
  mobileSection: MobileSection
  activeAgentId: string | null
  activeOfficeId: string | null
  activeProductId: string | null
  activeKnowledgeId: string | null
  rangeDays: RangeDays
  accessMetric: AccessMetric
  reducedMotion: boolean
  introComplete: boolean
}
```

Persist `theme`, `accentHue`, `introComplete` and the most recent mobile section in `localStorage`.

## 6. Data contracts and honesty rules

### 6.1 Universal provenance

Every displayed metric or assertion must include one of:

```ts
type Provenance = 'live' | 'partial' | 'snapshot' | 'simulated' | 'placeholder'
```

Suggested UI language:

| Provenance | UI label | Meaning |
|---|---|---|
| live | LIVE | Current operator RPC or telemetry result |
| partial | PARTIAL | Real signal with incomplete coverage |
| snapshot | SNAPSHOT | Dated repository/Vault fact |
| simulated | MODEL | Deterministic assumption/model |
| placeholder | AWAITING SIGNAL | Not wired; no value claimed |

Never substitute `0` for missing data. Render `—` with `AWAITING SIGNAL`.

### 6.2 Prototype data adapter

Create one adapter interface so static prototype data can later be replaced by production RPC calls:

```ts
interface JarvisDataAdapter {
  loadTwinSnapshot(): Promise<TwinSnapshot>
  loadReach(range: RangeDays, appId?: string): Promise<ReachSnapshot>
  loadActivity(range: RangeDays, appId?: string): Promise<ActivitySnapshot>
  loadWorkforce(): Promise<WorkforceSnapshot>
  loadBrief(): Promise<FounderBrief>
}
```

The prototype adapter may use:

- Structural facts extracted from the current Vault, marked `snapshot` and dated.
- Explicitly labelled illustrative usage data, marked `simulated` or `DEMO`.
- Honest empty states.

Do not hardcode large success numbers. The current founder truth is that infrastructure and product breadth are strong while distribution is the weak/high-leverage layer.

### 6.3 Digital twin snapshot

```ts
interface TwinSnapshot {
  generatedAt: string
  founder: FounderKernelData
  products: ProductNode[]
  offices: OfficeNode[]
  agents: AgentNode[]
  knowledgeNodes: KnowledgeNode[]
  knowledgeEdges: KnowledgeEdge[]
  architectureLayers: ArchitectureLayer[]
  infrastructureNodes: InfrastructureNode[]
  provenanceMix: Record<Provenance, number>
  activeMissions: MissionSummary[]
  approvals: ApprovalSummary[]
}
```

Current snapshot facts that may be shown if verified from the current repo at build time:

- Vault node count.
- Number of executive offices.
- Number of registered or planned capability agents.
- Database tables/RPCs only when verified against the current knowledge base or schema.
- Number of product/front-end surfaces only when clearly distinguished from the three-product philosophy.

Do not preserve stale counts merely because this handoff mentions them. Recalculate before embedding.

### 6.4 Reach contract

```ts
interface ReachPoint {
  regionId: string
  label: string
  latitude: number
  longitude: number
  people: number | null
  sessions: number | null
  activeMinutes: number | null
  newPeople: number | null
  returningPeople: number | null
  productMix: Record<string, number>
  source: Provenance
}

interface ReachSnapshot {
  rangeDays: RangeDays
  privacyMethod: 'timezone-coarse'
  points: ReachPoint[]
  updatedAt: string | null
  source: Provenance
}
```

The production source should be coarse timezone-derived aggregates from the usage-beats/geo pipeline. Never use or imply child GPS/IP precision.

### 6.5 Average app access contract

The user request is specifically average people accessing each app. The metric must be correctly defined:

```text
Average Daily Unique People
= mean over selected days of distinct person_id per app per day
```

Do not calculate this by dividing a range-level unique-user count by the number of days.

```ts
interface AppDailyAccess {
  appId: 'arganta' | 'kinetik' | 'lashira' | 'hq' | 'landing'
  appLabel: string
  avgDailyPeople: number | null
  avgDailySessions: number | null
  avgDailyMinutes: number | null
  avgSessionMinutes: number | null
  dailySeries: { date: string; people: number; sessions: number; minutes: number }[]
  source: Provenance
}
```

Production integration will likely require extending an HQ engagement RPC or adding a daily reach rollup. The prototype must expose the contract without pretending the current range-level totals satisfy it.

### 6.6 Heatmap contract

```ts
interface HeatCell {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  hour: number
  people: number | null
  sessions: number | null
  activeMinutes: number | null
  source: Provenance
}

interface ActivitySnapshot {
  appAccess: AppDailyAccess[]
  heatmap: HeatCell[]
  peak?: {
    dayOfWeek: number
    hour: number
    metric: AccessMetric
    value: number
  }
  source: Provenance
  updatedAt: string | null
}
```

The derived headline must come from the selected metric and filters, for example:

> Sunday evening is the strongest access window; ArgantaLabs peaks between 18:00 and 21:00.

Never hardcode the conclusion.

## 7. Jarvis Twin Core — detailed visual specification

The core is a 2D/2.5D layered composition built with SVG, Canvas 2D, D3 and CSS transforms. It must feel deep without Three.js.

### 7.1 Layer A — Founder Kernel

At the center:

- Small bright nucleus.
- `ALDYTH · FOUNDER` or a compact founder glyph.
- Current priority as one short line.
- Approval count as a crown/ring when non-zero.
- No implication that the AI replaces the founder.

Interaction:

- Click opens founder brief and approval queue summary.
- `approval` phase adds a pulsing crown ring.

### 7.2 Layer B — Jarvis Identity Core

Around the Founder Kernel:

- Saturated blue-to-white energy field.
- Fine concentric radar rings.
- Short waveform/radial bars responding to phase.
- Text label: `JARVIS · ARGANTA DIGITAL TWIN`.

The Jarvis core is the face and router, not the memory itself.

### 7.3 Layer C — Memory Lattice

Render a D3 force graph in a circular mask behind and around the identity core.

Node categories:

- Vault notes and decisions.
- Data/schema/RPC nodes.
- Product nodes.
- Architecture nodes.
- Agent/mission nodes.

Rules:

- Use a maximum of roughly 180–320 visible nodes on desktop.
- Use a representative subset on mobile.
- Larger radius for high-degree/source-of-truth nodes.
- Solid edges for confirmed connections.
- Dotted edges for suggestions.
- Product/layer color may tint nodes, but the global accent remains dominant.
- Hide most labels until hover, selection or sufficient zoom.
- When `remembering`, illuminate a path from the requested concept toward relevant nodes.

Avoid a chaotic full-screen hairball. The graph must read as an intelligent dense core.

### 7.4 Layer D — Command Cortex

Render a segmented rotating ring representing:

```text
Sense → Recall → Reason → Decide → Delegate → Review → Learn
```

Each segment can display a compact glyph. During an interaction:

- The active segment brightens.
- The next segment receives a travelling pulse.
- A mission path exits toward the selected capability agent.

The current production deterministic pipeline can inform the sequence, but the prototype should visualize the expanded Agent OS mission lifecycle.

### 7.5 Layer E — Executive Orbit

Place six executive nodes around the cortex:

- CEO/Jarvis Bridge.
- COO.
- CTO.
- CFO.
- GC.
- CAPO.

Since Jarvis already occupies the central face, the CEO orbit node may be represented as `BRIDGE` rather than duplicating the orb.

Each node shows:

- Office abbreviation.
- Health/status dot.
- Pending verdict/mission count.
- Active/inactive state.

When convened, the selected nodes move closer to the core and connect with brighter lines.

### 7.6 Layer F — Product Triad

Use three large asymmetrical lobes/arcs:

- ArgantaLabs — learning/acquisition.
- LashiraBloom — reward/retention/world.
- KinetikCircle — family utility/expansion.

Circle HQ is an outer governance halo, not a fourth equal lobe.

Kingdom and Landing appear as subordinate/support nodes:

- Kingdom beneath LashiraBloom as engine/lab.
- Landing outside the product ring as distribution membrane.

Clicking a product:

- Highlights associated memory nodes.
- Highlights related capability agents in the spine.
- Changes the world map/product filter.
- Changes the right-side activity charts.
- Updates the founder brief context.

### 7.7 Layer G — Architecture Exoskeleton

Render the five Architecture-tab layers as precision rings or mechanical bands:

1. Visualization / UI.
2. Agent OS.
3. AI/ML and Builders.
4. Knowledge and Data.
5. Platform and Delivery.

Add small infrastructure glyphs/nodes for the current stack, but do not turn the core into a logo cloud.

Architecture becomes prominent only when:

- Architecture Agent is selected.
- CTO is convened.
- The `architecture` lens is toggled.
- A blocked/deployment state is simulated.

### 7.8 Layer H — Provenance Health Ring

The outermost ring shows the relative mix of:

- Live.
- Partial.
- Snapshot.
- Simulated.
- Placeholder/blind.

This is the trust/readiness ring. It replaces any generic AI-confidence percentage.

Clicking it opens a compact inspector listing blind spots and modeled assumptions.

## 8. Agentic Spine specification

### 8.1 Desktop behavior

The full-screen Jarvis landing must retain a collapsed left rail:

- Icon-only by default.
- Expands on click; hover expansion is optional but must not trigger accidentally.
- Active agents glow.
- Approval badges are visible.
- Tooltips show name, current mission and autonomy mode.
- Clicking routes to the relevant manual workspace in the production port; in the prototype it opens an agent inspector.
- A visible animated path connects Jarvis to the working agent.

### 8.2 Information architecture

```text
FACE
  Jarvis CEO

BRAIN
  Command Agent

SENSE
  Portfolio Agent
  Growth Agent
  Reach Agent
  Builder Analytics

MEMORY
  Data Agent
  Vault Agent

STRUCTURE
  Architecture Agent

HANDS
  Pixel Agent
  Game Agent
  App Agent
  Learn Agent
  Content Agent
  Battle Agent
  Character Agent
  Openworld Agent
  Music Agent
  Video Agent

EVOLVE
  Agent Builder / Agent-Smith
```

If the current Agent OS registry differs, render from a normalized prototype registry rather than scattering lists through components.

### 8.3 Agent state colors

These status colors are semantic and must not change with the user-selected accent:

| Status | Color |
|---|---|
| Sensing | Blue |
| Remembering | Violet |
| Reasoning | Cyan |
| Working | Amber |
| Completed | Green |
| Blocked | Red |
| Not wired | Grey/hollow |
| Awaiting approval | Pulsing founder/amber badge |

### 8.4 Autonomy mode

Each agent inspector must show one of:

- Manual.
- Assist.
- Delegate.
- Autopilot.

The prototype can simulate switching modes locally. Make it clear that this is a UI concept and does not grant real production permissions.

## 9. Sensor visualizations

### 9.1 World Reach Map

Use D3 geographic projection and bundled world topology.

Requirements:

- Equal Earth or similarly legible world projection.
- Dotted/wireframe land treatment.
- Responsive SVG.
- Region pulses sized by selected metric.
- Product-colored arcs or signal paths connecting regions to product lobes.
- Filters for all apps and each app.
- Range selector: 7/14/30 days.
- Metric selector: people, sessions, active time, new/returning.
- Hover tooltip with region, app mix, value, provenance and last update.
- Zoom/focus on region selection.
- Explicit privacy label: `COARSE TIMEZONE · NO GPS/IP`.
- Honest empty state: `AWAITING REACH SIGNAL`.

Do not fabricate arcs when the adapter returns no reach points.

### 9.2 Average App Access bar chart

Use a horizontal D3 bar chart.

Default question:

> On an average day, how many unique people access each Arganta application?

Requirements:

- Five rows: ArgantaLabs, KinetikCircle, LashiraBloom, Circle HQ and Landing.
- Product-specific color accents.
- Animated initial draw and metric transition.
- Numeric label at the end of each bar.
- Honest `—` rows for missing data.
- Toggle people/day, sessions/day, minutes/day and average-session minutes.
- Range selector synchronized with map and heatmap.
- Selecting a bar selects the corresponding product/app everywhere.

### 9.3 Day/hour Visit Heatmap

Use D3 scales and SVG or Canvas.

Requirements:

- Seven rows for day of week.
- 24 columns for hour.
- Selected metric determines intensity.
- App filter synchronized with the bar chart and core.
- Hover tooltip.
- Highlight peak cell and peak day.
- Generate the insight sentence from data.
- Use theme-aware color scales.
- On narrow mobile, support horizontal scrolling or aggregate to four-hour bins; never compress cells into illegibility.

### 9.4 Sensor-to-core behavior

When a user selects a region, app bar or heat cell:

1. A pulse travels from the visualization toward the core.
2. The relevant product lobe brightens.
3. Growth/Portfolio sensor nodes activate.
4. Related memory nodes become visible.
5. The founder brief updates with the selected context.

## 10. Desktop layout

Target 1440×900 and 1920×1080 first.

Suggested grid:

```text
┌──────┬──────────────────────┬─────────────────────────────┬───────────────────────┐
│Spine │ Reach sensor wing    │ Jarvis digital twin stage   │ Activity sensor wing  │
│      │ world map            │ core + products + council   │ bars + heatmap        │
│      │ reach summary        │ founder brief               │ derived insight       │
├──────┴──────────────────────┴─────────────────────────────┴───────────────────────┤
│ Command dock · voice · modes · range · theme · provenance                         │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Proportions are flexible, but the core must remain the strongest focal point and the world map must be visibly important.

Avoid equal-sized rounded cards. Use:

- Edge instrumentation.
- Open frames.
- Fine connector lines.
- Cropped corner marks.
- Layered glass only where it aids focus.
- Large areas of calm negative space.
- Minimum body text around 11–12px.

## 11. Mobile layout

### 11.1 Jarvis home

At widths below approximately 760px, the Jarvis home contains no charts.

It shows:

- Compact top status/theme control.
- Jarvis digital-twin core.
- Founder priority.
- One-sentence daily brief.
- Talk button.
- Approval indicator.
- Bottom navigation.

The core may use a reduced knowledge-node subset and fewer effects.

### 11.2 Bottom navigation

Five destinations:

| Destination | Content |
|---|---|
| Jarvis | Core, brief and conversation |
| Reach | Full-screen world map |
| Activity | Bar chart and heatmap tabs |
| Workforce | Executives, agents, missions and approval indicators |
| Vault | Knowledge graph/search/inspector concept |

### 11.3 Mobile interaction

- Charts open as dedicated full-height sections.
- Agent and knowledge inspectors use bottom sheets.
- World map supports touch pan/zoom where practical.
- Respect safe-area insets.
- No horizontal page overflow.
- Minimum tap target 44px.
- Bottom navigation remains usable with the iOS browser chrome.

## 12. Theme system

### 12.1 Theme tokens

Use CSS variables, not hardcoded component colors:

```css
:root {
  --accent-h: 218;
  --accent: hsl(var(--accent-h) 88% 57%);
  --accent-2: hsl(calc(var(--accent-h) + 22) 92% 60%);
  --canvas: ...;
  --surface: ...;
  --surface-glass: ...;
  --text: ...;
  --muted: ...;
  --line: ...;
  --grid: ...;
}

html[data-theme='dark'] { ... }
html[data-theme='light'] { ... }
```

### 12.2 Dark theme

- Deep navy-black canvas.
- Electric blue core.
- Cyan signal paths.
- Violet memory.
- Subtle glow and additive-looking overlaps.
- Never crush text contrast.

### 12.3 Light theme

- Ice-white/blue-grey laboratory canvas.
- Saturated blue core.
- Crisp navy text.
- Hairline connectors and reduced glow.
- Use contrast and line density rather than white bloom.

### 12.4 Accent control

Provide presets plus a compact hue slider:

- Arganta Blue default.
- Cyan.
- Indigo.
- Emerald.
- Amber.
- Custom.

Accent changes must not alter semantic status/provenance colors.

## 13. Animation direction

Animations must communicate company activity. Avoid random motion that has no state meaning.

### 13.1 Boot sequence

Recommended 4–6 second timeline with skip/replay:

| Time | Event |
|---:|---|
| 0.0–0.5s | Black/dark or clean white field; `ARGANTA OS · INITIALIZING` |
| 0.4–1.3s | Memory nodes appear as scattered points |
| 1.0–2.0s | Nodes converge into the circular memory lattice |
| 1.5–2.5s | Architecture exoskeleton rings draw around the lattice |
| 2.0–3.0s | Three product lobes assemble |
| 2.5–3.5s | Executive nodes orbit into position |
| 3.0–4.0s | Jarvis core ignites around the Founder Kernel |
| 3.4–4.5s | Sensor wings draw in and charts animate |
| 4.0–5.2s | Agentic Spine status lights turn on |
| 4.5–5.8s | Founder brief types in; command dock rises |

Use one GSAP master timeline. Store a reference for skip/replay and ensure cleanup on unmount.

### 13.2 Ambient motion

- Core breath: 3–5 second low-amplitude loop.
- Radar sweep: 8–14 seconds.
- Memory drift: very slow, force simulation cools and mostly stabilizes.
- Signal particles: only along meaningful active paths.
- Executive orbit: nearly static; slight parallax rather than constant spinning.
- Architecture rings: subtle counter-rotation.
- World pulses: only where data points exist.

### 13.3 State choreography

#### Listening

- Microphone ring expands.
- Radial waveform responds to analyser/input level.
- Other UI dims slightly.

#### Sensing

- World/bar/heatmap signal line travels inward.
- Portfolio/Growth nodes illuminate.

#### Remembering

- Relevant Vault/Data nodes turn violet.
- A path builds toward the Command Cortex.

#### Reasoning

- Command ring steps activate sequentially.
- Relevant executive nodes move inward.

#### Working

- Selected capability agent glows amber in the spine.
- A path travels from Command to the agent.
- Inspector shows mission/tool timeline.

#### Approval

- Founder crown pulses.
- Working path pauses at the approval boundary.

#### Completed

- Green wave travels back from the agent through sensors and into memory.
- A new learning node briefly appears in the lattice.

#### Blocked

- Red interruption appears only on the failed path, not the whole screen.
- Relevant Architecture/GC constraint becomes visible.

### 13.4 Reduced motion

Respect `prefers-reduced-motion`:

- Skip boot convergence.
- Stop ambient rotations.
- Replace travelling pulses with simple opacity state changes.
- Keep all information and interactions available.

## 14. Voice and ElevenLabs seam

### 14.1 Principle

Arganta remains the brain. ElevenLabs is the voice/turn-taking layer.

```text
Founder voice
  → ElevenLabs session/transcription
  → Arganta voice adapter
  → CEO/Command/Vault/metrics
  → grounded text stream
  → ElevenLabs speech stream
  → Jarvis speaking animation
```

### 14.2 Prototype implementation

Do not attempt authenticated ElevenLabs calls from the standalone HTML.

Create a `VoiceAdapter` seam:

```ts
interface VoiceAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  startListening(): Promise<void>
  stopListening(): Promise<void>
  speak(text: string): Promise<void>
  interrupt(): Promise<void>
  subscribe(listener: (event: VoiceEvent) => void): () => void
}
```

Ship two prototype adapters:

1. `DemoVoiceAdapter` — drives listening/reasoning/speaking states using local scripted events.
2. Optional `BrowserSpeechAdapter` — only if it can be added without breaking portability; label it browser/local, not ElevenLabs.

### 14.3 Production integration target

Later production integration should use a server endpoint to create a short-lived ElevenLabs signed session/token. Never expose the API key client-side.

Recommended path:

1. Add an Arganta Bridge adapter exposing an OpenAI-compatible `/v1/responses` interface.
2. Map it internally to `ceo_ask`, Agent OS missions, Vault retrieval and live metrics.
3. Configure ElevenLabs custom LLM/agent to call that endpoint.
4. Use the ElevenLabs React SDK or WebSocket/WebRTC session in production HQ.
5. Feed session events into the shared Jarvis phase store.

Official references:

- https://elevenlabs.io/docs/eleven-agents/libraries/react
- https://elevenlabs.io/docs/eleven-agents/customization/authentication
- https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm
- https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets

## 15. Deterministic prototype interactions

The standalone prototype must feel alive without pretending to call a real model.

Provide scripted commands such as:

- `Give me the Arganta daily brief.`
- `Show the weakest company layer.`
- `Convene Growth, Portfolio and CFO.`
- `Which product is getting the most average daily access?`
- `Show the busiest day and hour.`
- `Ask Architecture what is not wired.`
- `Show everything waiting for approval.`
- `Assign Video and Content to prepare a LashiraBloom launch.`

Each command triggers the correct visual choreography and returns a clearly labelled deterministic/snapshot response. Do not call it an LLM response.

## 16. Connection to Agent OS v2

The prototype must use terminology compatible with `docs/agent-os-v2-grand-design.md`:

- `AgentSpec` is the future registry contract.
- Tool packs are the universal capability seam.
- Command creates persistent missions.
- Child agents create draft artifacts.
- Review Queue governs approval/rejection/publish.
- CAPO meters cost and ROI.
- GC can block child-facing artifacts.
- Autopilot is off by default and granted per agent/artifact boundary.
- Model pills show runtime truth, not fictional branded tiers.

The prototype may use local objects shaped like the future `AgentSpec`, `Mission`, `Artifact` and `Run` interfaces. This will reduce production-port churn.

## 17. Performance budgets

Targets for the prototype:

- Initial HTML size: measure and report; aim below roughly 3 MB compressed when served.
- Desktop animation: target 60 fps on a modern laptop.
- Mobile: stable 30–60 fps with the reduced core.
- Visible memory nodes: cap dynamically by viewport/performance.
- Disable expensive canvas shadows/glow at higher node counts.
- Pause simulations and GSAP loops when document visibility is hidden.
- Use `ResizeObserver` for every responsive D3 visual.
- Avoid React state updates on every animation frame; let D3/GSAP mutate visual refs where appropriate.
- Clean up simulations, observers, timelines and listeners on unmount.

## 18. Accessibility and usability

- Minimum body text 11–12px desktop, 12px mobile.
- Minimum mobile tap target 44px.
- Keyboard access to theme, navigation, filters, agent selection and command chips.
- `aria-label` on icon-only buttons.
- Clear focus rings.
- Do not encode provenance/status only by color.
- Tooltips must remain inside the viewport.
- Provide a Skip Intro and Replay control.
- Respect `prefers-reduced-motion`.
- Maintain contrast in both themes and all accent presets.

## 19. Implementation phases

### P0 — Establish baseline

Tasks:

- Read applicable instructions and target files.
- Confirm current repo/branch status.
- Record current landing behavior and relevant data shapes.
- Verify current Vault node count and current agent/office registry facts.
- Create the prototype path without modifying production landing code.

Acceptance:

- No production UI behavior changed.
- Prototype file exists as a minimal browser-openable shell.

### P1 — Shell, themes and responsive routing

Tasks:

- Implement app shell, desktop grid and mobile router.
- Implement dark/light tokens and accent control.
- Implement provenance legend.
- Implement bottom command dock and mobile bottom navigation.
- Persist preferences.

Acceptance:

- Theme and accent work.
- Desktop and mobile shells have no overflow.
- Mobile Jarvis home contains no charts.

### P2 — Digital Twin Core

Tasks:

- Build Founder Kernel.
- Build Jarvis Identity Core.
- Build D3 memory lattice.
- Build Command Cortex.
- Build executive orbit.
- Build product triad and HQ halo.
- Build architecture exoskeleton and provenance ring.

Acceptance:

- The core visibly communicates company anatomy without explanatory text.
- Each layer is selectable and opens a context inspector.
- No major animation jank at target node count.

### P3 — Agentic Spine

Tasks:

- Implement normalized agent registry.
- Render FACE/BRAIN/SENSE/MEMORY/STRUCTURE/HANDS/EVOLVE groups.
- Add status, autonomy and approval indicators.
- Connect active agent paths to the core.

Acceptance:

- Every listed capability can be selected.
- Active mission choreography reaches the correct agent.
- Rail is collapsed but present on the desktop landing.

### P4 — World Reach sensor

Tasks:

- Build bundled D3 world map.
- Add filters, metric selector, tooltips, privacy/provenance labels and empty state.
- Add map-to-product/core interaction.

Acceptance:

- Map is visually important, responsive and theme-correct.
- No fake points/arcs when data is absent.
- Product selection synchronizes with the core.

### P5 — Activity sensors

Tasks:

- Build average app access bars.
- Build day/hour heatmap.
- Build derived peak insight.
- Synchronize range, metric and app filters.

Acceptance:

- Bar values follow the correct average-daily contract.
- Heatmap selection generates a data-derived headline.
- Selection signals animate into the core.

### P6 — GSAP choreography

Tasks:

- Implement master boot timeline.
- Implement phase transitions.
- Implement mission/delegation/approval/completion paths.
- Implement skip/replay and reduced-motion behavior.

Acceptance:

- Animations communicate state.
- No orphaned timelines/listeners after replay or route changes.
- Reduced-motion mode remains fully usable.

### P7 — Mobile experience

Tasks:

- Tune reduced mobile core.
- Implement dedicated Reach, Activity, Workforce and Vault sections.
- Add bottom-sheet inspectors.
- Validate safe-area and iOS viewport behavior.

Acceptance:

- Jarvis mobile home shows no charts.
- All visualizations are accessible through bottom navigation.
- No squeezed desktop layout appears on mobile.

### P8 — Voice seam and scripted demonstration

Tasks:

- Implement `VoiceAdapter` and `DemoVoiceAdapter`.
- Connect voice events to Jarvis phases.
- Add deterministic command chips and example mission flow.
- Add British-voice concept label without claiming live ElevenLabs connectivity.

Acceptance:

- Listening/reasoning/speaking/interrupt states can be demonstrated.
- No secrets or fake live voice state exist.

### P9 — Package and verify

Tasks:

- Bundle React, GSAP and required D3 modules into one HTML.
- Run markup/script validation and manual interaction checks.
- Test at 390×844, 768×1024, 1440×900 and 1920×1080.
- Verify light/dark, all navigation items, filters, boot replay and reduced motion.
- Report final file size and known limitations.

Acceptance:

- One HTML opens directly.
- No console-breaking errors.
- No local file dependencies.
- All required interactions work.
- Production landing remains unchanged.

## 20. Definition of done

The prototype is complete only when:

- The core clearly represents founder, Jarvis, memory, Command, executives, products, architecture and provenance.
- The complete agentic workforce remains accessible through the spine.
- The world map is a primary visualization.
- Average daily access and visit heatmap are functional and correctly defined.
- Light and dark themes are equally intentional.
- Accent color is adjustable.
- Mobile Jarvis home contains only Jarvis, priority/brief, voice control and bottom navigation.
- Charts live in dedicated mobile sections.
- Jarvis states and mission flow are visibly animated.
- Data provenance is shown everywhere.
- Demo/snapshot values are not presented as live.
- ElevenLabs integration is represented by a secure adapter seam.
- The final result is a single standalone HTML file.

## 21. Production port after approval

Do not perform this during the prototype phase. After founder approval:

1. Split prototype elements into production React components under `apps/hq/src/surfaces/jarvis/`.
2. Add a shared `JarvisRuntimeStore` compatible with Agent OS missions/runs.
3. Replace prototype adapter with live HQ RPC adapters.
4. Add or extend daily access aggregation for the correct average-daily metric.
5. Use the real Vault graph and Agent Registry.
6. Connect Command mission/review state after Agent OS v2 P0–P3 exist.
7. Add secure ElevenLabs signed-session endpoint and production voice adapter.
8. Lazy-load every non-home HQ surface to reduce initial bundle size.
9. Replace the existing landing only after side-by-side performance and design review.

## 22. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The orb becomes an unreadable diagram | Progressive disclosure; one dominant Jarvis identity, layers appear by context |
| Too many agents crowd the rail | Collapsed grouped spine, search/expand, live status only |
| Dense memory graph hurts performance | Node caps, Canvas rendering, cooled simulation, reduced mobile subset |
| World reach implies false precision | Timezone-coarse label, no GPS/IP, no points when absent |
| Average users metric is calculated incorrectly | Require daily distinct-person aggregation; never divide range uniques |
| Prototype numbers appear real | Universal provenance badges and dated snapshots |
| ElevenLabs key leaks in single HTML | No authenticated call in prototype; signed server session in production |
| Animation overwhelms usability | Functional phase-driven motion, reduced motion, skip/replay |
| Single HTML becomes too large | Measure bundle, tree-shake D3 modules, avoid local image/audio assets |
| Prototype accidentally changes production | Separate path, no production Landing edits until approval |

## 23. Final design sentence

> The Jarvis Orb is a living compression of Arganta: one founder-governed intelligence that senses through Portfolio, Growth and Reach; remembers through Data and Vault; reasons through Command; remains coherent through Architecture; and acts through a complete agentic workforce across three connected products.

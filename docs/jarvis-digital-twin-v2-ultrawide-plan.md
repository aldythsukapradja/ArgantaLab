# Jarvis Digital Twin v2 — Ultrawide Single-Orb Revision

**Status:** revised design direction · ready for build  
**Supersedes:** `jarvis-digital-twin-design-audit-build-plan.md`  
**Target:** `apps/hq/prototypes/jarvis-digital-twin.html`  
**Review basis:** first working prototype viewed on an ultrawide display  
**Date:** 2026-07-13

## 0. Founder direction, locked

The next prototype is not a dashboard with an orb in the middle. It is a **single enormous Jarvis orb whose node field becomes the interface**.

Remove:

- The entire left rail.
- `ALDYTH · FOUNDER` and `FINAL GOVERNING AUTHORITY` from the center.
- The small founder kernel treatment.
- The large priority headline and its subtitle below the orb.
- The persistent “company spine is mature…” brief/input capsule.
- Persistent left Reach and right Activity wings.
- Any permanent three-column layout that constrains the orb.
- The current center lens pill beneath explanatory copy.

Add or transform:

- One huge, responsive orb as the dominant screen object.
- Thousands of real derived knowledge nodes, not a decorative hundred-node sample.
- Five animated twin lenses: Company, Evidence, Decision, Workforce, Architecture.
- A concise explanation for every lens and every major animation.
- A premium bottom dock: Portfolio · Analytics · central Mic · Command · Build.
- Direct alignment with the existing HQ section model.
- Light and dark themes tuned independently.

## 1. Revised experience thesis

> Jarvis is the company’s knowledge graph made visible. The orb does not sit beside the operating system; the orb rearranges itself to become every operating view.

The first frame contains only:

1. Minimal Arganta/Jarvis identity in the top-left.
2. Current phase and snapshot provenance in the top-center or top-right.
3. Theme/settings controls.
4. The enormous Jarvis orb.
5. A contextual lens caption that appears only when useful.
6. The floating bottom command dock.

There is no central founder label, no marketing headline, no subtitle, no side dashboard, and no left navigation.

## 2. What the first prototype taught us

### 2.1 The orb was too small on ultrawide

The three-column layout allocated large permanent regions to Reach and Activity. On a very wide screen this created acres of low-value whitespace while the central object remained approximately laptop-sized.

**Revision:** use a full-viewport stage. The orb is sized primarily from viewport height and secondarily from width:

```css
--orb-size: clamp(680px, min(84dvh, 68vw), 1320px);
```

Target behavior:

| Viewport | Approximate orb diameter |
|---|---:|
| 1440×900 | 700–740px |
| 1920×1080 | 840–900px |
| 2560×1080 ultrawide | 860–920px |
| 3440×1440 ultrawide | 1120–1200px |
| 5120×1440 super-ultrawide | 1160–1240px |

The orb may extend behind the bottom dock but must not be visibly cropped at the top. Additional width becomes negative space, node-label space, and contextual explanation space—not permanent panels.

### 2.2 The current center contained too many messages

The founder label, priority headline, explanatory subtitle, five-lens pill, and bottom brief competed with the orb. The eye read text first and the actual digital twin second.

**Revision:** the orb owns the center. Lens explanations move to an edge-aligned contextual caption. The caption is hidden in idle and appears during lens transition, hover/focus, or explanation mode.

### 2.3 The left rail made the prototype feel like another HQ shell

The rail was technically consistent with HQ but visually weakened the new landing. It also duplicated the bottom navigation model the founder prefers.

**Revision:** no left rail. The bottom dock becomes the only primary navigation on the landing.

### 2.4 The memory field looked sampled, not expansive

The first prototype rendered 118 desktop nodes. This communicated “graph,” but not “the company’s accumulated memory.”

**Revision:** build an expanded, derived Vault graph with multiple levels of detail and thousands of visible primitives on capable hardware.

## 3. Final desktop composition

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ARGANTA / JARVIS                         IDLE · SNAPSHOT       theme · settings│
│                                                                             │
│                  contextual lens explanation (appears when active)          │
│                                                                             │
│                           ╭────────────────────╮                            │
│                        ╭──┤                    ├──╮                         │
│                      ╭─┤  │   THOUSANDS OF     │  ├─╮                      │
│                      │ │  │  KNOWLEDGE NODES   │  │ │                      │
│                      │ │  │    SINGLE ORB      │  │ │                      │
│                      ╰─┤  │                    │  ├─╯                      │
│                        ╰──┤                    ├──╯                         │
│                           ╰────────────────────╯                            │
│                                                                             │
│       ╭─────────────── floating glass command dock ─────────────────╮       │
│       │ Portfolio │ Analytics │      ◉ MIC      │ Command │ Build   │       │
│       ╰───────────────────────────────────────────────────────────────╯       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Top chrome

- Top-left: `ARGANTA / JARVIS DIGITAL TWIN` in compact mono typography.
- Status: `IDLE · SNAPSHOT 2026-07-11` with semantic phase dot.
- Top-right: theme, quality, replay/settings.
- Maximum height: 52px.
- No full-width opaque bar; use hairline instrumentation only.

### 3.2 Single-orb stage

- One canvas/WebGL-free 2D/2.5D composition filling the stage.
- No separate map or charts in idle.
- The orb contains the memory graph, product topology, Command sequence, offices, agents, architecture, and provenance as animated configurations of one node system.
- A subtle outer field may extend 8–14% beyond the nominal circle to avoid a hard “planet” silhouette.
- The core remains visually singular: one saturated energy center, not a smaller labeled founder object.

### 3.3 Context caption

The explanation is not a subtitle. It is a transient operating annotation.

Desktop placement:

- Default: upper-right quadrant beside the orb.
- If labels occupy that quadrant: upper-left.
- Width: 280–380px.
- One eyebrow, one 18–24px statement, one 11–13px explanation, one provenance line.
- Appears after the animation begins, not before it.
- Fades to a compact `? EXPLAIN` affordance after 5–7 seconds.

Example:

```text
EVIDENCE LENS · SNAPSHOT
What Jarvis knows—and how it knows it.
Live, partial, modeled, snapshot, and missing signals reorganize the same graph.
```

## 4. Thousands-node knowledge system

### 4.1 Measured source opportunity

The current generated Vault already contains:

- 319 note documents.
- 605 Markdown headings.
- 974 wiki-link occurrences.
- 1,448 inline code-reference occurrences.
- 71 verified tables.
- 147 verified RPCs.
- 27 roster identities.
- Product, office, surface, layer, package, decision, mission, and provenance entities.

This is sufficient to derive a truthful multi-thousand-node graph once documents are expanded into sections, entities, code references, schema objects, and relationships. Exact unique counts are calculated during the build; they must never be preclaimed.

### 4.2 Node taxonomy

```ts
type TwinNodeKind =
  | 'document'
  | 'section'
  | 'decision'
  | 'lesson'
  | 'product'
  | 'surface'
  | 'office'
  | 'agent'
  | 'mission'
  | 'architecture-layer'
  | 'package'
  | 'table'
  | 'rpc'
  | 'event'
  | 'metric'
  | 'code-reference'
  | 'tag'
```

Every node includes:

```ts
interface TwinNode {
  id: string
  kind: TwinNodeKind
  label: string
  parentId: string | null
  productIds: string[]
  officeIds: string[]
  sourcePath: string
  source: Provenance
  degree: number
  weight: number
  searchText: string
}
```

### 4.3 Edge taxonomy

- `CONTAINS`
- `LINKS_TO`
- `MENTIONS`
- `OWNS`
- `RUNS_ON`
- `FEEDS`
- `DERIVES_FROM`
- `MEASURES`
- `SERVES`
- `GUARDS`
- `CREATES`
- `DEPENDS_ON`
- `LADDERS_TO`

Confirmed relationships are solid. Inferred relationships are dotted and labelled `MODEL` or `SUGGESTED`.

### 4.4 Offline graph builder

Add a build-time script that reads the current repository rather than embedding a hand-authored graph:

```text
scripts/build-jarvis-twin-graph.mjs
  1. Read vault/kb.generated.ts.
  2. Parse each note into document + section nodes.
  3. Extract headings, wiki links, tags and code references.
  4. Merge verified tables/RPCs from the knowledge graph.
  5. Merge offices, agents, products, surfaces and packages.
  6. Normalize aliases and deduplicate stable ids.
  7. Calculate degree, weight, clusters and provenance.
  8. Write a compact generated JSON module for bundling.
```

The build report must print:

- nodes by kind;
- edges by kind;
- confirmed versus inferred relationships;
- orphan count;
- payload bytes before and after gzip;
- graph snapshot date/commit.

### 4.5 Level of detail

Thousands of nodes do not mean thousands of labels.

| Zoom/state | Visible nodes | Labels |
|---|---:|---:|
| Idle | 1,200–2,500 points | 0–8 anchors |
| Lens active | 1,800–4,000 points | 8–24 cluster labels |
| Hover/focus | selected neighborhood | 1 selected + 6–18 related |
| Search | matched path + context | matched nodes only |
| Mobile | 350–900 points | 0–8 anchors |

High-degree nodes are larger and remain stable. Low-degree section/code nodes appear as fine memory dust. Labels are DOM/SVG overlays; bulk nodes and edges are Canvas 2D.

### 4.6 Performance architecture

- One Canvas 2D layer for nodes and edges.
- One SVG overlay for crisp rings, active paths and accessible focus marks.
- One DOM layer for labels, captions and controls.
- Build-time or Worker-computed base layout.
- Spatial index for hover/selection; never test every node on pointer move.
- Draw only edges inside the current semantic/zoom budget.
- Device quality tiers: 900 / 2,000 / 4,000 nodes.
- DPR cap: 1.25 ultrawide, 1.5 standard desktop, 1.25 mobile.
- Pause when hidden.
- No React state updates per animation frame.

## 5. Five animated twin lenses

All five lenses transform the **same graph**. There are no five separately mounted visualizations.

### 5.1 Company lens

**Question:** What is Arganta as one company?

**Animation:**

1. Memory dust contracts toward three asymmetric product gravity wells.
2. ArgantaLabs, LashiraBloom and KinetikCircle become the three largest clusters.
3. Shared Data, Engine and Identity nodes form a bright common core between them.
4. Circle HQ becomes a governance halo—not a fourth product cluster.
5. Landing forms a thin outer distribution membrane.

**Explanation:**

> Three living products, one shared substrate. Circle HQ observes, decides and builds across all of them.

**Key facts:** 3 products · 1 Supabase spine · 7 front ends · 96k LOC · snapshot.

### 5.2 Evidence lens

**Question:** What does Jarvis know, and can it be trusted?

**Animation:**

1. Product colors recede.
2. Nodes recolor by provenance: live, partial, snapshot, model, awaiting signal.
3. Confirmed evidence paths brighten.
4. Missing reach/activity paths break visibly before reaching the core.
5. Tables, RPCs, metrics and Vault sources rise to the foreground.

**Explanation:**

> Evidence is not confidence. Every claim keeps its source, date and blind spot.

**Key facts:** 319 Vault documents · 71 tables · 147 RPCs · reach/activity awaiting signal.

### 5.3 Decision lens

**Question:** How does Jarvis turn evidence into a governed decision?

**Animation:**

1. A selected evidence cluster emits a single inbound pulse.
2. Relevant memory nodes resolve around it.
3. Seven Command stages illuminate: Sense → Recall → Reason → Decide → Delegate → Review → Learn.
4. Only consulted office nodes move inward.
5. A proposed mission path exits toward the selected capability.
6. If approval is required, the path pauses at a thin governance boundary.

**Explanation:**

> Jarvis does not jump from data to action. It shows the evidence, reasoning path, owner and review boundary.

**Key facts:** 6 offices · persistent mission model planned · approvals explicit · autopilot off by default.

### 5.4 Workforce lens

**Question:** Who senses, remembers, constrains and builds?

**Animation:**

1. The graph unfolds into six office constellations around Jarvis.
2. Capability agents form secondary clusters by SENSE, MEMORY, STRUCTURE, HANDS and EVOLVE.
3. Current readiness is visible: live/read-only, partial, prototype, planned.
4. Active or demo mission paths connect Jarvis to only the assigned capabilities.
5. Model/runtime truth appears on selected runs—not branded fictional tiers.

**Explanation:**

> The workforce is a capability system, not an org-chart poster. Readiness and permission are visible on every agent.

**Key facts:** 27 current roster identities · 6 offices · 20 Bridge tools · builder action mostly planned/draft.

### 5.5 Architecture lens

**Question:** What is the company built on, and where does it break?

**Animation:**

1. Nodes flatten from orbital depth into precision horizontal strata.
2. L0–L7 repository layers group into five readable architecture bands.
3. Dependencies draw from product surface down to shared data/platform nodes.
4. NOW edges remain solid; NEXT edges become dashed.
5. Risk nodes—distribution, version drift, instrumentation gaps—move forward.
6. Selecting a band rotates the relevant section toward the viewer without opening permanent side cards.

**Explanation:**

> The architecture lens shows both capability and constraint: what is mature, what is shared, and what fails first.

**Key facts:** 71 tables · 147 RPCs · 7 deploy targets · L7 Distribution remains the gap.

## 6. Lens controls and explanation behavior

The old five-label center pill is removed.

Recommended control:

- A very small `TWIN LENS` control above the bottom dock or at the orb’s lower-right tangent.
- Five icon/label options revealed on hover, click, keyboard focus or `L` shortcut.
- Default collapsed state shows current lens only.
- Scroll wheel over the lens control or left/right arrow keys cycles lenses.
- Direct shortcuts: `1` Company, `2` Evidence, `3` Decision, `4` Workforce, `5` Architecture.

On transition:

1. Current lens label dims.
2. Orb geometry starts moving.
3. Context caption enters 180–280ms later.
4. Caption progress line follows the meaningful animation duration.
5. `Skip animation` resolves immediately to the correct final topology.

## 7. Bottom command dock

### 7.1 Structure

The dock has five visual positions but four navigation sections:

```text
Portfolio        Analytics          MIC          Command          Build
```

The mic is an action, not a fifth section.

### 7.2 Visual direction

- Floating, centered, 72–84px high.
- Width: `min(1180px, calc(100vw - 40px))` on standard desktop.
- On super-ultrawide, cap at 1440px; never stretch edge-to-edge.
- Two left sections, raised mic, two right sections.
- Semi-transparent precision glass with a top highlight and restrained shadow.
- The central mic is 68–78px, raised 22–30px above the dock.
- Two thin rings respond to listening level; no permanent ripple loop.
- Active section gets a bright bottom rail and an inward signal path to the orb.
- Labels remain readable at 12–14px; optional small destination subtitle appears on hover/focus.

### 7.3 Section mapping

| Dock section | HQ destination group | Prototype behavior |
|---|---|---|
| Portfolio | Home/Portfolio/product health | Activates Company lens; opens product portfolio overlay on second click. |
| Analytics | Growth/Data/Vault/Reach | Activates Evidence lens; radial submenu selects Growth, Data, Vault or Reach. |
| Command | Command/office system | Activates Decision lens; second click opens Command mission/council overlay. |
| Build | All builder workspaces/Agent Builder | Activates Workforce lens; second click opens builder capability carousel. |
| Mic | Jarvis voice/command | Opens centered voice/input mode without changing section. |

Architecture is accessed from the Twin Lens selector and from Command’s Architecture action. This keeps the bottom dock faithful to the four requested HQ groups.

### 7.4 Prototype versus production routing

- Standalone prototype: navigation changes the orb topology and opens an overlay representation.
- Production port: each section can route to the real HQ grouped surface.
- Preserve a return-to-Jarvis affordance in production so the dock does not strand the user in a workspace.

## 8. Voice interaction

The mic becomes the focal action in the dock.

States:

- Idle: solid blue core, no ripple.
- Hover/focus: one thin ring appears.
- Listening: analyser-driven dual ring + compressed outer UI.
- Transcribing: waveform collapses into text.
- Reasoning: orb enters Decision lens automatically.
- Speaking: core luminance follows speech envelope.
- Interrupted: immediate return to listening or idle.

Prototype remains deterministic and local. A text alternative is always visible once voice mode opens.

## 9. Context overlays instead of permanent side panels

Reach, Activity, product metrics, office detail and architecture detail become overlays invoked by the orb or bottom dock.

Overlay rules:

- The orb remains at least 55% visible.
- One overlay at a time.
- Desktop: edge sheet, 360–520px wide.
- Ultrawide: floating instrument panel anchored 48–80px from an edge.
- Mobile: bottom sheet.
- Close returns the exact prior lens topology.
- The overlay never recenters or shrinks the orb unless the user enters a dedicated detailed workspace.

## 10. Responsive behavior

### 10.1 Ultrawide

- Orb stays physically large and centered, not scaled down by columns.
- Context caption may sit 12–18vw from the orb edge.
- Labels may fan farther outward because horizontal space is abundant.
- Dock remains centered and capped.
- Background grid density remains constant in physical pixels; do not stretch cells.

### 10.2 Standard desktop

- Orb 76–84dvh.
- Context caption overlaps the outer node field if necessary but not the core.
- Dock width approximately 88–94vw.

### 10.3 Tablet

- Orb 68–76vmin.
- Lens control becomes a compact five-item sheet.
- Bottom dock labels remain; subtitles disappear.

### 10.4 Mobile

- Orb 72–90vw on Jarvis home.
- Only 350–900 rendered nodes depending on quality.
- Bottom dock becomes the five-position mobile navigation with raised mic.
- Lens explanations use a compact top caption or bottom sheet.
- No permanent charts on the Jarvis home.

## 11. Light and dark themes

### Dark

- Navy-black canvas.
- Bright blue-white core.
- Violet memory depth.
- Cyan active paths.
- Low-opacity node fog and restrained additive bloom.

### Light

- Ice-blue laboratory canvas.
- Cobalt-white core with crisp edge contrast.
- Fine navy/blue node field.
- Minimal glow; depth comes from density, opacity and line weight.
- Glass dock uses stronger border contrast and reduced blur.

Every lens transition is tuned and verified independently in both themes. Semantic provenance and readiness colors never follow the theme accent.

## 12. Motion and timing

### Lens transition budget

| Transition | Duration | Signature |
|---|---:|---|
| Idle → Company | 1.2–1.8s | three product gravity wells form |
| Company → Evidence | 1.0–1.5s | product colors drain into provenance spectrum |
| Evidence → Decision | 1.4–2.2s | evidence path enters staged Command sequence |
| Decision → Workforce | 1.2–1.8s | offices and capability constellations unfold |
| Workforce → Architecture | 1.4–2.0s | orbital graph flattens into strata |
| Any → Idle | 0.7–1.1s | topology relaxes back into the single orb |

Animation must remain interruptible. Starting a new lens transition cancels or smoothly retargets the current one; it must not queue multiple full animations.

### Explanation timing

- Lens title enters 180–280ms after motion begins.
- Explanation enters 100ms after title.
- Provenance line enters last.
- Caption remains fully visible for at least 4 seconds.
- User can pin the explanation.

## 13. Revised component architecture

```text
JarvisDigitalTwinApp
├── TwinDataProvider
├── TwinGraphWorker
├── MotionDirector
├── MinimalTopChrome
├── SingleOrbStage
│   ├── KnowledgeCanvas
│   ├── PrecisionSvgOverlay
│   ├── NodeLabelLayer
│   ├── CoreEnergyField
│   ├── LensTopologyController
│   └── ContextCaption
├── TwinLensControl
├── ContextOverlay
│   ├── PortfolioOverlay
│   ├── AnalyticsOverlay
│   ├── CommandOverlay
│   ├── BuildOverlay
│   └── ArchitectureOverlay
├── BottomCommandDock
│   ├── PortfolioAction
│   ├── AnalyticsAction
│   ├── JarvisMic
│   ├── CommandAction
│   └── BuildAction
└── VoiceSessionOverlay
```

## 14. Revised build sequence

### R0 — Preserve and re-establish editable source · 0.5 day

The first prototype is currently a final bundled HTML. Recreate a temporary source build, keep the final deliverable single-file, and add a reproducible non-committed build path or documented script.

**Acceptance:** final HTML still opens directly; production landing unchanged.

### R1 — Remove rejected layout · 0.5 day

- Remove rail.
- Remove founder labels/kernel copy.
- Remove headline/subtitle/brief capsule.
- Remove permanent Reach/Activity columns.
- Remove old center lens pill.
- Establish full-viewport single-orb stage.

**Acceptance:** at 3440×1440 the orb is at least 1,100px and is the unquestioned focal point.

### R2 — Expanded graph generator · 1–1.5 days

- Parse Vault notes, sections, wiki links and code references.
- Merge verified tables, RPCs, agents, products, offices, packages and surfaces.
- Deduplicate stable ids and produce provenance-aware edges.
- Emit compact generated graph and build report.

**Acceptance:** graph contains at least 1,500 truthful derived nodes or reports why the unique source count is lower; no filler nodes.

### R3 — High-density orb renderer · 1.5–2 days

- Canvas node/edge renderer.
- Worker/base-layout pipeline.
- quality tiers and LOD.
- SVG active-path overlay and labels.
- huge responsive sizing.

**Acceptance:** 2,000-node tier remains smooth on the target ultrawide machine; 4,000-node tier is available when measured safe.

### R4 — Five topology animations · 2–2.5 days

- Company.
- Evidence.
- Decision.
- Workforce.
- Architecture.
- Interrupt/retarget behavior.

**Acceptance:** each final frame reads differently even when motion is disabled; every transition has its contextual explanation.

### R5 — Bottom command dock · 1 day

- Portfolio, Analytics, Command and Build actions.
- Raised central mic.
- active path to orb.
- hover/focus subtitles and keyboard navigation.
- prototype overlay/routing behavior.

**Acceptance:** dock matches the requested five-position structure and stays centered/capped on super-ultrawide.

### R6 — Context overlays and voice mode · 1 day

- Replace old permanent sensor panels with on-demand overlays.
- Centered voice/text interaction.
- deterministic command choreography.

**Acceptance:** orb remains dominant and at least 55% visible whenever an overlay is open.

### R7 — Mobile and tablet adaptation · 1 day

- reduced node tiers.
- mobile dock.
- compact lens selector/explanations.
- bottom-sheet overlays.

**Acceptance:** no desktop rail/panels mount on mobile; first screen remains the large orb and dock.

### R8 — Light/dark art direction and performance QA · 1–1.5 days

- Tune both themes independently.
- test 1440×900, 1920×1080, 2560×1080, 3440×1440 and 5120×1440.
- measure 900/2,000/4,000 node tiers.
- keyboard, reduced-motion, page-hide and repeated-transition tests.
- final single-file bundle report.

**Acceptance:** no external runtime dependency; no stale founder/priority/spine copy; themes and lens transitions pass at every target viewport.

**Estimated focused revision:** 9.5–11.5 working days.

## 15. Definition of done

- No left rail exists.
- No founder text or founder kernel appears in the center.
- No central headline, subtitle or company-spine brief remains.
- No permanent Reach or Activity side panel remains.
- The orb is huge and responsive on ultrawide.
- The graph is derived from real Vault/repository structure and contains thousands of meaningful nodes where the source supports it.
- Company, Evidence, Decision, Workforce and Architecture each have a distinctive animated topology and clear contextual explanation.
- The bottom dock contains Portfolio, Analytics, central Mic, Command and Build.
- The mic is visually dominant but does not pulse constantly while idle.
- Light and dark themes both feel finished.
- The final prototype is one directly openable HTML file with zero external runtime dependencies.

## 16. Valuation on the landing

### 16.1 Placement decision

Valuation belongs on the landing, but it must not become a giant vanity number or another permanent dashboard panel.

Use two levels:

1. **Valuation Pulse** — a compact readout attached to the lower-right tangent of the orb in idle/Company mode.
2. **Valuation Overlay** — a full Treasury/Portfolio evidence view opened from the pulse or `Portfolio → Valuation` in the bottom dock.

Valuation is a **Company sub-lens owned by Treasury**, not a sixth primary twin lens. This preserves the five-lens model while making valuation directly visible and discoverable.

### 16.2 Numbers and labels to show

Use the final valuation audit, dated 2026-07-13:

| Item | Value | Required label |
|---|---:|---|
| Defensible indicative pre-money range | **$1.8M–$2.8M** | AUDIT RANGE · MEDIUM-LOW CONFIDENCE |
| Planning point estimate | **$2.2M** / **QAR 8.0M** | AUDIT POINT · NOT A MARKET PRICE |
| Recommended SAFE opening cap | **$2.5M** / **QAR 9.1M** | FINANCING ANCHOR · NOT FAIR VALUE |
| Stretch position | **up to $3.0M** | STRATEGIC / CONVICTION CASE |
| Difficult to defend today | **$3.5M+** | REQUIRES EXTERNAL RETENTION / PAYMENT PROOF |
| Internal deterministic HQ model | **$1.81M–$2.38M** | MODEL · INPUTS PARTIAL/SIMULATED |
| Company stage | integrated platform prototype / pre-PMF | SNAPSHOT |

Never collapse the $2.2M point estimate and $2.5M SAFE cap into one number. Financing terms and audit fair value answer different questions.

### 16.3 Idle landing text wireframe · ultrawide

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ARGANTA / JARVIS DIGITAL TWIN                         IDLE · SNAPSHOT        theme · settings│
│                                                                                            │
│                                                                                            │
│                              ╭─────────────────────────────╮                               │
│                          ╭───┤                             ├───╮                           │
│                       ╭──┤   │                             │   ├──╮                        │
│                       │  │   │    SINGLE HUGE JARVIS      │   │  │                        │
│                       │  │   │   THOUSANDS OF KB NODES    │   │  │                        │
│                       ╰──┤   │                             │   ├──╯                        │
│                          ╰───┤                             ├───╯                           │
│                              ╰─────────────────────────────╯                               │
│                                                    ╭─ TREASURY · VALUATION AUDIT ─────────╮│
│                                                    │ $1.8M ━━━━━●━━━━━ $2.8M             ││
│                                                    │          $2.2M audit point           ││
│                                                    │ SAFE CAP  $2.5M  │  CONF MEDIUM-LOW  ││
│                                                    │ 2026-07-13 · INDICATIVE PRE-MONEY  › ││
│                                                    ╰───────────────────────────────────────╯│
│                                                                                            │
│        ╭────────────────────── floating bottom command dock ──────────────────────╮       │
│        │ Portfolio │ Analytics │        ◉ MIC        │ Command │ Build             │       │
│        ╰────────────────────────────────────────────────────────────────────────────╯       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

The pulse is 300–380px wide, aligned to the orb tangent rather than the viewport edge. On smaller desktop screens it becomes a compact two-line capsule above the bottom dock.

### 16.4 Valuation Pulse visual

The pulse contains one horizontal range track:

```text
$1.8M ├──────────────────────────────────────────┤ $2.8M
                  ● $2.2M            │ $2.5M SAFE
```

Visual grammar:

- Range band: Arganta blue with low-opacity uncertainty texture.
- Point estimate: solid white/blue dot.
- SAFE cap: amber vertical tick, labelled `FINANCING`.
- Internal model range: thin violet line below the audit range.
- Confidence: textual `MEDIUM-LOW`; never encoded as a fake percentage.
- Provenance: `AUDIT · 2026-07-13 · COMMIT 4b688536`.
- Click/tap: opens the valuation overlay and switches the orb into valuation topology.

### 16.5 Orb valuation animation

Opening valuation does not shrink the orb into a chart background. The knowledge graph itself explains where the value and discount come from.

Sequence:

1. Company topology settles into its three product clusters and shared substrate.
2. Repository-verified asset nodes move to the upper hemisphere: product depth, architecture, data model, creative corpus, founder execution, HQ/IP.
3. Commercial-risk nodes move to the lower hemisphere: distribution, traction, revenue, trust, testing/CI, key-person concentration.
4. Six valuation-method arcs appear around the orb with different ranges and weights.
5. Higher-but-weakly-grounded methods remain faint/dashed.
6. The audit synthesis band resolves across the core from $1.8M to $2.8M.
7. The $2.2M point locks into place.
8. An amber $2.5M SAFE marker appears outside the fair-value band and is explicitly labelled `FINANCING ANCHOR`.
9. The explanation caption enters after the method dispersion becomes visible.

Caption:

```text
VALUATION · TREASURY / PORTFOLIO
Deep technical assets establish a real floor; missing market evidence limits the current re-rating.
$1.8M–$2.8M indicative pre-money · $2.2M audit point · confidence medium-low.
```

Reduced motion replaces the rearrangement with three discrete frames: evidence assets → risk discounts → final range.

### 16.6 Portfolio interaction

The Portfolio dock action opens a small radial/hover menu on second activation:

```text
Portfolio
├── Company overview
├── Products
├── North Star
└── Valuation
```

Behavior:

- First click on Portfolio: Company lens.
- Second click or long hover/focus: Portfolio menu.
- Valuation selection: valuation topology + Valuation Overlay.
- Direct keyboard shortcut: `V`.
- Escape: close overlay, retain Company lens.

### 16.7 Valuation Overlay text wireframe

Ultrawide placement: right-side floating evidence instrument, 520–680px wide. The orb remains at least 60% visible.

```text
╭──────────────────────────────────────────────────────────────────────╮
│ TREASURY / THE ACTUARY                         AUDIT · 2026-07-13  × │
│                                                                      │
│ DEFENSIBLE INDICATIVE PRE-MONEY                                      │
│ $1.8M — $2.8M                  $2.2M             QAR 8.0M            │
│ audit range                     point              translated         │
│ MEDIUM-LOW CONFIDENCE · INTEGRATED PROTOTYPE / PRE-PMF               │
│                                                                      │
│ [ RANGE ]  [ UNLOCKS ]  [ EVIDENCE ]  [ ASSUMPTIONS ]               │
│                                                                      │
│ RANGE · SIX-METHOD DISPERSION                                        │
│ $0M       $1M       $2M       $3M       $4M       $5M       $6M      │
│ Cost        ├───┤                                                     │
│ Berkus          ├────┤                                                │
│ First Chicago                 ├───────┤                                │
│ VC Method                              ├─────┤                         │
│ Scorecard                                  ├────────┤                  │
│ Risk Factor                                 ├───────────┤              │
│ Audit synthesis              ╞════●════════╡                           │
│ Internal HQ model             ├──────┤                                 │
│                                      │ $2.5M SAFE                      │
│                                                                      │
│ WHY THE RANGE IS HERE                                                │
│ + product depth     + architecture     + founder execution           │
│ – zero externals    – no paid cohort   – no validated retention      │
│                                                                      │
│ This is decision support, not a statutory valuation or market quote. │
╰──────────────────────────────────────────────────────────────────────╯
```

The method rows must visually distinguish current audit weight:

- High weight: Cost-to-Duplicate, Berkus.
- Medium-low: First Chicago.
- Low: Risk-Factor Summation, Scorecard, VC Method.
- Context-only or zero-weight cross-checks are excluded from the primary football field and available under Assumptions.

### 16.8 Range tab visuals

#### A. Valuation football field

Purpose: show why a range is more honest than one magic number.

Rows:

| Method | Range | Weight today | Provenance |
|---|---:|---|---|
| Cost-to-Duplicate | $0.35M–$0.60M | High | repo-verified/partial |
| Berkus | $0.81M–$1.11M | High | partial |
| First Chicago | $2.60M–$3.41M | Medium-low | simulated |
| VC Method | $3.50M–$4.38M | Low | simulated |
| Scorecard | $4.00M–$5.00M | Low | partial/incomplete implementation |
| Risk-Factor Summation | $4.25M–$5.50M | Low | partial/manual baseline |
| Audit synthesis | $1.80M–$2.80M | Decision | medium-low confidence |
| Internal HQ model | $1.81M–$2.38M | Model cross-check | mechanically reproducible; weak inputs |

Markers:

- $2.2M audit point.
- $2.5M SAFE opening cap.
- $3.0M stretch position.
- $3.5M+ current defensibility boundary.

#### B. Evidence/risk balance

Use a paired lollipop/dot-plot rather than a radar chart.

Positive evidence:

- Vision/coherence 9/10.
- Founder execution 9/10.
- Product depth 8/10.
- Architecture 7/10.
- Data model 7/10.
- Instrumentation readiness 7/10.

Gating evidence:

- Agentic-operating reality 4/10.
- Testing/CI 4/10.
- Trust readiness 4/10.
- Distribution 1/10.
- Traction/retention 1/10.
- Revenue 0/10.

The scores are diagnostic and must not be averaged into a single company score.

### 16.9 Unlocks tab text wireframe

The unlock ladder is the most useful founder view because it turns valuation into an evidence plan.

```text
TODAY                    20–50 WEEKLY FAMILIES       100–300 FAMILIES
$1.8M–$2.8M              $2.5M–$4.0M cap            $4M–$6M
deep repo                D7 >20%                     repeated cohorts
0 external users         activation integrity        D30 trend
no verified payment      interview evidence          paid conversion
        ───────────────►             ───────────────►

1,000 WAU + 100 PAYERS                         $1.1M–$2.5M ARR
$6M–$10M cap                                  ~$6M–$12M revenue-supported
retention + payment                           margin + CAC payback
trust operations                              repeatable channel
```

Each milestone is labelled `INDICATIVE FINANCING INTERPRETATION`, not a guaranteed future valuation.

The current position glows blue. The next incomplete evidence requirement glows amber. Future steps remain low contrast.

### 16.10 Evidence tab

Show two columns:

```text
VALUE SUPPORTED BY                     VALUE DISCOUNTED BY
• integrated product prototype         • zero verified external users
• reusable shared substrate            • no validated retention cohort
• 676 JS/TS files                      • no real-money revenue
• 79 SQL files                         • partial CI/testing
• 40,130 committed bitmap assets       • trust/compliance work incomplete
• 479 commits                          • solo-founder key-person risk
• 7 shared packages                    • LOC contradiction unresolved
• HQ + deterministic valuation engine  • valuation benchmarks partly manual
```

Every line opens its source or audit exception. Asset counts are evidence of scope, not automatically assigned monetary value.

### 16.11 Assumptions tab

This tab prevents the valuation from looking more precise than it is.

Show:

- Audit date and commit.
- Currency and QAR translation basis.
- Fair-value versus SAFE-cap definitions.
- Confidence: medium-low with explanation.
- Internal engine assumptions for regional baseline, exit ARR, revenue multiple, required return, dilution and First Chicago weights.
- Known LOC contradiction: 96K versus 122K.
- Missing live observations: users, cohort retention, cash revenue.
- Current engine remediation status.

No assumption is editable from the landing prototype unless changes are explicitly stored as a local scenario and labelled `MODEL`. The audit value itself remains immutable.

### 16.12 Libraries and rendering

Use the libraries already present in HQ; add no chart dependency.

| Visual | Prototype library | Production port |
|---|---|---|
| Valuation pulse/range | D3 scale + bespoke SVG | D3 or reusable SVG component |
| Orb valuation topology | Canvas 2D + D3 layout data | same renderer |
| Method arcs around orb | SVG + D3 scale/shape | same renderer |
| Football field | D3 scale + SVG | reuse/refine `ValuationFootballField` from Recharts or port the D3 version |
| Unlock ladder | D3 scale/shape + SVG | D3 |
| Evidence/risk lollipops | D3 scale + SVG | D3 or Recharts if kept inside Treasury |
| Tabs, values, disclaimers | React + CSS | React |
| Transitions | GSAP | GSAP |
| Icons | Lucide React in production; simple inline glyphs in standalone prototype | Lucide React |

Recommendation: use D3 for the standalone valuation visualizations because it supports custom range geometry and keeps the orb/overlay visual language coherent. Do not add ECharts solely for this feature. Recharts remains useful for the existing Treasury surface, but its standard chart grammar should not dictate the landing’s bespoke valuation animation.

### 16.13 Data contract

```ts
interface LandingValuationSnapshot {
  asOf: string
  auditCommit: string
  currency: 'USD'
  basis: 'indicative-pre-money'
  stage: 'integrated-platform-prototype-pre-pmf'
  confidence: 'medium-low'
  auditRange: { lowM: 1.8; highM: 2.8 }
  auditPointM: 2.2
  qarPointM: 8.0
  safeOpeningCapM: 2.5
  safeOpeningCapQarM: 9.1
  stretchM: 3.0
  difficultToDefendAboveM: 3.5
  internalModelRange: { lowM: 1.81; highM: 2.38; source: 'model' }
  methods: ValuationMethodDisplay[]
  evidence: EvidenceRef[]
  risks: EvidenceRef[]
  unlocks: ValuationUnlock[]
  disclaimer: string
}
```

This contract should be generated from the audit plus deterministic engine rather than duplicated across UI components.

### 16.14 Honesty and safety rules

- Never label valuation `LIVE`.
- Never animate the point estimate as if revenue increased it.
- Never show a green up-arrow without a persisted prior audit snapshot.
- Never describe $2.5M as the current fair value; it is a SAFE negotiation cap.
- Never show $3.5M+ as presently supported.
- Never use Diamonds or modeled revenue as payment proof.
- Never average the company scorecard dimensions.
- Never hide medium-low confidence.
- Always show the audit date, basis, and disclaimer in the detailed overlay.
- If a newer audit is unavailable, show `SNAPSHOT · STALE` rather than silently retaining the current value.

### 16.15 Build insertion

Add valuation after the core Company topology and bottom dock exist:

```text
R4.5 — Valuation Pulse and Treasury topology · 1–1.5 days
  • generate valuation display packet from audit + engine
  • add orb tangent range pulse
  • add valuation node topology and method arcs
  • add contextual explanation

R6.5 — Valuation Overlay · 1–1.5 days
  • Range / Unlocks / Evidence / Assumptions tabs
  • football field, unlock ladder and lollipop scorecard
  • USD/QAR display
  • source links, disclaimer and responsive states
```

Revised focused estimate including valuation: **12–14.5 working days**.

## 17. Complete landing wireframe system

### 17.1 Operating model

The landing has one persistent shell and four dock-selected operating compositions:

```text
PERSISTENT
  Minimal top chrome
  Huge Jarvis knowledge orb
  Current-lens explanation
  Bottom dock

DOCK COMPOSITIONS
  Portfolio  → products · North Star · KPIs · valuation
  Analytics  → world map · access bars · heatmap · funnel · retention · economy
  Command    → decision cortex · offices · verdicts · missions · approvals
  Build      → builder agents · artifacts · analytics · review queue

TWIN LENSES
  Company · Evidence · Decision · Workforce · Architecture
```

The map, KPIs and charts are not removed. They become **context instruments** that animate into the available ultrawide space when their dock section is active. Idle remains calm; operating modes become information-rich.

### 17.2 Persistent ultrawide shell

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ARGANTA / JARVIS DIGITAL TWIN              [current lens / phase]              range · theme · ⚙   │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                    │
│    LEFT INSTRUMENT ZONE                 HUGE SINGLE ORB                   RIGHT INSTRUMENT ZONE     │
│    changes by section             thousands of real KB nodes              changes by section      │
│                                                                                                    │
│                                           context explanation                                      │
│                                                                                                    │
│            LOWER-LEFT INSTRUMENT                                LOWER-RIGHT INSTRUMENT              │
│                                                                                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│               Portfolio     Analytics          ◉ MIC          Command       Build                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Responsive layout rules:

- Orb diameter remains 76–84dvh.
- Instrument zones use the horizontal surplus outside the orb.
- On ultrawide, four instruments may be visible simultaneously.
- On 16:9 desktop, show two primary instruments and place secondary content in tabs/drawers.
- Instruments animate from edges or from selected orb nodes; they do not permanently reserve columns.
- The orb never falls below 52% of the visible stage height.

### 17.3 Idle / Jarvis home

Purpose: presence, current phase and one defensible company signal without dashboard noise.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ARGANTA / JARVIS DIGITAL TWIN                     IDLE · SNAPSHOT 2026-07-13        ☼ · ⚙           │
│                                                                                                    │
│                                      ╭────────────────────────╮                                    │
│                                  ╭───┤                        ├───╮                                │
│                               ╭──┤   │   JARVIS KNOWLEDGE     │   ├──╮                             │
│                               │  │   │   2,000+ NODE TIER     │   │  │                             │
│                               ╰──┤   │                        │   ├──╯                             │
│                                  ╰───┤                        ├───╯                                │
│                                      ╰────────────────────────╯                                    │
│                                                               ╭─ VALUATION PULSE ───────────────╮ │
│                                                               │ $1.8M ━━━●━━━━ $2.8M           │ │
│                                                               │ $2.2M point · $2.5M SAFE        │ │
│                                                               ╰─────────────────────────────────╯ │
│                                                                                                    │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Visible data:

- Vault/graph snapshot status.
- One valuation pulse.
- Current phase/provenance.
- No large headline, subtitle, founder label, map or chart until a section is selected.

### 17.4 Portfolio composition · complete

Purpose: answer “What do we own, how is it performing, what matters, and what is it worth?”

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PORTFOLIO · COMPANY LENS               7 / 14 / 30 DAYS               SNAPSHOT + LIVE-BACKED        │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                    │
│ ┌─ NORTH STAR ──────────────────┐       ╭────────────────────────╮      ┌─ COMPANY KPIs ──────────┐ │
│ │ WEEKLY TWO-HOOK FAMILIES      │   ╭───┤                        ├───╮  │ External families   0   │ │
│ │ — · AWAITING COMPLETE SIGNAL  │ ╭─┤   │  COMPANY TOPOLOGY      │   ├─╮│ Products            3   │ │
│ │ trend · alignment · WoW       │ │ │   │  ARGANTA / LASHIRA /   │   │ ││ Front ends          7   │ │
│ │ [line + target band]          │ │ │   │  KINETIK + SHARED CORE │   │ ││ Vault nodes       319   │ │
│ └───────────────────────────────┘ ╰─┤   │                        │   ├─╯│ Offices             6   │ │
│                                      ╰───┤                        ├───╯  │ Tables / RPCs   71/147  │ │
│ ┌─ PRODUCT PORTFOLIO ───────────┐       ╰────────────────────────╯      └──────────────────────────┘ │
│ │ ArgantaLabs  LEARN   strongest│                                                                    │
│ │ LashiraBloom BLOOM   retention│                         ┌─ VALUATION ───────────────────────────┐ │
│ │ Kinetik      ORGANIZE expansion│                         │ $1.8M ━━━━━●━━━━━ $2.8M             │ │
│ │ [3 product health strips]     │                         │ $2.2M point · $2.5M SAFE · MED-LOW   │ │
│ └───────────────────────────────┘                         │ [OPEN RANGE / UNLOCKS / EVIDENCE]     │ │
│                                                          └────────────────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Portfolio visuals:

1. **North Star trend** — line/area chart with target band and honest empty state.
2. **Product health strips** — three compact rows showing role, maturity, engagement/provenance and current strategic contribution.
3. **Company KPI rail** — structural and live-backed metrics; no fake growth values.
4. **Valuation pulse** — audit range, point, SAFE marker and confidence.
5. **Orb Company topology** — products as gravity wells over one shared substrate.

Portfolio interactions:

- Select a product → filter Analytics, highlight related knowledge and agents.
- Select North Star → orb shows the child-learning + parent-coordination evidence path.
- Select Valuation → orb enters Treasury valuation topology and opens the detailed overlay.

### 17.5 Analytics composition · overview

Purpose: answer “Where are people, what are they doing, when do they return, and where does the funnel break?”

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ANALYTICS · EVIDENCE LENS    [OVERVIEW] [REACH] [ACTIVITY] [RETENTION] [ECONOMY]    7/14/30 DAYS  │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                    │
│ ┌─ WORLD REACH ────────────────┐       ╭────────────────────────╮      ┌─ AVERAGE APP ACCESS ─────┐ │
│ │                              │   ╭───┤                        ├───╮  │ ArgantaLabs          —   │ │
│ │      DOTTED WORLD MAP        │ ╭─┤   │  EVIDENCE TOPOLOGY     │   ├─╮│ LashiraBloom         —   │ │
│ │  coarse timezone · no GPS/IP │ │ │   │ tables · RPCs · events │   │ ││ KinetikCircle        —   │ │
│ │  points/arcs only when real  │ │ │   │ sources · blind paths  │   │ ││ Circle HQ            —   │ │
│ │  AWAITING REACH SIGNAL       │ ╰─┤   │                        │   ├─╯│ Landing              —   │ │
│ └──────────────────────────────┘   ╰───┤                        ├───╯  │ unique people/day         │ │
│                                        ╰────────────────────────╯      └───────────────────────────┘ │
│ ┌─ AARRR / FUNNEL ─────────────┐                                  ┌─ VISIT RHYTHM · 7 × 24 ─────┐ │
│ │ Acquire → Activate → Engage  │                                  │ Mon ░░░░░░░░░░░░░░░░░░░░░░ │ │
│ │ → Retain → Refer → Monetize  │                                  │ Tue ░░░░░░░░░░░░░░░░░░░░░░ │ │
│ │ [funnel + six status rings]  │                                  │ ... peak derived from data   │ │
│ └──────────────────────────────┘                                  └───────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Analytics overview contains the major earlier visuals:

- D3 world reach map.
- Average daily unique people per app.
- Day/hour heatmap.
- AARRR funnel/status rings.
- Central evidence/provenance graph.

When real reach/activity data is unavailable, the actual chart frame stays visible but contains a designed `AWAITING SIGNAL` state and integration explanation.

### 17.6 Analytics · Reach detail

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ANALYTICS / REACH        ALL APPS ▾     PEOPLE ▾     7 / 14 / 30 DAYS     COARSE TIMEZONE          │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────── WORLD MAP · 60% ──────────────────────────────┐ ┌─ REGION DETAIL ─┐ │
│ │                                                                            │ │ Doha / GMT+3    │ │
│ │                region pulses · product paths · focus/zoom                  │ │ people       —  │ │
│ │                                                                            │ │ sessions     —  │ │
│ │                no point/arc exists without a source                        │ │ active time  —  │ │
│ │                                                                            │ │ app mix      —  │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │ source       —  │ │
│ ┌─ REACH TREND ────────────────────────────────────────┐ ┌─ NEW / RETURNING ─┐ │ updated      —  │ │
│ │ daily people by app · multi-line / honest empty     │ │ stacked bars      │ └─────────────────┘ │
│ └──────────────────────────────────────────────────────┘ └────────────────────┘                     │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 17.7 Analytics · Activity detail

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ANALYTICS / ACTIVITY    ALL APPS ▾    PEOPLE/DAY ▾    7 / 14 / 30 DAYS                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ AVERAGE DAILY ACCESS ─────────────────────────┐ ┌─ VISIT HEATMAP · DAY × HOUR ────────────────┐ │
│ │ ArgantaLabs      ███████████████  value/source │ │      00 01 02 ...                     23     │ │
│ │ LashiraBloom     ███████████      value/source │ │ Mon  ░  ░  ░      ▒▒▒▒                      │ │
│ │ KinetikCircle    ███████          value/source │ │ Tue  ░  ░  ░      ▓▓▓                       │ │
│ │ Circle HQ        ███              value/source │ │ ...                                              │ │
│ │ Landing          ██               value/source │ │ Sun                    PEAK                     │ │
│ └─────────────────────────────────────────────────┘ └───────────────────────────────────────────────┘ │
│ ┌─ DERIVED INSIGHT ───────────────────────────────────────────────────────────────────────────────┐ │
│ │ “Sunday evening is the strongest access window…” generated from current filters, never fixed.  │ │
│ └───────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ ACTIVITY MIX ──────────────┐ ┌─ SESSION DEPTH ───────────────┐ ┌─ PRODUCT TREND ──────────────┐ │
│ │ donut · journeys/quests/etc │ │ avg session · minutes/person │ │ small multiples by product  │ │
│ └──────────────────────────────┘ └────────────────────────────────┘ └───────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 17.8 Analytics · Retention and Growth detail

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ANALYTICS / RETENTION & GROWTH           ARGANTALABS ▾           COHORT / 30 DAYS                  │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ GROWTH KPIs ──────────────────────────────────────────────────────────────────────────────────┐ │
│ │ DAU  —   WAU  —   MAU  —   DAU/MAU  —   NEW·7D  —   DEPTH  —   ACCURACY  —                  │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ NORTH STAR / WAU TREND ───────────────────────────┐ ┌─ RETENTION COHORT TRIANGLE ─────────────┐ │
│ │ line + comparison + event annotations             │ │ signup week × week-return percentage   │ │
│ └─────────────────────────────────────────────────────┘ └───────────────────────────────────────────┘ │
│ ┌─ ACQUISITION FUNNEL ───────────────────────────────┐ ┌─ ACTIVATION PATH ───────────────────────┐ │
│ │ visit → signup → child → first learn → return     │ │ event sequence + largest drop-off     │ │
│ └─────────────────────────────────────────────────────┘ └───────────────────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 17.9 Analytics · Economy detail

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ANALYTICS / ECONOMY                      INTERNAL DIAMONDS · NOT CASH REVENUE                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ ECONOMY KPIs ─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ minted —  burned —  float —  sink coverage —  spend/active —  real-money revenue: —          │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ MINT VS BURN ────────────────────────────────────┐ ┌─ ACTIVITY / LEDGER MIX ───────────────────┐ │
│ │ weekly diverging bars                            │ │ donut/stack: learn, quest, shop, farm   │ │
│ └────────────────────────────────────────────────────┘ └───────────────────────────────────────────┘ │
│ ┌─ FLOW ─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ learning rewards → wallet → shop/world sinks → retention loop                                 │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 17.10 Command composition · complete

Purpose: answer “What is being decided, by whom, with what evidence, and what requires approval?”

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ COMMAND · DECISION LENS                [MISSIONS] [VERDICTS] [COUNCIL] [APPROVALS]                  │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ ACTIVE MISSION ───────────────┐       ╭────────────────────────╮      ┌─ SIX OFFICES ───────────┐ │
│ │ 01 Sense          complete     │   ╭───┤  COMMAND CORTEX        ├───╮  │ BRIDGE   synthesis     │ │
│ │ 02 Recall         complete     │ ╭─┤   │ Sense → Recall →       │   ├─╮│ COO      operations    │ │
│ │ 03 Reason         active       │ │ │   │ Reason → Decide →      │   │ ││ CTO      technology    │ │
│ │ 04 Decide         pending      │ │ │   │ Delegate → Review →    │   │ ││ CFO      treasury      │ │
│ │ 05 Delegate       pending      │ ╰─┤   │ Learn                  │   ├─╯│ GC       legal         │ │
│ │ spend / runtime / source       │   ╰───┤                        ├───╯  │ CAPO     workforce     │ │
│ └────────────────────────────────┘       ╰────────────────────────╯      └──────────────────────────┘ │
│ ┌─ VERDICT QUEUE ────────────────┐                                  ┌─ FOUNDER APPROVALS ─────────┐ │
│ │ INSTRUMENT · Growth            │                                  │ artifact / evidence / risk  │ │
│ │ HOLD · child-facing content    │                                  │ [APPROVE] [REJECT] [INSPECT]│ │
│ │ STRATEGY · distribution        │                                  │ no fake pending count       │ │
│ └────────────────────────────────┘                                  └──────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Command visuals:

- Seven-stage decision sequence inside the orb.
- Mission timeline.
- Six-office constellation.
- Verdict queue with provenance.
- Approval boundary and artifact evidence.
- Cost/runtime truth for actual or deterministic demo runs.

### 17.11 Build composition · complete

Purpose: answer “Which capabilities can create, what are they working on, and what is waiting for review?”

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BUILD · WORKFORCE LENS       [ALL] [CONTENT] [PRODUCT] [WORLD] [MEDIA] [AGENTS]                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ CAPABILITY ROSTER ─────────────┐      ╭────────────────────────╮    ┌─ BUILD ANALYTICS ─────────┐ │
│ │ Pixel       live/read-only      │  ╭───┤  WORKFORCE TOPOLOGY    ├──╮ │ artifacts drafted       — │ │
│ │ Game        prototype           │╭─┤   │ active agents connect  │  ├╮│ reviewed                — │ │
│ │ App         prototype           ││ │   │ to the selected        │  │││ publish success         — │ │
│ │ Learn       partial             ││ │   │ product + artifact     │  │││ avg build time          — │ │
│ │ Content     partial             │╰─┤   │                        │  ├╯│ cost / artifact         — │ │
│ │ Battle / Character / World...   │  ╰───┤                        ├──╯ └───────────────────────────┘ │
│ └─────────────────────────────────┘      ╰────────────────────────╯                                  │
│ ┌─ ACTIVE BUILDS ─────────────────┐                               ┌─ REVIEW QUEUE ─────────────────┐ │
│ │ mission · agent · stage · cost  │                               │ draft artifact · risk · owner │ │
│ │ no action implied if not wired  │                               │ [PREVIEW] [APPROVE] [REJECT]  │ │
│ └─────────────────────────────────┘                               └────────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 17.12 Architecture composition

Architecture remains a Twin Lens accessible from the lens control and Command/Analytics actions.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ARCHITECTURE LENS               [THESIS] [SYSTEM] [SCALE]              NOW ━━━  NEXT ┄┄┄           │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ SYSTEM KPIs ───────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 7 front ends · 7 packages · 71 tables · 147 RPCs · 7 deploy targets · coverage / blind spots │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                    │
│       UI / VISUALIZATION     Arganta · Lashira · Kinetik · HQ · Landing                           │
│                ║                                                                                   │
│       AGENT OS              Command · offices · missions · review queue                           │
│                ║                                                                                   │
│       AI / BUILDERS         model router · builder tool packs                                     │
│                ║                                                                                   │
│       KNOWLEDGE / DATA      Vault · PostgreSQL · tables · RPCs · events                           │
│                ║                                                                                   │
│       PLATFORM / DELIVERY   Vercel · Render · Capacitor · CI                                      │
│                                                                                                    │
│ ┌─ RISKS / WHAT BREAKS FIRST ──────────────┐ ┌─ SCALE & COST ────────────────────────────────────┐ │
│ │ distribution · drift · CI · trust        │ │ 1k → 10k → 100k → 1M families · modeled         │ │
│ └───────────────────────────────────────────┘ └────────────────────────────────────────────────────┘ │
│                   Portfolio       Analytics        ◉ MIC        Command        Build                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 17.13 Valuation overlay within the complete system

Valuation is opened from Portfolio and coexists with the complete landing rather than replacing it.

```text
PORTFOLIO ACTIVE
  ├── North Star
  ├── Product portfolio
  ├── Company KPIs
  └── Valuation Pulse
        └── open → Range / Unlocks / Evidence / Assumptions overlay
```

When the valuation overlay opens:

- Portfolio instruments dim to 20–30%.
- The orb enters valuation topology.
- The overlay occupies the right edge on ultrawide.
- The North Star remains faintly visible because valuation is downstream of traction.
- Closing returns to the exact Portfolio composition.

### 17.14 Mobile complete structure

The five-position dock remains:

```text
Portfolio    Analytics       ◉       Command      Build
```

Mobile routes:

- Portfolio: KPI cards → Products → North Star → Valuation.
- Analytics: Reach / Activity / Retention / Economy tabs.
- Command: Missions / Offices / Verdicts / Approvals.
- Build: Capabilities / Active builds / Review queue.
- Mic: centered voice/text overlay.

The large orb remains the first screen of each section; detailed charts scroll below or open full-height.

## 18. Complete visual and library map

Use existing HQ dependencies; add no new visualization package.

| Area | Visual | Library / renderer | Data source |
|---|---|---|---|
| Jarvis | thousands-node graph | Canvas 2D + D3 layout data | generated Vault/repo graph |
| Jarvis | crisp rings, paths, lens geometry | SVG + D3 shape | experience state |
| Motion | lens transitions, panels, dock, command stages | GSAP | experience state |
| Portfolio | North Star line + target band | D3 scale/shape + SVG | `hq_portfolio_vc`, `hq_growth_overview` |
| Portfolio | product health strips | React/CSS + SVG sparklines | portfolio/growth snapshots |
| Portfolio | KPI rail | React/CSS | KB + live-backed HQ packet |
| Portfolio | valuation pulse | D3 scale + SVG | valuation audit packet |
| Valuation | football field | D3 scale + SVG | audit + valuation engine |
| Valuation | unlock ladder | D3 scale/shape + SVG | valuation audit milestones |
| Valuation | evidence/risk lollipops | D3 scale + SVG | audit company scorecard |
| Reach | world map | D3 geo + TopoJSON + SVG | coarse timezone reach RPC/adapter |
| Reach | region pulses and paths | SVG + GSAP | sourced reach points only |
| Activity | average access bars | D3 scale + SVG | daily distinct-person rollup |
| Activity | day/hour heatmap | Canvas 2D or SVG + D3 scale | engagement punchcard |
| Activity | activity mix donut | D3 shape + SVG | `hq_growth_overview.activityMix` |
| Growth | trend lines/areas | D3 scale/shape + SVG | growth overview/day series |
| Growth | acquisition funnel | bespoke SVG + D3 scales | `hq_acquisition` |
| Retention | cohort triangle | Canvas/SVG + D3 scale | `hq_retention` |
| Economy | mint/burn diverging bars | D3 scale + SVG | `hq_economy.mintBurn` |
| Economy | ledger/activity mix | D3 shape + SVG | economy/activity kinds |
| Command | mission timeline | React/CSS + SVG paths | mission/run packet |
| Command | office constellation | same Canvas/SVG graph renderer | office registry |
| Command | approval boundary | SVG + GSAP | review queue |
| Build | capability topology | same Canvas/SVG graph renderer | normalized agent registry |
| Build | artifact analytics | D3 bars/lines + SVG | builder analytics |
| Architecture | layered system map | Canvas/SVG hybrid | architecture graph + KB |
| Architecture | scale/cost curves | D3 scale/shape + SVG | `scaleModel` |
| Controls | icons | Lucide React in production; bundled glyphs in prototype | static |

### 18.1 Why D3 rather than several chart libraries

- The standalone prototype already needs D3 for graph layout, map projection and custom scales.
- D3 gives exact control over the cinematic geometry and provenance encoding.
- Canvas/SVG can share one visual language across map, charts, valuation and orb.
- Recharts components can remain in the production Treasury surface, but the landing prototype should not bundle Recharts in addition to D3.
- ECharts is not required for this iteration.

### 18.2 Shared filter state

```ts
interface LandingFilterState {
  section: 'portfolio' | 'analytics' | 'command' | 'build'
  lens: 'company' | 'evidence' | 'decision' | 'workforce' | 'architecture'
  analyticsView: 'overview' | 'reach' | 'activity' | 'retention' | 'economy'
  portfolioView: 'overview' | 'products' | 'northstar' | 'valuation'
  rangeDays: 7 | 14 | 30
  productId: 'all' | 'arganta' | 'lashira' | 'kinetik' | 'hq' | 'landing'
  metric: AccessMetric
  selection: SelectionState
}
```

One selection updates the orb, contextual instruments and explanation. Selecting ArgantaLabs in Portfolio must filter Reach, Activity and Growth when Analytics opens.

### 18.3 Complete data-honesty behavior

| Condition | UI behavior |
|---|---|
| verified current value | render value + `LIVE-OBSERVED`/timestamp |
| live-capable path not independently observed | render value only if returned; label `LIVE-BACKED` |
| dated repository fact | render `SNAPSHOT` + date/commit |
| deterministic scenario | render `MODEL` + assumptions |
| missing value | render `—` + `AWAITING SIGNAL`; never zero |
| verified zero | render `0` + source/date, as with external users snapshot |
| stale audit/snapshot | retain value only with `STALE` warning |

## 19. Final revised design sentence

> One enormous Jarvis orb contains the company’s memory; each lens rearranges the same thousands of truthful nodes into company, evidence, decision, workforce and architecture—while the bottom dock turns that intelligence into the four real HQ operating sections.

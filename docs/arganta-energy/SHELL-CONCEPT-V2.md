# ArgantaEnergy — Shell Concept v2 (Command-Center OS)
2026-07-22. Supersedes the two-zone (mothership/vertical) shell in ARCHITECTURE-VISION.md.
Founder-directed restructure into a mobile-first 5-zone OS driven by a bottom nav (4 tabs + center orb).

## The Main navigation — bottom bar (4 tabs + center Agent orb)
```
┌──────────────┬───────────┬──────🔮──────┬──────────────┬──────────────┐
│ Command      │ Verticals │   Agent      │ Intelligence │  Foundation  │
│ Center       │           │  (Cosmonaut) │              │              │
└──────────────┴───────────┴──────────────┴──────────────┴──────────────┘
   ops cockpit   lifecycle    center orb     data→insight   learning bank
```
On desktop the same 5 zones drive the left drawer (each zone expands to its sub-nav); on mobile they are the bottom tab bar with the Agent orb center-raised.

## Zone 1 · COMMAND CENTER  (leftmost)
The high-level operator cockpit — "run the asset" view. **Core lives inside it.**
- **Core** — high-level overview / cockpit. **Placeholder for now** (founder idea TBD).
- **Governance** — evidence lineage, checks, contradiction flags, portability readiness.
> "command only in bottom nav bar" — Command Center is a top-level entry; Core is its content.

## Zone 2 · VERTICALS  (O&G lifecycle order)
The domain apps, following the upstream lifecycle:
- **Exploration**
- **Field Development**  ← the V1 mini-Petrel (map→logs→structural→property→volumetrics→forecast→economics)
- **Well Delivery**
- **Reservoir Management**
Wells / Surfaces / logs / volumetrics etc. are **sub-tabs inside** each vertical, not top-level.

## Zone 3 · AGENT  (center orb — Cosmonaut)
The conversational AI agent (chat + artifact drawers). Center-raised in the bottom bar; floating orb on desktop. Deterministic-first router, truthful trace, DET·SOV·FRO tier seam. (Built in M3.)

## Zone 4 · INTELLIGENCE  (was "Mothership")
The data-to-insight platform. A maturity ladder — **Data is the foundation at the bottom**, refining upward to Insight. Sub-nav rendered top→bottom = Insight ▸ Intelligence ▸ Knowledge ▸ **Data (bottom)**:
- **Insight** — dashboards, KPIs, briefings, decisions ("so what"). *(new; placeholder)*
- **Intelligence** — analytics / ML / deterministic reasoning engines / the tier ladder (the "smart" compute layer, distinct from the conversational Agent orb).
- **Knowledge** — knowledge graph + vault + extraction studio (organized, linked knowledge). *(M3)*
- **Data** — ingestion refinery: inventory/provenance, **Model (schema — was its own tab, now a Data sub-tab)**, pipeline (raw governed data). *(the foundation)*

## Zone 5 · FOUNDATION  (rightmost) — the knowledge bank / learning
The human-learning library (serves Goal 3: training material for O&G). Distinct from Intelligence▸Knowledge (which is the data-derived graph).
- **Training materials** — curricula generated from the brain + workbench.
- **Notes & reading** — reference notes, reading lists.
- **Reference** — mirrored reports (Discovery report, PUD), glossary.

## Mapping from the current build (M3)
| Current | → New home |
|---|---|
| Foundation (field metrics) | Command Center ▸ Core (high-level) + Intelligence ▸ Data ▸ Overview |
| Data (inventory) | Intelligence ▸ Data ▸ Inventory |
| Schema (standalone) | Intelligence ▸ Data ▸ **Model** (sub-tab; no dedicated tab) |
| Data ▸ Pipeline | Intelligence ▸ Data ▸ Pipeline |
| Knowledge (explorer/graph/extraction) | Intelligence ▸ Knowledge |
| Agents | Intelligence ▸ Intelligence (compute) + the Agent orb (chat) |
| Audit/Governance | Command Center ▸ Governance |
| Workbench | Verticals ▸ Field Development |
| Wells / Surfaces | sub-tabs inside the verticals |
| Training | Foundation ▸ Training materials |

## UI fixes (this batch)
1. **Drawer hide button** — redesign; current is an "ugly cut". Clean full-height chevron toggle, proper hit area.
2. **"Semantic model —" header** too tight to the panel border → add inset padding (applies to the Data▸Model view).
3. **Remove the "ALL WELLS" selector** from the top bar entirely (not needed).

## Default landing
Intelligence ▸ Data ▸ Inventory (real content) — or Command Center ▸ Core once its concept is defined.

## Open confirmations
- Zone-4 sub-order **Insight→Intelligence→Knowledge→Data (Data bottom)** — confirm the literal bottom-up stack.
- Zone label **"Intelligence"** vs a distinct name for its inner "Intelligence" compute layer (currently both use the word — inner could be "Reasoning/Analytics" to avoid the double).

## Sequencing
This restructure edits nav.ts, Drawer, ContextBar, App.tsx, store, tabs — the files the M3 UI agent is editing NOW. Execute as a follow-up batch AFTER M3 is verified + committed, to avoid collision.

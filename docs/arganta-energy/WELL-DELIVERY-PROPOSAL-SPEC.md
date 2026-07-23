# Well Delivery — the gated well-delivery workbench (spec, as built)

Supersedes the earlier "scrollable A4 drilling-proposal" concept. Well Delivery is
now a **gated workbench** on the exact FieldDev template, not a report generator.

## Research base — the industry standard

World-class operators (Shell, BP, Equinor) run a **Well Delivery Process (WDP)** —
"a set of activities along a timeline to plan, execute and close out a well" —
stage-gated to the corporate **Capital Value Process (CVP)** and *scalable* (short
form for repeatable development/infill wells). Deliverable order that fixes the tab
sequence:

| Gate | Phase | Deliverable | Answers |
|---|---|---|---|
| DG1 Assess | Feasibility | Opportunity from FDP / infill screen | is there a well? |
| DG2 Select | Concept | **SOR + Basis of Design** (multi-discipline) | what & why |
| DG3 Define | Detailed design | **Drilling programme**; hazards cleared | how |
| FID Sanction | Sanction | **Drilling proposal** (well-on-a-page synthesis) | go / no-go |
| DG4 Execute | Execution | Drilling + **geosteering**; NORSOK D-010 barriers | drill it |
| Closeout | Evaluate | **Final Well Report** (planned vs actual) | what we got |
| Handover | Operate | As-drilled package → **Reservoir Management** | learn & produce |

Key correction: the **drilling proposal is a synthesis at the FID gate — after the
SOR**, not before it. So the Overview/landing cockpit *is* the proposal.

Analogs: process = WDP + CVP (SPE/IADC 105990); software = SLB DrillPlan, Landmark
COMPASS/OpenWells, ROGII StarSteer (geosteering); standards = NORSOK D-010 (barriers).

## Design — same template as FieldDev

Shell renders, for `nav==='well-delivery'`, a `.tabs` bar + `.fd-body`
`[ explorer | canvas ]`, identical to the FieldDev / Exploration branches. Reuses
`../fielddev/chrome` (Inspector/Slider/Segmented) and `../fielddev/hooks`
(useCanvas/useAsync) and the classic control-room tokens. Location:
`src/tabs/welldelivery/` (mirrors `src/tabs/fielddev/`).

**Explorer** = the NEW-well / SIDETRACK candidate portfolio (never existing wells),
grouped by CVP gate. Candidates are anchored to REAL Volve wells (surface loc, TD,
formation depth from `public/wb`); all design/cost/timing is `dataNature: scenario`.

**Tabs (polished names + rich in-tab descriptions):**

| Tab | Gate | Cockpit |
|---|---|---|
| **Proposal** | Sanction | Non-scroll "well-on-a-page" — gate tracker, target, trajectory, casing/mud, AFE, top risks, gate readiness; links to the Report workspace docs |
| **Basis** | Select | SOR & Basis of Design — objectives, targets, success criteria, design envelope, rig sizing, L2 cost, risk register; editable + gate advance in the Inspector |
| **Clearance** | Define | Mud window (canvas), ISCWSA-style anti-collision separation factor vs REAL offset trajectories, two-envelope barrier schematic (NORSOK D-010) |
| **Steering** | Execute | StarSteer-style TVT cross-section, in-zone %, distance-to-boundary, type-well correlation (gate-locked until on bottom) |
| **Debrief** | Execute | Final Well Report — prognosed-vs-actual tops, NPT by section, days/cost plan-vs-actual, as-built casing, lessons |
| **Handover** | Handover | Barrier/limits/checklist + deliver the as-drilled package to Reservoir Management (forward-link) |

**Reports vs cockpits:** the tabs are interactive cockpits; the *documents* (SOR.md,
Drilling Program.md, FWR.md — already in the Report page's `well-delivery` dept) stay
in the Report workspace and are linked from the cockpits.

## Files (`src/tabs/welldelivery/`)

`types.ts` (Gate/WdCandidate), `wdData.ts` (real-anchor portfolio generator + store +
forward-links), `trajectory-math.ts` (DLS + simplified closest-approach/SF),
`registry.ts` (6 tabs), `shared.tsx` (WdHead/GateTrack/GateLocked), `WellDelivery.tsx`
(router), the 6 cockpits, `WellDeliveryExplorer.tsx`, `WellDeliveryWorkspace.tsx`,
`well-delivery.css`. Shell wires `well-delivery` → `WellDeliveryWorkspace`,
`drilling-sequence` → `DrillingSequenceView`.

## Cross-app loop

Field Development (FDP infill/sidetrack) → Well Delivery (mature through the gates) →
Reservoir Management (receives the as-drilled well at Handover). Sanctioned candidates
also surface in the Drilling Sequence lifecycle. The legacy `WellProposal`
`proposal-store`/`proposal-types` (in `src/cosmo/welldelivery/`) are retained only as
the schedule bridge for the in-progress Drilling Sequence Gantt build (`sequence/`).

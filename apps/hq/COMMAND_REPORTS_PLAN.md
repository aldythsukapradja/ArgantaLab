# Circle HQ — COMMAND Reports, Interactions & Presentations — Build Plan

> Detailed, build-ready roadmap. **Deterministic templates** (real facts + fixed phrasing); the LLM narration seam (P5) slots in later at the same interface. No fabricated numbers; provenance badges travel into every report and slide; blind stays blind.
> Status: ☐ not started · ◐ designed · ☑ built

## 0. Principle
A **report** is a saved *composition* of office slices over the one ontology. A **presentation** is a report rendered as slides. A **briefing** is a report on a schedule. → build ONE composition engine; everything else is configuration.

## 1. Data model (the spine)
`data/reports/types.ts`
```ts
type Cadence = 'onDemand'|'daily'|'weekly'|'monthly'|'quarterly'
type SectionKind = 'kpiRow'|'chart'|'table'|'metric'|'verdicts'|'consults'|'headline'|'text'|'divider'
interface Section { id; kind: SectionKind; title?; source: Source;      // provenance badge per section
  data: any;              // shape depends on kind (KpiItem[] | ChartData | rows | string)
  drillTo?: string;       // node id for "why?/drill"
}
interface Report { id; title; owner: OfficeId|'company'; cadence: Cadence; audience: string; generatedAt?: string;
  sections: Section[]; provenance: Coverage;   // rollup of section sources
}
type ReportBuilder = (ctx: ReportCtx) => Report   // deterministic; ctx = {graph, engine, model, range, live}
```
`data/reports/engine.ts` — assembly helpers: `officeHeadline(office)`, `metricSection(nodeId)`, `verdictSection(office)`, `consultSection()`, `deltaOf(nodeId, range)` (needs history → step 6), `rollupProvenance(sections)`.

---

## STEP 1 — Report composition engine  ◐
**Goal:** a generic renderer that turns a `Report` into UI, section by section, with a badge on every number.
- ➕ `data/reports/{types,engine}.ts`
- ➕ `surfaces/command/reports/Report.tsx` — maps `SectionKind` → existing components: `kpiRow→Kpi`, `chart→ChartView`, `table→<table>`, `verdicts→VerdictQueue`, `consults→ConsultPanel`, `headline→text+badge`.
- Reuse: `Kpi`, `ChartView`, `SourceBadge`, `HealthDot`.
- **Accept:** a `Report` object renders top-to-bottom; adding a section = data change, zero renderer edits (G3).

## STEP 2 — Daily C-Level Briefing (flagship)  ☐
**Goal:** on-demand briefing composed from the six office headlines.
- ➕ `data/reports/daily.ts` → `buildDailyBriefing(ctx)`:
  - Cover: North Star W2F + spark + org health + coverage%.
  - **The one thing**: deterministic pick — `weakestLever()` ∣ top red guardrail ∣ top resolve item.
  - **Six chief lines**: `officeHeadline(o)` = auto-brief + top metric(+trend) + top signal + recommended `deriveVerdict`, laddered. (Same sentence that feeds the Bridge roll-up — one source.)
  - Cross-cutting: `pendingConsults()` + resolve queue (Trust>NS>Retention>Money).
  - Since-yesterday: deltas (placeholder until history/step 6).
  - Money watch: CFO one-liner from the model.
- ➕ Bridge hub "Daily Brief" button; orb "daily brief" chip → renders inline.
- Cadence ladder reuses the template: Daily → Weekly (adds cohorts) → Monthly Business Review (adds financials) → Quarterly (adds strategy).
- **Accept:** briefing renders on demand; every chief line laddered; provenance footer honest.

## STEP 3 — Present + Export  ☐
- ➕ `surfaces/command/reports/Present.tsx` — wraps a `Report` into slides (reuse `Presentation.tsx` patterns): section(s) per slide, ←/→ nav, Esc.
- Export: **PDF** via `window.print()` + `@media print` stylesheet; **CSV** for `table` sections; **copy** for text.
- "Present" / "Export" actions on the Report renderer and every office.
- **Accept:** any report → deck (arrow-key) + PDF + CSV.

## STEP 4 — Chart library additions  ☐
`components/charts.tsx` (file is built to extend). Add `ChartData` variant + `ChartView` branch + `CHART_KINDS` entry, each dependency-free SVG:
- **waterfall** (P&L / cash bridge), **gauge** (LTV:CAC, SLA, coverage-to-target), **scatter** (agent ROI), **sankey/flow** (CURR transitions, value ladder), **riskMatrix** (2×2), **sparkline** (inline deltas), **funnel** (promote to native).
- **Accept:** each renders from `ChartData`; scenario runner + reports get them free.

## STEP 5 — Domain reports  ☐
One deterministic builder each in `data/reports/`:
| File | Owner | Marquee sections / charts | Prov. |
|---|---|---|---|
| `financial.ts` | CFO | waterfall P&L · fan · gauge LTV:CAC · runway · diamond economy (Treasury model ~80% there) | 🟡sim+🟢 |
| `operations.ts` | COO | CURR sankey · cohort · funnel · content heat · surface verdicts | 🟢 |
| `product.ts` | CPO | activation · build/ship funnels · world engagement · roadmap-vs-verdicts | 🟡 |
| `growth.ts` | VP Growth | acquisition funnel · k-factor trend · channel bars · waitlist | 🟡→🟢 |
| `health.ts` | CTO | coverage x-ray · signal board · latency · backlog | 🟡+🔴 |
| `risk.ts` | GC | register table · risk matrix · holds · revenue-at-risk | 🔴 |
| `people.ts` | Guild | ROI scatter · cost bars · SLA gauges | 🔴 |
- Each reached from its office "Report" action.
- **Accept:** each office generates its report; live where wired, "—"+badge where blind.

## STEP 6 — Interaction upgrades  ☐
- **Time-range + compare**: store `range` (7/30/90d·QTD·YTD·custom) + `compare` (none·prevPeriod·caseAB·regionAB); `RangePicker`; thread `range` into report ctx + RPC params (extend P3 RPCs to accept `p_from/p_to`).
- **Verdict/consult lifecycle**: store verdict status (proposed→active→resolved/rejected); actions in Verdict queue + Resolve queue; consult answer/handoff.
- **Universal drill + RCA**: implement `rootCause(dipNodeId)` in `graph/engine.ts` (walk NS→LADDERS_TO→CONTAINS→GUARDS→CAUSES lag-checked → ordered path); `DrillPath` component; "Why?" on any metric.
- **Ask the chief about this**: from a node → open the office orb with node context (seed prompt).
- **Accept:** change range → all metrics reflect; resolve a verdict → state moves; "Why?" → RCA path (G4 drill spine passes).

## STEP 7 — Board deck + Investor update  ☐
- ➕ `data/reports/{board,investor}.ts` — cross-office compositions: Executive (North Star · 6 office summaries · financials · risks · decisions · asks) → board slides; Investor update → reuse `Presentation.tsx`.
- Bridge hub lists them; Present → deck.
- **Accept:** board deck composes the six office summaries + financials + risks + decisions; investor update renders traction.

---

## Phasing (each ends RUNNABLE)
- **R1 = steps 1–3** — engine + daily briefing + present/export. *Ships the morning brief.*
- **R2 = steps 4–5** — chart library + the seven domain reports.
- **R3 = steps 6–7** — interaction upgrades (time/compare/lifecycle/RCA) + board & investor decks.

## File-change list
```
➕ data/reports/{types,engine,daily,financial,operations,product,growth,health,risk,people,board,investor}.ts
➕ surfaces/command/reports/{Report,Present,RangePicker,DrillPath}.tsx
✏️ components/charts.tsx            (waterfall·gauge·scatter·sankey·riskMatrix·sparkline·funnel)
✏️ data/graph/engine.ts            (rootCause, deltas, verdict lifecycle)
✏️ shell/store.ts                  (range, compare, verdict status)
✏️ surfaces/command/Cockpits.tsx   (Bridge = Briefings & Reports hub; office Report/Present actions)
✏️ components/AgentOrb.tsx         ("Ask the chief about this" node context)
♻️ reuse: Presentation.tsx · Kpi · ChartView · CohortHeat · SourceBadge · engine · Treasury model
```

## Battle tests (reporting layer)
- ☐ Every number in every report carries a source badge (G1); blind renders "—".
- ☐ Reports are deterministic — same inputs → same output (no fabrication).
- ☐ Present renders any report as slides; Export produces PDF + CSV.
- ☐ Adding a section/report = data change, zero renderer edits (G3).
- ☐ "Why?" on a dipped metric returns a real RCA path (G4).
- ☐ Provenance rollup: a report with any simulated section is badged, not passed as live.

## Acceptance (reporting v1 done)
> Ask for the daily brief and read six laddered chief lines + what needs you — then hit Present for the board deck, Export the financials to PDF, change the range to QTD and watch every number move, and click "Why?" on a red metric to walk it to the missing event.

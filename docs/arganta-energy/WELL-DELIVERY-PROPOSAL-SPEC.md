# Well Delivery — Drilling Proposal One-Pager (spec)

Research base: Landmark COMPASS (trajectory + anti-collision), SLB Petrel Trajectory
Planning / DrillPlan (subsurface→ops handoff, validation gates), AFE conventions
(cost/casing/mud), and this repo's own COSMO `TAB_SPECS['well-delivery']` +
`LIFECYCLE_TECH['well-delivery']` doctrine ("one well spine from prognosis through
BOD, trajectory, casing/completion, risk register, execution, EOWR, post-well
learning"). See memory `cosmo-ui-migration`, `geavision-four-app`.

## 1. What this is

A single-page **drilling proposal** (`WellProposal`) — the SOR→BOD slice of the
well spine — that:
- prefills from real Volve data where FD/wb data supports it,
- is editable for the parts no data source in Volve provides (AFE, mud/casing
  detail, completion, risk register) — those fields are explicitly tagged
  `dataNature: 'scenario'`,
- saves locally (`energy_well_proposals_v1`),
- **back-links to Field Development** (the well/target it originates from),
- **forward-links to Drilling Sequence** (emits a schedulable unit on approval).

## 2. One-pager sections (merged from COMPASS / DrillPlan / AFE / COSMO `.md` docs)

1. Header — well · field · platform/slot · rev · maturation gate · author · `dataNature`
2. Objective & rationale + success criteria
3. Targets & geology — target formation(s), TD (MD/TVD/TVDSS)
4. Trajectory summary — surface loc, KOP, max inclination/azimuth, max DLS, anti-collision separation
5. Casing & mud scheme (editable, scenario)
6. Completion intent (editable, scenario)
7. Data-acquisition matrix (editable, scenario)
8. Risk register — seeded from offset-well NPT patterns where derivable, else editable
9. AFE & days (editable, scenario)
10. Approvals & links — evidence checklist (links to the 7 WD report docs already in
    `report-data.json`), back-link to Field Development, forward-link to Drilling Sequence

## 3. `WellProposal` schema (the well spine object)

```ts
interface WellProposal {
  id: string;                       // uuid
  well: string;                     // WellRow.name, e.g. "F-12"
  rev: number;
  gate: 'SOR0' | 'SOR1' | 'SOR2' | 'BOD' | 'APPROVED';
  createdAt: string; updatedAt: string;
  sourceTarget: {                   // back-link to Field Development
    well: string; x: number; y: number;      // WellRow surface loc
    formation: string | null;                 // Hugin-interval-style pick match
    topMd: number | null; topTvdss: number | null;
  };
  objective: string;                // editable text
  successCriteria: string[];
  trajectory: {                     // derived from traj-*.json, real
    surfaceX: number; surfaceY: number;
    kopMd: number | null;
    tdMd: number; tdTvd: number; tdTvdss: number | null;
    maxInclDeg: number; maxAziDeg: number;
    maxDlsDeg30m: number;
    closestOffset: { well: string; distM: number } | null;  // simplified separation
    dataNature: 'measured' | 'interpreted';
  };
  casingMud: Array<{ section: string; shoeMd: number; mudWeightSg: number }>; // scenario
  completion: { type: string; intervals: string; sandControl: string; stimulation: string }; // scenario
  dataAcquisition: string[];        // scenario
  riskRegister: Array<{ hazard: string; severity: 'low'|'med'|'high'; mitigation: string }>; // scenario
  afe: { dryHoleUsd: number; completionUsd: number; totalUsd: number; p50Days: number }; // scenario
  dataNature: 'scenario';           // overall — most sections are scenario/proposal-stage
}
```

## 4. Forward link — `DrillingScheduleItem`

Emitted when `gate === 'APPROVED'`:

```ts
interface DrillingScheduleItem {
  proposalId: string; well: string;
  p50Days: number; earliestStart: string | null;
  dependencies: string[];
  emittedAt: string;
}
```

Stored in `energy_drilling_sequence_v1`; the Drilling Sequence nav placeholder
reads this list (a real, if minimal, forward link — full COMPASS-style Gantt is
future work per the phased build order).

## 5. Library choices (validated against 2025/26 sources)

| Need | Pick | Reason |
|---|---|---|
| One-pager layout/print | Reuse `PAGE_SIZES.A4`/`MARGINS` (report-types.tsx) + existing `@media print` scoped rule (cosmo-system.css:837) + `window.print()` | Crisp, selectable, zero new dep — html2canvas/jsPDF rasterize text and break on modern CSS colors |
| Trajectory math (DLS, closest-approach) | Small in-house TS module (`trajectory-math.ts`), min-curvature-style DLS formula, ISCWSA-style closest-approach simplified to straight 3D distance | `traj-*.json` stations are already computed (incl/azi/disp); no need for a full welleng port for this scope |
| Persistence | `localStorage` (`energy_well_proposals_v1`, `energy_drilling_sequence_v1`) | Matches `hq_vault` pattern; Supabase migration is later, same as other ArgantaEnergy surfaces |

Deferred (not needed for this slice): Three.js 3D trajectory viewer, uPlot depth/time
charts, TanStack Table registers, Mermaid barrier diagrams — these belong to the
later Trajectory/Drilling/Post-Mortem tabs (see `cosmo-ui-migration` memory,
"Still to build").

## 6. Build scope for this pass

1. `proposal-types.ts` — schema above.
2. `trajectory-math.ts` — DLS + closest-approach from real `TrajStation[]`.
3. `proposal-data.ts` — derive a draft `WellProposal` from `loadIndex`/`loadTraj`/`loadPicks`.
4. `proposal-store.ts` — localStorage CRUD for both stores.
5. `WellProposalOnePager.tsx` — the true-A4 one-pager, editable scenario fields, Save, Print/Export, gate control, evidence-checklist links.
6. `WellDeliveryHome.tsx` — well picker + proposal list, wired into `CosmoShell` nav (`well-delivery`).
7. Drilling Sequence nav placeholder upgraded to list emitted `DrillingScheduleItem`s.

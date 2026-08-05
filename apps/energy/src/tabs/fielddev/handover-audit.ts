// handover-audit.ts — is the static model fit to hand to the dynamic model?
//
// A static model is not "done" when it has properties. It is done when a reservoir
// engineer can INITIALISE it and start HISTORY MATCHING without coming back to ask
// for something. Those two jobs have specific, checkable requirements, and this
// module states each one, tests it against what the model actually contains, and
// reports blocked / warn / ready with the reason.
//
// The rule it exists to enforce: a gap must be found HERE, by the team that owns the
// static model, and not three weeks later by the engineer whose run will not
// equilibrate. Every check therefore names what is missing and what it blocks, and
// nothing is marked ready on the strength of a default.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.

export type AuditStatus = 'ready' | 'warn' | 'blocked' | 'absent';

export interface AuditItem {
  id: string;
  /** which downstream job needs it */
  needs: 'initialisation' | 'history match' | 'both';
  label: string;
  status: AuditStatus;
  /** what the model actually has — measured, never assumed */
  finding: string;
  /** what breaks downstream if this is not fixed */
  consequence?: string;
}

export interface AuditInput {
  grid: {
    nx: number; ny: number; nz: number;
    cells: number; activeCells: number;
    /** cells with geometry whose bulk volume is zero or non-finite — a real defect */
    degenerateCells: number;
    /**
     * Cell slots in a zone that does not cover their column.
     *
     * NOT a defect: `PackedGrid3D.activeCol` is per-COLUMN and is the UNION across
     * zones, so a column present in the reservoir but absent from the overburden is
     * marked active for every layer. Those slots simply have no geometry. It matters
     * because a simulator needs per-CELL ACTNUM, which the union cannot express.
     */
    inactiveCells: number;
    zones: Array<{ name: string; nz: number; crossedCols: number }>;
    /** true when the grid is unfaulted vertical-pillar */
    unfaulted: boolean;
  };
  properties: {
    /** true when a simulated field exists rather than geometry-only defaults */
    simulated: boolean;
    /** the areal resolution the simulation actually ran at */
    simNodes: number | null;
    modelNx: number;
    /** per-property coverage: finite fraction over active cells */
    poroFinite: number;
    permFinite: number;
    ntgFinite: number;
    /** true when a vertical permeability was produced, not just horizontal */
    hasPermZ: boolean;
    /** was the φ–k transform fitted to data, or taken from an analogue? */
    phiKFitted: boolean;
    meanPoro: number;
    meanPerm: number;
    /** cells whose φ→k extrapolated past the physical ceiling and were capped */
    permCapped: number;
    /** cells a property was actually simulated in — the denominator for `permCapped`.
     *  Omit and the whole active grid is used. */
    simulatedCells?: number;
  };
  wells: {
    producers: number;
    producersUpscaled: number;
    injectors: number;
    injectorsUpscaled: number;
    /** bores carrying a directional survey — needed to perforate cells */
    withSurvey: number;
    total: number;
    /** wells with a monthly production/injection history */
    withHistory: number;
    /** cells each flowing well is open to — the COMPDAT equivalent. Undefined means
     *  the intersection has not been computed; zero means it was computed and found
     *  nothing, which is a different and worse finding. */
    completionCells?: number;
  };
  fluids: {
    /** contacts declared, with their nature */
    contacts: Array<{ kind: string; tvdss: number | null; nature?: string }>;
    bo: number | null;
    rs: number | null;
    pb: number | null;
    /** initial reservoir pressure and its datum */
    pi: number | null;
    /** relative permeability / capillary pressure — SCAL */
    hasRelPerm: boolean;
  };
  regions: {
    /** equilibration regions — one per contact/compartment */
    eqlnum: number;
    /** fluid-in-place regions, for reporting volumes by pool */
    fipnum: number;
    /** saturation-function regions */
    satnum: number;
  };
  volumes: {
    stoiipSm3: number;
    /** an independent published figure to check against, when one exists */
    officialSm3: number | null;
    /** grid vs map disagreement, as a fraction */
    reconcileDiff: number;
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Run the audit.
 *
 * Ordered by what a reservoir engineer reaches for first: the grid, then what fills
 * it, then the wells that will be perforated in it, then the fluid system that
 * initialises it, then the regions that organise it, then the volume it reports.
 */
export function auditHandover(a: AuditInput): AuditItem[] {
  const items: AuditItem[] = [];
  const add = (i: AuditItem) => items.push(i);

  // ── grid ──────────────────────────────────────────────────────────────────
  add({
    id: 'grid.geometry', needs: 'both', label: 'Grid geometry',
    status: a.grid.activeCells > 0 ? 'ready' : 'blocked',
    finding: `${a.grid.nx} × ${a.grid.ny} × ${a.grid.nz} · ${a.grid.activeCells.toLocaleString('en-US')} active of ${a.grid.cells.toLocaleString('en-US')}`,
    consequence: a.grid.activeCells > 0 ? undefined : 'nothing to initialise',
  });

  add({
    id: 'grid.actnum', needs: 'both', label: 'Per-cell ACTNUM',
    status: a.grid.inactiveCells > 0 ? 'absent' : 'ready',
    finding: a.grid.inactiveCells > 0
      ? `${a.grid.inactiveCells.toLocaleString('en-US')} cell slots lie in a zone that does not cover their column; the packed grid marks activity per COLUMN (a union across zones), not per cell`
      : 'every column is present in every zone, so a per-column mask is sufficient',
    consequence: 'the simulator needs ACTNUM per cell — exporting the column union would activate cells that have no geometry',
  });

  add({
    id: 'grid.degenerate', needs: 'both', label: 'Cell validity',
    status: a.grid.degenerateCells === 0 ? 'ready' : 'blocked',
    finding: a.grid.degenerateCells === 0
      ? 'every active cell has a positive, finite bulk volume'
      : `${a.grid.degenerateCells.toLocaleString('en-US')} cells have zero or non-finite volume`,
    consequence: 'a zero-volume cell makes the pore-volume sum and the transmissibility undefined',
  });

  const crossed = a.grid.zones.reduce((n, z) => n + z.crossedCols, 0);
  add({
    id: 'grid.crossings', needs: 'both', label: 'Horizon crossings',
    status: crossed === 0 ? 'ready' : 'warn',
    finding: crossed === 0
      ? 'no zone has a base above its top'
      : `${crossed.toLocaleString('en-US')} columns where a zone base sits above its top, excluded from the model`,
    consequence: crossed === 0 ? undefined : 'those columns are holes in the model; the simulator will see inactive cells where the map shows reservoir',
  });

  add({
    id: 'grid.faults', needs: 'both', label: 'Faults',
    status: a.grid.unfaulted ? 'warn' : 'ready',
    finding: a.grid.unfaulted
      ? 'UNFAULTED vertical-pillar grid — no fault planes, no non-neighbour connections'
      : 'faulted grid with explicit connections',
    consequence: a.grid.unfaulted
      ? 'a sealing or partly-sealing fault cannot be represented, so compartmentalisation cannot be history-matched — this is usually the first thing an HM needs'
      : undefined,
  });

  // ── properties ────────────────────────────────────────────────────────────
  add({
    id: 'prop.populated', needs: 'both', label: 'Properties populated',
    status: a.properties.simulated ? 'ready' : 'blocked',
    finding: a.properties.simulated
      ? `φ mean ${a.properties.meanPoro.toFixed(3)} · k mean ${a.properties.meanPerm.toFixed(1)} mD`
      : 'geometry only — porosity is 0 and Sw is 1',
    consequence: a.properties.simulated ? undefined : 'zero pore volume; the model cannot hold or flow anything',
  });

  const worstCoverage = Math.min(a.properties.poroFinite, a.properties.permFinite, a.properties.ntgFinite);
  add({
    id: 'prop.coverage', needs: 'both', label: 'Property coverage',
    status: worstCoverage >= 0.999 ? 'ready' : worstCoverage >= 0.95 ? 'warn' : 'blocked',
    finding: `φ ${pct(a.properties.poroFinite)} · k ${pct(a.properties.permFinite)} · NTG ${pct(a.properties.ntgFinite)} of active cells finite`,
    consequence: worstCoverage >= 0.999 ? undefined : 'an undefined property in an active cell is a NaN the simulator will propagate or reject',
  });

  add({
    id: 'prop.permz', needs: 'both', label: 'Vertical permeability',
    status: a.properties.hasPermZ ? 'ready' : 'blocked',
    finding: a.properties.hasPermZ ? 'PERMZ present' : 'only horizontal permeability was produced — no PERMZ',
    consequence: 'without kv the simulator cannot compute vertical flow; coning, gravity segregation and layer communication are all unmodellable',
  });

  // "finite" is not "physical": phiToK is log-linear and unbounded, so an
  // extrapolated porosity produces a permeability a simulator will accept and a
  // reservoir cannot contain.
  // The denominator is the cells a property was actually SIMULATED in, not the whole
  // grid. Scoping the property model to the reservoir must not flatter this number by
  // leaving unsimulated layers in the divisor.
  const permDenom = a.properties.simulatedCells ?? a.grid.activeCells;
  const cappedFrac = permDenom > 0 ? a.properties.permCapped / permDenom : 0;
  add({
    id: 'prop.permrange', needs: 'both', label: 'Permeability in range',
    status: cappedFrac === 0 ? 'ready' : cappedFrac < 0.02 ? 'warn' : 'blocked',
    finding: cappedFrac === 0
      ? `mean ${a.properties.meanPerm.toFixed(0)} mD, none capped`
      : `${a.properties.permCapped.toLocaleString('en-US')} cells (${pct(cappedFrac)}) exceeded the physical ceiling and were capped`,
    consequence: cappedFrac === 0 ? undefined
      : 'the φ–k transform is being evaluated outside the porosity range it was calibrated over; a capped value is an admission, not a measurement',
  });

  add({
    id: 'prop.phik', needs: 'both', label: 'φ–k transform',
    status: a.properties.phiKFitted ? 'ready' : 'warn',
    finding: a.properties.phiKFitted
      ? 'fitted to measured permeability'
      : 'ANALOGUE coefficients — no permeability curve or core in this delivery to fit against',
    consequence: a.properties.phiKFitted ? undefined
      : 'permeability is the single most uncertain input to a history match, and here it rests on an assumed relationship',
  });

  if (a.properties.simNodes != null && a.properties.simNodes < a.properties.modelNx) {
    add({
      id: 'prop.simres', needs: 'both', label: 'Simulation resolution',
      status: 'warn',
      finding: `simulated on ${a.properties.simNodes} × ${a.properties.simNodes} and upsampled to ${a.properties.modelNx} areal cells`,
      consequence: 'the property field carries only the coarse grid’s spatial detail; small-scale heterogeneity a history match may need is not there to find',
    });
  }

  // ── wells ─────────────────────────────────────────────────────────────────
  const flowing = a.wells.producers + a.wells.injectors;
  const flowingUp = a.wells.producersUpscaled + a.wells.injectorsUpscaled;
  add({
    id: 'well.flowing', needs: 'history match', label: 'Flowing wells upscaled',
    status: flowing === 0 ? 'absent' : flowingUp === flowing ? 'ready' : 'blocked',
    finding: `${a.wells.producersUpscaled}/${a.wells.producers} producers · ${a.wells.injectorsUpscaled}/${a.wells.injectors} injectors`,
    consequence: flowingUp === flowing ? undefined
      : 'a flowing well that did not condition the model means the rock it drained was never informed by its own log',
  });

  add({
    id: 'well.survey', needs: 'history match', label: 'Directional surveys',
    status: a.wells.withSurvey === a.wells.total ? 'ready' : 'warn',
    finding: `${a.wells.withSurvey}/${a.wells.total} bores carry a survey`,
    consequence: a.wells.withSurvey === a.wells.total ? undefined
      : 'a bore without a survey cannot be perforated into cells, so it cannot be included in the simulation deck',
  });

  // A completion list is the one artifact this codebase can already almost produce —
  // `blockWellPath` walks every cell a bore crosses. Until that intersection is kept
  // and exported per well, the status is read from the input rather than asserted, so
  // that building it flips the audit instead of requiring the audit to be edited.
  const comp = a.wells.completionCells;
  add({
    id: 'well.completions', needs: 'history match', label: 'Completions / perforations',
    status: comp === undefined ? 'absent' : comp > 0 ? 'ready' : 'blocked',
    finding: comp === undefined
      ? 'not generated — the static model produces no COMPDAT-equivalent cell list per well'
      : comp > 0 ? `${comp} completed cells across the flowing wells`
      : 'the intersection was computed and returned no cells at all',
    consequence: comp && comp > 0 ? undefined
      : 'the simulator needs to know WHICH cells each well is open to; trajectory + grid gives it, but the intersection is not yet computed or exported',
  });

  add({
    id: 'well.history', needs: 'history match', label: 'Production history',
    status: a.wells.withHistory > 0 ? 'ready' : 'blocked',
    finding: `${a.wells.withHistory} wells carry a monthly rate history`,
    consequence: a.wells.withHistory > 0 ? undefined : 'there is nothing to match against',
  });

  // ── fluids and initialisation ─────────────────────────────────────────────
  add({
    id: 'fluid.contacts', needs: 'initialisation', label: 'Fluid contacts',
    status: a.fluids.contacts.length > 0 ? 'ready' : 'blocked',
    finding: a.fluids.contacts.length
      ? a.fluids.contacts.map((c) => `${c.kind} ${c.tvdss ?? '?'} m${c.nature ? ` (${c.nature})` : ''}`).join(' · ')
      : 'none declared',
    consequence: a.fluids.contacts.length ? undefined : 'equilibration has no datum to put fluids against',
  });

  add({
    id: 'fluid.pvt', needs: 'initialisation', label: 'PVT',
    status: a.fluids.bo != null && a.fluids.rs != null ? 'ready' : 'warn',
    finding: [
      a.fluids.bo != null ? `Bo ${a.fluids.bo}` : 'no Bo',
      a.fluids.rs != null ? `Rs ${a.fluids.rs}` : 'no Rs',
      a.fluids.pb != null ? `Pb ${a.fluids.pb}` : 'no Pb',
      a.fluids.pi != null ? `Pi ${a.fluids.pi}` : 'no Pi',
    ].join(' · '),
    consequence: a.fluids.bo != null ? undefined : 'without a formation volume factor a reservoir volume cannot be converted to a stock-tank one',
  });

  add({
    id: 'fluid.scal', needs: 'both', label: 'Relative permeability (SCAL)',
    status: a.fluids.hasRelPerm ? 'ready' : 'absent',
    finding: a.fluids.hasRelPerm ? 'relative-permeability functions available' : 'not part of the static model',
    consequence: 'no two-phase flow without kr; it belongs to the PVT/SCAL step, and the handover must say whether it exists yet',
  });

  // ── regions ───────────────────────────────────────────────────────────────
  add({
    id: 'region.eqlnum', needs: 'initialisation', label: 'Equilibration regions',
    status: a.regions.eqlnum > 0 ? 'ready' : 'absent',
    finding: a.regions.eqlnum > 0 ? `${a.regions.eqlnum} region(s)` : 'no EQLNUM array produced',
    consequence: 'separate accumulations with their own contacts must equilibrate separately, or oil is placed below one pool’s spill and above another’s',
  });

  add({
    id: 'region.fipnum', needs: 'both', label: 'Fluid-in-place regions',
    status: a.regions.fipnum > 0 ? 'ready' : 'absent',
    finding: a.regions.fipnum > 0 ? `${a.regions.fipnum} region(s)` : 'no FIPNUM array produced',
    consequence: 'volumes cannot be reported per pool or per zone in the simulator, so a match cannot be attributed',
  });

  add({
    id: 'region.satnum', needs: 'both', label: 'Saturation regions',
    status: a.regions.satnum > 0 ? 'ready' : 'absent',
    finding: a.regions.satnum > 0 ? `${a.regions.satnum} region(s)` : 'no SATNUM array produced',
    consequence: 'every facies gets one rock curve, so sand and shale flow identically',
  });

  // ── the volume itself ─────────────────────────────────────────────────────
  const off = a.volumes.officialSm3;
  const ratio = off ? a.volumes.stoiipSm3 / off : null;
  add({
    id: 'vol.reconcile', needs: 'both', label: 'Volume vs published figure',
    status: ratio == null ? 'warn' : Math.abs(ratio - 1) <= 0.2 ? 'ready' : 'warn',
    finding: ratio == null
      ? `STOIIP ${(a.volumes.stoiipSm3 / 1e6).toFixed(2)} MMSm³ — no published figure to check against`
      : `STOIIP ${(a.volumes.stoiipSm3 / 1e6).toFixed(2)} MMSm³ = ${ratio.toFixed(2)}× the published ${(off! / 1e6).toFixed(2)}`,
    consequence: ratio != null && Math.abs(ratio - 1) > 0.2
      ? 'a model that does not reproduce the known in-place volume will not history-match without absorbing that error into the parameters'
      : undefined,
  });

  add({
    id: 'vol.method', needs: 'both', label: 'Grid vs map volume',
    status: Math.abs(a.volumes.reconcileDiff) < 0.1 ? 'ready' : 'warn',
    finding: `${(a.volumes.reconcileDiff * 100).toFixed(1)}% between the cell summation and the averaged form`,
    consequence: Math.abs(a.volumes.reconcileDiff) < 0.1 ? undefined
      : 'a large gap means the averages do not represent the grid; a volume quoted from either alone is a choice, not a result',
  });

  return items;
}

export interface AuditSummary {
  items: AuditItem[];
  blocked: number;
  warn: number;
  absent: number;
  ready: number;
  /** the model may be handed over only when nothing is blocked */
  handoverReady: boolean;
  verdict: string;
}

export function summarise(items: AuditItem[]): AuditSummary {
  const count = (s: AuditStatus) => items.filter((i) => i.status === s).length;
  const blocked = count('blocked'), warn = count('warn'), absent = count('absent'), ready = count('ready');
  const handoverReady = blocked === 0 && absent === 0;
  const verdict = blocked > 0
    ? `NOT READY — ${blocked} blocking gap${blocked === 1 ? '' : 's'} must be closed before the model can be initialised.`
    : absent > 0
      ? `CONDITIONAL — nothing is broken, but ${absent} required artifact${absent === 1 ? ' is' : 's are'} not produced at all. The dynamic model cannot start without them.`
      : warn > 0
        ? `READY WITH CAVEATS — ${warn} item${warn === 1 ? '' : 's'} the receiving engineer must be told about.`
        : 'READY — every check passes.';
  return { items, blocked, warn, absent, ready, handoverReady, verdict };
}

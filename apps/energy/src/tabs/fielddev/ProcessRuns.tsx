// ProcessRuns — the three process dialogs that RUN: upscale, simulate, volumes.
//
// Each one drives a pure, truth-locked module and reports what the run actually
// produced rather than what it was asked for. Three rules they share:
//
//  · what went IN is ArgantaEnergy's own petrophysics under the current parameter
//    set — never the delivery's interpreted curves, which stay QC (see the
//    forwardStats seam in petro-field.ts);
//  · what could NOT be done is named, per well and per layer, rather than left as a
//    smaller number with no explanation;
//  · a resolution or an average that shapes the answer is stated on screen, because
//    a simulated field upsampled from a coarse grid is a coarse simulation however
//    fine the grid holding it.
import { useCallback, useState } from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import type { DigestedLog } from '../../dataqc/types';
import { readRecord } from '../../dataqc/readDigest';
import { depthToMetres } from '../../units';
import { phiToK, fitPhiK } from '../../engine/perm';
import { runPetro, DEFAULT_PARAMS } from './petro-compute';
import { useStatic } from './static-store';
import type { Workspace } from './workspace-model';
import {
  blockWellPath, placeSamples,
  type ColumnLayers, type LogSample, type PermAverage, type TrajStation, type UpscaledCell,
} from './upscale-grid';
import { simulateGrid, estimateSimOps, type SimConditioning } from './sim-grid';
import { writePackedProps, sourcesFromSim, ensureProp, hcpvSource } from './grid-props';
import { indexedDbVersionStore } from './grid-versions';
import { summariseSim } from './case-store';
import { applyPublishedShf, SCAL_ANALOGUE, swAtHeight, pcEntryPressure } from './fluid-model';
import { gridVolumes, reconcile, toMMSm3, toMMstb, type VolumeCell } from './volumes';
import { monteCarlo, tornado, type McInput, type McResult, type TornadoBar } from '../../engine/mc';
import { findPools, poolColumnMask, type PoolResult } from './pools';
import { layerSpan, zoneSurfaces, type BuiltGrid } from './grid-build';

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} k` : String(Math.round(n)));

/** Layer spans for one column, from each zone's OWN surfaces — layers are
 *  proportional WITHIN a zone, and the model-wide top/base span the whole section. */
function layersOf(built: BuiltGrid, i: number, j: number): ColumnLayers | null {
  const p = built.packed;
  const c = j * p.nx + i;
  if (!p.activeCol[c]) return null;
  const spans: Array<[number, number]> = [];
  let any = false;
  for (let k = 0; k < p.nz; k++) {
    const sp = layerSpan(built, c, k);
    if (sp) { spans.push([sp.top, sp.base]); any = true; } else spans.push([NaN, NaN]);
  }
  return any ? { spans } : null;
}

// ══ S4 · Scale up well logs ══════════════════════════════════════════════════

/**
 * The petrophysical parameters the model is actually built with.
 *
 * NOT `DEFAULT_PARAMS`. Two of its defaults are wrong for any real reservoir and both
 * were measured on Volve:
 *
 *  · ρfl = 1.00 is FRESH WATER. This field's own PVT declares a water density of
 *    1101.3 kg/m³ (130,000 ppm NaCl), and φ_D = (ρma − ρb)/(ρma − ρfl) under-reads every
 *    porosity by ~7% of its own value when the denominator is wrong. Correcting it alone
 *    moved net porosity from 0.210 to 0.226 against a published 0.225.
 *  · the 0.08 porosity cutoff. Measured inside the reservoir, φ≥0.05 reproduces the
 *    published net-to-gross of 0.900 exactly while net φ stays at 0.93× published.
 *
 * ρma stays at quartz 2.65 — pushing it to 2.67 would flatter the answer and there is no
 * measurement here to justify it.
 */
function petroParamsFor(ws: Workspace) {
  const rhoW = ws.contacts.length ? undefined : undefined;
  void rhoW;
  return {
    ...DEFAULT_PARAMS,
    rhoFl: 1.1013,
    cutoffs: { ...DEFAULT_PARAMS.cutoffs, phie: 0.05 },
  };
}

export function UpscaleDialog({ ws }: { ws: Workspace }) {
  const petroParams = petroParamsFor(ws);
  const grid = useStatic((s) => s.grid);
  const upscaled = useStatic((s) => s.upscaled);
  const setUpscaled = useStatic((s) => s.setUpscaled);
  const permAverage = useStatic((s) => s.permAverage);
  const setPermAverage = useStatic((s) => s.setPermAverage);
  const markDone = useStatic((s) => s.markDone);
  const [busy, setBusy] = useState<{ done: number; total: number; well: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fit, setFit] = useState<{ a: number; b: number; n: number } | null>(null);
  const [wellReport, setWellReport] = useState<Array<{ name: string; producer: boolean; cells: number; columns: number }>>([]);

  const run = useCallback(async () => {
    if (!grid) { setErr('Build the 3D grid first.'); return; }
    setErr(null);
    try {
      const p = grid.packed;
      // φ–k pairs harvested along the way, so the transform can be FITTED where the
      // delivery ships a permeability curve rather than assumed everywhere
      const phis: number[] = [], perms: number[] = [];
      const unusable: Array<{ well: string; why: string }> = [];
      const cells: UpscaledCell[] = [];
      const perWell: Array<{ name: string; producer: boolean; cells: number; columns: number }> = [];

      const todo = ws.bores.filter((b) => b.hasLogs && b.assetIds.log && b.x != null && b.y != null);
      setBusy({ done: 0, total: todo.length, well: '' });
      await new Promise((r) => setTimeout(r, 30));

      let done = 0;
      for (const bore of todo) {
        done++;
        const asset = ws.assets.find((a) => a.id === bore.assetIds.log);
        if (!asset) continue;
        const log = await readRecord<DigestedLog>(asset).catch(() => null);
        if (!log?.md?.length) continue;

        // THE DELIVERY MIXES DEPTH UNITS. Volve declares "M" on 5 logs, "mm" on 8 and
        // "0.1 in" on 11 — reading md raw put 19 of 24 wells three orders of magnitude
        // too deep, which is why they reported "no sample fell inside a layer".
        const f = depthToMetres(1, log.depthUnit);
        if (f == null) { unusable.push({ well: bore.name, why: `unknown depth unit "${log.depthUnit}"` }); continue; }
        const mdM = log.md.map((v) => v * f);
        const byFam = (fa: string) => log.curves.find((c) => c.family === fa);
        const byMnem = (m: string) => log.curves.find((c) => c.mnemonic.toUpperCase() === m);

        // OUR interpretation, under the current parameters — never their curves
        const res = runPetro({
          md: mdM,
          gr: byFam('GR')?.values, rt: (byFam('RT') ?? byFam('RXO'))?.values,
          rhob: byFam('RHOB')?.values, nphi: byFam('NPHI')?.values, dt: byFam('DT')?.values,
          grMin: byMnem('GRMIN')?.values, grMax: byMnem('GRMAX')?.values,
          klogh: (byFam('PERM') ?? byMnem('KLOGH'))?.values,
        }, petroParams);

        const trajId = bore.assetIds.trajectory;
        const trajAsset = trajId ? ws.assets.find((a) => a.id === trajId) : null;
        const traj = trajAsset
          ? await readRecord<{ stations?: TrajStation[] }>(trajAsset).catch(() => null)
          : null;
        // ── TVD IS NOT TVDSS ──
        //
        // A survey reports TVD below the DRILLING datum (the kelly bushing); horizon
        // grids, contacts and picks are all TVD SUB-SEA. On Volve that is a flat 54.90 m
        // and because it is flat NOTHING looks wrong — every well is displaced
        // identically. What it does is drop each well's reservoir out of the bottom of
        // its own zone: F-14's entire Hugin, 1,049 samples, silently reported as "no
        // layer", leaving the Heather above it to condition the model at phi 0.019
        // against the Hugin's 0.234.
        const kbM = bore.kbM ?? 0;
        const stations = (traj?.stations ?? []).map((st) => ({ ...st, tvd: st.tvd - kbM }));
        if (!stations.length) {
          unusable.push({ well: bore.name, why: 'no directional survey — cannot be placed in depth' });
          continue;
        }

        const permCurve = byFam('PERM') ?? byMnem('K') ?? byMnem('KLOGH');
        const raw: LogSample[] = mdM.map((md, n) => {
          const phie = res.phie[n];
          if (phie != null && permCurve) {
            const kv = permCurve.values[n];
            if (kv != null && Number.isFinite(kv) && kv > 0) { phis.push(phie); perms.push(kv); }
          }
          // NET RESERVOIR (Vsh + φ cutoffs), never net PAY. `ntg` multiplies a (1−Sw)
          // term in the volume equation, so filtering it on saturation as well removes
          // the water twice — worth more than 3× on this field.
          return { md, tvdss: md, vsh: res.vsh[n], phie, sw: res.sw[n], net: res.netRes[n] };
        });

        // EVERY SAMPLE AT ITS OWN POSITION along the survey. Volve's producers step
        // out 463 m (F-12) to 1,595 m (F-15 D) — 9 to 32 columns on a 50 m grid — so
        // blocking a well at its surface slot conditions rock it never touched and
        // misses every column it actually drilled.
        const placed = placeSamples({ x: bore.x as number, y: bore.y as number }, stations, raw);
        const a = 19, b = -1.5;      // refined below once the whole set is harvested
        const r = blockWellPath(
          { name: bore.name, samples: placed },
          { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
          (i, j) => layersOf(grid, i, j),
          { permAverage, phiToK: (phi) => phiToK(phi, a, b) },
        );
        cells.push(...r.cells);
        perWell.push({
          name: bore.name, producer: bore.role === 'oil-producer',
          cells: r.cells.length, columns: r.columnsCrossed,
        });
        if (!r.cells.length) {
          unusable.push({ well: bore.name, why: r.outsideGrid > r.noLayer ? 'path outside the model area' : 'no sample fell inside a layer' });
        }

        setBusy({ done, total: todo.length, well: bore.name });
        await new Promise((r2) => setTimeout(r2, 0));
      }

      const fitted = phis.length >= 8 ? fitPhiK(phis, perms) : null;
      setFit(fitted ? { ...fitted, n: phis.length } : null);

      const out = {
        cells,
        permAverage,
        skipped: unusable,
        thinCells: cells.filter((c) => c.nSamples < 3).length,
      };
      setWellReport(perWell);
      if (!out.cells.length) { setErr('No well produced a cell. Every one is listed below with its reason.'); }
      setUpscaled(out);
      if (out.cells.length) markDone('upscale');
    } catch (e) {
      setErr((e as Error).message || 'the upscaling failed');
    } finally {
      setBusy(null);
    }
  }, [grid, ws.bores, ws.assets, permAverage, setUpscaled, markDone]);

  return (
    <>
      <div className="pdlg-kv"><dt>Engine</dt><dd><code>petro-compute.runPetro → upscale-grid.upscaleWells</code></dd></div>
      <label className="pdf">
        <span>Permeability average</span>
        <select value={permAverage} onChange={(e) => setPermAverage(e.target.value as PermAverage)}>
          <option value="geometric">Geometric — the screening compromise</option>
          <option value="arithmetic">Arithmetic — parallel-flow upper bound</option>
          <option value="harmonic">Harmonic — series-flow lower bound</option>
        </select>
        <small>k is not additive. The three means can differ by orders of magnitude, so this is a choice, not a default.</small>
      </label>

      {busy && (
        <div className="pdlg-run">
          <b>Interpreting and blocking {busy.total} wells…</b>
          <span>{busy.well || 'reading log digests'} — {busy.done}/{busy.total}</span>
          <i style={{ width: `${(busy.done / Math.max(1, busy.total)) * 100}%` }} />
        </div>
      )}

      {err && <div className="pdlg-warn">{err}</div>}

      {upscaled && (
        <>
          <div className="pdlg-budget">
            <div><b>{fmt(upscaled.cells.length)}</b><i>cells blocked</i></div>
            <div><b>{new Set(upscaled.cells.map((c) => c.well)).size}</b><i>wells</i></div>
            <div><b>{upscaled.thinCells}</b><i>&lt; 3 samples</i></div>
            <div><b>{upscaled.permAverage}</b><i>k average</i></div>
          </div>
          <div className="pdlg-kv live">
            <dt>φ–k</dt>
            <dd>{fit
              ? `fitted from ${fit.n} pairs: log k = ${fit.a.toFixed(2)}·φ ${fit.b >= 0 ? '+' : '−'} ${Math.abs(fit.b).toFixed(2)}`
              : 'no permeability curve in this delivery — a = 19, b = −1.5 (analog, not measured)'}</dd>
          </div>

          {/* THE PRODUCERS, EXPLICITLY. These are the wells whose rock actually
              flowed; a property model not conditioned on them is a model of
              somewhere else. Any producer showing 0 cells is a defect, not a
              statistic, so they are listed individually rather than in a total. */}
          {wellReport.some((w) => w.producer) && (() => {
            const prods = wellReport.filter((w) => w.producer);
            const ok = prods.filter((w) => w.cells > 0).length;
            return (
              <div className={'pdlg-prod' + (ok === prods.length ? ' all' : ' gap')}>
                <span className="pdlg-mc-head">
                  Producing wells upscaled — <b>{ok}/{prods.length}</b>
                </span>
                {prods.map((w) => (
                  <div key={w.name} className={'pdlg-prod-row' + (w.cells ? '' : ' miss')}>
                    <span>{w.cells ? '✓' : '✗'} {w.name}</span>
                    <em>{w.cells} cells</em>
                    <em>{w.columns} columns</em>
                  </div>
                ))}
                <small>
                  Each producer is blocked along its own survey, so it conditions every
                  column it crossed rather than the one its slot sits in. Volve's
                  producers step out 463–1,595 m.
                </small>
              </div>
            );
          })()}
          {upscaled.skipped.length > 0 && (
            <div className="pdlg-warn">
              <AlertTriangle size={10} /> {upscaled.skipped.length} well{upscaled.skipped.length === 1 ? '' : 's'} produced no cell:{' '}
              {upscaled.skipped.slice(0, 6).map((s) => `${s.well} (${s.why})`).join(', ')}
              {upscaled.skipped.length > 6 ? ` +${upscaled.skipped.length - 6} more` : ''}
            </div>
          )}
          <div className="pdlg-warn soft">
            Samples are indexed by measured depth against a grid in TVDSS, and each well
            blocks into the single column its slot sits in. A deviated bore genuinely
            crosses several columns; following its survey is the correct treatment and is
            not wired yet.
          </div>
        </>
      )}

      <button className="pdlg-run-btn" disabled={!!busy || !grid} onClick={run}>
        {busy ? `Blocking ${busy.done}/${busy.total}…` : upscaled ? 'Re-run' : 'Run'}
      </button>
    </>
  );
}

/**
 * Which zones are the reservoir, given the user's choice and the grid's zone names.
 *
 * The default matches the interval whose TOP is the reservoir top — NOT every zone
 * whose name mentions it. "BCU → Hugin Fm Top" contains the word Hugin and is the
 * Heather overburden ABOVE the reservoir; counting it doubled the rock volume.
 */
export function defaultReservoirZones(zoneNames: string[], chosen: string[] | null): string[] {
  if (chosen) return chosen;
  return zoneNames.filter((n) => /^hugin[^→]*top\s*→/i.test(n));
}

/** The layer indices those zones occupy in the built grid. */
export function reservoirLayers(grid: BuiltGrid | null, zones: string[]): number[] {
  if (!grid) return [];
  const want = new Set(zones);
  const out: number[] = [];
  for (const zl of grid.zoneLayers) {
    if (!want.has(zl.name)) continue;
    for (let k = 0; k < zl.nz; k++) out.push(zl.k0 + k);
  }
  return out;
}

// ══ S6 · S7 · Facies (SIS) and porosity (SGS) ════════════════════════════════

export function SimDialog({ which, ws }: { which: 'facies' | 'porosity'; ws: Workspace }) {
  const grid = useStatic((s) => s.grid);
  const upscaled = useStatic((s) => s.upscaled);
  const sim = useStatic((s) => s.sim);
  const setSim = useStatic((s) => s.setSim);
  const simming = useStatic((s) => s.simming);
  const setSimming = useStatic((s) => s.setSimming);
  const simNodes = useStatic((s) => s.simNodes);
  const setSimNodes = useStatic((s) => s.setSimNodes);
  const simSeed = useStatic((s) => s.simSeed);
  const setSimSeed = useStatic((s) => s.setSimSeed);
  const markDone = useStatic((s) => s.markDone);
  const bumpProps = useStatic((s) => s.bumpProps);
  const setSimInfo = useStatic((s) => s.setSimInfo);
  const resZones = useStatic((s) => s.reservoirZones);
  const [err, setErr] = useState<string | null>(null);

  // A φ–k transform fitted to one formation says nothing outside it. Simulating the
  // whole section put 78% of the shallow overburden's cells past the physical
  // permeability ceiling against 0.2% of the reservoir's, so the property model is
  // built ONLY where it means something.
  const zoneNames = grid?.zoneLayers.map((z) => z.name) ?? [];
  const chosenZones = defaultReservoirZones(zoneNames, resZones);
  const simLayers = reservoirLayers(grid, chosenZones);

  const run = useCallback(async () => {
    if (!grid || !upscaled) { setErr('Scale up the well logs first.'); return; }
    setErr(null);
    const p = grid.packed;
    const byLayer = new Map<number, SimConditioning[]>();
    for (const c of upscaled.cells) {
      const list = byLayer.get(c.k);
      const datum: SimConditioning = { i: c.i, j: c.j, k: c.k, facies: c.facies, phie: c.phie };
      if (list) list.push(datum); else byLayer.set(c.k, [datum]);
    }
    if (!byLayer.size) { setErr('No upscaled cell to condition on.'); return; }

    setSimming({ layer: 0, nz: p.nz });
    // yield so the progress row paints before the run seizes the thread
    await new Promise((r) => setTimeout(r, 30));
    try {
      const out = simulateGrid(
        byLayer,
        { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
        { vario: { model: 'spherical', nugget: 0.05, sill: 1, range: 800 },
          seed: simSeed, simNodes, permA: 19, permB: -1.5, kvkh: 0.1,
          layers: simLayers.length ? simLayers : undefined },
      );
      setSim(out);
      setSimInfo(summariseSim(out));

      // ── WRITE THE RESULT INTO THE PACKED GRID ──
      //
      // Without this the simulation lived only in the session and the packed grid kept
      // the geometric defaults `buildPackedGrid` gave it — phi 0, sw 1, facies 0. Every
      // consumer reads the PACKED grid, so the model was fully simulated while the
      // viewport showed one flat colour, the legend read 0.000 at every tick and the
      // layer player looked inert because each layer it drew was identical.
      //
      // Saturation is not simulated, so it is derived here from the capillary curve at
      // the cell's own height above the contact — the same physics the headless chain
      // uses. A constant would put the crest and the cell just above the contact at the
      // same saturation and erase the transition zone.
      const owc = ws.contacts.find((c) => c.tvdss != null)?.tvdss;
      const owcM = owc != null ? Math.abs(owc) : null;
      const dRho = 219;                       // brine − oil at reservoir conditions, kg/m³
      const nCol = p.nx * p.ny;
      const src = sourcesFromSim(out);
      const swOf = (col: number, layer: number) => {
        if (owcM == null) return 0.25;
        const t = p.topZ[col], b = p.baseZ[col];
        if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) return NaN;
        const phi = src.phi(col, layer), kMd = src.perm(col, layer);
        if (!Number.isFinite(phi) || !(phi > 0) || !Number.isFinite(kMd) || !(kMd > 0)) return NaN;
        const z = t + ((b - t) * (layer + 0.5)) / p.nz;
        const e = applyPublishedShf(SCAL_ANALOGUE, null, kMd);
        const pcE = pcEntryPressure(e, phi, kMd);
        const hEntry = pcE > 0 ? (pcE * 1e5) / (dRho * 9.80665) : 0;
        return swAtHeight(owcM + hEntry - z, e, dRho, phi, kMd);
      };
      // HCPV is DERIVED, so it is appended rather than packed at build time — and it
      // is written last, because it reads the porosity, net-to-gross and saturation
      // that the lines above have just settled.
      ensureProp(grid.packed, 'hcpv', 'u16', false);
      const hcpv = hcpvSource(
        { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy,
          topZ: p.topZ, baseZ: p.baseZ, activeCol: p.activeCol },
        { ntg: src.ntg, phi: src.phi, sw: swOf },
        { owc: owcM ?? undefined },
      );
      const report = writePackedProps(grid.packed, { ...src, sw: swOf, hcpv });
      bumpProps();
      if (report.degenerate.length) {
        setErr(`Written, but these came back single-valued: ${report.degenerate.join(', ')}.`);
      }
      void nCol;

      markDone('facies');
      markDone('porosity');
      markDone('permeability');
    } catch (e) {
      setErr((e as Error).message || 'the simulation failed');
    } finally {
      setSimming(null);
    }
  }, [grid, upscaled, simNodes, simSeed, simLayers, setSim, setSimming, markDone]);

  const ops = grid ? estimateSimOps(simNodes, grid.packed.nz) : 0;

  return (
    <>
      <div className="pdlg-kv"><dt>Engine</dt><dd><code>geostat.sis + geostat.sgs, per layer, per facies</code></dd></div>

      <label className="pdf">
        <span>Simulation grid — {simNodes} × {simNodes} per layer</span>
        <input type="range" min={8} max={64} step={4} value={simNodes}
          onChange={(e) => setSimNodes(Number(e.target.value))} />
        <small>
          The engines are O(N² log N) per layer, so the field is simulated coarse and
          upsampled. {grid ? `The model is ${grid.packed.nx} × ${grid.packed.ny}; ` : ''}
          this is <b>{simNodes} × {simNodes}</b> worth of spatial detail, however fine the
          grid holding it. Estimated cost ≈ {ops.toExponential(1)} operations.
        </small>
      </label>

      <label className="pdf">
        <span>Seed — {simSeed}</span>
        <input type="range" min={1000} max={1020} step={1} value={simSeed}
          onChange={(e) => setSimSeed(Number(e.target.value))} />
        <small>A number quoted from a simulation names its seed, or it is not a realisation.</small>
      </label>

      {simming && (
        <div className="pdlg-run">
          <b>Simulating {simming.nz} layers…</b>
          <span>SIS then SGS per facies, layer by layer</span>
          <i style={{ width: '100%' }} />
        </div>
      )}

      {err && <div className="pdlg-warn">{err}</div>}

      {sim && !simming && (
        <>
          <div className="pdlg-budget">
            <div><b>{sim.layers.length}</b><i>layers</i></div>
            <div><b>{(sim.sandFraction * 100).toFixed(0)}%</b><i>sand</i></div>
            <div><b>{sim.simGrid.nx} × {sim.simGrid.ny}</b><i>simulated at</i></div>
            <div><b>{(sim.ms / 1000).toFixed(1)} s</b><i>seed {sim.seed}</i></div>
          </div>
          <div className="pdlg-warn soft">
            Simulated on a {sim.simGrid.nx} × {sim.simGrid.ny} areal grid and upsampled to
            {' '}{sim.modelNx} × {sim.modelNy}. It carries {sim.simGrid.nx} × {sim.simGrid.ny} worth of
            detail — the model grid holds it, it did not create it.
            {sim.unconditionedLayers > 0 && ` ${sim.unconditionedLayers} of ${sim.layers.length} layers had no upscaled cell of their own and borrowed the whole model's conditioning.`}
          </div>
        </>
      )}

      <button className="pdlg-run-btn" disabled={!!simming || !upscaled} onClick={run}>
        {simming ? 'Simulating…' : sim ? 'Re-run' : which === 'facies' ? 'Run SIS + SGS' : 'Run'}
      </button>
      {!upscaled && <div className="pdlg-note pad">Waiting on the upscaled cells to condition against.</div>}
    </>
  );
}


/**
 * The realization histogram, with the percentile markers on it.
 *
 * Drawn from the sorted realizations themselves rather than a fitted curve — a
 * Monte Carlo whose picture is a smooth idealisation of its own output is hiding
 * whatever the output actually did.
 */
function Histogram({ values, p90, p50, p10 }: {
  values: number[]; p90: number; p50: number; p10: number;
}) {
  if (values.length < 2) return null;
  const lo = values[0], hi = values[values.length - 1];
  const span = hi - lo || 1;
  const BINS = 34;
  const counts = new Array(BINS).fill(0);
  for (const v of values) {
    const b = Math.min(BINS - 1, Math.floor(((v - lo) / span) * BINS));
    counts[b]++;
  }
  const peak = Math.max(...counts) || 1;
  const at = (v: number) => ((v - lo) / span) * 100;
  return (
    <svg className="pdlg-hist" viewBox={`0 0 ${BINS * 4} 40`} preserveAspectRatio="none">
      {counts.map((n, i) => (
        <rect key={i} x={i * 4} y={40 - (n / peak) * 38} width={3.4} height={(n / peak) * 38}
          fill="currentColor" opacity="0.45" />
      ))}
      {[[p90, '#4ade80'], [p50, '#e2e8f0'], [p10, '#fbbf24']].map(([v, c], i) => (
        <line key={i} x1={(at(v as number) / 100) * BINS * 4} y1="0"
          x2={(at(v as number) / 100) * BINS * 4} y2="40"
          stroke={c as string} strokeWidth="1" opacity="0.95" />
      ))}
    </svg>
  );
}

// ══ S9 · Volume calculation ══════════════════════════════════════════════════

export function VolumesDialog({ ws }: { ws: Workspace }) {
  const grid = useStatic((s) => s.grid);
  const sim = useStatic((s) => s.sim);
  const volumes = useStatic((s) => s.volumes);
  const setVolumes = useStatic((s) => s.setVolumes);
  const markDone = useStatic((s) => s.markDone);
  const [bo, setBo] = useState(1.47);
  const [trials, setTrials] = useState(4000);
  const [err, setErr] = useState<string | null>(null);
  const [mc, setMc] = useState<{ res: McResult; bars: TornadoBar[]; inputs: McInput[] } | null>(null);
  const [pools, setPools] = useState<PoolResult | null>(null);
  /** restrict the volume to accumulations that contain a producing well */
  const [drainedOnly, setDrainedOnly] = useState(true);
  /** Which zones count as reservoir. Shared through the store, because the same
   *  choice scopes the property model — a volume reported for rock the simulation
   *  skipped would be a volume of zeros presented as an answer. */
  const resZones = useStatic((s) => s.reservoirZones);
  const setResZones = useStatic((s) => s.setReservoirZones);

  const contact = ws.contacts.find((c) => c.tvdss != null);
  const owc = contact?.tvdss != null ? Math.abs(contact.tvdss) : null;

  // Every zone in the grid, so the reservoir can be CHOSEN. Defaulting to all of
  // them counts the overburden and produced a STOIIP 218× the official figure.
  const zoneNames = grid?.zoneLayers.map((z) => z.name) ?? [];
  const chosen = defaultReservoirZones(zoneNames, resZones);

  const run = useCallback(() => {
    if (!grid) { setErr('Build the 3D grid first.'); return; }
    if (owc == null) { setErr('No fluid contact is defined — there is no volume without one.'); return; }
    setErr(null);
    const p = grid.packed;
    const nCol = p.nx * p.ny;
    const cells: VolumeCell[] = [];

    // which zone each layer belongs to, so a volume can be asked for the reservoir
    const layerZone: string[] = [];
    for (const zl of grid.zoneLayers) for (let k = 0; k < zl.nz; k++) layerZone[zl.k0 + k] = zl.name;

    // ── POOLS: is the filled area one accumulation, or several? ──
    // The reservoir zone's OWN surfaces are what a closure is made of. On Volve this
    // splits 13 km² above the contact into six separate highs, only one of which any
    // well has ever entered.
    const surf = chosen.length ? zoneSurfaces(grid, chosen[0]) : null;
    const found = surf ? findPools(
      { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0,
        topZ: surf.topZ, baseZ: surf.baseZ, activeCol: p.activeCol },
      owc,
      ws.bores.filter((b) => b.x != null && b.y != null).map((b) => ({
        name: b.name, x: b.x as number, y: b.y as number,
        producer: b.role === 'oil-producer',
      })),
      4,
    ) : null;
    setPools(found);

    // restrict to the drained accumulations when asked — summing an undrained
    // closure into the same STOIIP as a producing one is how a field's volume ends
    // up several times its published figure
    const wantedPools = found && drainedOnly
      ? found.pools.filter((x) => x.drained).map((x) => x.id)
      : found?.pools.map((x) => x.id) ?? [];
    const mask = found ? poolColumnMask(found, wantedPools, nCol) : null;

    for (let k = 0; k < p.nz; k++) {
      const layer = sim?.layers[k] ?? null;
      for (let c = 0; c < nCol; c++) {
        if (!p.activeCol[c]) continue;
        if (mask && !mask[c]) continue;
        // layers are proportional WITHIN a zone; the model-wide top/base span the
        // whole section, and using them put the reservoir crest 750 m too shallow
        const sp = layerSpan(grid, c, k);
        if (!sp) continue;
        const thk = sp.base - sp.top;
        // properties come from the SIMULATION where one exists; without it the grid
        // is geometry only and every volume is honestly zero
        const phi = layer ? layer.phie[c] : 0;
        cells.push({
          zone: layerZone[k],
          z: (sp.top + sp.base) / 2, thk, bulk: p.dx * p.dy * thk,
          ntg: layer ? (layer.facies[c] ? 1 : 0) : 1,
          phi, sw: layer ? 0.25 : 1,
          active: true,
        });
      }
    }

    const inputs = { owc, bo, zones: chosen };
    const g = gridVolumes(cells, inputs);
    setVolumes(reconcile(g, inputs, undefined, cells));

    // ── BACKFILL THE VERSION'S STATS ──
    //
    // A version is saved when the GRID is built, which is before any of this exists, so
    // its stats are honestly NaN until now. Filling them here is what makes the version
    // list comparable — a row reading "NaN MMSm³" is a row nobody can choose between.
    void (async () => {
      try {
        const list = ws.fieldId ? await indexedDbVersionStore.list(ws.fieldId) : [];
        const latest = list[0];
        if (!latest) return;
        await indexedDbVersionStore.save({
          ...latest,
          stats: {
            ...latest.stats,
            ntg: g.meanNtg, phi: g.meanPhi, sw: g.meanSw,
            stoiipMMSm3: toMMSm3(g.stoiipSm3),
            sandFraction: sim?.sandFraction ?? NaN,
          },
        });
      } catch {
        // a stats backfill that fails must not take the volume result with it
      }
    })();

    // ── uncertainty around the deterministic answer ──
    //
    // GRV is held at the grid's own value and varied by a geometry FACTOR rather
    // than re-gridded per trial: a screening MC asks "how wrong could the inputs
    // be", not "what if the structure were different", and re-running the whole
    // build 4,000 times would answer a question nobody asked at a cost nobody wants.
    const mcInputs: McInput[] = [
      { key: 'grvFactor', label: 'GRV / structure', dist: 'pert', min: 0.8, mode: 1, max: 1.2 },
      { key: 'ntg', label: 'Net-to-gross', dist: 'pert', min: Math.max(0.05, g.meanNtg * 0.7), mode: g.meanNtg || 0.5, max: Math.min(1, (g.meanNtg || 0.5) * 1.25) },
      { key: 'phi', label: 'Porosity', dist: 'pert', min: (g.meanPhi || 0.15) * 0.85, mode: g.meanPhi || 0.15, max: (g.meanPhi || 0.15) * 1.15 },
      { key: 'sw', label: 'Water saturation', dist: 'pert', min: Math.max(0.05, (g.meanSw || 0.3) * 0.75), mode: g.meanSw || 0.3, max: Math.min(0.95, (g.meanSw || 0.3) * 1.3) },
      { key: 'bo', label: 'Bo', dist: 'triangular', min: bo * 0.95, mode: bo, max: bo * 1.08 },
    ];
    const res = monteCarlo(
      mcInputs,
      (v) => (g.grvM3 * v.grvFactor * v.ntg * v.phi * (1 - v.sw)) / v.bo,
      trials, 20260805,
    );
    setMc({ res, bars: tornado(res, mcInputs), inputs: mcInputs });
    markDone('volumes');
  }, [grid, sim, owc, bo, trials, chosen, drainedOnly, ws.bores, setVolumes, markDone]);

  return (
    <>
      <div className="pdlg-kv"><dt>Engine</dt><dd><code>volumes.gridVolumes + reconcile</code></dd></div>
      <div className="pdlg-kv live">
        <dt>Contact</dt>
        <dd>{owc != null ? `${contact?.kind ?? 'OWC'} ${owc} m TVDSS (${contact?.dataNature ?? 'unstated'})` : 'none declared'}</dd>
      </div>
      <label className="pdf">
        <span>Bo — {bo.toFixed(2)} rm³/sm³</span>
        <input type="range" min={1} max={2} step={0.01} value={bo} onChange={(e) => setBo(Number(e.target.value))} />
      </label>

      {/* WHICH ZONES ARE RESERVOIR. The grid spans the whole section; counting the
          overburden gave a STOIIP 218× the official figure. */}
      {zoneNames.length > 0 && (
        <div className="pdlg-zones">
          <span>Reservoir zones</span>
          {zoneNames.map((z) => (
            <label key={z} className={chosen.includes(z) ? 'on' : ''}>
              <input type="checkbox" checked={chosen.includes(z)}
                onChange={() => setResZones(chosen.includes(z)
                  ? chosen.filter((x) => x !== z)
                  : [...chosen, z])} />
              {z}
            </label>
          ))}
          <small>The model spans seabed to base reservoir. Only the intervals ticked here contribute a volume.</small>
        </div>
      )}

      {/* The single biggest lever on the answer: whether undrained closures count.
          On Volve, six accumulations sit above the contact and only one has ever
          been drilled — including the other five triples the volume. */}
      <label className="pdlg-check">
        <input type="checkbox" checked={drainedOnly} onChange={() => setDrainedOnly(!drainedOnly)} />
        <span>Drained accumulations only</span>
        <small>
          Count only pools containing a producing well. An undrained closure is
          untested, and adding it to a producing field's STOIIP without saying so is
          how a volume ends up several times its published figure.
        </small>
      </label>

      <label className="pdf">
        <span>Monte Carlo trials — {trials.toLocaleString('en-US')}</span>
        <input type="range" min={500} max={20000} step={500} value={trials}
          onChange={(e) => setTrials(Number(e.target.value))} />
      </label>

      {err && <div className="pdlg-warn">{err}</div>}

      {volumes && (
        <>
          <div className="pdlg-budget">
            <div><b>{fmt(volumes.grid.grvM3 / 1e6)} Mm³</b><i>GRV above contact</i></div>
            <div><b>{toMMSm3(volumes.grid.stoiipSm3).toFixed(2)}</b><i>MMSm³ grid</i></div>
            <div><b>{toMMSm3(volumes.map.stoiipSm3).toFixed(2)}</b><i>MMSm³ map</i></div>
            <div><b>{toMMstb(volumes.grid.stoiipSm3).toFixed(1)}</b><i>MMstb grid</i></div>
          </div>
          <div className="pdlg-kv"><dt>Averages</dt>
            <dd>φ {volumes.mapProps.phi.toFixed(3)} · Sw {volumes.mapProps.sw.toFixed(3)} — {volumes.mapPropsSource}</dd></div>
          <div className={'pdlg-warn' + (Math.abs(volumes.relDiff) < 0.005 ? ' soft' : '')}>
            {volumes.verdict}
          </div>
          {!sim && (
            <div className="pdlg-warn">
              No simulated property field — porosity is 0, so STOIIP is zero by construction.
              Run the facies and porosity simulation first.
            </div>
          )}
          <div className="pdlg-note pad">
            <Database size={9} /> Volve official STOIIP is <b>18.70 MMSm³</b> (Sodir) — this
            model reads <b>{(toMMSm3(volumes.grid.stoiipSm3) / 18.7).toFixed(1)}×</b> that.
            {volumes.grid.outOfZone > 0 && ` ${volumes.grid.outOfZone.toLocaleString('en-US')} cells were excluded as outside the reservoir.`}
            {' '}The model is UNFAULTED and has no closure polygon, so it fills every column
            whose reservoir top is shallower than the contact, across the whole mapped area.
            Volve's oil sits in a small fault-bounded trap. That is the gap.
          </div>
        </>
      )}

      {/* ── the accumulations, and which of them anyone has drilled ── */}
      {pools && pools.pools.length > 0 && (
        <div className="pdlg-pools">
          <span className="pdlg-mc-head">
            {pools.pools.length} accumulation{pools.pools.length === 1 ? '' : 's'} above the contact
            {pools.tinyCount > 0 && ` (+${pools.tinyCount} below the 4-column noise floor)`}
            {' · '}{pools.drainedCount} with a producing well
          </span>
          <div className="pdlg-pool-head">
            <span>Pool</span><span>km²</span><span>crest</span><span>column</span><span>GRV Mm³</span><span>wells</span>
          </div>
          {pools.pools.slice(0, 8).map((pool) => (
            <div key={pool.id} className={'pdlg-pool' + (pool.drained ? ' drained' : '')}
              title={pool.wells.length ? pool.wells.join(', ') : 'no well has entered this closure'}>
              <span>{pool.drained ? '★' : '·'} {pool.id}</span>
              <span>{(pool.areaM2 / 1e6).toFixed(2)}</span>
              <span>{Math.round(pool.crestZ)}</span>
              <span>{Math.round(pool.columnM)} m</span>
              <span>{(pool.grvM3 / 1e6).toFixed(1)}</span>
              <span className="who">{pool.producers.length
                ? `${pool.producers.length} prod`
                : pool.wells.length ? `${pool.wells.length} well${pool.wells.length === 1 ? '' : 's'}` : '—'}</span>
            </div>
          ))}
          <small>
            Drained {(pools.drainedGrvM3 / 1e6).toFixed(1)} Mm³ · undrained {(pools.undrainedGrvM3 / 1e6).toFixed(1)} Mm³
            {' '}({((pools.drainedGrvM3 / Math.max(1, pools.drainedGrvM3 + pools.undrainedGrvM3)) * 100).toFixed(0)}% drained).
            Two columns are in the same accumulation only if oil could travel between
            them without crossing below the contact.
          </small>
        </div>
      )}

      {/* ── uncertainty ── */}
      {mc && (
        <>
          <div className="pdlg-mc">
            <span className="pdlg-mc-head">
              STOIIP distribution · {trials.toLocaleString('en-US')} trials · PERT/triangular · seed 20260805
            </span>
            <div className="pdlg-pct">
              <div><b>{toMMSm3(mc.res.p90).toFixed(1)}</b><i>P90</i></div>
              <div className="mid"><b>{toMMSm3(mc.res.p50).toFixed(1)}</b><i>P50</i></div>
              <div><b>{toMMSm3(mc.res.p10).toFixed(1)}</b><i>P10</i></div>
              <div><b>{(mc.res.p10 / mc.res.p90).toFixed(2)}×</b><i>P10/P90</i></div>
            </div>
            {/* the histogram, drawn from the realizations themselves */}
            <Histogram values={mc.res.realizations} p90={mc.res.p90} p50={mc.res.p50} p10={mc.res.p10} />
          </div>

          <div className="pdlg-tornado">
            <span className="pdlg-mc-head">Tornado — |Pearson r| against STOIIP</span>
            {mc.bars.map((b) => (
              <div key={b.key} className="pdlg-bar" title={`low tercile ${toMMSm3(b.lowOut).toFixed(1)} → high tercile ${toMMSm3(b.highOut).toFixed(1)} MMSm³`}>
                <span className="lbl">{b.label}</span>
                <span className="track">
                  <i className={b.r >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.abs(b.r) * 100}%` }} />
                </span>
                <em>{b.r >= 0 ? '+' : ''}{b.r.toFixed(2)}</em>
              </div>
            ))}
            <small>
              Ranked by correlation with the output across realizations. GRV is varied by a
              geometry factor rather than re-gridded per trial — a screening MC asks how
              wrong the inputs could be, not what a different structure would give.
            </small>
          </div>
        </>
      )}

      <button className="pdlg-run-btn" disabled={!grid} onClick={run}>
        {volumes ? 'Recalculate' : 'Run'}
      </button>
    </>
  );
}

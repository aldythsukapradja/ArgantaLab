// Streamline — the saved dynamic run, read as drainage.
//
// ── WHAT THIS SURFACE IS FOR ────────────────────────────────────────────────
//
// A cell field says where the water IS. It cannot say whose water it is. This answers
// the question a waterflood is managed on: which injector supports which producer, how
// much of each injector's water arrives anywhere useful, and how long it takes.
//
// ── IT NEVER RE-SOLVES ──────────────────────────────────────────────────────
//
// It reads the run the Simulation saved, and refuses to draw anything if there is
// none. Tracing a fresh solve would be tracing a DIFFERENT realisation of the same
// recipe — the lines would quietly disagree with the saturation animation one tab
// over, and nothing on either screen would say so. The whole point of the shared
// v0 basis is that the three surfaces describe the same rock.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Waves } from 'lucide-react';
import { StudioShell, TreeBranch, TreeRow, TreeEmpty, TreeFacts, type StudioView } from './studio-shell';
import { indexedDbRunStore, type StoredRun } from './run-store';
import { geomOf, wellCellsOf, drainage, tofStats, thin } from './streamlines';
import { traceStreamlines, type StreamResult } from '../../engine/sim/streamline';
import { useThemeInk } from './theme-ink';
import { GeaStudio } from './GeaStudio';
import { StreamlineLayer } from './StreamlineLayer';
import { useWorkspace } from './workspace';
import { useV0Basis } from './use-v0';
import type { SearchEntry } from '../../cosmo/cockpit-search';

const VIEWS: StudioView[] = [
  // The drainage map IS the 3D one: streamlines only mean something read against the
  // structure they are flowing through, and a flat map throws that away. The 2D plan
  // stays because a plan view is the right shape for judging PATTERN — spacing,
  // symmetry, gaps — which perspective distorts.
  { id: '3d', label: 'Drainage', hint: 'The drainage map, in the same 3D viewport as the grid, structure and well trajectories' },
  { id: 'map', label: 'Plan view', hint: 'The same streamlines from directly above — the right shape for judging pattern and spacing' },
  { id: 'allocation', label: 'Allocation', hint: 'Which injector supports which producer, and how much is lost' },
  { id: 'tof', label: 'Time of flight', hint: 'How long injected water takes to arrive' },
];

/** one hue per producer, so a line's colour names its destination */
const hueFor = (i: number) => `hsl(${(i * 61 + 18) % 360} 72% 58%)`;

export function Streamline({ field }: { field: SearchEntry }) {
  const { ws, ready } = useWorkspace();
  // THE GRID THE 3D VIEWPORT DRAWS. Without this the Drainage view rendered an empty
  // canvas and read as "there is no 3D here" rather than "there is no grid loaded".
  const basis = useV0Basis(ws, ready);
  const ink = useThemeInk();
  const [view, setView] = useState('3d');
  const [run, setRun] = useState<StoredRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stepIx, setStepIx] = useState<number | null>(null);
  // Denser than the tracer's own default of 24. A waterflood's drainage pattern is a
  // FAN, and a fan drawn with two dozen lines reads as a handful of arbitrary paths;
  // it takes a few hundred before the shape of the sweep — and the gaps in it — become
  // the thing you see. Cost is linear and the tracing is milliseconds.
  const [perInj, setPerInj] = useState(96);
  const [maxDraw, setMaxDraw] = useState(2400);

  // the SAME record the Simulation wrote. v0, always — one grid for the vertical.
  useEffect(() => {
    if (!ready || !ws.fieldId) return;
    let alive = true;
    (async () => {
      const all = await indexedDbRunStore.list(ws.fieldId);
      if (!alive) return;
      setRun(all.find((r) => r.gridVersionId === 'v0') ?? all[0] ?? null);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [ready, ws.fieldId]);

  // trace at the chosen report step — the flux field evolves, and so does the drainage
  const ix = run ? Math.max(0, Math.min(run.fluxX.length - 1, stepIx ?? run.fluxX.length - 1)) : 0;
  const traced = useMemo<StreamResult | null>(() => {
    if (!run || !run.fluxX.length) return null;
    return traceStreamlines(geomOf(run), run.fluxX[ix], run.fluxY[ix], wellCellsOf(run), { perInjector: perInj });
  }, [run, ix, perInj]);

  const wells = useMemo(() => (run ? wellCellsOf(run) : []), [run]);
  const drain = useMemo(() => (traced ? drainage(traced, wells) : null), [traced, wells]);
  const tof = useMemo(() => (traced ? tofStats(traced) : null), [traced]);

  const producers = useMemo(() => wells.filter((w) => w.kind === 'prod').map((w) => w.name), [wells]);
  const colourOf = useMemo(() => {
    const m = new Map<string, string>();
    producers.forEach((p, i) => m.set(p, hueFor(i)));
    return m;
  }, [producers]);

  const subtitle = !loaded
    ? 'looking for a saved run…'
    : run
      ? `${field.name} · on ${run.gridVersionId} · ${run.placed.length} wells · day ${run.times[ix]?.toFixed(0)}`
      : `${field.name} · no saved run`;

  return (
    <StudioShell
      subtitle={subtitle}
      progress={traced && (
        <span className="sms-progress" title="Streamlines traced from the saved flux field">
          <Waves size={10} /> {traced.lines.length} lines
        </span>
      )}
      tree={
        <div className="mt">
          <div className="mt-head">Streamline</div>
          <TreeBranch id="src" icon={<Waves size={13} />} label="Source run"
            affects="traced from the run the Simulation SAVED — never a fresh solve, or the lines would describe a different realisation">
            {run
              ? (
                <TreeFacts>
                  <span>{run.gridVersionId}</span>
                  <span>{run.times.length} steps</span>
                  <span>{new Date(run.savedAt).toLocaleDateString()}</span>
                </TreeFacts>
              )
              : <TreeEmpty>none — run the case in Simulation first</TreeEmpty>}
          </TreeBranch>

          <TreeBranch id="inj" icon={<Waves size={13} />} label="Injectors"
            count={`${wells.filter((w) => w.kind === 'inj').length}`}
            affects="every injector seeds streamlines; only injectors do">
            {wells.filter((w) => w.kind === 'inj').length
              ? wells.filter((w) => w.kind === 'inj').map((w) => (
                <TreeRow key={w.name} on onToggle={() => {}} label={w.name} right="INJ" />
              ))
              : <TreeEmpty>no injector in the run</TreeEmpty>}
          </TreeBranch>

          <TreeBranch id="prod" icon={<Waves size={13} />} label="Producers"
            count={`${producers.length}`}
            affects="a line's colour is the producer it reaches">
            {producers.length
              ? producers.map((p) => (
                <div key={p} className="mt-chain">
                  <span><i className="sl-swatch" style={{ background: colourOf.get(p) }} />{p}</span>
                  <em>{drain?.unsupported.includes(p) ? 'unsupported' : ''}</em>
                </div>
              ))
              : <TreeEmpty>no producer in the run</TreeEmpty>}
          </TreeBranch>

          <TreeBranch id="tof" icon={<Waves size={13} />} label="Time of flight" defaultOpen={false}>
            {tof && tof.n
              ? (
                <TreeFacts>
                  <span>P50 {fmtD(tof.p50)}</span>
                  <span>P90 {fmtD(tof.p90)}</span>
                  <span>{tof.unswept} lines reach nobody</span>
                </TreeFacts>
              )
              : <TreeEmpty>nothing traced</TreeEmpty>}
          </TreeBranch>
        </div>
      }
      views={VIEWS}
      view={view}
      onView={setView}
      toolbar={run && (
        <span className="sim-toolbar">
          <label>step
            <input type="range" min={0} max={Math.max(0, run.fluxX.length - 1)} step={1}
              value={ix} onChange={(e) => setStepIx(Number(e.target.value))} style={{ width: 120 }} />
          </label>
          <span className="sim3d-t">day {run.times[ix]?.toFixed(0)}</span>
          <label title="Streamlines seeded per injector — more resolves the pattern, fewer draws faster">
            per inj
            <input type="number" min={4} max={256} step={8} value={perInj}
              onChange={(e) => setPerInj(Math.max(4, Math.min(256, Number(e.target.value) || 96)))} />
          </label>
        </span>
      )}
    >
      {!loaded ? <Blank>Looking for a saved run…</Blank>
        : !run ? (
          <Blank>
            No saved run for this field. Open <b>Simulation</b>, press Run once, and it
            is stored — this surface traces that run rather than solving its own, so the
            drainage and the saturation animation always describe the same flood.
          </Blank>
        )
        : view === '3d' ? (
          <div className="sim3d">
            {!basis.ready && (
              <div className="sim-empty"><em>{basis.note ?? 'loading the v0 grid…'}</em></div>
            )}
            <div className="sim3d-canvas" style={{ display: basis.ready ? undefined : 'none' }}>
              {/* THE SAME VIEWPORT. Not a second 3D scene beside it: the lines have to
                  be read against the structure, the grid and the trajectories, and two
                  canvases can disagree about camera, exaggeration and origin without
                  anything on screen saying so. */}
              <GeaStudio ws={ws} onStats={() => {}}
                overlay={(f) => (traced ? (
                  <StreamlineLayer frame={f} run={run} lines={thin(traced, maxDraw).lines}
                    colourOf={colourOf} maxTof={traced.maxTof} />
                ) : null)} />
            </div>
            <p className="sim-note">
              Drawn in the Static Model's own viewport, so the drainage is read against
              the grid and the well paths. Colour is the producer a line reaches; grey
              reaches nobody. Faster paths are drawn brighter — they are the ones that
              control breakthrough.
              {!run.grid.topZ && ' This run carries no structure, so the lines are draped flat.'}
            </p>
          </div>
        )
        : view === 'map' ? (
          <MapPane run={run} traced={traced} colourOf={colourOf} ink={ink}
            maxDraw={maxDraw} onMaxDraw={setMaxDraw} />
        )
        : view === 'allocation' ? <AllocationPane drain={drain} colourOf={colourOf} />
        : <TofPane tof={tof} traced={traced} />}
    </StudioShell>
  );
}

function MapPane({ run, traced, colourOf, ink, maxDraw, onMaxDraw }: {
  run: StoredRun; traced: StreamResult | null;
  colourOf: Map<string, string>; ink: ReturnType<typeof useThemeInk>;
  maxDraw: number; onMaxDraw: (n: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 700, h: 520 });
  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      for (const e of es) setBox({ w: Math.max(200, e.contentRect.width), h: Math.max(200, e.contentRect.height) });
    });
    if (wrap.current) obs.observe(wrap.current);
    return () => obs.disconnect();
  }, []);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const shown = useMemo(() => (traced ? thin(traced, maxDraw) : null), [traced, maxDraw]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!shown) return;

    const wM = run.grid.nx * run.grid.dx, hM = run.grid.ny * run.grid.dy;
    const sc = Math.min(W / wM, H / hM) * 0.92;
    const ox = (W - wM * sc) / 2, oy = (H - hM * sc) / 2;
    const px = (x: number) => ox + (x - run.grid.x0) * sc;
    const py = (y: number) => oy + hM * sc - (y - run.grid.y0) * sc;

    // the active area, so the lines are read against the field's own outline
    ctx.fillStyle = ink.panel;
    for (let j = 0; j < run.grid.ny; j++) for (let i = 0; i < run.grid.nx; i++) {
      if (!run.grid.activeCol[j * run.grid.nx + i]) continue;
      ctx.fillRect(px(run.grid.x0 + i * run.grid.dx), py(run.grid.y0 + (j + 1) * run.grid.dy),
        run.grid.dx * sc + 1, run.grid.dy * sc + 1);
    }

    // A LINE'S COLOUR IS ITS DESTINATION. A line that reaches nobody is drawn faint and
    // grey — it is injection that supports nothing, and it must not read as sweep.
    ctx.lineWidth = 1.1 * dpr;
    for (const l of shown.lines) {
      if (l.pts.length < 2) continue;
      const c = l.toWell ? colourOf.get(l.toWell) : null;
      ctx.strokeStyle = c ?? ink.axis;
      ctx.globalAlpha = c ? 0.75 : 0.22;
      ctx.beginPath();
      ctx.moveTo(px(l.pts[0][0]), py(l.pts[0][1]));
      for (let i = 1; i < l.pts.length; i++) ctx.lineTo(px(l.pts[i][0]), py(l.pts[i][1]));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const w of run.placed) {
      const x = px(run.grid.x0 + (w.i + 0.5) * run.grid.dx);
      const y = py(run.grid.y0 + (w.j + 0.5) * run.grid.dy);
      ctx.beginPath(); ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = w.kind === 'injector' ? '#5ac8fa' : '#ff6b4a';
      ctx.fill();
      ctx.lineWidth = 1.4 * dpr; ctx.strokeStyle = ink.tipBg; ctx.stroke();
      ctx.fillStyle = ink.axis; ctx.font = `${9.5 * dpr}px ui-monospace,monospace`;
      ctx.fillText(w.name, x + 7 * dpr, y + 3 * dpr);
    }
  }, [shown, run, colourOf, ink, dpr, box]);

  return (
    <div className="sl">
      <div className="sl-canvas" ref={wrap}>
        <canvas ref={ref} width={Math.round(box.w * dpr)} height={Math.round(box.h * dpr)} />
      </div>
      <p className="sim-note">
        A line's colour is the producer it reaches; grey lines reach nobody and are
        injection supporting nothing.
        {shown && shown.dropped > 0 && (
          <> {shown.dropped} of {(traced?.lines.length ?? 0)} lines are not drawn —
            thinning is a display choice, not a result.{' '}
            <button className="sl-more" onClick={() => onMaxDraw(maxDraw * 2)}>draw more</button>
          </>
        )}
      </p>
    </div>
  );
}

function AllocationPane({ drain, colourOf }: {
  drain: ReturnType<typeof drainage> | null; colourOf: Map<string, string>;
}) {
  if (!drain) return <Blank>Nothing traced.</Blank>;
  return (
    <div className="sim-scroll">
      <section className="sim-block">
        <h4>Injector support</h4>
        <table className="sim-table sl-table">
          <thead><tr><th>Injector</th><th>Producer</th><th>Share</th></tr></thead>
          <tbody>
            {drain.rows.map((r) => (
              <tr key={`${r.injector}-${r.producer}`}>
                <th>{r.injector}</th>
                <td><i className="sl-swatch" style={{ background: colourOf.get(r.producer) }} />{r.producer}</td>
                <td>
                  <span className="sl-bar"><i style={{ width: `${r.fraction * 100}%`, background: colourOf.get(r.producer) }} /></span>
                  {(r.fraction * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sim-block">
        <h4>Where the injection goes</h4>
        <table className="sim-table">
          <tbody>
            {drain.captured.map((c) => (
              <tr key={c.injector}>
                <th>{c.injector}</th>
                <td>{(c.captured * 100).toFixed(0)}% reaches a producer · <b className="sl-lost">{(c.lost * 100).toFixed(0)}% does not</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* the lost fraction is the most useful number here and is never normalised away */}
        <p className="sim-note">
          Water that reaches no producer has gone to the aquifer, out of the model, or
          into a stagnant region. It is reported rather than renormalised: renormalising
          would hide exactly the injection that is being wasted.
        </p>
      </section>

      {(drain.unsupported.length > 0 || drain.orphaned.length > 0) && (
        <div className="sim-assume">
          <b>Gaps in the pattern</b>
          {drain.unsupported.length > 0 && <em>no injector reaches {drain.unsupported.join(', ')}</em>}
          {drain.orphaned.length > 0 && <em>{drain.orphaned.join(', ')} support nothing</em>}
        </div>
      )}
    </div>
  );
}

function TofPane({ tof, traced }: { tof: ReturnType<typeof tofStats> | null; traced: StreamResult | null }) {
  if (!tof || !tof.n) return <Blank>No streamline reached a producer, so there is no travel time to report.</Blank>;
  return (
    <div className="sim-scroll">
      <div className="sim-kpis">
        <Kpi label="P10 — the fast paths" value={fmtD(tof.p10)} />
        <Kpi label="P50 — the median arrival" value={fmtD(tof.p50)} />
        <Kpi label="P90 — the slow tail" value={fmtD(tof.p90)} />
        <Kpi label="Lines reaching nobody" value={String(tof.unswept)} />
      </div>
      <p className="sim-note">
        Reported as a MEDIAN, not a mean. Streamline travel time is strongly
        right-skewed — a few lines wander into stagnant corners and carry enormous
        times — so a mean describes a sweep slower than the one doing the work.
        Here the maximum is {fmtD(tof.max)} against a median of {fmtD(tof.p50)}.
      </p>
      <p className="sim-note">
        {tof.n} of {traced?.lines.length ?? 0} traced lines arrive somewhere.
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="sim-kpi"><b>{value}</b><span>{label}</span></div>;
}
function Blank({ children }: { children: React.ReactNode }) {
  return <div className="sim-empty"><em>{children}</em></div>;
}

const fmtD = (d: number) => {
  if (!Number.isFinite(d)) return '—';
  if (d >= 365) return `${(d / 365).toFixed(1)} yr`;
  return `${d.toFixed(0)} d`;
};

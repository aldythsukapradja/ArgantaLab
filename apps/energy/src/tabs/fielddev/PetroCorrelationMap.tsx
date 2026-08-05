// PetroCorrelationMap — where the correlation line actually runs.
//
// A correlation panel is a set of columns in an order, and the order is a claim
// about the field: these bores, along this traverse. Read as columns alone that
// claim is invisible — F-12 beside F-14 looks the same whether they are 400 m
// apart or on opposite flanks. So the panel gets a map, and the map draws the
// line the columns are.
//
// It replaces the datum & track picker, which is now the Input tree's job: the
// datum is a Well top you click, the tracks are curve types you tick. What was
// left unanswered was WHERE, and that is this.
//
// Wellhead x/y come from the well master in the delivery's own CRS — projected
// metres. We draw them in that frame directly rather than reprojecting to
// lat/lon and back: for a field-scale box a metric grid IS the map, and every
// reprojection is a chance to be subtly wrong about a field.
import { useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import type { Workspace } from './workspace';
import { useCumulativeOil, panelSequence } from './petro-luping';
import { ROLE_FILL } from './ImpactMarkers';
import { pathRole } from './well-paths';
import { useScene } from './scene';

const W = 300;
const H = 210;
const PAD = 16;

export function PetroCorrelationMap({ ws }: { ws: Workspace }) {
  const panelWells = useScene((s) => s.panelWells);
  const panelOrder = useScene((s) => s.panelOrder);
  const toggleWell = useScene((s) => s.toggleWell);

  /** Only bores the panel could draw: a bore with no logs is not a column. */
  const logged = useMemo(
    () => ws.bores.filter((b) => b.hasLogs && b.x != null && b.y != null),
    [ws.bores],
  );
  const { cum } = useCumulativeOil(useMemo(() => logged.map((b) => b.name), [logged]));

  const seq = useMemo(
    () => panelSequence(logged.map((b) => b.name), panelWells, panelOrder, cum),
    [logged, panelWells, panelOrder, cum],
  );

  /**
   * ONE metres-per-pixel for both axes. A map that scales x and y independently
   * turns a 3 km × 1 km field into a square and every distance read off it is a
   * lie — which for a traverse is the whole point of drawing it.
   */
  const proj = useMemo(() => {
    if (!logged.length) return null;
    const xs = logged.map((b) => b.x as number);
    const ys = logged.map((b) => b.y as number);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    // A single wellhead, or several sharing one, has no extent — give it a
    // nominal 500 m box rather than dividing by zero.
    const spanX = Math.max(x1 - x0, 500);
    const spanY = Math.max(y1 - y0, 500);
    const k = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return {
      k,
      px: (x: number) => W / 2 + (x - cx) * k,
      // y is northing: up on the map, down in SVG
      py: (y: number) => H / 2 - (y - cy) * k,
    };
  }, [logged]);

  const line = useMemo(() => {
    if (!proj) return [];
    const at = new Map(logged.map((b) => [b.name, b]));
    return seq.map((w) => at.get(w)).filter((b) => !!b)
      .map((b) => ({ name: b!.name, role: b!.role, x: proj.px(b!.x as number), y: proj.py(b!.y as number) }));
  }, [seq, logged, proj]);

  /** Traverse length along the line, in metres — the number the map is for. */
  const runM = useMemo(() => {
    const at = new Map(logged.map((b) => [b.name, b]));
    let d = 0;
    for (let i = 1; i < seq.length; i++) {
      const a = at.get(seq[i - 1]), b = at.get(seq[i]);
      if (!a || !b) continue;
      d += Math.hypot((b.x as number) - (a.x as number), (b.y as number) - (a.y as number));
    }
    return d;
  }, [seq, logged]);

  /** A round scale-bar length that fits in a quarter of the frame. */
  const bar = useMemo(() => {
    if (!proj) return null;
    const want = (W - PAD * 2) / 4 / proj.k;
    const pow = Math.pow(10, Math.floor(Math.log10(want)));
    const m = [1, 2, 5, 10].map((f) => f * pow).find((v) => v >= want) ?? pow * 10;
    return { m, px: m * proj.k };
  }, [proj]);

  if (!proj || !logged.length) {
    return (
      <section className="pps-region live pcm" style={{ gridArea: 'aside' }}>
        <header><span className="pps-region-ic"><MapIcon size={13} /></span><b>Correlation line</b></header>
        <div className="pcm-empty">
          {ws.bores.length
            ? 'no logged bore in this delivery carries a wellhead position — the line cannot be placed'
            : 'no bores yet'}
        </div>
      </section>
    );
  }

  return (
    <section className="pps-region live pcm" style={{ gridArea: 'aside' }}>
      <header>
        <span className="pps-region-ic"><MapIcon size={13} /></span>
        <b>Correlation line</b>
        <em className="pps-step">P6</em>
      </header>

      <svg viewBox={`0 0 ${W} ${H}`} className="pcm-svg">
        {/* every logged bore, so the ones NOT in the panel are visible as the
            choice they are rather than absent */}
        {logged.map((b) => (
          <circle key={b.name} cx={proj.px(b.x as number)} cy={proj.py(b.y as number)} r={2.6}
            fill="var(--panel)" stroke="var(--line)" strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => toggleWell(b.name)}>
            <title>{b.name} — click to {panelWells.includes(b.name) ? 'remove from' : 'show only in'} the panel</title>
          </circle>
        ))}

        {/* the traverse, in panel order */}
        {line.length > 1 && (
          <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} fill="none"
            stroke="var(--teal,#0fb5a6)" strokeWidth={1.4} strokeLinejoin="round" opacity={0.9} />
        )}

        {line.map((p, i) => (
          <g key={p.name} style={{ cursor: 'pointer' }} onClick={() => toggleWell(p.name)}>
            <circle cx={p.x} cy={p.y} r={4.6} fill={ROLE_FILL[pathRole(p.role)]}
              stroke="var(--panel)" strokeWidth={1.2} />
            <text x={p.x} y={p.y + 2.4} textAnchor="middle" fontSize={5.4} fill="#fff"
              fontFamily="var(--mono)" pointerEvents="none">{i + 1}</text>
            <text x={p.x + 6} y={p.y - 5} fontSize={6.2} fill="var(--ink2)"
              fontFamily="var(--mono)" pointerEvents="none">{p.name}</text>
            <title>{p.name} — column {i + 1} of {line.length}</title>
          </g>
        ))}

        {/* north arrow, and a scale bar that means metres on the ground */}
        <g transform={`translate(${W - 18},${18})`}>
          <line x1={0} y1={9} x2={0} y2={-6} stroke="var(--ink3)" strokeWidth={1} />
          <polygon points="0,-9 2.6,-3 -2.6,-3" fill="var(--ink3)" />
          <text x={0} y={17} textAnchor="middle" fontSize={5.6} fill="var(--ink3)"
            fontFamily="var(--mono)">N</text>
        </g>
        {bar && (
          <g transform={`translate(${PAD},${H - 12})`}>
            <line x1={0} y1={0} x2={bar.px} y2={0} stroke="var(--ink3)" strokeWidth={1.2} />
            <line x1={0} y1={-3} x2={0} y2={3} stroke="var(--ink3)" strokeWidth={1.2} />
            <line x1={bar.px} y1={-3} x2={bar.px} y2={3} stroke="var(--ink3)" strokeWidth={1.2} />
            <text x={bar.px / 2} y={-5} textAnchor="middle" fontSize={5.8} fill="var(--ink3)"
              fontFamily="var(--mono)">{bar.m >= 1000 ? `${bar.m / 1000} km` : `${bar.m} m`}</text>
          </g>
        )}
      </svg>

      <div className="pcm-foot">
        <span><b>{line.length}</b> of {logged.length} logged bores</span>
        <span>traverse <b>{runM >= 1000 ? `${(runM / 1000).toFixed(2)} km` : `${Math.round(runM)} m`}</b></span>
        <span className="pcm-crs">{ws.crs ?? 'CRS not declared'}</span>
      </div>
      {/* The order is a choice, and the map is the honest place to say whose. */}
      <div className="pcm-note">
        {panelOrder.length
          ? 'sequence set by hand — the sort popup in the panel header'
          : 'sequence is cumulative oil, biggest producer first'}
        {' · click a bore to add or drop it'}
      </div>
    </section>
  );
}

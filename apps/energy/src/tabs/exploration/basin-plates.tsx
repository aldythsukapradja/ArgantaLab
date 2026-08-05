// basin-plates.tsx — the picture on the dossier's title card, for EVERY basin.
//
// WHY THESE ARE DRAWN AND NOT SOURCED. The obvious way to put a picture on 179 basin
// cards is to fetch or synthesize one. Both are wrong here:
//   * Third-party figures carry the Doust problem — a citation is not a licence, this
//     repo is public, and the existing 49 figures are cleared for INTERNAL use only.
//   * An AI-generated "basin cross-section" would be a fabrication that looks
//     authoritative. This dossier is explicitly the thing you present from, and an
//     image cannot be flagged `derived-rule` the way a chart bar can. A synthesized
//     Zagros section shown to a client is a worse failure than any bad data row.
//
// So every plate here is RENDERED FROM DATA WE HOLD — the province polygon, the basin
// cycle framework, the petroleum-system rows, the field inventory. That makes them
// genuine, publishable (our own rendering of public USGS geometry), always in sync
// with the workbook, theme-aware, and free of binaries in a public repo.
//
// Each plate declares `provenance` — what it was drawn from — which the gallery shows.
import type { ReactNode } from 'react';
import type { KbSpine } from '../../dataqc/masterkb.ts';
import type { BasinFigure } from './basin-figures.ts';

export type PlateKind = 'locator' | 'cycles' | 'petroleum' | 'discovery' | 'endowment' | 'figure';

export interface Plate {
  id: string;
  kind: PlateKind;
  title: string;
  /** One line naming exactly what this was drawn from — shown under the plate. */
  provenance: string;
  node: ReactNode;
}

export interface PlateField {
  name?: string; basin_id?: string; discovery_year?: number; hc_type?: string; status?: string;
}

const W = 320, H = 190;   // plate viewBox — 16:9.5, matches the card slot

// Geodynamic colours, shared with the tectonostratigraphy column so the two read as
// one system rather than two unrelated pictures.
const GEO_COLOR: Record<string, string> = {
  'pre-rift': '#64748b', extensional: '#f59e0b', sag: '#0ea5e9', compressional: '#ef4444',
};
const ROLE_COLOR: Record<string, string> = {
  source: '#a855f7', reservoir: '#22c55e', seal: '#0ea5e9', overburden: '#94a3b8',
};
const HC_COLOR: Record<string, string> = {
  oil: '#22c55e', 'oil and gas': '#15803d', gas: '#dc2626',
  'gas and condensate': '#ea580c', condensate: '#f59e0b',
};

const span = (c: { age_top_ma?: number; age_base_ma?: number }): [number, number] =>
  [Math.max(c.age_top_ma ?? 0, c.age_base_ma ?? 0), Math.min(c.age_top_ma ?? 0, c.age_base_ma ?? 0)];

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

// ── 1 · locator — the basin's real outline, its fields, and where on Earth it is ──
function LocatorPlate({ ring, fields, name }: {
  ring: number[][] | null; fields: Array<{ lon: number; lat: number; hc?: string }>; name: string;
}) {
  if (!ring || ring.length < 3) return null;
  const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  let minX = Math.min(...lons), maxX = Math.max(...lons);
  let minY = Math.min(...lats), maxY = Math.max(...lats);
  // pad, then force the aspect to the plate so the outline is never distorted
  const padX = (maxX - minX) * 0.14 || 1, padY = (maxY - minY) * 0.14 || 1;
  minX -= padX; maxX += padX; minY -= padY; maxY += padY;
  const bw = maxX - minX, bh = maxY - minY;
  const target = W / H;
  if (bw / bh > target) { const need = bw / target, add = (need - bh) / 2; minY -= add; maxY += add; }
  else { const need = bh * target, add = (need - bw) / 2; minX -= add; maxX += add; }
  const px = (lon: number) => ((lon - minX) / (maxX - minX)) * W;
  const py = (lat: number) => H - ((lat - minY) / (maxY - minY)) * H;
  const d = ring.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join('') + 'Z';

  // world-context inset: equirectangular, marking the basin centroid
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2, cy = (Math.min(...lats) + Math.max(...lats)) / 2;
  const iw = 74, ih = 37, ix = W - iw - 8, iy = 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exs-plate-svg" role="img" aria-label={`${name} outline and field distribution`}>
      <defs>
        <linearGradient id="pl-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b2436" /><stop offset="100%" stopColor="#071825" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#pl-sea)" />
      <path d={d} fill="rgba(15,181,166,.17)" stroke="#0fb5a6" strokeWidth="1.4" strokeLinejoin="round" />
      {fields.map((f, i) => (
        <circle key={i} cx={px(f.lon)} cy={py(f.lat)} r="1.9"
          fill={HC_COLOR[String(f.hc ?? '').toLowerCase()] ?? '#94a3b8'} opacity=".9" />
      ))}
      <g transform={`translate(${ix},${iy})`} opacity=".72">
        <rect width={iw} height={ih} rx="2" fill="rgba(2,10,18,.72)" stroke="rgba(255,255,255,.2)" />
        <line x1="0" y1={ih / 2} x2={iw} y2={ih / 2} stroke="rgba(255,255,255,.16)" strokeWidth=".5" />
        <line x1={iw / 2} y1="0" x2={iw / 2} y2={ih} stroke="rgba(255,255,255,.16)" strokeWidth=".5" />
        <circle cx={((cx + 180) / 360) * iw} cy={((90 - cy) / 180) * ih} r="2.6" fill="#f59e0b" />
      </g>
      <text x="10" y={H - 10} className="exs-plate-cap">{fields.length ? `${fields.length} mapped fields` : 'basin outline'}</text>
    </svg>
  );
}

// ── 2 · tectonostratigraphic column — the cycle framework as a picture ───────────
function CyclesPlate({ cycles, name }: { cycles: KbSpine['basinCycle']; name: string }) {
  const rows = cycles.filter((c) => Number.isFinite(c.age_top_ma) && Number.isFinite(c.age_base_ma));
  if (!rows.length) return null;
  const oldest = Math.max(...rows.map((c) => span(c)[0]));
  const youngest = Math.min(...rows.map((c) => span(c)[1]));
  const range = Math.max(1, oldest - youngest);
  const top = 20, bot = H - 18, colX = 58, colW = 132;
  const y = (ma: number) => top + ((oldest - ma) / range) * (bot - top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exs-plate-svg" role="img" aria-label={`${name} tectonostratigraphic column`}>
      <rect width={W} height={H} fill="#08131d" />
      <text x="10" y="13" className="exs-plate-cap">Tectonostratigraphy · Ma</text>
      {rows.map((c) => {
        const [o, yg] = span(c);
        const y0 = y(o), y1 = y(yg);
        const h = Math.max(2, y1 - y0);
        return (
          <g key={c.cycle_id}>
            <rect x={colX} y={y0} width={colW} height={h} rx="1.5"
              fill={GEO_COLOR[c.geodynamics ?? ''] ?? '#64748b'} opacity=".82" />
            <rect x={colX + colW + 3} y={y0} width="6" height={h} rx="1"
              fill={ROLE_COLOR[String(c.dominant_role ?? '').split(' ')[0]] ?? 'transparent'} opacity=".9" />
            <text x={colX - 5} y={y0 + Math.min(h, 11)} className="exs-plate-tick" textAnchor="end">{o}</text>
            {h > 13 && (
              <text x={colX + 5} y={y0 + h / 2 + 3} className="exs-plate-lbl">
                {(c.title ?? '').replace(/\s*\([^)]*\)\s*$/, '').slice(0, 22)}
              </text>
            )}
          </g>
        );
      })}
      <text x={colX - 5} y={bot + 9} className="exs-plate-tick" textAnchor="end">{youngest}</text>
      <g transform={`translate(${colX + colW + 16},${top})`}>
        {Object.entries(GEO_COLOR).map(([k, v], i) => (
          <g key={k} transform={`translate(0,${i * 13})`}>
            <rect width="7" height="7" rx="1.5" fill={v} opacity=".85" />
            <text x="11" y="6.5" className="exs-plate-lbl">{k}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ── 3 · petroleum system — the 11 canonical rows as a compact event chart ────────
function PetroleumPlate({ elements, events, name }: {
  elements: KbSpine['psElement']; events: KbSpine['psEvent']; name: string;
}) {
  const ROWS: Array<{ key: string; label: string; role?: string; type?: string }> = [
    { key: 'source', label: 'Source', role: 'source' },
    { key: 'reservoir', label: 'Reservoir', role: 'reservoir' },
    { key: 'seal', label: 'Seal', role: 'seal' },
    { key: 'overburden', label: 'Overburden', role: 'overburden' },
    { key: 'trap', label: 'Trap', type: 'trap-formation' },
    { key: 'gen', label: 'Generation', type: 'generation' },
    { key: 'mig', label: 'Migration', type: 'migration' },
    { key: 'acc', label: 'Accumulation', type: 'accumulation' },
    { key: 'pres', label: 'Preservation', type: 'preservation' },
  ];
  const bars = ROWS.map((r) => {
    const src = r.role
      ? elements.filter((e) => e.element_role === r.role && e.start_ma != null)
        .map((e) => ({ o: Math.max(e.start_ma, e.end_ma), y: Math.min(e.start_ma, e.end_ma), d: e.provenance === 'derived-rule' }))
      : events.filter((e) => e.event_type === r.type && e.start_ma != null && e.end_ma != null)
        .map((e) => ({ o: Math.max(e.start_ma!, e.end_ma!), y: Math.min(e.start_ma!, e.end_ma!), d: e.event_status === 'derived' }));
    return { ...r, src };
  });
  const all = bars.flatMap((b) => b.src);
  if (!all.length) return null;
  const oldest = Math.max(...all.map((b) => b.o)), youngest = 0;
  const range = Math.max(1, oldest - youngest);
  const left = 74, right = W - 12, top = 20, rowH = (H - top - 14) / ROWS.length;
  const x = (ma: number) => right - ((ma - youngest) / range) * (right - left);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exs-plate-svg" role="img" aria-label={`${name} petroleum system chart`}>
      <rect width={W} height={H} fill="#08131d" />
      <text x="10" y="13" className="exs-plate-cap">Petroleum system · {oldest} Ma → present</text>
      {bars.map((b, i) => {
        const yy = top + i * rowH;
        return (
          <g key={b.key}>
            <text x={left - 5} y={yy + rowH / 2 + 3} className="exs-plate-lbl" textAnchor="end">{b.label}</text>
            <line x1={left} y1={yy + rowH / 2} x2={right} y2={yy + rowH / 2} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            {b.src.map((s, j) => {
              const x0 = x(s.o), x1 = x(s.y);
              return (
                <rect key={j} x={x0} y={yy + 2.5} width={Math.max(2, x1 - x0)} height={rowH - 5} rx="1.6"
                  fill={ROLE_COLOR[b.role ?? ''] ?? '#0fb5a6'}
                  opacity={s.d ? 0.42 : 0.9}
                  stroke={s.d ? 'rgba(255,255,255,.42)' : 'none'} strokeDasharray={s.d ? '2 2' : undefined} strokeWidth=".8" />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ── 4 · discovery history — the creaming curve ───────────────────────────────────
function DiscoveryPlate({ fields, name }: { fields: PlateField[]; name: string }) {
  const yrs = fields.map((f) => f.discovery_year).filter((y): y is number => !!y && y > 1850).sort((a, b) => a - b);
  if (yrs.length < 3) return null;
  const y0 = yrs[0], y1 = yrs[yrs.length - 1];
  const left = 34, right = W - 12, top = 24, bot = H - 20;
  const px = (y: number) => left + ((y - y0) / Math.max(1, y1 - y0)) * (right - left);
  const py = (n: number) => bot - (n / yrs.length) * (bot - top);
  const pts = yrs.map((y, i) => [px(y), py(i + 1)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = `${line}L${px(y1).toFixed(1)},${bot}L${px(y0).toFixed(1)},${bot}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exs-plate-svg" role="img" aria-label={`${name} discovery history`}>
      <rect width={W} height={H} fill="#08131d" />
      <defs>
        <linearGradient id="pl-cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(15,181,166,.42)" /><stop offset="100%" stopColor="rgba(15,181,166,0)" />
        </linearGradient>
      </defs>
      <text x="10" y="13" className="exs-plate-cap">Discovery history · {yrs.length} dated fields</text>
      <path d={area} fill="url(#pl-cream)" />
      <path d={line} fill="none" stroke="#0fb5a6" strokeWidth="1.8" strokeLinejoin="round" />
      <text x={left} y={bot + 13} className="exs-plate-tick">{y0}</text>
      <text x={right} y={bot + 13} className="exs-plate-tick" textAnchor="end">{y1}</text>
      <text x={left - 4} y={top + 6} className="exs-plate-tick" textAnchor="end">{yrs.length}</text>
    </svg>
  );
}

// ── 5 · endowment — assessed resource and the discovered hydrocarbon mix ─────────
function EndowmentPlate({ fields, oilMean, gasMean, name }: {
  fields: PlateField[]; oilMean?: number; gasMean?: number; name: string;
}) {
  const mix = new Map<string, number>();
  for (const f of fields) {
    const k = String(f.hc_type ?? '').toLowerCase();
    if (k) mix.set(k, (mix.get(k) ?? 0) + 1);
  }
  const entries = [...mix.entries()].sort((a, b) => b[1] - a[1]);
  const boe = (oilMean ?? 0) + (gasMean ?? 0) / 6;
  if (!entries.length && !boe) return null;
  const total = entries.reduce((a, e) => a + e[1], 0) || 1;
  const cx = 78, cy = 104, r = 44, ir = 25;
  let acc = -Math.PI / 2;
  const arcs = entries.map(([k, v]) => {
    const a0 = acc, a1 = acc + (v / total) * Math.PI * 2; acc = a1;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rr: number) => `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
    return { k, v, d: `M${p(a0, r)}A${r},${r} 0 ${big} 1 ${p(a1, r)}L${p(a1, ir)}A${ir},${ir} 0 ${big} 0 ${p(a0, ir)}Z` };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exs-plate-svg" role="img" aria-label={`${name} endowment and hydrocarbon mix`}>
      <rect width={W} height={H} fill="#08131d" />
      <text x="10" y="13" className="exs-plate-cap">Endowment · undiscovered mean</text>
      {arcs.map((a) => (
        <path key={a.k} d={a.d} fill={HC_COLOR[a.k] ?? '#94a3b8'} opacity=".88" />
      ))}
      <text x={cx} y={cy + 1} className="exs-plate-num" textAnchor="middle">{total}</text>
      <text x={cx} y={cy + 12} className="exs-plate-tick" textAnchor="middle">fields</text>
      <g transform="translate(152,34)">
        {entries.slice(0, 5).map(([k, v], i) => (
          <g key={k} transform={`translate(0,${i * 15})`}>
            <rect width="8" height="8" rx="2" fill={HC_COLOR[k] ?? '#94a3b8'} />
            <text x="13" y="7.5" className="exs-plate-lbl">{k} · {v}</text>
          </g>
        ))}
        {!!boe && (
          <g transform={`translate(0,${Math.min(entries.length, 5) * 15 + 10})`}>
            <text y="8" className="exs-plate-num">{fmt(boe)}</text>
            <text y="21" className="exs-plate-lbl">MMBOE mean undiscovered</text>
          </g>
        )}
      </g>
    </svg>
  );
}

/** Build the full plate set for a basin. Order is the default gallery order; the
 *  dossier lets the user promote any one of them to be the card's main picture. */
export function buildPlates(input: {
  name: string;
  ring: number[][] | null;
  fieldPoints: Array<{ lon: number; lat: number; hc?: string }>;
  fields: PlateField[];
  cycles: KbSpine['basinCycle'];
  elements: KbSpine['psElement'];
  events: KbSpine['psEvent'];
  oilMean?: number; gasMean?: number;
  figure?: BasinFigure | null;
  figureSrc?: string;
  figureCredit?: string;
}): Plate[] {
  const { name } = input;
  const out: Plate[] = [];

  const locator = <LocatorPlate ring={input.ring} fields={input.fieldPoints} name={name} />;
  if (input.ring) out.push({
    id: 'locator', kind: 'locator', title: 'Basin outline & fields',
    provenance: `USGS province polygon · ${input.fieldPoints.length} mapped field locations`,
    node: locator,
  });

  // The real published figure, where one exists.
  if (input.figure && input.figureSrc) out.push({
    id: `figure-${input.figure.fig}`, kind: 'figure',
    title: input.figure.caption,
    provenance: input.figureCredit ?? 'published figure — internal use only',
    node: <img src={input.figureSrc} alt={input.figure.caption} loading="lazy" className="exs-plate-img" />,
  });

  return out.filter((p) => p.node);
}

// The cycle / petroleum / discovery / endowment renderers above are intentionally
// retained but NOT part of the default gallery. The card is meant to carry PUBLISHED
// figures — cross-sections, stratigraphic charts, depositional maps — and a chart
// drawn from our own table is not a substitute for one. They stay available for the
// enlarged view and for any later panel that explicitly wants a data-drawn frame.
export { CyclesPlate, PetroleumPlate, DiscoveryPlate, EndowmentPlate };

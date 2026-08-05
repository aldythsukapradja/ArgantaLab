// petro-schematics.tsx — the inline drawings on the Petrophysics shell canvas.
//
// Each one is a small, honest sketch of what its region will look like when built:
// the track layout, the flattened panel, the Pickett cloud, the zone matrix. They are
// SCHEMATIC — deliberately drawn from a fixed pseudo-random walk, not from the
// delivery — so nobody can mistake a canvas preview for a result. The real curves
// arrive with the real components (P4–P8).
//
// Pure SVG, no dependency, currentColor throughout so they theme with the panel.
// Deterministic: a seeded LCG, never Math.random, so the canvas looks the same on
// every render and a screenshot of it means something.

/** Tiny deterministic generator — same sketch every time. */
function walk(seed: number, n: number, amp: number, mid: number): number[] {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out: number[] = [];
  let v = mid;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * amp;
    v = Math.max(mid - amp * 1.6, Math.min(mid + amp * 1.6, v));
    out.push(v);
  }
  return out;
}

const path = (vals: number[], h: number) =>
  vals.map((v, i) => `${i ? 'L' : 'M'}${v.toFixed(1)},${((i / (vals.length - 1)) * h).toFixed(1)}`).join('');

const S = { width: '100%', height: '100%', display: 'block' } as const;

/** The Single Well bench: zones, GR with endpoints, resistivity, RHOB–NPHI with
 *  crossover fill, the computed curves, and the net ribbon. */
function Tracks() {
  const H = 74;
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="log track layout">
      {/* zone bands, shared down every track */}
      {[[0, 18], [18, 34], [34, 52], [52, 74]].map(([y0, y1], i) => (
        <rect key={i} x="0" y={y0} width="236" height={y1 - y0} fill="currentColor" opacity={i % 2 ? 0.05 : 0.02} />
      ))}
      {/* depth + zone column */}
      <rect x="0" y="0" width="20" height={H} fill="currentColor" opacity="0.06" />
      {[18, 34, 52].map((y) => <line key={y} x1="0" y1={y} x2="236" y2={y} stroke="currentColor" opacity="0.35" strokeWidth="0.6" strokeDasharray="2 2" />)}

      {/* GR with the two draggable endpoints */}
      <g transform="translate(24,0)">
        <line x1="8" y1="0" x2="8" y2={H} stroke="var(--green,#4ade80)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        <line x1="34" y1="0" x2="34" y2={H} stroke="var(--amber,#fbbf24)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        <path d={path(walk(7, 40, 13, 22), H)} fill="none" stroke="currentColor" strokeWidth="0.9" />
      </g>
      {/* resistivity, log scale */}
      <g transform="translate(72,0)">
        <path d={path(walk(19, 40, 15, 22), H)} fill="none" stroke="var(--purple,#a78bfa)" strokeWidth="0.9" />
      </g>
      {/* RHOB + NPHI with the crossover fill */}
      <g transform="translate(120,0)">
        <path d={`${path(walk(31, 40, 11, 20), H)}L${path(walk(43, 40, 11, 26), H).slice(1).split('L').reverse().join('L')}Z`}
          fill="var(--amber,#fbbf24)" opacity="0.18" />
        <path d={path(walk(31, 40, 11, 20), H)} fill="none" stroke="currentColor" strokeWidth="0.85" />
        <path d={path(walk(43, 40, 11, 26), H)} fill="none" stroke="var(--cblue,#60a5fa)" strokeWidth="0.85" strokeDasharray="2 1.5" />
      </g>
      {/* computed: ours solid, theirs dashed */}
      <g transform="translate(168,0)">
        <path d={path(walk(53, 40, 9, 20), H)} fill="none" stroke="var(--teal,#2dd4bf)" strokeWidth="0.95" />
        <path d={path(walk(57, 40, 9, 23), H)} fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
      </g>
      {/* net / pay ribbon */}
      <g transform="translate(222,0)">
        {[[4, 12], [22, 9], [38, 16], [60, 7]].map(([y, h], i) => (
          <rect key={i} x="2" y={y} width="10" height={h} fill="var(--green,#4ade80)" opacity="0.75" />
        ))}
      </g>
      {[20, 68, 116, 164, 218].map((x) => <line key={x} x1={x} y1="0" x2={x} y2={H} stroke="currentColor" opacity="0.3" strokeWidth="0.6" />)}
    </svg>
  );
}

/** The zone summary strip: one row per picked interval. */
function ZoneStrip() {
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="zone summary rows">
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(0,${i * 18 + 3})`}>
          <rect x="0" y="0" width="52" height="13" rx="2" fill="currentColor" opacity="0.1" />
          {[62, 100, 138].map((x, j) => (
            <rect key={x} x={x} y="3" width={22 + j * 4} height="7" rx="1.5" fill="currentColor" opacity="0.22" />
          ))}
          {/* the N:G bar — the one number the zone row exists to carry */}
          <rect x="182" y="3" width="50" height="7" rx="3.5" fill="currentColor" opacity="0.1" />
          <rect x="182" y="3" width={[38, 21, 44, 9][i]} height="7" rx="3.5" fill="var(--green,#4ade80)" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

/** The correlation panel: wells side by side, flattened on a shared horizon. */
function Panel() {
  const H = 74;
  const wells = [0, 1, 2, 3];
  const flat = 30;                      // the datum every well is hung on
  const shift = [0, -6, 5, -3];         // each well's own offset before flattening
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="correlation panel">
      {/* the flattening datum, dead straight across every well — the whole point */}
      <line x1="0" y1={flat} x2="236" y2={flat} stroke="var(--teal,#2dd4bf)" strokeWidth="1.1" />
      {wells.map((w) => {
        const x0 = w * 59;
        const dy = shift[w];
        return (
          <g key={w} transform={`translate(${x0},0)`}>
            <rect x="0" y="0" width="57" height={H} fill="currentColor" opacity={w % 2 ? 0.035 : 0} />
            {/* two tracks per well */}
            <path d={path(walk(11 + w * 13, 34, 9, 15), H)} fill="none" stroke="currentColor" strokeWidth="0.8" />
            <g transform="translate(28,0)">
              <path d={path(walk(71 + w * 17, 34, 9, 14), H)} fill="none" stroke="var(--purple,#a78bfa)" strokeWidth="0.8" />
            </g>
            {/* zone fills, offset per well, correlated across */}
            <rect x="0" y={flat + dy - 14} width="57" height="9" fill="var(--amber,#fbbf24)" opacity="0.16" />
            <rect x="0" y={flat + dy + 8} width="57" height="12" fill="var(--cblue,#60a5fa)" opacity="0.14" />
            <line x1="0" y1="0" x2="0" y2={H} stroke="currentColor" opacity="0.28" strokeWidth="0.6" />
          </g>
        );
      })}
      {/* correlation lines joining the picks between adjacent wells */}
      {[0, 1, 2].map((i) => (
        <g key={i} opacity="0.55">
          <line x1={i * 59 + 57} y1={flat + shift[i] - 14} x2={(i + 1) * 59} y2={flat + shift[i + 1] - 14}
            stroke="var(--amber,#fbbf24)" strokeWidth="0.8" />
          <line x1={i * 59 + 57} y1={flat + shift[i] + 20} x2={(i + 1) * 59} y2={flat + shift[i + 1] + 20}
            stroke="var(--cblue,#60a5fa)" strokeWidth="0.8" />
        </g>
      ))}
    </svg>
  );
}

/** Datum / track picker: two short lists, one of them constrained. */
function Datum() {
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="datum and track picker">
      <text x="4" y="9" fontSize="6" fill="currentColor" opacity="0.55" fontFamily="monospace">DATUM</text>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(4,${14 + i * 12})`}>
          <rect width="104" height="9" rx="2" fill="currentColor" opacity={i === 1 ? 0.2 : 0.08} />
          {i === 1 && <circle cx="98" cy="4.5" r="2" fill="var(--teal,#2dd4bf)" />}
        </g>
      ))}
      <text x="4" y="62" fontSize="5.5" fill="currentColor" opacity="0.4" fontFamily="monospace">only horizons ALL wells share</text>
      <line x1="118" y1="4" x2="118" y2="70" stroke="currentColor" opacity="0.2" strokeWidth="0.6" />
      <text x="126" y="9" fontSize="6" fill="currentColor" opacity="0.55" fontFamily="monospace">TRACKS</text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(126,${14 + i * 12})`}>
          <rect width="10" height="9" rx="2" fill={i < 2 ? 'var(--teal,#2dd4bf)' : 'currentColor'} opacity={i < 2 ? 0.7 : 0.12} />
          <rect x="14" width={72 - i * 8} height="9" rx="2" fill="currentColor" opacity="0.1" />
        </g>
      ))}
    </svg>
  );
}

/** The 2D crossplot, drawn as a Pickett — log–log, with the m-slope lines. */
function Xplot() {
  let s = 97;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < 150; i++) {
    const x = 18 + rnd() * 200;
    // a genuine Pickett trend: resistivity falls as porosity rises, with scatter
    const y = 66 - (x - 18) * 0.22 + (rnd() - 0.5) * 26;
    pts.push([x, Math.max(5, Math.min(70, y)), rnd()]);
  }
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="Pickett crossplot">
      {/* log decade grid */}
      {[18, 68, 118, 168, 218].map((x) => <line key={x} x1={x} y1="2" x2={x} y2="70" stroke="currentColor" opacity="0.16" strokeWidth="0.6" />)}
      {[10, 26, 42, 58].map((y) => <line key={y} x1="14" y1={y} x2="232" y2={y} stroke="currentColor" opacity="0.16" strokeWidth="0.6" />)}
      {/* the m-slope family — what you actually read off a Pickett */}
      {[0, 1, 2].map((i) => (
        <line key={i} x1="18" y1={16 + i * 15} x2="222" y2={16 + i * 15 - 44}
          stroke="var(--teal,#2dd4bf)" strokeWidth="0.7" opacity={i === 1 ? 0.9 : 0.35} strokeDasharray={i === 1 ? '' : '2 2'} />
      ))}
      {pts.map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r="1.1"
          fill={c > 0.72 ? 'var(--amber,#fbbf24)' : c > 0.4 ? 'var(--cblue,#60a5fa)' : 'currentColor'}
          opacity={c > 0.4 ? 0.8 : 0.4} />
      ))}
      {/* a brush box — the selection that reaches every other view */}
      <rect x="120" y="14" width="58" height="26" fill="var(--teal,#2dd4bf)" opacity="0.12"
        stroke="var(--teal,#2dd4bf)" strokeWidth="0.7" strokeDasharray="2 1.5" />
    </svg>
  );
}

/** The 3D crossplot: an orbiting point cloud on three curve axes. */
function Xplot3D() {
  let s = 251;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < 130; i++) {
    // a rough ellipsoidal cluster projected isometrically
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    const px = Math.cos(a) * r * 52, py = Math.sin(a) * r * 30;
    const dz = (rnd() - 0.5) * 26;
    pts.push([118 + px + dz * 0.5, 38 + py - dz * 0.35, rnd()]);
  }
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="3D crossplot">
      {/* the three axes, isometric */}
      <g stroke="currentColor" opacity="0.4" strokeWidth="0.7">
        <line x1="44" y1="62" x2="200" y2="62" />
        <line x1="44" y1="62" x2="44" y2="10" />
        <line x1="44" y1="62" x2="86" y2="40" />
      </g>
      {pts.map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r={0.9 + c * 1.1}
          fill={c > 0.66 ? 'var(--amber,#fbbf24)' : c > 0.33 ? 'var(--teal,#2dd4bf)' : 'var(--purple,#a78bfa)'}
          opacity={0.35 + c * 0.5} />
      ))}
      <text x="204" y="65" fontSize="5.5" fill="currentColor" opacity="0.45" fontFamily="monospace">GR</text>
      <text x="34" y="9" fontSize="5.5" fill="currentColor" opacity="0.45" fontFamily="monospace">RT</text>
      <text x="88" y="36" fontSize="5.5" fill="currentColor" opacity="0.45" fontFamily="monospace">RHOB</text>
    </svg>
  );
}

/** The sample table: the flat primitive everything else projects from. */
function TableSchematic() {
  const cols = [30, 22, 22, 26, 18, 18, 18, 18, 18];
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="sample table">
      {/* header */}
      <g transform="translate(4,4)">
        {cols.reduce<{ x: number; els: JSX.Element[] }>((acc, w, i) => {
          acc.els.push(<rect key={i} x={acc.x} y="0" width={w - 3} height="8" rx="1.5" fill="currentColor" opacity="0.28" />);
          acc.x += w;
          return acc;
        }, { x: 0, els: [] }).els}
      </g>
      {/* rows, with a brushed band */}
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <g key={r} transform={`translate(4,${16 + r * 9})`}>
          {r >= 2 && r <= 3 && <rect x="-2" y="-1" width="232" height="8.5" fill="var(--teal,#2dd4bf)" opacity="0.14" />}
          {cols.reduce<{ x: number; els: JSX.Element[] }>((acc, w, i) => {
            acc.els.push(<rect key={i} x={acc.x} y="0" width={w - 3} height="6" rx="1.5" fill="currentColor"
              opacity={r >= 2 && r <= 3 ? 0.3 : 0.12} />);
            acc.x += w;
            return acc;
          }, { x: 0, els: [] }).els}
        </g>
      ))}
    </svg>
  );
}

/** The zone × well matrix — the deliverable, including its honest holes. */
function Matrix() {
  const empty = new Set(['1-3', '2-5', '3-1', '3-6', '0-7']);
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="zone by well matrix">
      {/* well headers */}
      {Array.from({ length: 8 }, (_, c) => (
        <rect key={c} x={38 + c * 24} y="3" width="20" height="6" rx="1.5" fill="currentColor" opacity="0.28" />
      ))}
      {Array.from({ length: 4 }, (_, r) => (
        <g key={r}>
          {/* zone label */}
          <rect x="3" y={15 + r * 15} width="32" height="9" rx="2" fill="currentColor" opacity="0.14" />
          {Array.from({ length: 8 }, (_, c) => {
            const hole = empty.has(`${r}-${c}`);
            const fill = [0.72, 0.44, 0.86, 0.28][r] * (0.6 + ((c * 7) % 5) / 10);
            return hole ? (
              // a cell the delivery cannot fill: hatched, not zero, not blank
              <g key={c}>
                <rect x={38 + c * 24} y={15 + r * 15} width="20" height="9" rx="1.5"
                  fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" strokeDasharray="1.5 1.5" />
                <line x1={38 + c * 24} y1={24 + r * 15} x2={58 + c * 24} y2={15 + r * 15}
                  stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
              </g>
            ) : (
              <g key={c}>
                <rect x={38 + c * 24} y={15 + r * 15} width="20" height="9" rx="1.5" fill="currentColor" opacity="0.08" />
                <rect x={38 + c * 24} y={15 + r * 15} width={20 * Math.min(1, fill)} height="9" rx="1.5"
                  fill="var(--green,#4ade80)" opacity="0.55" />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** The calibration report: our answer against a known one, on the 1:1 line. */
function Calib() {
  let s = 401;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 90; i++) {
    const t = rnd();
    const x = 20 + t * 190;
    const y = 66 - t * 58 + (rnd() - 0.5) * 11;   // scattered about the 1:1
    pts.push([x, Math.max(4, Math.min(70, y))]);
  }
  return (
    <svg viewBox="0 0 236 74" style={S} preserveAspectRatio="none" aria-label="calibration scatter">
      <g stroke="currentColor" opacity="0.3" strokeWidth="0.7">
        <line x1="18" y1="70" x2="216" y2="70" />
        <line x1="18" y1="70" x2="18" y2="4" />
      </g>
      {/* the 1:1 line — the only line that matters here */}
      <line x1="20" y1="68" x2="212" y2="8" stroke="var(--teal,#2dd4bf)" strokeWidth="1" />
      {/* ±10 % envelope */}
      <line x1="20" y1="60" x2="212" y2="2" stroke="var(--teal,#2dd4bf)" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 2" />
      <line x1="20" y1="74" x2="212" y2="16" stroke="var(--teal,#2dd4bf)" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 2" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill="var(--amber,#fbbf24)" opacity="0.7" />)}
      <text x="150" y="66" fontSize="5.5" fill="currentColor" opacity="0.5" fontFamily="monospace">theirs →</text>
      <text x="22" y="10" fontSize="5.5" fill="currentColor" opacity="0.5" fontFamily="monospace">↑ ours</text>
    </svg>
  );
}

export const PETRO_SCHEMATICS = {
  tracks: Tracks,
  zonestrip: ZoneStrip,
  panel: Panel,
  datum: Datum,
  xplot: Xplot,
  xplot3d: Xplot3D,
  table: TableSchematic,
  matrix: Matrix,
  calib: Calib,
};

// Slide 2's instrument — one donut, two readings of the same fifteen years.
//
// TECHNICAL MIX answers "what work?"; ENVIRONMENT MIX answers "in what kind of
// institution?". The point of putting them behind one switch rather than side
// by side is that they are the SAME career measured twice — a perspective is
// broad because of both, and two separate charts would let you read either one
// alone.
//
// Geometry is d3-shape (arc + pie); motion is GSAP, which already drives the
// deck. Arcs are matched by index and any surplus segment collapses to zero
// width, so five segments genuinely morph into three instead of cross-fading.
import { useEffect, useMemo, useRef, useState } from 'react';
import { arc as d3arc, pie as d3pie } from 'd3-shape';
import { gsap, prefersReducedMotion } from './timeline';

export type Mode = 'technical' | 'environment';

interface Seg { key: string; label: string; value: number; color: string; verb: string; note: string }

/* ── mode A: what the work was ───────────────────────────────────────────────
   Three visual families, deliberately not a rainbow. The three 25% segments
   share one blue family because together they ARE the 75% story — development
   geoscience — and the eye should read them as a block before it reads them
   apart. Operations and Exploration each get their own family precisely
   because they are not part of that block. */
const TECHNICAL: Seg[] = [
  {
    key: 'characterize', label: 'Reservoir Characterization', value: 25, color: '#4FA8D8',
    verb: 'CHARACTERIZE',
    note: 'Integrating geology, seismic, and reservoir models to reduce subsurface uncertainty.',
  },
  {
    key: 'develop', label: 'Field Development', value: 25, color: '#69D6FF',
    verb: 'DEVELOP',
    note: 'Connecting reservoirs, wells, risks, and development choices.',
  },
  {
    key: 'manage', label: 'Reservoir Management', value: 25, color: '#9BE6F2',
    verb: 'MANAGE',
    note: 'Turning surveillance and performance into sustainable field value.',
  },
  {
    key: 'deliver', label: 'Operations & Wells', value: 10, color: '#D8B15A',
    verb: 'DELIVER',
    note: 'Applying subsurface understanding to well and operational decisions.',
  },
  {
    key: 'discover', label: 'Exploration & Appraisal', value: 15, color: '#A78BFA',
    verb: 'DISCOVER',
    note: 'Understanding basins, petroleum systems, opportunities, and uncertainty.',
  },
];

/* ── mode B: where the work happened ─────────────────────────────────────────
   NOT hard-coded. The shares are computed from the career timeline's own
   months, so they cannot drift from the dates shown beside them.

   Two classifications are genuinely the presenter's call, not mine, and the
   handoff says so explicitly. They are isolated here as single lines:

     · North Oil Company is a QatarEnergy / TotalEnergies joint venture. Named
       as a national oil company and defaulted to one; flip to 'multinational'
       and the chart follows.
     · Energi Mega Persada is an Indonesian independent — neither a state
       operator nor a multinational. Defaulted to 'national' as the domestic
       bucket, which is the least wrong of three.

   Change either value and nothing else needs touching. */
export type EnvKey = 'academic' | 'multinational' | 'national';

export const ENVIRONMENT_OF: Record<string, EnvKey> = {
  'itb-beng': 'academic',
  'itb-grg': 'academic',
  emp: 'national',              // ← presenter's call
  'ifp-total': 'academic',      // the M.Sc year; sponsored, but spent studying
  'total-model': 'multinational',
  'total-ops': 'multinational',
  'total-geophys': 'multinational',
  phm: 'national',
  'noc-fd': 'national',         // ← presenter's call
  'noc-rm': 'national',         // ← presenter's call
};

const ENV_META: Record<EnvKey, { label: string; color: string; verb: string; note: string }> = {
  academic: {
    label: 'Academic & Research', color: '#A78BFA', verb: 'QUESTION',
    note: 'Building foundations in evidence, interpretation, research, and geological reasoning.',
  },
  multinational: {
    label: 'Multinational Energy', color: '#69D6FF', verb: 'INTEGRATE',
    note: 'Working within mature technical systems, multidisciplinary teams, and globally benchmarked practices.',
  },
  national: {
    label: 'National Oil Company', color: '#D8B15A', verb: 'APPLY',
    note: 'Connecting technical decisions with field delivery, institutional continuity, and national operating priorities.',
  },
};

/** Months per stage, from the timeline. Digital Transformation is deliberately
 *  absent: it is cross-cutting, and counting it would double-count the years it
 *  overlaps. */
export function environmentMix(months: Record<string, number>): Seg[] {
  const tally: Record<EnvKey, number> = { academic: 0, multinational: 0, national: 0 };
  for (const [id, m] of Object.entries(months)) {
    const env = ENVIRONMENT_OF[id];
    if (env) tally[env] += m;
  }
  const total = Object.values(tally).reduce((t, v) => t + v, 0) || 1;
  // Largest-remainder rounding, so the printed integers actually sum to 100.
  const raw = (Object.keys(ENV_META) as EnvKey[]).map((k) => ({ k, exact: (tally[k] / total) * 100 }));
  const out = raw.map((r) => ({ ...r, v: Math.floor(r.exact) }));
  let short = 100 - out.reduce((t, r) => t + r.v, 0);
  out.sort((a, b) => (b.exact - b.v) - (a.exact - a.v));
  for (let i = 0; short > 0; i += 1, short -= 1) out[i % out.length].v += 1;

  return (Object.keys(ENV_META) as EnvKey[]).map((k) => {
    const m = ENV_META[k];
    return {
      key: k, label: m.label, color: m.color, verb: m.verb, note: m.note,
      value: out.find((r) => r.k === k)?.v ?? 0,
    };
  });
}

const R_OUT = 100;
const R_IN = 64;

export function PerspectiveDonut({
  mode, months, onHover,
}: { mode: Mode; months: Record<string, number>; onHover?: (env: EnvKey | null) => void }) {
  const segs = useMemo(
    () => (mode === 'technical' ? TECHNICAL : environmentMix(months)),
    [mode, months],
  );
  const [hover, setHover] = useState<string | null>(null);
  // Angles are animated, so they live outside React's render loop until the
  // tween writes them back — one setState per frame on five numbers is cheap,
  // and it keeps the arcs declarative.
  const [angles, setAngles] = useState<number[]>([]);
  const prev = useRef<number[]>([]);

  const target = useMemo(() => {
    const layout = d3pie<Seg>().value((d) => d.value).sort(null).padAngle(0.014);
    return layout(segs).map((a) => [a.startAngle, a.endAngle] as [number, number]);
  }, [segs]);

  useEffect(() => {
    const flat = target.flat();
    if (prefersReducedMotion()) { prev.current = flat; setAngles(flat); return; }

    // Tween a plain keyed object, not an array: spreading an array into GSAP's
    // vars carries `length` and every Array.prototype member in with it, and
    // GSAP will happily try to tween them.
    //
    // Where a segment did not exist before, start it collapsed AT its new start
    // angle, so it grows out of the right place instead of sweeping in from
    // twelve o'clock.
    const o: Record<string, number> = {};
    const to: Record<string, number> = {};
    flat.forEach((v, i) => {
      o[`a${i}`] = prev.current[i] ?? target[Math.floor(i / 2)][0];
      to[`a${i}`] = v;
    });

    const tw = gsap.to(o, {
      ...to,
      duration: 0.68,
      ease: 'power2.inOut',
      onUpdate: () => {
        const now = flat.map((_, i) => o[`a${i}`]);
        prev.current = now;
        setAngles(now);
      },
    });
    return () => { tw.kill(); };
  }, [target]);

  const arcFor = useMemo(() => d3arc<[number, number]>()
    .innerRadius(R_IN).outerRadius(R_OUT).cornerRadius(3)
    .startAngle((d) => d[0]).endAngle((d) => d[1]), []);

  const active = segs.find((s) => s.key === hover);
  const centre = active
    ? { big: `${active.value}%`, small: active.verb, note: active.note }
    : mode === 'technical'
      ? { big: '75%', small: 'Development geoscience', note: 'Characterize · Develop · Manage' }
      : { big: '3', small: 'Professional environments', note: 'Academic · Multinational · National' };

  const pairs: [number, number][] = [];
  for (let i = 0; i < angles.length; i += 2) pairs.push([angles[i], angles[i + 1]]);

  return (
    <div className="kn-donut">
      <svg viewBox="-118 -118 236 236" preserveAspectRatio="xMidYMid meet"
        role="img" aria-label={`${mode === 'technical' ? 'Technical' : 'Environment'} mix`}>
        <g>
          {pairs.map((p, i) => {
            const s = segs[i];
            if (!s) return null;
            const dim = hover !== null && hover !== s.key;
            return (
              <path
                key={s.key}
                d={arcFor(p) ?? undefined}
                fill={s.color}
                className={'kn-donut-arc' + (dim ? ' dim' : '')}
                tabIndex={0}
                role="button"
                aria-label={`${s.label}, ${s.value} percent`}
                onMouseEnter={() => { setHover(s.key); onHover?.(mode === 'environment' ? s.key as EnvKey : null); }}
                onMouseLeave={() => { setHover(null); onHover?.(null); }}
                onFocus={() => { setHover(s.key); onHover?.(mode === 'environment' ? s.key as EnvKey : null); }}
                onBlur={() => { setHover(null); onHover?.(null); }}
              />
            );
          })}
        </g>
        {/* Centre copy is SVG text so it scales with the donut rather than
            fighting it at small widths. */}
        <text className="kn-donut-big" textAnchor="middle" y="-6">{centre.big}</text>
        <text className="kn-donut-small" textAnchor="middle" y="14">{centre.small}</text>
      </svg>

      {/* The note lives in HTML, not SVG: it wraps, and wrapped SVG text does
          not exist without manual line breaking. */}
      <p className="kn-donut-note" key={centre.note}>{centre.note}</p>

      <ul className="kn-donut-key">
        {segs.map((s) => (
          <li key={s.key}
            className={hover !== null && hover !== s.key ? 'dim' : ''}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{s.value}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

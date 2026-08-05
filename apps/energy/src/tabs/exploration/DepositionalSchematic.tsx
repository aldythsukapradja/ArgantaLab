// DepositionalSchematic.tsx — an ORIGINAL depositional schematic drawn from extracted
// facts, not traced from anyone's figure.
//
// WHY THIS EXISTS
//   Measured across the USGS corpus: the figures a geologist actually reasons from —
//   stratigraphic summaries, burial curves, structural sections — are overwhelmingly
//   reproduced from third parties inside otherwise public-domain reports (50% of
//   Bulletin 2204-C, 27% of the monograph corpus). We may cite and link them; we may
//   not redistribute them. For Viking Graben that leaves the strat chart and the burial
//   curves invisible.
//
//   So the schematic is not a decorative fallback. For most basins it is the only
//   depositional picture we can legitimately show.
//
// WHAT IT IS AND IS NOT
//   Every mark is driven by a fact already in the Basin Cycle row: geodynamics sets the
//   basin geometry, fill sets whether the section is subaqueous, lithology sets the
//   ornament, dominant_role sets the emphasis. Facts are not copyrightable and this
//   composition is our own. It is a SCHEMATIC — no scale, no real geometry — and it is
//   labelled as generated wherever it appears.
import { useId } from 'react';

export interface CycleFacts {
  id: string;
  title?: string;
  stage?: string;
  geodynamics?: string;
  fill?: string;
  lithology?: string;
  dominantRole?: string;
  ageMa?: [number, number];
  units?: string;
}

const ROLE_TINT: Record<string, string> = {
  source: '#f43f5e', reservoir: '#22c55e', seal: '#a78bfa', overburden: '#64748b',
};

/** Ornament chosen from the cycle's own lithology text — the standard geological
 *  conventions: dots for sand, dashes for mud, bricks for carbonate, vertical hatch
 *  for evaporite, chevrons for volcanic. */
function litho(l?: string): 'sand' | 'mud' | 'carb' | 'evap' | 'volc' | 'coal' | 'mixed' {
  const s = (l ?? '').toLowerCase();
  if (/evaporite|anhydrite|salt|gypsum/.test(s)) return 'evap';
  if (/basalt|volcan|tuff|trap|diabase|igneous/.test(s)) return 'volc';
  if (/coal/.test(s)) return 'coal';
  if (/carbonate|limestone|dolomit|reef|chalk|microbial/.test(s)) return 'carb';
  if (/shale|mudstone|claystone|marl|organic/.test(s)) return 'mud';
  if (/sand|clastic|turbidite|conglomerat|siliciclastic/.test(s)) return 'sand';
  return 'mixed';
}

/** Basin geometry from the geodynamic stage. These are the four shapes the vocabulary
 *  supports; anything unrecognised falls back to layer-cake, which asserts least. */
function geometry(g?: string): 'prerift' | 'rift' | 'sag' | 'compress' {
  const s = (g ?? '').toLowerCase();
  if (s.startsWith('extensional')) return 'rift';
  if (s.startsWith('compress')) return 'compress';
  if (s.startsWith('sag')) return 'sag';
  return 'prerift';
}

const W = 240, H = 104, SEA = 30;

export function DepositionalSchematic({ cycle, compact }: { cycle: CycleFacts; compact?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const geo = geometry(cycle.geodynamics);
  const lt = litho(cycle.lithology);
  const marine = /marine/.test((cycle.fill ?? '').toLowerCase())
    && !/non-marine/.test((cycle.fill ?? '').toLowerCase());
  const mixed = /mixed/.test((cycle.fill ?? '').toLowerCase());
  const tint = ROLE_TINT[(cycle.dominantRole ?? '').split(' ')[0]] ?? '#38bdf8';

  // Sediment top surface — the shape IS the geodynamic statement.
  const top = (() => {
    switch (geo) {
      case 'rift':      // half-graben: fill wedges toward the master fault on the left
        return `M0,52 L${W * 0.42},44 L${W * 0.44},40 L${W},34`;
      case 'sag':       // broad symmetric saucer, thickest at the depocentre
        return `M0,40 Q${W / 2},${SEA + 4} ${W},40`;
      case 'compress':  // folded section
        return `M0,46 Q${W * 0.18},30 ${W * 0.34},44 Q${W * 0.5},58 ${W * 0.66},42 Q${W * 0.82},28 ${W},44`;
      default:          // pre-rift layer cake
        return `M0,44 L${W},42`;
    }
  })();

  const basin = `${top} L${W},${H} L0,${H} Z`;

  return (
    <svg className="exs-schem" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Generated depositional schematic — ${cycle.stage ?? cycle.geodynamics ?? 'basin fill'}, ${cycle.lithology ?? ''}`}>
      <defs>
        <pattern id={`sand${uid}`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.9" fill="rgba(255,255,255,.55)" />
          <circle cx="5.5" cy="5" r="0.9" fill="rgba(255,255,255,.4)" />
        </pattern>
        <pattern id={`mud${uid}`} width="9" height="6" patternUnits="userSpaceOnUse">
          <path d="M0,2 H5 M4,5 H9" stroke="rgba(255,255,255,.42)" strokeWidth=".8" />
        </pattern>
        <pattern id={`carb${uid}`} width="12" height="8" patternUnits="userSpaceOnUse">
          <path d="M0,4 H12 M0,8 H12 M0,0 V4 M6,4 V8 M12,0 V4"
            stroke="rgba(255,255,255,.4)" strokeWidth=".8" fill="none" />
        </pattern>
        <pattern id={`evap${uid}`} width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M3.5,0 V7" stroke="rgba(255,255,255,.5)" strokeWidth=".9" />
        </pattern>
        <pattern id={`volc${uid}`} width="10" height="7" patternUnits="userSpaceOnUse">
          <path d="M0,6 L5,1 L10,6" stroke="rgba(255,255,255,.45)" strokeWidth=".9" fill="none" />
        </pattern>
        <pattern id={`coal${uid}`} width="10" height="8" patternUnits="userSpaceOnUse">
          <rect width="10" height="2.4" y="2.6" fill="rgba(0,0,0,.55)" />
        </pattern>
        <linearGradient id={`fillg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tint} stopOpacity=".55" />
          <stop offset="100%" stopColor={tint} stopOpacity=".16" />
        </linearGradient>
      </defs>

      {/* water column — only when the fill says the section was subaqueous */}
      {(marine || mixed) && (
        <>
          <rect x="0" y="0" width={W} height={SEA + 14} fill="#0e7490" opacity={mixed ? 0.28 : 0.45} />
          <path d={`M0,${SEA} q6,-3 12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0`}
            stroke="rgba(125,211,252,.8)" strokeWidth="1.1" fill="none" />
        </>
      )}

      {/* basement */}
      <path d={`M0,${H} L0,66 L${W},58 L${W},${H} Z`} fill="#1e293b" />
      <path d={`M0,66 L${W},58`} stroke="#475569" strokeWidth="1" fill="none" />

      {/* the basin fill */}
      <path d={basin} fill={`url(#fillg${uid})`} />
      <path d={basin} fill={`url(#${lt === 'mixed' ? 'sand' : lt}${uid})`} opacity={lt === 'mixed' ? 0.5 : 1} />
      {lt === 'mixed' && <path d={basin} fill={`url(#mud${uid})`} opacity="0.5" />}
      <path d={top} stroke={tint} strokeWidth="1.6" fill="none" />

      {/* the master fault, only where extension is what made the basin */}
      {geo === 'rift' && (
        <path d={`M${W * 0.43},34 L${W * 0.40},${H}`} stroke="#f8fafc" strokeWidth="1.2"
          strokeDasharray="3 2" fill="none" opacity=".75" />
      )}
      {geo === 'compress' && (
        <path d={`M${W * 0.24},${H} L${W * 0.40},40`} stroke="#f8fafc" strokeWidth="1.2"
          strokeDasharray="3 2" fill="none" opacity=".7" />
      )}

      {!compact && (
        <text x="6" y={H - 6} className="exs-schem-cap">
          {(cycle.geodynamics ?? 'basin fill')} · {marine ? 'marine' : mixed ? 'mixed' : 'non-marine'}
        </text>
      )}
    </svg>
  );
}

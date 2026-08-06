// petro-tracks.ts — what a correlation column can actually draw.
//
// This exists because the Input tree was mostly dead. The tree lists the curve
// FAMILIES the delivery carries — on Volve seventeen of them — and the panel
// could draw four. Thirteen rows were a click that did nothing, which reads,
// correctly, as "the tree is not connected to the panel".
//
// So the vocabulary is defined here, once, and it covers every family the LAS
// parser resolves (see dataqc/parse/las.ts FAMILY). A family with no entry is
// still drawable — it falls back to a data-ranged linear track — so a delivery
// carrying a curve we have never seen gets a column rather than a dead row.
//
// THREE tracks are OURS rather than the delivery's, and the tree row for them
// points here on purpose:
//
//   PHIE / PHIT → our PHIE      the delivery ships it in 3 of 24 bores
//   SW          → our Sw        same
//   VSH         → our Vsh       same
//
// Drawing the delivered curve for those would give three columns and twenty-one
// blanks. Ours is the same interpretation under the same parameters in every
// bore, which is the only version that can be correlated. The delivered curve is
// still carried per bore as `ref` and is never merged with ours.

export interface TrackSpec {
  /** stable id, unique across the panel */
  id: string;
  /** column header */
  label: string;
  /** left value of the track, i.e. the value at its left edge */
  lo: number;
  /** right value */
  hi: number;
  color: string;
  /** px */
  w: number;
  /** logarithmic across the track — resistivity and permeability span decades */
  log?: boolean;
  /** where the samples come from: our interpretation, or a delivered family */
  src: { kind: 'ours'; key: 'phie' | 'sw' | 'vsh' | 'gr' | 'net' } | { kind: 'raw'; family: string };
}

/** OUR curves. `net` is a flag, not a measurement — see its width. */
export const OUR_TRACKS: Record<string, TrackSpec> = {
  phie: { id: 'phie', label: 'PHIE', lo: 0.4, hi: 0, color: '#2f9bff', w: 44, src: { kind: 'ours', key: 'phie' } },
  net: { id: 'net', label: 'net', lo: 0, hi: 1, color: '#10b981', w: 14, src: { kind: 'ours', key: 'net' } },
  sw: { id: 'sw', label: 'Sw', lo: 1, hi: 0, color: '#c2582c', w: 44, src: { kind: 'ours', key: 'sw' } },
  vsh: { id: 'vsh', label: 'Vsh', lo: 0, hi: 1, color: '#8a6a3f', w: 40, src: { kind: 'ours', key: 'vsh' } },
};

/**
 * The panel's opening set: PHIE · net · Sw.
 *
 * GR is one tree click away. It is the curve you reach for to decide what the
 * rock IS, and that decision has already been made — by the same parameters —
 * and is expressed in the net ribbon. Three tracks instead of four is a quarter
 * more wells on screen, which is what a correlation panel is for.
 */
export const DEFAULT_TRACK_IDS = ['phie', 'net', 'sw'];

/**
 * A delivered family → its track. Ranges are the conventional display scales,
 * not the data's own: the point of a fixed scale is that the same rock lands in
 * the same place in every well and every field.
 */
const RAW_TRACKS: Record<string, Omit<TrackSpec, 'id' | 'src'>> = {
  GR: { label: 'GR', lo: 0, hi: 150, color: '#7a8b3f', w: 44 },
  SP: { label: 'SP', lo: -100, hi: 100, color: '#6b7280', w: 40 },
  CALI: { label: 'CALI', lo: 6, hi: 16, color: '#94a3b8', w: 34 },
  BS: { label: 'BS', lo: 6, hi: 16, color: '#64748b', w: 30 },
  RHOB: { label: 'RHOB', lo: 1.95, hi: 2.95, color: '#c026d3', w: 44 },
  NPHI: { label: 'NPHI', lo: 0.6, hi: 0, color: '#0891b2', w: 44 },
  PEF: { label: 'PEF', lo: 0, hi: 10, color: '#a16207', w: 34 },
  DT: { label: 'DT', lo: 140, hi: 40, color: '#7c3aed', w: 40 },
  RT: { label: 'RT', lo: 0.2, hi: 200, color: '#dc2626', w: 46, log: true },
  RXO: { label: 'RXO', lo: 0.2, hi: 200, color: '#f97316', w: 44, log: true },
  RMED: { label: 'RMED', lo: 0.2, hi: 200, color: '#ea580c', w: 44, log: true },
  PERM: { label: 'K', lo: 0.01, hi: 10_000, color: '#0f766e', w: 44, log: true },
  PHIT: { label: 'PHIT', lo: 0.4, hi: 0, color: '#38bdf8', w: 40 },
  ROP: { label: 'ROP', lo: 0, hi: 100, color: '#84cc16', w: 36 },
};

/**
 * Families whose tree row means OUR curve rather than the delivered one.
 * See the header — three of twenty-four bores is not a correlation panel.
 */
const OURS_FOR_FAMILY: Record<string, string> = {
  PHIE: 'phie', PHIT: 'phie', SW: 'sw', VSH: 'vsh',
};

/**
 * Canonical left-to-right order. A panel whose columns reorder themselves
 * depending on which order you happened to tick things in is a panel you cannot
 * compare with a screenshot of itself.
 */
const ORDER = [
  'GR', 'SP', 'CALI', 'BS', 'RHOB', 'NPHI', 'PEF', 'DT',
  'RT', 'RXO', 'RMED', 'phie', 'net', 'sw', 'vsh', 'PERM', 'ROP',
];

/** Resolve one tree key (a curve FAMILY) to the track it draws. */
export function trackForFamily(family: string): TrackSpec | null {
  const ours = OURS_FOR_FAMILY[family];
  if (ours && OUR_TRACKS[ours]) return OUR_TRACKS[ours];
  const raw = RAW_TRACKS[family];
  if (raw) return { ...raw, id: 'raw:' + family, src: { kind: 'raw', family } };
  // An unknown family is still a curve the delivery carries. Give it a track
  // with a data-driven scale rather than a dead row — the panel says the scale
  // is auto in the header, so nobody reads it as a standard one.
  return {
    id: 'raw:' + family, label: family, lo: NaN, hi: NaN,
    color: '#64748b', w: 40, src: { kind: 'raw', family },
  };
}

/**
 * The tracks a panel should draw for a tree selection.
 *
 * An empty selection is the ABSENCE of one, not a request for nothing — the
 * panel opens on its default set. `net` is always present: it is the
 * interpretation this panel exists to correlate, it costs 14 px, and a
 * correlation panel with no pay flag is a picture of logs.
 */
export function resolveTracks(panelCurves: string[]): TrackSpec[] {
  if (!panelCurves.length) return DEFAULT_TRACK_IDS.map((id) => OUR_TRACKS[id]);

  const seen = new Map<string, TrackSpec>();
  for (const fam of panelCurves) {
    const t = trackForFamily(fam);
    if (t) seen.set(t.id, t);
  }
  if (!seen.has('net')) seen.set('net', OUR_TRACKS.net);

  const rank = (t: TrackSpec) => {
    const key = t.src.kind === 'ours' ? t.src.key : t.src.family;
    const i = ORDER.indexOf(key);
    return i < 0 ? ORDER.length : i;
  };
  return [...seen.values()].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

/** Total inner width and each track's x offset, in draw order. */
export function trackLayout(tracks: TrackSpec[]): { offs: number[]; inner: number } {
  const offs: number[] = [];
  let x = 0;
  for (const t of tracks) { offs.push(x); x += t.w; }
  return { offs, inner: x };
}

// dataqc/insight.ts — what each asset actually SAYS, for the inventory row.
//
// A row that reads "WLC_COMPOSITE_1.DLIS · las2 · 2.87 MB" tells you a file exists.
// It does not tell you the well has a density log, or that it reached 3,520 m, or
// that it produced 2.1 MMbbl. This turns each digest's own measured metadata into
// the two or three facts that matter for that data type.
//
// Rules:
//  · every value is READ from the asset's meta — nothing is inferred or estimated
//  · volumes and depths render in the PROJECT unit system (units.ts), never raw Sm³
//  · a fact that is genuinely absent is omitted, never filled with a placeholder
//    (the Volve delivery carries no spud dates, so no row claims one)
import type { IngestedAsset } from './types.ts';
import {
  oilVol, gasVol, waterVol, depth as depthQ, depthToMetres, type UnitSystem,
} from '../units.ts';
import { stripEdgeSuffix } from './surface-context.ts';

export interface InsightChip {
  label: string;
  value: string;
  /** longer explanation on hover, when the short value compresses something */
  title?: string;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

/** Depth stored in the asset's own declared unit → the project unit system.
 *  Returns null rather than guessing when the source unit isn't recognised. */
function depthText(value: unknown, sourceUnit: unknown, sys: UnitSystem): string | null {
  const n = num(value);
  if (n == null) return null;
  const m = depthToMetres(n, String(sourceUnit ?? 'm'));
  return m == null ? null : depthQ(m, sys).text;
}
const metresText = (v: unknown, sys: UnitSystem): string | null => {
  const n = num(v);
  return n == null ? null : depthQ(n, sys).text;
};

/** Month keys are already ISO-ish (`2008-02`); render them compactly. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ym(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return s;
  const mi = Number(m[2]) - 1;
  return MONTHS[mi] ? `${MONTHS[mi]} ${m[1]}` : s;
}

/** Curve mnemonics, shortened for the row with the full list on hover. */
function curveSummary(list: string | null, max = 6): { value: string; title?: string } | null {
  if (!list) return null;
  const all = list.split(/\s+/).filter(Boolean);
  if (!all.length) return null;
  return all.length <= max
    ? { value: all.join(' · ') }
    : { value: `${all.slice(0, max).join(' · ')} +${all.length - max}`, title: all.join(', ') };
}

/** Inclination in DEGREES from a survey station.
 *
 *  The Volve delivery mixes two conventions in the same folder: WITSML-derived
 *  surveys carry `incl` in RADIANS alongside an explicit `incl_deg` (F-12: incl
 *  0.96 = 54.95°), while others carry `incl` already in degrees and no `incl_deg`
 *  at all (F-10: incl 88.09). Reading `incl` blindly reports a 55° well as 1°.
 *  `incl_deg` is authoritative wherever the file provides it. */
export function stationInclDeg(st: { incl?: number; incl_deg?: number } | undefined): number | null {
  if (!st) return null;
  const d = num(st.incl_deg);
  if (d != null) return d;
  return num(st.incl);
}

/** Azimuth in DEGREES — same split convention as inclination (F-12: azi 1.84 rad
 *  alongside azi_deg 105.59). */
export function stationAziDeg(st: { azi?: number; azi_deg?: number } | undefined): number | null {
  if (!st) return null;
  const d = num(st.azi_deg);
  if (d != null) return d;
  return num(st.azi);
}

export function assetInsight(a: IngestedAsset, sys: UnitSystem): InsightChip[] {
  const m = a.meta;
  const out: InsightChip[] = [];
  const push = (label: string, value: string | null | undefined, title?: string) => {
    if (value) out.push({ label, value, ...(title ? { title } : {}) });
  };

  switch (a.kind) {
    case 'log': {
      // WHICH curves — the question the row exists to answer
      const c = curveSummary(str(m.curveList));
      if (c) push('curves', c.value, c.title);
      const lo = depthText(m.mdMin, m.depthUnit, sys);
      const hi = depthText(m.mdMax, m.depthUnit, sys);
      if (lo && hi) push('logged', `${lo} – ${hi}`);
      const n = num(m.samples);
      if (n) push('samples', n.toLocaleString('en-US'));
      break;
    }
    case 'trajectory': {
      push('TD', metresText(m.tdMdM, sys), 'Deepest measured depth in this survey');
      push('TVD', metresText(m.tdTvdM, sys));
      const inc = num(m.maxInclDeg);
      if (inc != null) push('max incl', `${inc}°`);
      push('step-out', metresText(m.stepOutM, sys), 'Horizontal distance from surface location to the last station');
      const n = num(m.records);
      if (n) push('stations', String(n));
      break;
    }
    case 'production':
    case 'injection': {
      const oil = num(m.cumOilSm3), gas = num(m.cumGasSm3);
      const water = num(m.cumWaterSm3), inj = num(m.cumInjectedSm3);
      if (oil) push('oil', oilVol(oil, sys).text);
      if (gas) push('gas', gasVol(gas, sys).text);
      if (water) push('water', waterVol(water, sys).text);
      if (inj) push('injected', waterVol(inj, sys).text);
      const from = ym(m.firstMonth), to = ym(m.lastMonth);
      if (from && to) push('period', `${from} – ${to}`);
      const mo = num(m.months);
      if (mo) push('months', String(mo));
      break;
    }
    case 'drilling': {
      const c = curveSummary(str(m.curveList));
      if (c) push('channels', c.value, c.title);
      const n = num(m.samples);
      if (n) push('samples', n.toLocaleString('en-US'));
      push('run', str(m.run));
      break;
    }
    case 'pressure': {
      const runs = num(m.runs);
      if (runs) push('runs', String(runs));
      const rows = num(m.rows);
      if (rows) push('rows', rows.toLocaleString('en-US'));
      const sc = num(m.screened);
      if (sc) push('screened', String(sc), 'Samples outside the physical range, set to null at ingest');
      break;
    }
    case 'surface': {
      const lo = num(m.zmin), hi = num(m.zmax);
      if (lo != null && hi != null) push('depth', `${depthQ(lo, sys).text} – ${depthQ(hi, sys).text}`);
      const ncol = num(m.ncol), nrow = num(m.nrow);
      if (ncol && nrow) push('grid', `${ncol} × ${nrow}`);
      const dx = num(m.dx);
      if (dx) push('cell', `${Math.round(dx)} m`);
      const live = num(m.live), nodes = num(m.nodes);
      if (live != null && nodes) push('coverage', `${Math.round((live / nodes) * 100)}%`,
        `${live.toLocaleString('en-US')} live of ${nodes.toLocaleString('en-US')} nodes`);
      break;
    }
    case 'picks': {
      const n = num(m.records);
      if (n) push('formation tops', String(n));
      break;
    }
    case 'document': {
      const p = num(m.pages);
      if (p) push('pages', String(p));
      const cand = num(m.candidates);
      if (cand) push('candidates', String(cand), 'Knowledge candidates proposed for review in the Extraction Studio');
      const ch = num(m.characters);
      if (ch) push('text', `${Math.round(ch / 1000)}k chars`);
      break;
    }
    case 'wellmaster': {
      const w = num(m.wells), slotted = num(m.wellsWithSlot);
      if (w) push('wellbores', String(w));
      if (w && slotted != null && slotted < w) {
        push('positioned', `${slotted} of ${w}`, 'Wellbores carrying a wellhead coordinate — the rest cannot be drawn');
      }
      const h = num(m.wellheads);
      if (h) push('slots', String(h));
      const c = num(m.contacts);
      if (c) push('contacts', String(c));
      break;
    }
    case 'patterns': {
      const p = num(m.patterns);
      if (p) push('patterns', String(p));
      const i = num(m.injectors), pr = num(m.producers);
      if (i != null && pr != null) push('wells', `${i} inj · ${pr} prod`);
      break;
    }
    default:
      break;
  }
  return out;
}

// ── display naming ───────────────────────────────────────────────────────────

/** "Hugin Fm Top" → "Top Hugin" · "Shetland Gp Base" → "Base Shetland" · "BCU" → "BCU".
 *  The conventional way to say a horizon out loud puts the edge first and drops the
 *  Fm/Gp qualifier; the raw .dat filename stays available as provenance. */
export function cleanSurfaceName(raw: string | null | undefined): string | null {
  const name = str(raw);
  if (!name) return null;
  const { base, isTop, isBase } = stripEdgeSuffix(name);
  const unit = base.replace(/\s+(Fm|Gp|Formation|Group)\.?$/i, '').trim() || base;
  if (isTop) return `Top ${unit}`;
  if (isBase) return `Base ${unit}`;
  return unit;
}

/** The row's headline. Surfaces lead with the horizon, wellbore data with the
 *  wellbore, and anything else falls back to its filename. */
export function assetDisplayName(a: IngestedAsset): string {
  if (a.kind === 'surface') {
    const clean = cleanSurfaceName(str(a.meta.name));
    if (clean) return clean;
  }
  // the master describes every well, so naming it after its filename ("index.json")
  // would hide what it is
  if (a.kind === 'wellmaster') return 'Well master & contacts';
  const well = str(a.meta.well);
  if (well) return `${well} · ${a.kind}`;
  const title = str(a.meta.title);
  if (title) return title;
  return a.fileName;
}

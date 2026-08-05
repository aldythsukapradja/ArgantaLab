// parse/las.ts — LAS 2.0 well-log parser. Pure, isomorphic (Node + browser), no DOM.
// Deterministic: no inference, no repair, no LLM. Anything malformed becomes a QC
// exception upstream rather than a silently "fixed" number.
//
// LAS 2.0 structure:
//   ~V  version    (VERS, WRAP)
//   ~W  well       (STRT, STOP, STEP, NULL, WELL, FLD, …)
//   ~C  curve      (one line per curve: MNEM.UNIT  api : description)
//   ~P  parameter  (optional)
//   ~O  other      (free text)
//   ~A  ascii      (the data matrix; first column is depth)
// Section lines are `MNEM .UNIT   DATA : DESCRIPTION`.
import type { DigestedCurve, DigestedLog } from '../types.ts';

/** Canonical curve families — used for QC ("is this mnemonic known?") and display.
 *  Deliberately small and explicit; an unmapped mnemonic is reported, never guessed. */
const FAMILY: Record<string, string> = {
  GR: 'GR', SGR: 'GR', CGR: 'GR', GRD: 'GR',
  RHOB: 'RHOB', DEN: 'RHOB', RHOZ: 'RHOB',
  NPHI: 'NPHI', TNPH: 'NPHI', NPOR: 'NPHI',
  DT: 'DT', DTC: 'DT', AC: 'DT',
  RT: 'RT', RDEEP: 'RT', LLD: 'RT', RD: 'RT', ILD: 'RT',
  RXO: 'RXO', LLS: 'RXO', MSFL: 'RXO',
  PEF: 'PEF', PE: 'PEF',
  CALI: 'CALI', CAL: 'CALI',
  SP: 'SP',
  PHIF: 'PHIE', PHIE: 'PHIE', PHIT: 'PHIT',
  SW: 'SW', SWE: 'SW', SWT: 'SW',
  VSH: 'VSH', VCL: 'VSH',
  KLOGH: 'PERM', PERM: 'PERM', K: 'PERM',
  // LWD/MWD composites. The build's canonical names (RMED/ROPLOG/BITSIZE) plus the
  // raw ARC tool channels, so an LWD-only wellbore's curves are recognised rather
  // than falling through as unmapped.
  RMED: 'RMED', A28H: 'RMED', P28H: 'RMED', RACELM: 'RMED', RM: 'RMED',
  A40H: 'RT', A34H: 'RT', P40H: 'RT', RACEHM: 'RT',
  GR_ARC: 'GR', MWD_GR_BHC: 'GR', GRAFM: 'GR', GRSIM: 'GR', GRA: 'GR', GRM1: 'GR',
  ROPLOG: 'ROP', ROP: 'ROP', ROP5: 'ROP', ROPAVG: 'ROP',
  BITSIZE: 'BS', BS: 'BS', BDIA: 'BS',
};
export const curveFamily = (mnem: string): string | undefined => FAMILY[mnem.trim().toUpperCase()];

export interface LasHeaderLine { mnem: string; unit: string; data: string; description: string }

/** Parse one LAS header line: `MNEM .UNIT   DATA : DESCRIPTION`. */
export function parseHeaderLine(line: string): LasHeaderLine | null {
  const s = line.trim();
  if (!s || s.startsWith('#')) return null;
  const colon = s.lastIndexOf(':');
  const left = colon === -1 ? s : s.slice(0, colon);
  const description = colon === -1 ? '' : s.slice(colon + 1).trim();
  const dot = left.indexOf('.');
  if (dot === -1) return null;
  const mnem = left.slice(0, dot).trim();
  const rest = left.slice(dot + 1);
  // unit is the token immediately after the dot (may be empty); data is the remainder
  const m = rest.match(/^(\S*)\s*(.*)$/);
  const unit = (m?.[1] ?? '').trim();
  const data = (m?.[2] ?? '').trim();
  if (!mnem) return null;
  return { mnem, unit, data, description };
}

const SECTION_RX = /^~\s*([VWCPOA])/i;

export interface LasParseResult { log: DigestedLog; warnings: string[] }

export function parseLas(text: string): LasParseResult {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);

  let section = '';
  const header: Record<string, string> = {};
  const curveDefs: Array<{ mnem: string; unit: string; description: string }> = [];
  const dataLines: string[] = [];
  let wrap = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const sec = line.match(SECTION_RX);
    if (sec) { section = sec[1].toUpperCase(); continue; }
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    if (section === 'A') { dataLines.push(line); continue; }
    if (section === 'C') {
      const h = parseHeaderLine(line);
      if (h) curveDefs.push({ mnem: h.mnem, unit: h.unit, description: h.description });
      continue;
    }
    if (section === 'V' || section === 'W' || section === 'P') {
      const h = parseHeaderLine(line);
      if (h) {
        header[h.mnem.toUpperCase()] = h.data || h.description;
        if (h.mnem.toUpperCase() === 'WRAP') wrap = /yes|true|y/i.test(h.data);
        if (h.unit && (h.mnem.toUpperCase() === 'STRT' || h.mnem.toUpperCase() === 'STOP' || h.mnem.toUpperCase() === 'STEP')) {
          header[`${h.mnem.toUpperCase()}_UNIT`] = h.unit;
        }
      }
      continue;
    }
  }

  if (!curveDefs.length) warnings.push('No ~C (curve) section — curve names unknown.');
  if (!dataLines.length) warnings.push('No ~A (data) section — file contains no samples.');

  const nullValue = header.NULL != null && header.NULL !== '' && isFinite(Number(header.NULL))
    ? Number(header.NULL) : null;
  if (nullValue === null) warnings.push('No NULL sentinel declared in ~W — blanks treated as missing.');

  // ── data matrix ────────────────────────────────────────────────────────────
  const nCols = curveDefs.length || 0;
  const tokens: number[] = [];
  for (const line of dataLines) {
    for (const t of line.trim().split(/\s+/)) {
      if (!t) continue;
      const v = Number(t);
      tokens.push(Number.isFinite(v) ? v : NaN);
    }
  }
  if (wrap) warnings.push('WRAP=YES — wrapped LAS is read by column count; verify sample alignment.');

  const rows = nCols > 0 ? Math.floor(tokens.length / nCols) : 0;
  if (nCols > 0 && tokens.length % nCols !== 0) {
    warnings.push(`Data matrix is not a whole multiple of ${nCols} columns (${tokens.length} values) — trailing values ignored.`);
  }

  const md: number[] = new Array(rows);
  const cols: (number | null)[][] = curveDefs.map(() => new Array(rows));
  const isNull = (v: number) => !Number.isFinite(v) || (nullValue !== null && Math.abs(v - nullValue) < 1e-9);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < nCols; c++) {
      const v = tokens[r * nCols + c];
      if (c === 0) { md[r] = v; continue; }
      cols[c][r] = isNull(v) ? null : v;
    }
    if (nCols > 0) cols[0][r] = isNull(tokens[r * nCols]) ? null : tokens[r * nCols];
  }

  const depthDef = curveDefs[0] ?? { mnem: 'DEPT', unit: 'm', description: 'Depth' };
  const curves: DigestedCurve[] = curveDefs.slice(1).map((d, i) => ({
    mnemonic: d.mnem,
    unit: d.unit,
    description: d.description || undefined,
    family: curveFamily(d.mnem),
    values: cols[i + 1],
  }));

  const num = (k: string) => (header[k] != null && isFinite(Number(header[k])) ? Number(header[k]) : undefined);

  return {
    log: {
      well: (header.WELL || header.UWI || '').trim() || 'UNKNOWN',
      depthUnit: depthDef.unit || header.STRT_UNIT || '',
      depthMnemonic: depthDef.mnem,
      md,
      curves,
      nullValue,
      header,
      start: num('STRT'), stop: num('STOP'), step: num('STEP'),
    },
    warnings,
  };
}

/** Cheap sniff — is this text a LAS file? */
export const looksLikeLas = (text: string): boolean => /^\s*~V/im.test(text) && /^\s*~A/im.test(text);

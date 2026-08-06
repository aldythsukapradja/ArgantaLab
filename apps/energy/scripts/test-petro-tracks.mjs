// test-petro-tracks.mjs — the tree's vocabulary reaches the panel.
//
// The bug this locks out is not a wrong number, it is a DEAD CONTROL. The Input
// tree lists every curve family the delivery carries; a family the panel cannot
// draw is a row you click and nothing happens, which is indistinguishable from
// a tree that is not wired at all. So: every family the LAS parser resolves must
// resolve to a track.
import { readFileSync } from 'node:fs';
import {
  resolveTracks, trackForFamily, trackLayout, OUR_TRACKS, DEFAULT_TRACK_IDS,
} from '../src/tabs/fielddev/petro-tracks.ts';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };

// Every family the parser can emit — read from the parser itself, so adding a
// mnemonic there and forgetting this file is a test failure and not a dead row.
const las = readFileSync('src/dataqc/parse/las.ts', 'utf8');
const block = las.slice(las.indexOf('const FAMILY'), las.indexOf('export const curveFamily'));
const FAMILIES = [...new Set([...block.matchAll(/:\s*'([A-Z0-9_]+)'/g)].map((m) => m[1]))];

ok('the parser families were actually read', FAMILIES.length > 10, String(FAMILIES.length));

for (const fam of FAMILIES) {
  const t = trackForFamily(fam);
  ok(`${fam} resolves to a track — no dead tree row`, t !== null);
  ok(`${fam} has a positive width`, !!t && t.w > 0);
  ok(`${fam} names where its samples come from`, !!t && !!t.src);
}

// ── ours vs the delivery ─────────────────────────────────────────────────────
{
  // The delivery ships PHIE/SW/VSH in 3 of 24 bores. Drawing THEIRS would be
  // three columns and twenty-one blanks, so those rows mean OUR curve.
  ok('PHIE draws our interpretation', trackForFamily('PHIE').src.kind === 'ours');
  ok('PHIT also draws our PHIE', trackForFamily('PHIT').id === OUR_TRACKS.phie.id);
  ok('SW draws our Sw', trackForFamily('SW').src.kind === 'ours');
  ok('VSH draws our Vsh', trackForFamily('VSH').src.kind === 'ours');
  // …and the measurements stay measurements
  ok('GR draws the delivered curve', trackForFamily('GR').src.kind === 'raw');
  ok('RHOB draws the delivered curve', trackForFamily('RHOB').src.family === 'RHOB');
}

// ── scales that carry meaning ────────────────────────────────────────────────
{
  ok('resistivity is logarithmic', trackForFamily('RT').log === true);
  ok('permeability is logarithmic', trackForFamily('PERM').log === true);
  ok('neutron is drawn reversed, as a log is read', trackForFamily('NPHI').lo > trackForFamily('NPHI').hi);
  ok('sonic is drawn reversed', trackForFamily('DT').lo > trackForFamily('DT').hi);
  ok('Sw is drawn reversed — low Sw is the good end', OUR_TRACKS.sw.lo > OUR_TRACKS.sw.hi);
  ok('GR is not logarithmic', !trackForFamily('GR').log);
}

// ── an unknown family is still drawable ──────────────────────────────────────
{
  const t = trackForFamily('WHATEVER');
  ok('an unrecognised family still gets a track rather than a dead row', t !== null);
  ok('and it is labelled with its own name', t.label === 'WHATEVER');
  ok('with no declared scale, so the panel knows to auto-range it',
    !Number.isFinite(t.lo) && !Number.isFinite(t.hi));
}

// ── the default set ──────────────────────────────────────────────────────────
{
  const d = resolveTracks([]);
  ok('an empty selection is the ABSENCE of one, not a request for nothing', d.length === 3);
  ok('it opens on PHIE · net · Sw',
    d.map((t) => t.id).join(',') === DEFAULT_TRACK_IDS.join(','), d.map((t) => t.id).join(','));
  ok('GR is NOT in the default set', !d.some((t) => t.label === 'GR'));
}

// ── a selection reaches the panel ────────────────────────────────────────────
{
  const t = resolveTracks(['GR']);
  ok('ticking GR puts GR on the panel', t.some((x) => x.label === 'GR'));
  ok('and net rides along — a correlation panel without a pay flag is a picture of logs',
    t.some((x) => x.id === 'net'));
  ok('but nothing else is dragged in', t.length === 2, t.map((x) => x.label).join(','));
}
{
  const t = resolveTracks(['RHOB', 'NPHI', 'RT']);
  ok('a three-curve selection draws three curves plus net', t.length === 4);
  // canonical order, not tick order — a panel that reorders itself cannot be
  // compared with a screenshot of itself
  const a = resolveTracks(['RT', 'NPHI', 'RHOB']).map((x) => x.label).join(',');
  const b = resolveTracks(['RHOB', 'NPHI', 'RT']).map((x) => x.label).join(',');
  ok('column order does not depend on the order you ticked', a === b, `${a} vs ${b}`);
  ok('density comes before resistivity', b.indexOf('RHOB') < b.indexOf('RT'), b);
}
{
  const t = resolveTracks(['PHIE', 'PHIT']);
  ok('two families that mean the same track do not draw it twice',
    t.filter((x) => x.label === 'PHIE').length === 1);
}
{
  ok('ticking a family that is only ever net still leaves a usable panel',
    resolveTracks(['VSH']).length >= 2);
}

// ── layout ───────────────────────────────────────────────────────────────────
{
  const t = resolveTracks([]);
  const l = trackLayout(t);
  ok('the first track sits at zero', l.offs[0] === 0);
  ok('offsets accumulate the real widths', l.offs[1] === t[0].w && l.offs[2] === t[0].w + t[1].w);
  ok('inner width is the sum', l.inner === t.reduce((n, x) => n + x.w, 0));
  // net is a FLAG: one bit per sample does not earn a full column
  ok('net is much narrower than a measurement track', OUR_TRACKS.net.w < OUR_TRACKS.phie.w / 2);
  const empty = trackLayout([]);
  ok('no tracks is a zero-width column, not a crash', empty.inner === 0 && empty.offs.length === 0);
}

console.log(`petro-tracks: ${pass}/${pass + fail}`);
if (fail) process.exit(1);

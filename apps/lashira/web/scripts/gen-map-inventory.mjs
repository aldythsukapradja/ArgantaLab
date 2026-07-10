#!/usr/bin/env node
// Regenerates the AUTO-marked sections of
//   docs/lashirabloom/Openworld Bloom Concept/MAP-full-element-inventory.md
// from the REAL source of truth — farm-map.js, world-map-registry.js, and the
// realm loop modules — so the doc can never silently drift from the code.
//
// This does NOT execute the game (no DOM, no imports of .jsx/browser files).
// It extracts plain object/array LITERALS by text (brace-balanced scan) and
// evaluates just that literal text via `new Function`, so it's safe even
// though the source files import browser-only modules at the top.
//
// Run after touching any of: farm-map.js, world-map-registry.js, realms/*.js
//   node scripts/gen-map-inventory.mjs
// (wired as `npm run map:sync` — see package.json)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..', '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'lashirabloom', 'Openworld Bloom Concept', 'MAP-full-element-inventory.md');

const FARM_MAP = path.join(ROOT, 'src', 'game', 'farm-map.js');
const REGISTRY = path.join(ROOT, 'src', 'game', 'world-map-registry.js');
const REALMS_DIR = path.join(ROOT, 'src', 'game', 'realms');

// ---------- brace-balanced literal extraction (no eval of the whole file) ----------
function extractLiteral(src, declRegex, scope = {}) {
  const m = declRegex.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  // skip whitespace
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  let literal;
  if (!close) {
    // bare primitive (number/string), e.g. `export const ARENA_WALL_Y = 33;`
    // — read up to the statement-ending `;` or line end.
    const rest = src.slice(i);
    const end = rest.search(/[;\n]/);
    literal = end === -1 ? rest.trim() : rest.slice(0, end).trim();
  } else {
    let depth = 0, j = i;
    for (; j < src.length; j++) {
      if (src[j] === open) depth++;
      else if (src[j] === close) { depth--; if (depth === 0) { j++; break; } }
    }
    literal = src.slice(i, j);
  }
  const keys = Object.keys(scope);
  try { return new Function(...keys, 'return (' + literal + ')')(...keys.map((k) => scope[k])); }
  catch (e) { console.warn('  [warn] failed to eval literal for', declRegex, '-', e.message); return null; }
}

function loadConst(src, name, scope) {
  return extractLiteral(src, new RegExp(`export const ${name}\\s*=`), scope);
}
function loadLocalConst(src, name, scope) {
  return extractLiteral(src, new RegExp(`const ${name}\\s*=`), scope);
}

// ---------- pull farm-map.js ----------
const farmSrc = readFileSync(FARM_MAP, 'utf8');
const FIELD = loadConst(farmSrc, 'FIELD');
const ZONES = loadConst(farmSrc, 'ZONES');
const ARENA = loadConst(farmSrc, 'ARENA');
const PVP = loadConst(farmSrc, 'PVP');
const ARENA_WALL_Y = loadConst(farmSrc, 'ARENA_WALL_Y');
const ARENA_GATE_X = loadConst(farmSrc, 'ARENA_GATE_X');
const PENS = loadConst(farmSrc, 'PENS');
const BUILDINGS = loadConst(farmSrc, 'BUILDINGS');
const PLACEMENTS = loadConst(farmSrc, 'PLACEMENTS');
const CASTLE = loadConst(farmSrc, 'CASTLE');
const SPAWN = loadConst(farmSrc, 'SPAWN');
const ONTOP = loadLocalConst(farmSrc, 'ONTOP', { CASTLE });
const ORE_NODES = loadLocalConst(farmSrc, 'ORE_NODES');
const TREE_NODES = loadLocalConst(farmSrc, 'TREE_NODES');
// HOTSPOTS static part: rather than trying to regex-strip the leading
// "...WORLD_PORTALS.map(...)" spread (fragile — silently broke once already),
// scan the array's raw text and pull out each TOP-LEVEL `{...}` object
// directly. This ignores whatever non-object content (spreads, comments)
// sits between them, so it survives that spread line being reworded.
function extractRawArraySource(src, name) {
  const re = new RegExp(`export const ${name}\\s*=`);
  const m = re.exec(src);
  let i = m.index + m[0].length;
  while (/\s/.test(src[i])) i++;
  let depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '[') depth++; else if (src[j] === ']') { depth--; if (depth === 0) { j++; break; } } }
  return src.slice(i, j);
}
function extractTopLevelObjects(arrayText) {
  const out = [];
  let i = 0;
  while (i < arrayText.length) {
    if (arrayText[i] === '{') {
      let depth = 0, j = i;
      for (; j < arrayText.length; j++) {
        if (arrayText[j] === '{') depth++;
        else if (arrayText[j] === '}') { depth--; if (depth === 0) { j++; break; } }
      }
      const obj = arrayText.slice(i, j);
      try { out.push(new Function('return (' + obj + ')')()); }
      catch (e) { console.warn('  [warn] skipped one HOTSPOTS row (unparseable):', e.message); }
      i = j;
    } else i++;
  }
  return out;
}
const hotspotsRaw = extractRawArraySource(farmSrc, 'HOTSPOTS');
const HOTSPOTS = extractTopLevelObjects(hotspotsRaw);

// ---------- pull world-map-registry.js ----------
const regSrc = readFileSync(REGISTRY, 'utf8');
const WORLD_MAPS = loadConst(regSrc, 'WORLD_MAPS');

// ---------- pull realm module literals (best-effort; some realms are dynamic) ----------
const kitchenSrc = readFileSync(path.join(REALMS_DIR, 'kitchen.jsx'), 'utf8');
const STATIONS = loadLocalConst(kitchenSrc, 'STATIONS');

// bloomwall.js's lane geometry is actively evolving (real bestiary monsters,
// forking lanes) — extract defensively so a future reshape warns instead of
// crashing the sync. Current shape (2026-07-10): LEAD_IN -> fork into
// BRANCH_A/BRANCH_B at SPLIT -> MERGE -> TAIL -> CORE; PADS is now an array
// of { tile:[x,y] } objects (was plain [x,y] pairs).
const bloomwallSrc = readFileSync(path.join(REALMS_DIR, 'bloomwall.js'), 'utf8');
let BW_LEAD_IN = null, BW_BRANCH_A = null, BW_BRANCH_B = null, BW_CORE = null, BW_PADS = null;
try {
  BW_LEAD_IN = loadLocalConst(bloomwallSrc, 'LEAD_IN');
  BW_CORE = loadLocalConst(bloomwallSrc, 'CORE');
  const MERGE = loadLocalConst(bloomwallSrc, 'MERGE');
  const SPLIT = BW_LEAD_IN ? BW_LEAD_IN[BW_LEAD_IN.length - 1] : null;
  BW_BRANCH_A = loadLocalConst(bloomwallSrc, 'BRANCH_A', { SPLIT, MERGE });
  BW_BRANCH_B = loadLocalConst(bloomwallSrc, 'BRANCH_B', { SPLIT, MERGE });
  BW_PADS = loadLocalConst(bloomwallSrc, 'PADS');
  // fall back to the older flat-array shape if PADS.tile isn't present
  if (BW_PADS && BW_PADS.length && !BW_PADS[0].tile) BW_PADS = BW_PADS.map((p) => ({ tile: p }));
} catch (e) { console.warn('  [warn] bloomwall.js lane extraction partially failed — its geometry may have reshaped again:', e.message); }

const keepSrc = readFileSync(path.join(REALMS_DIR, 'keep.js'), 'utf8');
const KEEP_DEFAULTS = loadLocalConst(keepSrc, 'DEFAULTS');

// festival.jsx and arena.js have NO fixed world-space object coordinates in
// code today (festival's board is a DOM overlay; arena's dummies spawn via a
// random-range function) — deliberately not extracted; the doc says so.

// ---------- render markdown ----------
const rectStr = (r) => `${r.x0},${r.y0} – ${r.x1},${r.y1}`;
const md = [];

md.push('### 1.1 Named zones (regions)');
md.push('| Zone | Rect (x0,y0 – x1,y1) | Source |');
md.push('|---|---|---|');
md.push(`| Farm field (\`FIELD\`) | ${rectStr(FIELD)} | \`FIELD\` |`);
for (const [k, r] of Object.entries(ZONES)) md.push(`| ${cap(k)} (\`ZONES.${k}\`) | ${rectStr(r)} | \`ZONES.${k}\` |`);
md.push(`| Battleground band (\`ARENA\`) | ${rectStr(ARENA)} | \`ARENA\` |`);
md.push(`| PvP arena (\`PVP\`, sub-rect of ARENA) | ${rectStr(PVP)} | \`PVP\` |`);
md.push(`| Battleground-only (ARENA − PVP) | ${ARENA.x0},${ARENA.y0} – ${PVP.x0 - 1},${ARENA.y1} | derived |`);
for (const [k, r] of Object.entries(PENS)) md.push(`| ${cap(k)} pen (\`PENS.${k}\`) | ${rectStr(r)} | gate: ${r.gate} |`);
md.push('');
md.push(`Dividing wall: \`ARENA_WALL_Y = ${ARENA_WALL_Y}\`, gate at \`ARENA_GATE_X = ${ARENA_GATE_X}\` (tiles ${ARENA_GATE_X}–${ARENA_GATE_X + 1}).`);
md.push('');

md.push('### 1.2 Buildings');
md.push('| Key | Type | Anchor (tx,ty) | Size (w×h) | Label |');
md.push('|---|---|---|---|---|');
for (const b of BUILDINGS) md.push(`| \`${b.key}\` | ${b.type} | ${b.tx},${b.ty} | ${b.w}×${b.h} | ${b.label} |`);
md.push('');
md.push(`Castle sprite anchor: \`CASTLE = {cx:${CASTLE.cx}, cy:${CASTLE.cy}, w:${CASTLE.w}, baseTx:${CASTLE.baseTx}, baseTy:${CASTLE.baseTy}, baseW:${CASTLE.baseW}, baseH:${CASTLE.baseH}}\`.`);
md.push('');

md.push('### 1.3 Baked placements (decorative + solid props) — ' + PLACEMENTS.length + ' items');
md.push('| # | Prop key | Anchor (tx,ty) | Size | Solid? |');
md.push('|---|---|---|---|---|');
PLACEMENTS.forEach((p, i) => md.push(`| ${i + 1} | \`${p.key}\` | ${p.tx},${p.ty} | ${p.w}×${p.h} | ${p.solid ? '✅' : '—'} |`));
md.push('');

md.push('### 1.4 The REAL visible/clickable shops (`ONTOP` — drawn after the basemap image; the plaza-ring copies in §1.3 render underneath the art and are invisible)');
md.push('| Shop key | Anchor (tx,ty) | Size | Solid? |');
md.push('|---|---|---|---|');
for (const p of ONTOP) { if (p.noDraw) continue; md.push(`| \`${p.key}\` | ${p.tx},${p.ty} | ${p.w}×${p.h} | ${p.solid ? '✅' : '—'} |`); }
md.push('');

md.push('### 1.5 Interactive hotspot registry (static rows — excludes the 5 realm portals, listed in 1.6)');
md.push('| Kind | id | Rect | Status |');
md.push('|---|---|---|---|');
for (const h of HOTSPOTS) {
  if (h.kind === 'ore' || h.kind === 'tree') continue; // harvest nodes listed separately below
  const status = h.ported === false ? '🔴 not wired' : '🟢 live';
  md.push(`| ${h.kind} | \`${h.id}\` | ${rectStr(h.rect)} | ${status} |`);
}
md.push('');

md.push('### 1.6 The 5 world portals (from `world-map-registry.js`, live)');
md.push('| Portal | Name | hqHotspot rect | hqReturn | spawn | color |');
md.push('|---|---|---|---|---|---|');
for (const [id, p] of Object.entries(WORLD_MAPS)) {
  md.push(`| \`${id}\` | ${p.name} | ${rectStr(p.hqHotspot)} | [${p.hqReturn.join(',')}] | [${p.spawn.join(',')}] | ${p.color} |`);
}
md.push('');

md.push('### 1.7 Harvest nodes (' + (ORE_NODES.length + TREE_NODES.length) + ' total)');
md.push('**Ore (' + ORE_NODES.length + '):** ' + ORE_NODES.map(([ore, x, y]) => `${ore} ${x},${y}`).join(' · '));
md.push('');
md.push('**Trees (' + TREE_NODES.length + '):** ' + TREE_NODES.map(([x, y, hard]) => `${hard ? '**oak**' : 'pine'} ${x},${y}`).join(' · '));
md.push('');

md.push('### 1.8 Special markers');
md.push('| Marker | Value |');
md.push('|---|---|');
md.push(`| \`SPAWN\` | [${SPAWN.join(',')}] |`);
md.push('');

md.push('### 1.9 Realm module coordinates (what the CODE currently assumes — cross-check against §2 visual notes for drift)');
md.push('**Hearthrush Kitchen** `STATIONS`:');
for (const [k, s] of Object.entries(STATIONS)) md.push(`- \`${k}\`: tile ${s.tx},${s.ty}, ${s.w}×${s.h}, icon ${s.icon}`);
md.push('');
if (BW_LEAD_IN && BW_CORE && BW_PADS) {
  md.push('**Bloomwall Pass**: `LEAD_IN` = ' + BW_LEAD_IN.map((p) => `[${p.join(',')}]`).join(' → '));
  if (BW_BRANCH_A) md.push('  → fork **Branch A** (upper, shorter) = ' + BW_BRANCH_A.map((p) => `[${p.join(',')}]`).join(' → '));
  if (BW_BRANCH_B) md.push('  → fork **Branch B** (lower, winding) = ' + BW_BRANCH_B.map((p) => `[${p.join(',')}]`).join(' → '));
  md.push(`  → \`CORE\` = [${BW_CORE.join(',')}]`);
  md.push(`- \`PADS\` (${BW_PADS.length}): ` + BW_PADS.map((p) => `[${p.tile.join(',')}]`).join(', '));
} else {
  md.push('**Bloomwall Pass**: ⚠ lane geometry extraction incomplete — `bloomwall.js` has reshaped since this script was last updated; re-check `scripts/gen-map-inventory.mjs` against the current file.');
}
md.push('');
md.push('**Lashira Keep** `DEFAULTS` districts:');
for (const d of KEEP_DEFAULTS) md.push(`- \`${d.key}\`: tile ${d.tx},${d.ty}, ${d.name} (${d.icon})`);
md.push('');
md.push('**Fountain Festival**: no fixed world-space coordinates in code — the match board is a DOM overlay (`movement:false`), not anchored to a map position.');
md.push('');
md.push('**Emberring Arena**: no fixed world-space coordinates in code — training dummies spawn via a random range (`SPAWN()`), not fixed points.');
md.push('');

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------- splice into the doc between AUTO markers ----------
const doc = readFileSync(DOC_PATH, 'utf8');
const START = '<!-- AUTO:KINGDOM:START -->';
const END = '<!-- AUTO:KINGDOM:END -->';
const startIdx = doc.indexOf(START);
const endIdx = doc.indexOf(END);
if (startIdx === -1 || endIdx === -1) {
  console.error('AUTO markers not found in', DOC_PATH, '— run once by hand to seed them, or check the doc has not been restructured.');
  process.exit(1);
}
const before = doc.slice(0, startIdx + START.length);
const after = doc.slice(endIdx);
const stamp = `\n\n<!-- Generated by apps/lashira/web/scripts/gen-map-inventory.mjs on ${new Date().toISOString()} — do not hand-edit this section. -->\n\n`;
const next = before + stamp + md.join('\n') + '\n\n' + after;
writeFileSync(DOC_PATH, next, 'utf8');
console.log('✓ Synced Kingdom map section into', DOC_PATH);
console.log('  zones:', Object.keys(ZONES).length + 2, '· buildings:', BUILDINGS.length, '· placements:', PLACEMENTS.length,
  '· hotspots:', HOTSPOTS.filter(h => h.kind !== 'ore' && h.kind !== 'tree').length, '· portals:', Object.keys(WORLD_MAPS).length,
  '· ore nodes:', ORE_NODES.length, '· tree nodes:', TREE_NODES.length);

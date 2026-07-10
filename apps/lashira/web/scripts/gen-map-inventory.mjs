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

// bloomwall.js's lane geometry has actively evolved this session (from a fixed
// 4-pad row, to a forking 2-lane/8-pad system, to today's single traced lane
// with FREE tower placement — no fixed pads at all, any legal tile near the
// lane works). Extract defensively so a future reshape warns instead of
// crashing the sync. Current shape (2026-07-10): `PATH` = single traced
// lane, `CORE = PATH[last]`, `TOWERS` = the placeable tower catalog (no
// fixed world position — towers go wherever the player taps).
const bloomwallSrc = readFileSync(path.join(REALMS_DIR, 'bloomwall.js'), 'utf8');
let BW_PATH = null, BW_CORE = null, BW_TOWERS = null;
try {
  BW_PATH = loadLocalConst(bloomwallSrc, 'PATH');
  BW_CORE = BW_PATH ? loadLocalConst(bloomwallSrc, 'CORE', { PATH: BW_PATH }) : null;
  BW_TOWERS = loadLocalConst(bloomwallSrc, 'TOWERS');
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
if (BW_PATH && BW_CORE) {
  md.push('**Bloomwall Pass**: `PATH` (' + BW_PATH.length + ' points) = ' + BW_PATH.map((p) => `[${p.join(',')}]`).join(' → '));
  md.push(`  → \`CORE\` = [${BW_CORE.join(',')}]`);
  md.push('- Tower placement is FREE (no fixed pads) — any tile far enough from the lane is buildable. Tower catalog' + (BW_TOWERS ? ` (${Object.keys(BW_TOWERS).length})` : '') + ': ' + (BW_TOWERS ? Object.values(BW_TOWERS).map((t) => `${t.icon} ${t.name}`).join(', ') : '⚠ not extracted'));
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

// ---------- openworld-manifest.json — the data source the Openworld Builder
// (Circle HQ surface) loads, so it starts populated with EVERY real component
// instead of demo stubs. Same extracted variables as the markdown above —
// one extraction, two outputs, so they can never drift from each other. ----------
const fileOf = (id) => (id === 'kingdom' ? 'basemap.png' : WORLD_MAPS[id]?.file || null);
const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  maps: {
    kingdom: {
      image: 'basemap.png', grid: [60, 48],
      zones: { field: FIELD, ...ZONES, arena: ARENA, pvp: PVP, ...Object.fromEntries(Object.entries(PENS).map(([k, r]) => [`pen_${k}`, r])) },
      buildings: BUILDINGS,
      placements: PLACEMENTS,
      ontop: ONTOP,
      hotspots: HOTSPOTS.map((h) => ({ kind: h.kind, id: h.id, rect: h.rect, ported: h.ported !== false })),
      portals: Object.entries(WORLD_MAPS).map(([id, p]) => ({ id, name: p.name, color: p.color, hqHotspot: p.hqHotspot, hqReturn: p.hqReturn, spawn: p.spawn })),
      harvestNodes: {
        ore: ORE_NODES.map(([ore, x, y]) => ({ ore, x, y })),
        trees: TREE_NODES.map(([x, y, hard]) => ({ x, y, hard })),
      },
      special: { castle: CASTLE, spawn: SPAWN, arenaWallY: ARENA_WALL_Y, arenaGateX: ARENA_GATE_X },
    },
    hearthrush_kitchen: {
      image: fileOf('hearthrush_kitchen'), grid: [60, 48],
      objects: Object.entries(STATIONS).map(([k, s]) => ({ id: k, kind: 'station', tile: [s.tx, s.ty], size: [s.w, s.h], icon: s.icon })),
    },
    bloomwall_pass: {
      image: fileOf('bloomwall_pass'), grid: [60, 48],
      lane: BW_PATH || [],
      objects: BW_CORE ? [{ id: 'core', kind: 'core', tile: BW_CORE }] : [],
      towerCatalog: BW_TOWERS ? Object.values(BW_TOWERS).map((t) => ({ id: t.id, name: t.name, icon: t.icon })) : [],
      placement: 'free', // no fixed pads — any legal tile near the lane is buildable
    },
    lashira_keep: {
      image: fileOf('lashira_keep'), grid: [60, 48],
      objects: KEEP_DEFAULTS.map((d) => ({ id: d.key, kind: 'district', tile: [d.tx, d.ty], icon: d.icon, label: d.name })),
    },
    fountain_festival: {
      image: fileOf('fountain_festival'), grid: [60, 48], objects: [],
      note: 'board is a DOM overlay, no fixed world-space coordinates in code',
    },
    emberring_arena: {
      image: fileOf('emberring_arena'), grid: [60, 48], objects: [],
      note: 'training-dummy spawns are fully random in code, no fixed coordinates',
    },
  },
};
const manifestJson = JSON.stringify(manifest, null, 2);
const LASHIRA_MANIFEST_PATH = path.join(ROOT, 'public', 'farm-art', 'openworld-manifest.json');
const HQ_MANIFEST_PATH = path.join(REPO_ROOT, 'apps', 'hq', 'public', 'farm-art', 'openworld-manifest.json');
writeFileSync(LASHIRA_MANIFEST_PATH, manifestJson, 'utf8');
try {
  writeFileSync(HQ_MANIFEST_PATH, manifestJson, 'utf8');
  console.log('✓ Wrote openworld-manifest.json to lashira/public + hq/public (Builder data source)');
} catch (e) {
  console.warn('  [warn] wrote lashira manifest but could not copy into apps/hq/public (Builder will be stale):', e.message);
}

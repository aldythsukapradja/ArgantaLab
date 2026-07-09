// COMBAT COMMAND-CENTER COVERAGE AUDIT.
// Enumerates every lever that controls battle / PvP / PvE / boss / exp / loot and
// checks three things for each:
//   [cfg]  is it carried by the tuning config (COMBAT_DEFAULTS)?
//   [live] does applyTuning() push it into a live shared object?
//   [game] does the shipped LashiraBloom combat actually READ it today?
// The first two are verified programmatically; [game] is encoded from a code read
// (FarmRoom / farm-logic / gear) and noted per row.
//
//   node packages/combat/tests/coverage-audit.mjs

import { COMBAT_DEFAULTS, applyTuning, resetTuning, SPAWN_TUNING, REWARD_TUNING } from '../src/tuning.js';
import { PATH_POWER, PVP_PROFILE, PVP_TUNING, boltDamage, physBase, SKILL_SLOTS } from '../src/skills.js';
import { BESTIARY, ZONE_MOBS } from '../src/bestiary.js';
import { weaponAtk, armorDef } from '../src/gear.js';
import { pathMaxHp, xpForLevel } from '../src/progression.js';

// walk a dotted path in the default config
const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// Each lever: group, name, cfgPath (in COMBAT_DEFAULTS or null), a probe that
// returns [before, after] around an applyTuning to prove the live wire, and the
// game-read status.
const LEVERS = [
  // group, name, cfgPath, liveProbe (fn -> changed?), game
  ['Player', 'Path magic/physical ×', 'paths.mage.mag', () => probe({ paths: { mage: { mag: 1.2 } } }, () => PATH_POWER.mage.mag), 'yes'],
  ['Player', 'PvP profile (atkInt/move/hp/heal)', 'paths.rogue.atkInt', () => probe({ paths: { rogue: { atkInt: 0.8 } } }, () => PVP_PROFILE.rogue.atkInt), 'no'],
  ['Player', 'Melee base damage', 'damage.phys.base', () => probe({ damage: { phys: { base: 50 } } }, () => physBase(1)), 'yes'],
  ['Player', 'Skill base curves', 'damage.bolt.base', () => probe({ damage: { bolt: { base: 88 } } }, () => boltDamage(1)), 'yes'],
  ['Player', 'HP / MP pools (per path/level)', 'pools.warrior.hp', () => probe({ pools: { warrior: { hp: 200 } } }, () => pathMaxHp('warrior', 1)), 'yes'],
  ['Player', 'XP ladder / level curve', 'xp.base', () => probe({ xp: { base: 120 } }, () => xpForLevel(2)), 'yes'],
  ['Skills', 'MP cost · targeting · loadout', 'skills.bolt.manaCost', () => probe({ skills: { bolt: { manaCost: 6 } } }, () => SKILL_SLOTS.find(s => s.id === 'bolt').manaCost), 'partial'],
  ['Skills', 'Add new attack types', null, null, 'no'],
  ['Gear',   'Weapon ATK tiers', 'gear.weapons.t3.atk', () => probe({ gear: { weapons: { t3: { atk: 300 } } } }, () => weaponAtk(3)), 'yes'],
  ['Gear',   'Armor DEF / HP tiers', 'gear.armor.t3.def', () => probe({ gear: { armor: { t3: { def: 90 } } } }, () => armorDef(3)), 'yes'],
  ['Gear',   'Upgrade costs', null, null, 'yes'],
  ['PvE',    'Enemy HP', 'enemies.boar.hp', () => probe({ enemies: { boar: { hp: 999 } } }, () => BESTIARY.boar.hp), 'yes'],
  ['PvE',    'Enemy ATK (damage to player)', 'enemies.boar.atk', () => probe({ enemies: { boar: { atk: 55 } } }, () => BESTIARY.boar.atk), 'yes'],
  ['PvE',    'Enemy speed', 'enemies.boar.speedMs', () => probe({ enemies: { boar: { speedMs: 400 } } }, () => BESTIARY.boar.speedMs), 'yes'],
  ['PvE',    'Enemy behavior / AI', null, null, 'no'],
  ['PvE',    'Zone gating (which mob, where)', 'zones.meadow', () => probe({ zones: { meadow: ['squirrel'] } }, () => ZONE_MOBS.meadow.length), 'partial'],
  ['Spawn',  'Max concurrent', 'spawn.maxConcurrent', () => probe({ spawn: { maxConcurrent: 8 } }, () => SPAWN_TUNING.maxConcurrent), 'yes'],
  ['Spawn',  'Respawn interval', 'spawn.intervalMs', () => probe({ spawn: { intervalMs: 600 } }, () => SPAWN_TUNING.intervalMs), 'yes'],
  ['Spawn',  'Roster', 'spawn.roster', () => probe({ spawn: { roster: ['squirrel'] } }, () => SPAWN_TUNING.roster.length), 'yes'],
  ['Boss',   'Boss stats (hp/atk/xp/bloom)', 'enemies.tiger.hp', () => probe({ enemies: { tiger: { hp: 25000 } } }, () => BESTIARY.tiger.hp), 'yes'],
  ['Boss',   'Phases / telegraph / enrage', null, null, 'no'],
  ['Boss',   'Spawn gate / conditions', null, null, 'no'],
  ['Exp',    'Kill XP (per enemy)', 'enemies.fox.xp', () => probe({ enemies: { fox: { xp: 77 } } }, () => BESTIARY.fox.xp), 'yes'],
  ['Exp',    'Global XP multiplier', 'rewards.xpMul', () => probe({ rewards: { xpMul: 3 } }, () => REWARD_TUNING.xpMul), 'yes'],
  ['Loot',   'Kill Bloom (per enemy)', 'enemies.fox.bloom', () => probe({ enemies: { fox: { bloom: 44 } } }, () => BESTIARY.fox.bloom), 'yes'],
  ['Loot',   'Global Bloom multiplier', 'rewards.bloomMul', () => probe({ rewards: { bloomMul: 2 } }, () => REWARD_TUNING.bloomMul), 'yes'],
  ['Loot',   'Drop tables (material · rate)', 'enemies.fox.drops', () => probe({ enemies: { fox: { drops: [{ k: 'gem', min: 1, max: 1, p: 1 }] } } }, () => JSON.stringify(BESTIARY.fox.drops)), 'yes'],
  ['PvP',    'PvP damage / HP / reach', 'pvp.boltReach', () => probe({ pvp: { boltReach: 4 } }, () => PVP_TUNING.boltReach), 'no'],
  ['Scale',  'Add new monster from HQ (no deploy)', null, null, 'no'],
  ['Scale',  'Add subclass', null, null, 'no'],
  ['Scale',  'Per-game scope (Kingdom vs Lashira)', null, null, 'no'],
];

function probe(override, read) { const before = read(); applyTuning(override); const after = read(); resetTuning(); return before !== after; }

const MK = { yes: '\x1b[32m✓ live\x1b[0m', no: '\x1b[31m✗\x1b[0m', partial: '\x1b[33m~ partial\x1b[0m' };
const yn = (b) => b ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';

console.log('\n=== COMBAT COMMAND-CENTER — coverage audit ===\n');
console.log('  ' + 'lever'.padEnd(40) + 'cfg  apply  read-by-game');
let cfgN = 0, applyN = 0, gameN = 0, total = 0, liveControl = 0;
let group = '';
for (const [g, name, cfgPath, probeFn, game] of LEVERS) {
  if (g !== group) { group = g; console.log('\n  \x1b[1m' + g.toUpperCase() + '\x1b[0m'); }
  const inCfg = cfgPath ? at(COMBAT_DEFAULTS, cfgPath) !== undefined : false;
  const applies = probeFn ? probeFn() === true : false;
  if (inCfg) cfgN++; if (applies) applyN++; if (game === 'yes') gameN++; total++;
  // "controllable live TODAY" = tunable AND applied AND read by the game
  const controlNow = inCfg && applies && game === 'yes';
  if (controlNow) liveControl++;
  console.log('   ' + (controlNow ? '\x1b[32m●\x1b[0m ' : '  ') + name.padEnd(38) + ' ' + yn(inCfg) + '    ' + yn(applies) + '     ' + MK[game]);
}
console.log('\n  ── summary ──');
console.log(`  levers audited:            ${total}`);
console.log(`  carried by config:         ${cfgN}/${total}`);
console.log(`  applied to live objects:   ${applyN}/${total}`);
console.log(`  read by the game today:    ${gameN}/${total}`);
console.log(`  \x1b[1mCONTROLLABLE LIVE NOW (all three): ${liveControl}/${total}  (${Math.round(100 * liveControl / total)}%)\x1b[0m`);
console.log('\n  ● = you can change it in HQ and it takes effect in the game today.');
console.log('  Everything else is a gap → see docs/lashirabloom/battle-command-audit.md\n');

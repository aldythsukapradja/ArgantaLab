// Battle test for the combat-tuning PIPELINE (HQ publish → transport → game load
// → apply → effective combat changes). Runs the REAL modules; a mock Supabase
// client stands in for the DB so the whole round-trip is exercised offline.
//
//   node packages/combat/tests/pipeline-harness.mjs

// Import the specific modules (not index.js — it re-exports .jsx which Node can't parse).
import {
  COMBAT_DEFAULTS, mergeTuning, validateTuning, applyTuning, resetTuning,
  serializeTuning, parseTuning, fairnessSummary, TUNING_VERSION,
} from '../src/tuning.js';
import { SPAWN_TUNING, REWARD_TUNING } from '../src/tuning.js';
import { publishTuning, loadActiveTuning, bootCombatTuning } from '../src/tuningRepo.js';
import { PATH_POWER, PVP_PROFILE, PVP_TUNING } from '../src/skills.js';
import { BESTIARY } from '../src/bestiary.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name, extra); } else { fail++; console.log('  ✗ FAIL:', name, extra); } };
const approx = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ── A mock Supabase client: one active config row, operator flag toggleable ────
function mockClient({ operator = true, active = null, failRead = false } = {}) {
  let row = active;
  return {
    _row: () => row,
    async rpc(fn, args) {
      if (fn === 'hq_combat_publish') {
        if (!operator) return { data: null, error: new Error('not authorized') };
        row = args.p_config; return { data: 'row-id-1', error: null };
      }
      if (fn === 'combat_tuning_active') {
        if (failRead) return { data: null, error: new Error('rpc down') };
        return { data: row, error: null };
      }
      return { data: null, error: new Error('unknown rpc ' + fn) };
    },
  };
}

console.log('\n=== Combat tuning pipeline — battle test ===');

// 1. Defaults sanity — the shipped tuning is fair.
const base = fairnessSummary(COMBAT_DEFAULTS, { level: 10, samples: 500 });
ok('defaults fairness score is healthy', base.score >= 70, `(score ${base.score}, rms ${base.rms.toFixed(1)})`);
ok('defaults: every path 40–60% overall', Object.values(base.perPath).every(v => v > 38 && v < 62),
  '(' + Object.entries(base.perPath).map(([k, v]) => k.slice(0, 3) + ' ' + v.toFixed(0)).join(' ') + ')');

// 2. fairnessSummary is DETERMINISTIC (seeded) — HQ and game report identical numbers.
const s1 = fairnessSummary(COMBAT_DEFAULTS, { level: 10, samples: 300 });
const s2 = fairnessSummary(COMBAT_DEFAULTS, { level: 10, samples: 300 });
ok('fairness is deterministic (same config ⇒ same score)', s1.score === s2.score && approx(s1.rms, s2.rms));

// 3. Serialize / parse round-trip.
const override = { paths: { mage: { mag: 1.10 } }, enemies: { tiger: { hp: 22000 } } };
const round = parseTuning(serializeTuning(override));
ok('serialize→parse preserves version + override', round.version === TUNING_VERSION && round.override.paths.mage.mag === 1.10);

// 4. Merge: override wins, untouched keys keep defaults.
const eff = mergeTuning(override);
ok('merge applies override', approx(eff.paths.mage.mag, 1.10));
ok('merge keeps defaults for untouched keys', approx(eff.paths.warrior.phy, COMBAT_DEFAULTS.paths.warrior.phy));

// 5. Validation catches ordering + range problems.
const vBad = validateTuning({ paths: { warrior: { mag: 1.9 } } }); // warrior magic > mage → order broken
ok('validation warns on broken magic order', vBad.warnings.some(w => /Magic order/.test(w)));
const vRange = validateTuning({ paths: { mage: { mag: 99 } } });
ok('validation clamps insane values (no NaN leaks)', mergeTuning({ paths: { mage: { mag: 99 } } }).paths.mage.mag <= 1.9);

// 6. Tuning actually CHANGES balance — nerf the mage, its win% drops.
const nerf = { paths: { mage: { mag: 0.90, phy: 0.50, pvpHpMul: 0.68 } } };
const after = fairnessSummary(nerf, { level: 10, samples: 500 });
ok('nerfing mage lowers its win rate', after.perPath.mage < base.perPath.mage - 3,
  `(mage ${base.perPath.mage.toFixed(0)}% → ${after.perPath.mage.toFixed(0)}%)`);

// 7. applyTuning mutates the LIVE objects the game reads.
const magBefore = PATH_POWER.mage.mag, tigerBefore = BESTIARY.tiger.hp;
applyTuning({ paths: { mage: { mag: 1.30 }, warrior: { pvpHpMul: 1.35 } }, enemies: { tiger: { hp: 25000, atk: 200 } }, pvp: { boltReach: 3 } });
ok('applyTuning updates PATH_POWER (player damage) live', approx(PATH_POWER.mage.mag, 1.30), `(was ${magBefore})`);
ok('applyTuning updates PVP_PROFILE (player HP) live', approx(PVP_PROFILE.warrior.pvpHpMul, 1.35));
ok('applyTuning updates PVP_TUNING (reach) live', PVP_TUNING.boltReach === 3);
ok('applyTuning updates BESTIARY (enemy hp/atk) live', BESTIARY.tiger.hp === 25000 && BESTIARY.tiger.atk === 200, `(was ${tigerBefore})`);
ok('applyTuning rebuilds the HP curve fn', typeof PVP_TUNING.hpCurve === 'function' && PVP_TUNING.hpCurve(1) === 100);

// 8. SPAWN + REWARDS + enemy XP/Bloom flow through the pipeline to live objects.
applyTuning({
  enemies: { fox: { xp: 99, bloom: 40 } },
  spawn: { maxConcurrent: 9, intervalMs: 500, roster: ['squirrel', 'boar'] },
  rewards: { xpMul: 2, bloomMul: 1.5 },
});
ok('applyTuning updates enemy XP + Bloom rewards live', BESTIARY.fox.xp === 99 && BESTIARY.fox.bloom === 40);
ok('applyTuning updates spawn count + interval live', SPAWN_TUNING.maxConcurrent === 9 && SPAWN_TUNING.intervalMs === 500);
ok('applyTuning updates spawn roster (filtered to real enemies)', SPAWN_TUNING.roster.join(',') === 'squirrel,boar');
ok('applyTuning updates global XP/Bloom multipliers', REWARD_TUNING.xpMul === 2 && REWARD_TUNING.bloomMul === 1.5);
applyTuning({ spawn: { maxConcurrent: 999 }, rewards: { xpMul: -5 } });
ok('spawn/reward values are clamped to safe ranges', SPAWN_TUNING.maxConcurrent <= 20 && REWARD_TUNING.xpMul >= 0);

// 9. resetTuning restores every default (no permanent drift from a bad publish).
resetTuning();
ok('resetTuning restores PATH_POWER', approx(PATH_POWER.mage.mag, COMBAT_DEFAULTS.paths.mage.mag));
ok('resetTuning restores BESTIARY hp + rewards', BESTIARY.tiger.hp === COMBAT_DEFAULTS.enemies.tiger.hp && BESTIARY.fox.xp === COMBAT_DEFAULTS.enemies.fox.xp);
ok('resetTuning restores spawn + reward multipliers', SPAWN_TUNING.maxConcurrent === COMBAT_DEFAULTS.spawn.maxConcurrent && REWARD_TUNING.xpMul === 1);

// 9. FULL ROUND-TRIP over the mock transport: HQ publishes → game loads + applies.
async function roundTrip() {
  const client = mockClient({ operator: true });
  const pub = await publishTuning(client, { paths: { rogue: { atkInt: 0.60 } }, enemies: { boar: { atk: 90 } } }, { note: 'faster rogue' });
  ok('publish returns a fairness summary', pub.ok && typeof pub.fairness.score === 'number', `(score ${pub.fairness.score})`);
  ok('publish wrote an active row', !!client._row() && client._row().v === TUNING_VERSION);

  const loaded = await loadActiveTuning(client);
  ok('game loads the published config from cloud', loaded.source === 'cloud');
  ok('loaded config carries the override', approx(loaded.config.paths.rogue.atkInt, 0.60));

  resetTuning();
  const boot = await bootCombatTuning(client);   // load + apply in one call (game boot)
  ok('bootCombatTuning applies rogue atkInt to live PVP_PROFILE', approx(PVP_PROFILE.rogue.atkInt, 0.60));
  ok('bootCombatTuning applies enemy atk to live BESTIARY', BESTIARY.boar.atk === 90);
  ok('boot reports cloud source', boot.source === 'cloud');
  resetTuning();
}

// 10. SAFETY: operator gate, empty DB, rpc failure, newer version — all fall back.
async function safety() {
  const noOp = mockClient({ operator: false });
  let threw = false;
  try { await publishTuning(noOp, { paths: { mage: { mag: 1.2 } } }); } catch { threw = true; }
  ok('non-operator publish is rejected', threw);

  const empty = mockClient({ operator: true, active: null });
  const l1 = await loadActiveTuning(empty);
  ok('empty DB → falls back to defaults (no throw)', l1.source === 'defaults' && l1.reason === 'no-active');

  const down = mockClient({ operator: true, failRead: true });
  const l2 = await loadActiveTuning(down);
  ok('rpc failure → falls back to defaults', l2.source === 'defaults' && l2.reason === 'rpc-error');

  const l3 = await loadActiveTuning(null);
  ok('no client → falls back to defaults', l3.source === 'defaults');

  const future = mockClient({ operator: true, active: { v: 99, override: { paths: { mage: { mag: 0.1 } } } } });
  const l4 = await loadActiveTuning(future);
  ok('newer version → ignored, defaults used (forward-compat)', l4.source === 'defaults' && l4.reason === 'newer-version');

  // a bad load must not corrupt live combat
  resetTuning(); await bootCombatTuning(down);
  ok('bad boot leaves live combat at defaults', approx(PATH_POWER.mage.mag, COMBAT_DEFAULTS.paths.mage.mag));
}

await roundTrip();
await safety();

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);

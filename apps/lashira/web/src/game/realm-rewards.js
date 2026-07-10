import { loadOpenworldCircle, saveOpenworldCircle } from './openworld-save.js';

// ── Reward + compliance spine (IMPL doc §2). ONE code path mints every realm
// reward, so adult/kid rules live in exactly one place, never per-realm:
//
//   1. Diamonds are NEVER minted from gameplay, for anyone.
//   2. Kids never earn Character XP from game actions.
//   3. Adults earn XP only if the realm's reward contract allows it.
//   4. Everything else (bloom/wood/stone/food/ore/meals/tokens/score) is fine
//      for both — those are the "help the kingdom" currencies.
//
// NOTE (safety): realm payouts accumulate in the CIRCLE progression blob
// (totals/meters), kept separate from the live farm resource pool and the real
// character-XP system. Wiring realm output back into farm resources / xp is a
// deliberate reviewed follow-up (needs the increment + xp-ledger RPCs from
// IMPL §2.3) — not done here so an unattended build can never corrupt the
// family's live economy.

export const REWARD_KEYS = ['bloom', 'wood', 'stone', 'food', 'ore', 'meals', 'tokens', 'score'];

export function accountTypeOf(profile) {
  return profile?.role === 'kid' ? 'kid' : 'adult';
}

// Reward contract per realm (adult/kid policy). Kept tiny + declarative.
export const REWARD_CONTRACTS = {
  hearthrush_kitchen: { adult: { xpPolicy: 'none' }, meterMax: 12, meterKey: 'happiness' },
  bloomwall_pass: { adult: { xpPolicy: 'none' }, meterMax: 10, meterKey: 'defense' },
  fountain_festival: { adult: { xpPolicy: 'none' }, meterMax: 8, meterKey: 'festival' },
  lashira_keep: { adult: { xpPolicy: 'none' }, meterMax: 100, meterKey: 'prosperity' },
  emberring_arena: { adult: { xpPolicy: 'none' }, meterMax: 999, meterKey: 'rank' },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Strip anything the account type may not earn. Returns a CLEAN reward object.
function applyCompliance(rewards, accountType, contract) {
  const clean = {};
  for (const k of REWARD_KEYS) {
    const v = Number(rewards?.[k] || 0);
    if (v) clean[k] = v;
  }
  // Rule 1: diamonds never from gameplay — silently dropped for everyone.
  const blockedDiamond = !!rewards?.diamonds;
  // Rules 2/3: XP only for adults, only if contract allows.
  let xp = 0;
  let blockedXp = false;
  if (rewards?.xp) {
    if (accountType === 'adult' && contract?.adult?.xpPolicy && contract.adult.xpPolicy !== 'none') {
      xp = Number(rewards.xp) || 0;
    } else {
      blockedXp = true; // kid, or adult contract disallows
    }
  }
  return { clean, xp, blockedXp, blockedDiamond };
}

// A realm-rewards session bound to one circle. Holds the shared progression in
// memory, applies compliance, and debounces the circle save.
export function makeRewardSession({ profile, circleId }) {
  const accountType = accountTypeOf(profile);
  const memberId = profile?.id || 'anon';
  const memberName = profile?.displayName || 'Farmer';
  let circle = null;      // shared progression blob (loaded)
  let personalCaps = null; // { [date]: { [realmId]: count } } — injected by room
  let saveTimer = 0;
  let dirty = false;

  async function ensureLoaded() {
    if (circle) return circle;
    const { data } = await loadOpenworldCircle(profile, circleId);
    circle = data;
    return circle;
  }

  function queueSave() {
    dirty = true;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flush, 600);
  }

  async function flush() {
    if (!dirty || !circle || !circleId) return;
    dirty = false;
    try { await saveOpenworldCircle(profile, circleId, circle); }
    catch (err) { dirty = true; console.warn('[realm-rewards] circle save failed:', err?.message || err); }
  }

  // caps live in the PERSONAL blob; the room passes them in + persists them.
  function bindCaps(capsObj) { personalCaps = capsObj || {}; }
  function loopsToday(realmId) {
    const d = todayKey();
    return Number(personalCaps?.[d]?.[realmId] || 0);
  }
  function bumpLoop(realmId) {
    const d = todayKey();
    if (!personalCaps[d]) personalCaps[d] = {};
    personalCaps[d][realmId] = (personalCaps[d][realmId] || 0) + 1;
    return personalCaps[d][realmId];
  }

  // The single mint entrypoint. `rewards` may include any REWARD_KEYS plus
  // xp/diamonds (which compliance strips). Returns what was actually granted
  // (already compliance-filtered) + a soft-cap multiplier applied.
  async function grant(realmId, rewards, { source = 'loop', meterGain = 0 } = {}) {
    await ensureLoaded();
    const contract = REWARD_CONTRACTS[realmId] || {};
    // Soft daily cap: full payout for the first 20 loops/realm/day, then 30%.
    const n = loopsToday(realmId);
    const mult = n < 20 ? 1 : 0.3;
    const scaled = {};
    for (const k of REWARD_KEYS) if (rewards?.[k]) scaled[k] = rewards[k];
    const { clean, xp, blockedXp, blockedDiamond } = applyCompliance(scaled, accountType, contract);
    // apply the cap multiplier to resource output (not score/meter)
    for (const k of Object.keys(clean)) {
      if (k !== 'score') clean[k] = Math.max(1, Math.round(clean[k] * mult));
    }

    // fold into circle totals
    if (!circle.totals) circle.totals = {};
    for (const [k, v] of Object.entries(clean)) circle.totals[k] = (circle.totals[k] || 0) + v;

    // advance the shared realm meter
    if (meterGain && contract.meterMax) {
      const m = circle.meters[realmId] || { value: 0, stage: 0 };
      m.value = Math.min(contract.meterMax, m.value + meterGain);
      if (m.value >= contract.meterMax) { m.stage = (m.stage || 0) + 1; m.value = 0; }
      circle.meters[realmId] = m;
    }

    // compliance ledger (the kid_xp_blocked / kid_diamond_blocked proof)
    circle.ledger.push({
      t: Date.now(), realmId, memberId, memberName, accountType, source,
      granted: clean, xp: xp || 0, blockedXp, blockedDiamond,
    });

    bumpLoop(realmId);
    queueSave();
    return { granted: clean, xp, blockedXp, blockedDiamond, capped: mult < 1, meter: circle.meters[realmId] };
  }

  return {
    accountType, memberId, memberName,
    ensureLoaded, grant, flush, bindCaps, loopsToday,
    getCircle: () => circle,
    getMeter: (realmId) => (circle?.meters?.[realmId] || { value: 0, stage: 0 }),
    getTotals: () => (circle?.totals || {}),
    getBoard: () => (circle?.board || {}),
    setBoardBest: (best) => {
      if (!circle) return;
      const cur = circle.board[memberId]?.best || 0;
      if (best > cur) { circle.board[memberId] = { name: memberName, best }; queueSave(); }
    },
    setCity: (patch) => { if (circle) { circle.city = { ...circle.city, ...patch }; queueSave(); } },
    getCity: () => (circle?.city || {}),
  };
}

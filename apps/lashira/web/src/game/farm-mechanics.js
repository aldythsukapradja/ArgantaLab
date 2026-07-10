// Mechanics store — the parts of the resource loop the ECONOMY workspace does NOT
// own: ore, gem, fish, tool tiers, node cooldowns, house tier. Its own localStorage.
//
// SHARED resources wood + stone + bloom are owned by farm-logic (economy workspace).
// This store routes wood/stone THROUGH the live FarmLogic via getLogic() — preferring
// their method (game.gainMaterial/spendMaterial) if present, else incrementing their
// state field directly and re-emitting so the HUD updates. See
// docs/lashirabloom/HANDOFF-mechanics-vs-economy.md. Every currency touch is // ECONOMY-SEAM.

import { weaponUpgradeCost, armorUpgradeCost, WEAPON_MAX, ARMOR_MAX } from '@arganta/combat';

export const MAT_ICON = { wood: '🪵', stone: '🪨', ore: '🟨', gem: '🔷', fish: '🐟', ingot: '🧱', token: '🎟️', shard: '💠', hide: '🟫', essence: '✨', potion: '🧪', bloom: '🌸' };

// Refining recipes: convert dead-end raw mats into craft goods (closes the sinks).
export const SMELT_COST = { ore: 3 };  // → 1 ingot (feeds weapon/armor T3+)
export const COOK_COST = { fish: 2 };  // → 1 potion (drink to restore stamina), any species mix
export const POTION_STAMINA = 30;
const RESPAWN_MS = { ore: 90_000, tree: 60_000 };   // kid-fast node cooldowns
const TOOL_MAX = 3, HOUSE_MAX = 5;

// ---- FISH SPECIES: rarity ladder for the dock minigame. `weight` = base roll
// share at zero skill/rod luck; rarer species get boosted by catch quality +
// rod tier (see catchFish). `sell` feeds sellFish(); cooking always costs
// COOK_COST.fish regardless of species (cheapest consumed first, see cook()).
export const FISH_SPECIES = [
  { id: 'minnow', name: 'Minnow', icon: '🐟', rarity: 'common', weight: 60, sell: 4 },
  { id: 'bluegill', name: 'Bluegill', icon: '🐠', rarity: 'uncommon', weight: 27, sell: 9 },
  { id: 'puffer', name: 'Puffer', icon: '🐡', rarity: 'rare', weight: 10, sell: 20 },
  { id: 'goldkoi', name: 'Gold Koi', icon: '🎏', rarity: 'legendary', weight: 3, sell: 60 },
];
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
// Extra "luck" per rod tier — shifts the catch roll toward rarer species.
const ROD_LUCK = [0, 0.12, 0.28];

export class FarmMechanics {
  constructor(id = 'guest', getLogic = () => null) {
    this.key = 'lashira_mech_' + id;
    this.getLogic = getLogic;
    this.listeners = new Set();
    this.toast = null;
    this.state = this._load();
  }
  _default() {
    return {
      ore: 0, gem: 0, fish: {},           // mechanics-only materials (economy tracks wood/stone); fish keyed by FISH_SPECIES id
      ingot: 0, token: 0, shard: 0, hide: 0, essence: 0, potion: 0, // craft mats: refining + boss/mob drops
      tools: { pickaxe: 1, axe: 1, rod: 1 },
      nodes: {},                         // id -> lastGatheredAt (respawn cooldown)
      house: { tier: 1, storage: 60 },
    };
  }
  _load() {
    const d0 = this._default();
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(this.key);
      const d = raw ? JSON.parse(raw) : null;
      if (!d) return d0;
      // migrate pre-species saves: fish was a flat number → treat as minnows.
      const fish = (typeof d.fish === 'number') ? { minnow: d.fish } : { ...(d.fish || {}) };
      return { ...d0, ...d, fish, tools: { ...d0.tools, ...(d.tools || {}) }, house: { ...d0.house, ...(d.house || {}) }, nodes: { ...(d.nodes || {}) } };
    } catch { return d0; }
  }
  _save() { try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch { /* quota */ } }
  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
  // `fish` here is an AGGREGATE total (back-compat with the existing flat-number
  // readers, e.g. HotspotPanels' MatBar / Panels' bag capacity count);
  // `fishBag` carries the real per-species breakdown for the Bag + dock UI.
  snapshot() { return { ...this.state, tools: { ...this.state.tools }, house: { ...this.state.house }, fish: this.totalFish(), fishBag: { ...this.state.fish }, toast: this.toast }; }
  flash(m) { this.toast = m; this.emit(); clearTimeout(this._t); this._t = setTimeout(() => { this.toast = null; this.emit(); }, 1500); }
  _add(k, n) { this.state[k] = (this.state[k] || 0) + n; }

  // ---- SHARED wood/stone via the economy workspace's FarmLogic (// ECONOMY-SEAM) ----
  sharedAmt(k) { const l = this.getLogic(); return Number(l?.state?.[k] || 0); }
  _gainShared(k, n) {
    const l = this.getLogic(); if (!l) return;
    if (typeof l.gainMaterial === 'function') l.gainMaterial(k, n);          // preferred (once they add it)
    else { l.state[k] = (Number(l.state[k]) || 0) + n; l.save?.(); l.emit?.(); } // fallback: their field
  }
  _spendShared(k, n) {
    const l = this.getLogic(); if (!l) return false;
    if (typeof l.spendMaterial === 'function') return l.spendMaterial(k, n);
    if ((Number(l.state[k]) || 0) < n) return false;
    l.state[k] = (Number(l.state[k]) || 0) - n; l.save?.(); l.emit?.(); return true;
  }
  affordShared(cost) { return this.sharedAmt('wood') >= cost.wood && this.sharedAmt('stone') >= cost.stone; }

  // ---- node cooldowns (timestamp-derived, like crops) ----
  nodeReady(id, kind) { const t = this.state.nodes[id]; return !t || (Date.now() - t) >= (RESPAWN_MS[kind] || 60000); }
  nodeFrac(id, kind) { const t = this.state.nodes[id]; if (!t) return 1; return Math.min(1, (Date.now() - t) / (RESPAWN_MS[kind] || 60000)); }

  // ---- MINING --- node = { id, ore ∈ stone|copper|iron|gold|gem } ----
  mine(node) {
    if (!this.nodeReady(node.id, 'ore')) { this.flash('⛏ vein still recovering'); return null; }
    if ((node.ore === 'gold' || node.ore === 'gem') && this.state.tools.pickaxe < 2) { this.flash('Need a Tier-2 pickaxe ⚒ (blacksmith)'); return null; }
    const YIELD = { stone: { stone: 2 }, copper: { stone: 1, ore: 1 }, iron: { stone: 2, ore: 1 }, gold: { ore: 3 }, gem: { gem: 1, ore: 1 } };
    const y = YIELD[node.ore] || { stone: 1 };
    for (const [k, v] of Object.entries(y)) { if (k === 'wood' || k === 'stone') this._gainShared(k, v); else this._add(k, v); }
    this.state.nodes[node.id] = Date.now(); this._save(); this.emit();
    this.flash('⛏ ' + Object.entries(y).map(([k, v]) => `+${v}${MAT_ICON[k]}`).join(' '));
    return y;
  }
  // ---- FORESTRY --- node = { id, hard } ----
  chop(node) {
    if (!this.nodeReady(node.id, 'tree')) { this.flash('🌳 tree still regrowing'); return null; }
    if (node.hard && this.state.tools.axe < 2) { this.flash('Need a Tier-2 axe ⚒ (blacksmith)'); return null; }
    const w = node.hard ? 3 : 2;
    this._gainShared('wood', w);
    this.state.nodes[node.id] = Date.now(); this._save(); this.emit(); this.flash('🪵 +' + w + ' Wood');
    return { wood: w };
  }
  // ---- FISHING ---- quality ∈ 0..1 = how centered the reel-timing tap was in
  // the bite's sweet zone (see FishingPanel); rod tier adds extra luck on top.
  // Both push the roll toward rarer species (weight boosted exponentially by
  // rarity index) rather than changing the odds of catching SOMETHING at all.
  totalFish() { return FISH_SPECIES.reduce((a, f) => a + (this.state.fish[f.id] || 0), 0); }
  fishValue() { return FISH_SPECIES.reduce((a, f) => a + (this.state.fish[f.id] || 0) * f.sell, 0); }
  catchFish(quality = 0.5) {
    const luck = clamp01(quality) * 0.6 + (ROD_LUCK[this.toolTier('rod') - 1] || 0);
    const boosted = FISH_SPECIES.map((f, i) => f.weight * Math.pow(1 + luck * 3, i));
    const total = boosted.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, species = FISH_SPECIES[0];
    for (let i = 0; i < FISH_SPECIES.length; i++) { r -= boosted[i]; if (r <= 0) { species = FISH_SPECIES[i]; break; } }
    this.state.fish[species.id] = (this.state.fish[species.id] || 0) + 1;
    this._save(); this.emit();
    this.flash(`${species.icon} Caught a ${species.name}!${species.rarity !== 'common' ? ' ✨' : ''}`);
    return species;
  }
  sellFish() {
    const gain = this.fishValue();
    if (!gain) { this.flash('No fish to sell'); return false; }
    for (const f of FISH_SPECIES) this.state.fish[f.id] = 0;
    this.getLogic()?.earnBloom?.(gain, 'Sold fish');
    this._save(); this.emit();
    this.flash(`🌸 +${gain} from fish`);
    return true;
  }

  // ---- LOOT (monster drops) — route each material to the right store ----
  grantMaterial(k, n) {
    if (!(n > 0)) return;
    if (k === 'wood' || k === 'stone') this._gainShared(k, n);
    else this._add(k, n);
  }
  // Grant a rolled drop list [{k,n}] and flash a compact summary.
  grantDrops(drops) {
    if (!drops || !drops.length) return;
    for (const d of drops) this.grantMaterial(d.k, d.n);
    this._save(); this.emit();
    this.flash(drops.map((d) => `+${d.n}${MAT_ICON[d.k] || d.k}`).join(' '));
  }

  // ---- REFINING (close the ore/fish dead-ends) ----
  canSmelt() { return (this.state.ore || 0) >= SMELT_COST.ore; }
  smelt() {
    if (!this.canSmelt()) { this.flash(`Need 3${MAT_ICON.ore}`); return false; }
    this.state.ore -= SMELT_COST.ore; this._add('ingot', 1);
    this._save(); this.emit(); this.getLogic()?.questCraftTick?.(); this.flash(`🧱 +1 Ingot`); return true;
  }
  canCook() { return this.totalFish() >= COOK_COST.fish; }
  cook() {
    if (!this.canCook()) { this.flash(`Need ${COOK_COST.fish}${MAT_ICON.fish}`); return false; }
    let need = COOK_COST.fish;
    for (const f of [...FISH_SPECIES].sort((a, b) => a.sell - b.sell)) { // commonest first, saves rare fish for selling
      if (need <= 0) break;
      const have = this.state.fish[f.id] || 0, take = Math.min(have, need);
      this.state.fish[f.id] = have - take; need -= take;
    }
    this._add('potion', 1);
    this._save(); this.emit(); this.flash(`🧪 +1 Potion`); return true;
  }
  drinkPotion() {
    if ((this.state.potion || 0) < 1) { this.flash('No potions'); return false; }
    this.state.potion -= 1; this.getLogic()?.restoreStamina?.(POTION_STAMINA);
    this._save(); this.emit(); this.flash(`🧪 +${POTION_STAMINA} stamina`); return true;
  }

  // ---- BLACKSMITH --- tool upgrade spends wood/stone (shared) ----
  toolTier(tool) { return this.state.tools[tool] || 1; }
  toolCost(tool) { const t = this.toolTier(tool); return { wood: t * 4, stone: t * 6 }; }
  upgradeTool(tool) {
    const cur = this.toolTier(tool);
    if (cur >= TOOL_MAX) { this.flash('Already max tier'); return false; }
    const c = this.toolCost(tool);
    if (!this.affordShared(c)) { this.flash(`Need 🪵${c.wood} 🪨${c.stone}`); return false; }
    this._spendShared('wood', c.wood); this._spendShared('stone', c.stone);
    this.state.tools[tool] = cur + 1; this._save(); this.emit(); this.getLogic()?.questCraftTick?.(); this.flash(`⚒ ${tool} → Tier ${cur + 1}`); return true;
  }
  // ---- CASTLE --- home upgrade spends wood/stone (shared) ----
  houseCost() { const t = this.state.house.tier; return { wood: t * 20, stone: t * 15 }; }
  upgradeHouse() {
    const t = this.state.house.tier;
    if (t >= HOUSE_MAX) { this.flash('🏰 Castle is max tier'); return false; }
    const c = this.houseCost();
    if (!this.affordShared(c)) { this.flash(`Need 🪵${c.wood} 🪨${c.stone}`); return false; }
    this._spendShared('wood', c.wood); this._spendShared('stone', c.stone);
    this.state.house.tier = t + 1; this.state.house.storage += 40;
    this._save(); this.emit(); this.flash(`🏰 Home → Tier ${t + 1}`); return true;
  }
  // ---- FORGE: weapon/armor gear (bridges both stores) — tier lives in FarmLogic
  //      (personal, save-preserved); materials come from bloom/wood/stone (economy)
  //      + ore/gem/fish/ingot/token/shard (this store). Operator = free. ----
  gearTier(slot) { const l = this.getLogic(); return Number(l?.state?.[slot === 'weapon' ? 'weaponTier' : 'armorTier'] || 1); }
  gearCost(slot) { const t = this.gearTier(slot); return slot === 'weapon' ? weaponUpgradeCost(t) : armorUpgradeCost(t); }
  gearMax(slot) { return this.gearTier(slot) >= (slot === 'weapon' ? WEAPON_MAX : ARMOR_MAX); }
  // What you own of each craft material (unifies both stores for the afford check).
  materialAmount(k) {
    if (k === 'bloom' || k === 'wood' || k === 'stone') return this.sharedAmt(k) || (k === 'bloom' ? Number(this.getLogic()?.state?.bloom || 0) : 0);
    return Number(this.state[k] || 0);
  }
  gearAfford(slot) {
    if (this.getLogic()?.isOperator?.()) return true;
    const cost = this.gearCost(slot); if (!cost) return false;
    return Object.entries(cost).every(([k, v]) => this.materialAmount(k) >= v);
  }
  upgradeGear(slot) {
    const l = this.getLogic(); if (!l) return false;
    if (this.gearMax(slot)) { this.flash('Already max tier'); return false; }
    const cost = this.gearCost(slot); if (!cost) return false;
    const op = l.isOperator?.();
    if (!op && !this.gearAfford(slot)) {
      const miss = Object.entries(cost).find(([k, v]) => this.materialAmount(k) < v);
      this.flash('Need more ' + (MAT_ICON[miss?.[0]] || miss?.[0])); return false;
    }
    if (!op) {
      for (const [k, v] of Object.entries(cost)) {
        if (k === 'bloom') { l.state.bloom = Number(l.state.bloom || 0) - v; }
        else if (k === 'wood' || k === 'stone') this._spendShared(k, v);
        else this.state[k] = (Number(this.state[k]) || 0) - v;
      }
    }
    const key = slot === 'weapon' ? 'weaponTier' : 'armorTier';
    l.state[key] = this.gearTier(slot) + 1; l.save?.(); l.emit?.();
    this._save(); this.emit(); l.questCraftTick?.();
    this.flash(`⚒ ${slot} → Tier ${l.state[key]}`);
    return true;
  }
  // ---- DUNGEON loot (materials only; bloom reward via game.earnBloom — ECONOMY-SEAM) ----
  dungeonLoot() {
    const w = 3 + Math.floor(Math.random() * 4), s = 2 + Math.floor(Math.random() * 4);
    this._gainShared('wood', w); this._gainShared('stone', s); this._add('gem', 1);
    this.emit(); return { wood: w, stone: s, gem: 1 };
  }
}

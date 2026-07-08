// Mechanics store — the parts of the resource loop the ECONOMY workspace does NOT
// own: ore, gem, fish, tool tiers, node cooldowns, house tier. Its own localStorage.
//
// SHARED resources wood + stone + bloom are owned by farm-logic (economy workspace).
// This store routes wood/stone THROUGH the live FarmLogic via getLogic() — preferring
// their method (game.gainMaterial/spendMaterial) if present, else incrementing their
// state field directly and re-emitting so the HUD updates. See
// docs/lashirabloom/HANDOFF-mechanics-vs-economy.md. Every currency touch is // ECONOMY-SEAM.

export const MAT_ICON = { wood: '🪵', stone: '🪨', ore: '🟨', gem: '🔷', fish: '🐟' };
const RESPAWN_MS = { ore: 90_000, tree: 60_000 };   // kid-fast node cooldowns
const TOOL_MAX = 3, HOUSE_MAX = 5;

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
      ore: 0, gem: 0, fish: 0,           // mechanics-only materials (economy tracks wood/stone)
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
      return { ...d0, ...d, tools: { ...d0.tools, ...(d.tools || {}) }, house: { ...d0.house, ...(d.house || {}) }, nodes: { ...(d.nodes || {}) } };
    } catch { return d0; }
  }
  _save() { try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch { /* quota */ } }
  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
  snapshot() { return { ...this.state, tools: { ...this.state.tools }, house: { ...this.state.house }, toast: this.toast }; }
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
  // ---- FISHING ----
  catchFish() { this._add('fish', 1); this._save(); this.emit(); this.flash('🐟 Caught a fish!'); return { fish: 1 }; }

  // ---- BLACKSMITH --- tool upgrade spends wood/stone (shared) ----
  toolTier(tool) { return this.state.tools[tool] || 1; }
  toolCost(tool) { const t = this.toolTier(tool); return { wood: t * 4, stone: t * 6 }; }
  upgradeTool(tool) {
    const cur = this.toolTier(tool);
    if (cur >= TOOL_MAX) { this.flash('Already max tier'); return false; }
    const c = this.toolCost(tool);
    if (!this.affordShared(c)) { this.flash(`Need 🪵${c.wood} 🪨${c.stone}`); return false; }
    this._spendShared('wood', c.wood); this._spendShared('stone', c.stone);
    this.state.tools[tool] = cur + 1; this._save(); this.emit(); this.flash(`⚒ ${tool} → Tier ${cur + 1}`); return true;
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
  // ---- DUNGEON loot (materials only; bloom reward via game.earnBloom — ECONOMY-SEAM) ----
  dungeonLoot() {
    const w = 3 + Math.floor(Math.random() * 4), s = 2 + Math.floor(Math.random() * 4);
    this._gainShared('wood', w); this._gainShared('stone', s); this._add('gem', 1);
    this.emit(); return { wood: w, stone: s, gem: 1 };
  }
}

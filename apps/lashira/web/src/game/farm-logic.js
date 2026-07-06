// Renderer-agnostic farm mechanics + state (no canvas, no Pixi). FarmRoom drives
// the render; this owns the rules and persistence. Kept from the verified v1
// engine so the whole loop (till/plant/water/grow/harvest/sell, livestock, Kin
// automation) is unchanged — only the renderer swapped to Kingdom's canvas-2D.
import { CROPS, SEASONS, DAYS_PER_SEASON } from '../data/crops.js';
import { SPECIES, STARTER_LIVESTOCK } from '../data/livestock.js';
import { STARTER_KINS } from '../data/kins.js';
import { FIELD, tileKey } from './farm-map.js';
import { loadFarmState, saveFarmState } from './farm-save.js';

export class FarmLogic {
  // circleId (optional): when the game is embedded inside a KinetikCircle
  // circle, every member of that circle shares ONE farm save — keyed by the
  // circle, not the individual account. Falls back to a per-profile save
  // standalone (no circle context). Local-only for now (see the Tier-2 note in
  // memory: real cross-device shared farm needs the lashira_farm Supabase
  // tables + realtime sync — this is the "same device, same circle" tier).
  constructor(profile, circleId = null) {
    this.profile = profile;
    this.circleId = circleId;
    this.listeners = new Set();
    this.toast = null;
    this.externalKins = [];
    this.saveKey = circleId
      ? 'lashirabloom_save_v2_circle_' + circleId
      : 'lashirabloom_save_v2_' + (profile?.id || 'guest');
    this.state = this._default();
    this.saveSource = 'initializing';
    this.ready = this._load();
  }

  _default() {
    return {
      day: 1, season: 0,
      // Diamonds is the ONE currency (no separate farm currency). Local mutable
      // copies seeded from the real profile so selling/buying feels instant;
      // NOT yet synced back to Supabase — that's a follow-up RPC, same honest
      // scaffolding pattern as the rest of this build.
      diamonds: this.profile?.diamonds ?? 0,
      xp: this.profile?.xp ?? 0,
      stamina: 40, maxStamina: 40,
      tool: 'hoe', selectedSeed: 'turnip',
      seeds: { turnip: 3, potato: 0, carrot: 0 },
      produce: {},
      plots: {},
      livestock: STARTER_LIVESTOCK.map((a, i) => ({ id: 'ls_' + i, species: a.species, name: a.name, affection: 40, fed: false, produce: false })),
      kins: STARTER_KINS.map((k) => ({ ...k })),
      kinTasks: {},
    };
  }
  async _load() {
    try {
      const loaded = await loadFarmState({ profile: this.profile, circleId: this.circleId });
      if (loaded?.data) this.state = { ...this._default(), ...loaded.data };
      this.saveSource = loaded?.source || 'fresh';
      return;
    } catch (err) {
      console.warn('[farm] cloud load failed, trying local fallback:', err?.message || err);
      this.saveSource = 'local-fallback-after-cloud-error';
    }
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) this.state = { ...this._default(), ...JSON.parse(raw) };
    } catch { /* fresh */ }
  }
  serialize() {
    return {
      day: this.state.day,
      season: this.state.season,
      diamonds: this.state.diamonds,
      xp: this.state.xp,
      stamina: this.state.stamina,
      maxStamina: this.state.maxStamina,
      tool: this.state.tool,
      selectedSeed: this.state.selectedSeed,
      seeds: { ...this.state.seeds },
      produce: { ...this.state.produce },
      plots: { ...this.state.plots },
      livestock: this.state.livestock.map((a) => ({ ...a })),
      kins: this.state.kins.map((k) => ({ ...k })),
      kinTasks: { ...(this.state.kinTasks || {}) },
    };
  }
  setExternalKins(kins) {
    this.externalKins = Array.isArray(kins) ? kins.map((k) => ({ ...k })) : [];
    this.emit();
  }
  activeKins() {
    if (this.externalKins?.length) {
      const tasks = this.state.kinTasks || {};
      return this.externalKins.map((k) => ({
        ...k,
        task: Object.prototype.hasOwnProperty.call(tasks, k.id) ? tasks[k.id] : (k.task ?? null),
      }));
    }
    return this.state.kins.map((k) => ({ ...k }));
  }
  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flushSave(), 500);
  }
  async flushSave() {
    clearTimeout(this._saveTimer);
    const payload = this.serialize();
    try {
      const res = await saveFarmState({ profile: this.profile, circleId: this.circleId, data: payload });
      this.saveSource = res?.source || this.saveSource;
    } catch (err) {
      console.warn('[farm] cloud save failed, keeping a local fallback:', err?.message || err);
      try { localStorage.setItem(this.saveKey, JSON.stringify(payload)); } catch { /* quota */ }
      this.saveSource = 'local-fallback-after-cloud-error';
    }
  }

  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
  snapshot() {
    const st = this.state;
    return {
      day: st.day, season: SEASONS[st.season],
      stamina: st.stamina, maxStamina: st.maxStamina,
      tool: st.tool, selectedSeed: st.selectedSeed,
      seeds: { ...st.seeds }, produce: { ...st.produce },
      livestock: st.livestock.map((a) => ({ ...a })),
      kins: this.activeKins(),
      diamonds: st.diamonds,
      xp: st.xp,
      level: 1 + Math.floor(Math.max(0, st.xp) / 500), // mirrors argantalab_level_from_xp
      role: this.profile?.role ?? 'user',
      name: this.profile?.displayName ?? 'Farmer',
      guest: !!this.profile?.guest,
      saveSource: this.saveSource,
      toast: this.toast,
    };
  }
  flash(msg) { this.toast = msg; this.emit(); clearTimeout(this._tt); this._tt = setTimeout(() => { this.toast = null; this.emit(); }, 1600); }

  inField(tx, ty) { return tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1; }
  stageOf(p, crop) {
    if (!p?.cropId) return -1;
    if (p.growth <= 0) return 0;
    if (p.growth >= crop.days) return 3;
    return (p.growth / crop.days) < 0.4 ? 1 : 2;
  }

  setTool(tool) { this.state.tool = tool; this.emit(); }
  setSeed(id) { this.state.selectedSeed = id; this.state.tool = 'seed'; this.emit(); }
  _spend(n) { if (this.state.stamina < n) { this.flash('Too tired — sleep to restore energy'); return false; } this.state.stamina -= n; return true; }

  // Apply the current tool at a specific tile (harvest ripe first, any tool).
  actionAt(tx, ty) {
    const key = tileKey(tx, ty);
    const st = this.state;
    const p = st.plots[key];
    if (p && p.cropId && p.growth >= CROPS[p.cropId].days) {
      const crop = CROPS[p.cropId];
      st.produce[crop.id] = (st.produce[crop.id] || 0) + 1;
      p.cropId = null; p.growth = 0; p.watered = false;
      this.flash('Harvested ' + crop.name + ' ' + crop.emoji); this.save(); this.emit(); return;
    }
    const tool = st.tool;
    if (tool === 'hoe') {
      if (!this.inField(tx, ty)) { this.flash('Till inside the field'); return; }
      if (p && p.tilled) { this.flash('Already tilled'); return; }
      if (!this._spend(1)) return;
      st.plots[key] = { tilled: true, watered: false, cropId: null, growth: 0 };
      this.save(); this.emit(); return;
    }
    if (tool === 'seed') {
      if (!p || !p.tilled) { this.flash('Till the soil first'); return; }
      if (p.cropId) { this.flash('Already planted here'); return; }
      const id = st.selectedSeed;
      if ((st.seeds[id] || 0) <= 0) { this.flash('No ' + CROPS[id].name + ' seeds — buy some'); return; }
      if (!this._spend(1)) return;
      st.seeds[id] -= 1; p.cropId = id; p.growth = 0;
      this.flash('Planted ' + CROPS[id].name); this.save(); this.emit(); return;
    }
    if (tool === 'can') {
      if (!p || !p.tilled) { this.flash('Nothing to water here'); return; }
      if (p.watered) { this.flash('Already watered'); return; }
      if (!this._spend(1)) return;
      p.watered = true; this.save(); this.emit(); return;
    }
  }

  // Buying always costs Diamonds — for kids this ties farm progress directly to
  // real learning (their diamonds only ever come from finishing World rings).
  buySeed(id, qty = 1) {
    const crop = CROPS[id]; const cost = crop.seedCost * qty;
    if (this.state.diamonds < cost) { this.flash('Not enough 💎 Diamonds'); return; }
    this.state.diamonds -= cost; this.state.seeds[id] = (this.state.seeds[id] || 0) + qty;
    this.flash('Bought ' + qty + '× ' + crop.name + ' seed'); this.save(); this.emit();
  }
  // Selling rewards differ by role: adults earn Diamonds directly from playing
  // (normal adult platform rule). Kids earn XP instead — but ONLY a flat, tiny
  // nibble (+1 per sell action, independent of quantity/value), never Diamonds.
  // This is deliberately NOT a real leveling path: real learning stays the only
  // meaningful way for a kid to level up. Farming is flavor, not a shortcut.
  sellAll() {
    let gain = 0, any = false;
    for (const [id, n] of Object.entries(this.state.produce)) {
      if (n <= 0) continue; any = true;
      gain += (CROPS[id]?.sell ?? this._animalSell(id)) * n;
    }
    if (!any) { this.flash('Nothing to sell'); return; }
    this.state.produce = {};
    const isKid = this.profile?.role === 'kid';
    if (isKid) { this.state.xp += 1; this.flash('Sold — +1 XP'); }
    else { this.state.diamonds += gain; this.flash('Sold for ' + gain + ' 💎'); }
    this.save(); this.emit();
  }
  _animalSell(pid) { for (const sp of Object.values(SPECIES)) if (sp.produce === pid) return sp.sell; return 10; }

  feedAll() {
    let fed = 0; for (const a of this.state.livestock) if (!a.fed) { a.fed = true; fed++; }
    this.flash(fed ? 'Fed ' + fed + ' animal' + (fed > 1 ? 's' : '') : 'All already fed'); this.save(); this.emit();
  }
  petAnimal(id) { const a = this.state.livestock.find((x) => x.id === id); if (a) { a.affection = Math.min(100, a.affection + 5); this.flash('❤ ' + a.name); this.save(); this.emit(); } }
  collectProduce(id) {
    const a = this.state.livestock.find((x) => x.id === id); if (!a || !a.produce) return;
    const sp = SPECIES[a.species]; this.state.produce[sp.produce] = (this.state.produce[sp.produce] || 0) + 1; a.produce = false;
    this.flash('Collected ' + sp.produceName + ' ' + sp.produceEmoji); this.save(); this.emit();
  }
  assignKin(id, task) {
    if (this.externalKins?.some((x) => x.id === id)) {
      this.state.kinTasks = { ...(this.state.kinTasks || {}), [id]: task };
      this.save(); this.emit(); return;
    }
    const k = this.state.kins.find((x) => x.id === id);
    if (k) { k.task = task; this.save(); this.emit(); }
  }

  sleep() {
    const st = this.state;
    const kins = this.activeKins();
    for (const k of kins) if (k.task === 'water') for (const p of Object.values(st.plots)) if (p.tilled && p.cropId && !p.watered) p.watered = true;
    for (const p of Object.values(st.plots)) {
      if (p.tilled && p.cropId && p.watered) { const crop = CROPS[p.cropId]; if (p.growth < crop.days) p.growth += 1; }
      p.watered = false;
    }
    for (const k of kins) if (k.task === 'harvest') for (const p of Object.values(st.plots)) {
      if (p.cropId && p.growth >= CROPS[p.cropId].days) { const crop = CROPS[p.cropId]; st.produce[crop.id] = (st.produce[crop.id] || 0) + 1; p.cropId = null; p.growth = 0; }
    }
    for (const a of st.livestock) if (a.fed) { a.produce = true; a.affection = Math.min(100, a.affection + 3); a.fed = false; }
    st.day += 1;
    if (st.day > DAYS_PER_SEASON) { st.day = 1; st.season = (st.season + 1) % SEASONS.length; }
    st.stamina = st.maxStamina;
    this.save(); this.flash('☀ Day ' + st.day + ' — a new morning'); this.emit();
  }
}

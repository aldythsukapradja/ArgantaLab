// Renderer-agnostic farm mechanics + state (no canvas, no Pixi). FarmRoom drives
// the render; this owns the rules and persistence. Kept from the verified v1
// engine so the whole loop (till/plant/water/grow/harvest/sell, livestock, Kin
// automation) is unchanged — only the renderer swapped to Kingdom's canvas-2D.
import { CROPS, SEASONS, DAYS_PER_SEASON } from '../data/crops.js';
import { SPECIES, STARTER_LIVESTOCK } from '../data/livestock.js';
import { STARTER_KINS } from '../data/kins.js';
import { FIELD, tileKey } from './farm-map.js';

export class FarmLogic {
  constructor(profile) {
    this.profile = profile;
    this.listeners = new Set();
    this.toast = null;
    this.saveKey = 'lashirabloom_save_v2_' + (profile?.id || 'guest');
    this.state = this._default();
    this._load();
  }

  _default() {
    return {
      day: 1, season: 0,
      bloom: 120,
      stamina: 40, maxStamina: 40,
      tool: 'hoe', selectedSeed: 'turnip',
      seeds: { turnip: 3, potato: 0, carrot: 0 },
      produce: {},
      plots: {},
      livestock: STARTER_LIVESTOCK.map((a, i) => ({ id: 'ls_' + i, species: a.species, name: a.name, affection: 40, fed: false, produce: false })),
      kins: STARTER_KINS.map((k) => ({ ...k })),
    };
  }
  _load() {
    try { const raw = localStorage.getItem(this.saveKey); if (raw) this.state = { ...this._default(), ...JSON.parse(raw) }; } catch { /* fresh */ }
  }
  save() { try { localStorage.setItem(this.saveKey, JSON.stringify(this.state)); } catch { /* quota */ } }

  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
  snapshot() {
    const st = this.state;
    return {
      day: st.day, season: SEASONS[st.season], bloom: st.bloom,
      stamina: st.stamina, maxStamina: st.maxStamina,
      tool: st.tool, selectedSeed: st.selectedSeed,
      seeds: { ...st.seeds }, produce: { ...st.produce },
      livestock: st.livestock.map((a) => ({ ...a })),
      kins: st.kins.map((k) => ({ ...k })),
      diamonds: this.profile?.diamonds ?? 0,
      level: this.profile?.level ?? 1,
      xp: this.profile?.xp ?? 0,
      role: this.profile?.role ?? 'user',
      name: this.profile?.displayName ?? 'Farmer',
      guest: !!this.profile?.guest,
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

  buySeed(id, qty = 1) {
    const crop = CROPS[id]; const cost = crop.seedCost * qty;
    if (this.state.bloom < cost) { this.flash('Not enough Bloom'); return; }
    this.state.bloom -= cost; this.state.seeds[id] = (this.state.seeds[id] || 0) + qty;
    this.flash('Bought ' + qty + '× ' + crop.name + ' seed'); this.save(); this.emit();
  }
  sellAll() {
    let gain = 0, any = false;
    for (const [id, n] of Object.entries(this.state.produce)) {
      if (n <= 0) continue; any = true;
      gain += (CROPS[id]?.sell ?? this._animalSell(id)) * n;
    }
    if (!any) { this.flash('Nothing to sell'); return; }
    this.state.produce = {}; this.state.bloom += gain;
    this.flash('Sold for ' + gain + ' 🌸'); this.save(); this.emit();
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
  assignKin(id, task) { const k = this.state.kins.find((x) => x.id === id); if (k) { k.task = task; this.save(); this.emit(); } }

  sleep() {
    const st = this.state;
    for (const k of st.kins) if (k.task === 'water') for (const p of Object.values(st.plots)) if (p.tilled && p.cropId && !p.watered) p.watered = true;
    for (const p of Object.values(st.plots)) {
      if (p.tilled && p.cropId && p.watered) { const crop = CROPS[p.cropId]; if (p.growth < crop.days) p.growth += 1; }
      p.watered = false;
    }
    for (const k of st.kins) if (k.task === 'harvest') for (const p of Object.values(st.plots)) {
      if (p.cropId && p.growth >= CROPS[p.cropId].days) { const crop = CROPS[p.cropId]; st.produce[crop.id] = (st.produce[crop.id] || 0) + 1; p.cropId = null; p.growth = 0; }
    }
    for (const a of st.livestock) if (a.fed) { a.produce = true; a.affection = Math.min(100, a.affection + 3); a.fed = false; }
    st.day += 1;
    if (st.day > DAYS_PER_SEASON) { st.day = 1; st.season = (st.season + 1) % SEASONS.length; }
    st.stamina = st.maxStamina;
    this.save(); this.flash('☀ Day ' + st.day + ' — a new morning'); this.emit();
  }
}

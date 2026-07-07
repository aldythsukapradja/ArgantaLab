// Renderer-agnostic farm mechanics + state (no canvas, no Pixi). FarmRoom drives
// the render; this owns the rules and persistence. Kept from the verified v1
// engine so the whole loop (till/plant/water/grow/harvest/sell, livestock, Kin
// automation) is unchanged — only the renderer swapped to Kingdom's canvas-2D.
import { CROPS, SEASONS, DAYS_PER_SEASON } from '../data/crops.js';
import { SPECIES, STARTER_LIVESTOCK } from '../data/livestock.js';
import { STARTER_KINS } from '../data/kins.js';
import { FIELD, tileKey } from './farm-map.js';
import { loadFarmState, saveFarmState } from './farm-save.js';

const defaultSeeds = () => Object.fromEntries(Object.keys(CROPS).map((id) => [id, id === 'turnip' ? 3 : 0]));
const starterKinArt = {
  kin_sprig: { kinKey: 'kin:sproutling', render: 'sproutling', assetKey: 'kin.sproutling', color: '#a78bfa' },
  kin_pip: { kinKey: 'kin:pixelslime', render: 'pixelslime', assetKey: 'kin.pixelslime', color: '#22c55e' },
  kin_bramble: { kinKey: 'kin:storyfox', render: 'storyfox', assetKey: 'kin.storyfox', color: '#6366f1' },
};
const profileProgress = (profile) => ({
  diamonds: profile?.diamonds ?? 0,
  xp: profile?.xp ?? 0,
});

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
    this.externalKinsLoaded = false;
    // Realtime sync hooks. Every LOCAL mutation emits a tiny granular intent
    // through intentSink (wired to the circle channel by FarmRoom); remote
    // intents arrive via applyIntent and are applied WITHOUT re-emitting.
    // `rev` is a monotonic mutation counter used to gate whole-state snapshots
    // (late joiners) and to reconcile cloud vs local saves — never wall clocks.
    this.intentSink = null;
    this.frozen = false; // kicked sessions freeze saves so a zombie tab can't overwrite the shared farm
    this.saveKey = circleId
      ? 'lashirabloom_save_v2_circle_' + circleId
      : 'lashirabloom_save_v2_' + (profile?.id || 'guest');
    this.state = this._default();
    this.saveSource = 'initializing';
    this.ready = this._load();
  }

  _default() {
    return {
      rev: 0,
      day: 1, season: 0,
      // Diamonds is the ONE currency (no separate farm currency). Local mutable
      // copies seeded from the real profile so selling/buying feels instant;
      // NOT yet synced back to Supabase — that's a follow-up RPC, same honest
      // scaffolding pattern as the rest of this build.
      diamonds: this.profile?.diamonds ?? 0,
      xp: this.profile?.xp ?? 0,
      stamina: 40, maxStamina: 40,
      tool: 'hoe', selectedSeed: 'turnip',
      seeds: defaultSeeds(),
      produce: {},
      plots: {},
      livestock: STARTER_LIVESTOCK.map((a, i) => ({ id: 'ls_' + i, species: a.species, name: a.name, affection: 40, fed: false, produce: false })),
      kins: STARTER_KINS.map((k) => ({ ...k })),
      kinTasks: {},
    };
  }
  // Load BOTH the cloud save and the local fallback and keep the most advanced
  // one (highest rev, then furthest calendar). This heals the split-brain where
  // one failed cloud write left real progress stranded in localStorage while the
  // cloud (and therefore every other device) stayed behind — if the local copy
  // wins, it is pushed back to the cloud immediately.
  async _load() {
    let cloud = null;
    let cloudOk = false;
    try {
      const loaded = await loadFarmState({ profile: this.profile, circleId: this.circleId });
      cloud = loaded?.data || null;
      cloudOk = true;
      this.saveSource = loaded?.source || 'fresh';
    } catch (err) {
      console.warn('[farm] cloud load failed, trying local fallback:', err?.message || err);
      this.saveSource = 'local-fallback-after-cloud-error';
    }
    let local = null;
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) local = JSON.parse(raw);
    } catch { /* corrupt local — ignore */ }

    const revOf = (d) => Number(d?.rev) || 0;
    const absOf = (d) => (Number(d?.season) || 0) * DAYS_PER_SEASON + (Number(d?.day) || 1);
    let winner = cloud;
    let fromLocal = false;
    if (local && (!cloud || revOf(local) > revOf(cloud) || (revOf(local) === revOf(cloud) && absOf(local) > absOf(cloud)))) {
      winner = local;
      fromLocal = true;
    }
    if (winner) {
      const base = this._default();
      this.state = {
        ...base,
        ...winner,
        ...profileProgress(this.profile),
        seeds: { ...base.seeds, ...(winner.seeds || {}) },
        produce: { ...base.produce, ...(winner.produce || {}) },
        plots: { ...base.plots, ...(winner.plots || {}) },
        livestock: winner.livestock || base.livestock,
        kins: winner.kins || base.kins,
        kinTasks: { ...base.kinTasks, ...(winner.kinTasks || {}) },
      };
    }
    if (fromLocal && cloudOk) {
      this.saveSource = 'local-ahead-reconciling';
      this.saveNow(); // push the stranded local progress up so every device converges
    }
  }
  _bump() { this.state.rev = (Number(this.state.rev) || 0) + 1; }
  _intent(obj) { try { this.intentSink?.(obj); } catch { /* sync is best-effort */ } }
  _absDay(d = this.state) { return (Number(d?.season) || 0) * DAYS_PER_SEASON + (Number(d?.day) || 1); }
  freeze() { this.frozen = true; clearTimeout(this._saveTimer); }
  // Marks a calendar change so EVERY circle member's UI shows the same New Day
  // splash — the sleeper, peers receiving the day intent, and late joiners
  // adopting a further-along snapshot.
  _dayEvent() {
    this.dayEvent = { day: this.state.day, season: SEASONS[this.state.season], at: Date.now() };
  }

  // Whole-state adoption — ONLY for late-joiner snapshots. The CALENDAR is the
  // primary freshness signal (two windows with divergent histories can carry
  // incomparable rev counters — e.g. many Day-1 actions vs few Day-4 actions —
  // so day-first ordering is what actually converges them); rev only breaks
  // same-day ties. Personal fields (tool, seed selection, stamina, diamonds/xp)
  // always stay local.
  applySnapshot(data, rev = 0) {
    if (!data || typeof data !== 'object') return false;
    const remoteRev = Number(rev) || 0;
    const localRev = Number(this.state.rev) || 0;
    const remoteAbs = this._absDay(data);
    const localAbs = this._absDay(this.state);
    const remoteFresher = remoteAbs > localAbs || (remoteAbs === localAbs && remoteRev > localRev);
    if (!remoteFresher) return false;
    const base = this._default();
    const local = this.state;
    const dayChanged = remoteAbs !== localAbs;
    this.state = {
      ...base,
      ...local,
      ...data,
      day: data.day, season: data.season,
      rev: Math.max(remoteRev, localRev),
      ...profileProgress(this.profile),
      tool: local.tool,
      selectedSeed: local.selectedSeed,
      stamina: local.stamina,
      maxStamina: local.maxStamina,
      seeds: { ...base.seeds, ...(data.seeds || {}) },
      produce: { ...base.produce, ...(data.produce || {}) },
      plots: { ...base.plots, ...(data.plots || {}) },
      livestock: data.livestock || local.livestock || base.livestock,
      kins: data.kins || local.kins || base.kins,
      kinTasks: { ...base.kinTasks, ...(data.kinTasks || {}) },
    };
    if (dayChanged) this._dayEvent();
    this.save();
    this.emit();
    return true;
  }

  // Apply a peer's granular change. Field-level, so concurrent actions on
  // different plots/animals can never wipe each other out (the failure mode of
  // whole-state last-writer-wins). Never re-emits an intent.
  applyIntent(intent) {
    if (!intent || typeof intent !== 'object') return;
    const st = this.state;
    switch (intent.t) {
      case 'plot': {
        if (!intent.key || !intent.plot) return;
        st.plots[intent.key] = { ...intent.plot };
        break;
      }
      case 'stock': {
        // Absolute per-key counts (merge), or full replace after a sell-all.
        if (intent.seedsReplace) st.seeds = { ...intent.seedsReplace };
        else if (intent.seeds) st.seeds = { ...st.seeds, ...intent.seeds };
        if (intent.produceReplace) st.produce = { ...intent.produceReplace };
        else if (intent.produce) st.produce = { ...st.produce, ...intent.produce };
        break;
      }
      case 'livestock': {
        if (Array.isArray(intent.livestock)) st.livestock = intent.livestock.map((a) => ({ ...a }));
        break;
      }
      case 'kin-task': {
        if (!intent.kinId) return;
        st.kinTasks = { ...(st.kinTasks || {}), [intent.kinId]: intent.task ?? null };
        const k = st.kins.find((x) => x.id === intent.kinId);
        if (k) k.task = intent.task ?? null;
        break;
      }
      case 'day': {
        // Monotonic by construction — only ever adopt a FURTHER calendar.
        if (this._absDay(intent) <= this._absDay(st)) return;
        st.day = intent.day; st.season = intent.season;
        if (intent.plots) st.plots = { ...intent.plots };
        if (Array.isArray(intent.livestock)) st.livestock = intent.livestock.map((a) => ({ ...a }));
        st.stamina = st.maxStamina; // the whole family wakes up with the new day
        this._dayEvent(); // every circle member sees the same New Day splash
        break;
      }
      default: return;
    }
    this._bump();
    this.save();
    this.emit();
  }
  serialize() {
    return {
      rev: Number(this.state.rev) || 0,
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
    this.externalKinsLoaded = true;
    this.emit();
  }
  activeKins() {
    if (this.externalKinsLoaded) {
      const tasks = this.state.kinTasks || {};
      return this.externalKins.map((k) => ({
        ...k,
        task: Object.prototype.hasOwnProperty.call(tasks, k.id) ? tasks[k.id] : (k.task ?? null),
      }));
    }
    return this.state.kins.map((k) => ({ ...(starterKinArt[k.id] || {}), ...k, ...(k.render ? {} : starterKinArt[k.id] || {}) }));
  }
  save() {
    if (this.frozen) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flushSave(), 200);
  }
  saveNow() {
    if (this.frozen) return;
    clearTimeout(this._saveTimer);
    return this.flushSave();
  }
  async flushSave() {
    if (this.frozen) return;
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
      level: this.profile?.level ?? (1 + Math.floor(Math.max(0, st.xp) / 500)), // mirrors argantalab_level_from_xp when profile level is unavailable
      role: this.profile?.role ?? 'user',
      name: this.profile?.displayName ?? 'Farmer',
      guest: !!this.profile?.guest,
      saveSource: this.saveSource,
      toast: this.toast,
      dayEvent: this.dayEvent || null,
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
  setSeed(id) {
    const crop = CROPS[id];
    if (!crop) return;
    this.state.selectedSeed = id;
    this.state.tool = 'seed';
    const owned = this.state.seeds[id] || 0;
    this.flash(owned > 0 ? crop.emoji + ' ' + crop.name + ' selected' : crop.emoji + ' ' + crop.name + ' selected — buy seeds at the Shop');
    this.save();
    this.emit();
  }
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
      this._bump();
      this._intent({ t: 'plot', key, plot: { ...p } });
      this._intent({ t: 'stock', produce: { [crop.id]: st.produce[crop.id] } });
      this.flash('Harvested ' + crop.name + ' ' + crop.emoji); this.save(); this.emit(); return;
    }
    const tool = st.tool;
    if (tool === 'hoe') {
      if (!this.inField(tx, ty)) { this.flash('Till inside the field'); return; }
      if (p && p.tilled) { this.flash('Already tilled'); return; }
      if (!this._spend(1)) return;
      st.plots[key] = { tilled: true, watered: false, cropId: null, growth: 0 };
      this._bump();
      this._intent({ t: 'plot', key, plot: { ...st.plots[key] } });
      this.save(); this.emit(); return;
    }
    if (tool === 'seed') {
      if (!p || !p.tilled) { this.flash('Till the soil first'); return; }
      if (p.cropId) { this.flash('Already planted here'); return; }
      const id = st.selectedSeed;
      if ((st.seeds[id] || 0) <= 0) { this.flash('No ' + CROPS[id].name + ' seeds — buy some'); return; }
      if (!this._spend(1)) return;
      st.seeds[id] -= 1; p.cropId = id; p.growth = 0;
      this._bump();
      this._intent({ t: 'plot', key, plot: { ...p } });
      this._intent({ t: 'stock', seeds: { [id]: st.seeds[id] } });
      this.flash('Planted ' + CROPS[id].name); this.save(); this.emit(); return;
    }
    if (tool === 'can') {
      if (!p || !p.tilled) { this.flash('Nothing to water here'); return; }
      if (p.watered) { this.flash('Already watered'); return; }
      if (!this._spend(1)) return;
      p.watered = true;
      this._bump();
      this._intent({ t: 'plot', key, plot: { ...p } });
      this.save(); this.emit(); return;
    }
  }

  // Buying always costs Diamonds — for kids this ties farm progress directly to
  // real learning (their diamonds only ever come from finishing World rings).
  buySeed(id, qty = 1) {
    const crop = CROPS[id];
    if (!crop) return;
    const cost = crop.seedCost * qty;
    if (this.state.diamonds < cost) { this.flash('Not enough 💎 Diamonds'); return; }
    this.state.diamonds -= cost; this.state.seeds[id] = (this.state.seeds[id] || 0) + qty;
    this.state.selectedSeed = id;
    this.state.tool = 'seed';
    this._bump();
    this._intent({ t: 'stock', seeds: { [id]: this.state.seeds[id] } });
    this.flash('Bought ' + qty + '× ' + crop.emoji + ' ' + crop.name + ' seed · now owned: ' + this.state.seeds[id]);
    this.save(); this.emit();
  }
  // Selling rewards differ by role: adults earn Diamonds directly from playing
  // (normal adult platform rule). Kids earn XP instead — but ONLY a flat, tiny
  // nibble (+1 per sell action, independent of quantity/value), never Diamonds.
  // This is deliberately NOT a real leveling path: real learning stays the only
  // meaningful way for a kid to level up. Farming is flavor, not a shortcut.
  sellAll() {
    let gain = 0, any = false;
    const items = [];
    for (const [id, n] of Object.entries(this.state.produce)) {
      if (n <= 0) continue; any = true;
      const info = this._produceInfo(id);
      gain += info.sell * n;
      items.push(info.icon + '×' + n);
    }
    if (!any) { this.flash('Nothing to sell'); return; }
    this.state.produce = {};
    const isKid = this.profile?.role === 'kid';
    this._bump();
    this._intent({ t: 'stock', produceReplace: {} });
    if (isKid) { this.state.xp += 1; this.flash('Sold ' + items.join(' ') + ' · value 💎' + gain + ' · +1 XP'); }
    else { this.state.diamonds += gain; this.flash('Sold ' + items.join(' ') + ' = 💎' + gain); }
    this.save(); this.emit();
  }
  _animalSell(pid) { for (const sp of Object.values(SPECIES)) if (sp.produce === pid) return sp.sell; return 10; }
  _produceInfo(pid) {
    const crop = CROPS[pid];
    if (crop) return { id: pid, name: crop.name, icon: crop.emoji, sell: crop.sell };
    for (const sp of Object.values(SPECIES)) {
      if (sp.produce === pid) return { id: pid, name: sp.produceName, icon: sp.produceEmoji, sell: sp.sell };
    }
    return { id: pid, name: pid, icon: '📦', sell: 10 };
  }

  feedAll() {
    let fed = 0; for (const a of this.state.livestock) if (!a.fed) { a.fed = true; fed++; }
    if (fed) { this._bump(); this._intent({ t: 'livestock', livestock: this.state.livestock.map((a) => ({ ...a })) }); }
    this.flash(fed ? 'Fed ' + fed + ' animal' + (fed > 1 ? 's' : '') : 'All already fed'); this.save(); this.emit();
  }
  petAnimal(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (!a) return;
    a.affection = Math.min(100, a.affection + 5);
    this._bump();
    this._intent({ t: 'livestock', livestock: this.state.livestock.map((x) => ({ ...x })) });
    this.flash('❤ ' + a.name); this.save(); this.emit();
  }
  collectProduce(id) {
    const a = this.state.livestock.find((x) => x.id === id); if (!a || !a.produce) return;
    const sp = SPECIES[a.species]; this.state.produce[sp.produce] = (this.state.produce[sp.produce] || 0) + 1; a.produce = false;
    this._bump();
    this._intent({ t: 'livestock', livestock: this.state.livestock.map((x) => ({ ...x })) });
    this._intent({ t: 'stock', produce: { [sp.produce]: this.state.produce[sp.produce] } });
    this.flash('Collected ' + sp.produceName + ' ' + sp.produceEmoji); this.save(); this.emit();
  }
  assignKin(id, task) {
    if (this.externalKins?.some((x) => x.id === id)) {
      this.state.kinTasks = { ...(this.state.kinTasks || {}), [id]: task };
      this._bump();
      this._intent({ t: 'kin-task', kinId: id, task });
      this.save(); this.emit(); return;
    }
    const k = this.state.kins.find((x) => x.id === id);
    if (k) {
      k.task = task;
      this._bump();
      this._intent({ t: 'kin-task', kinId: id, task });
      this.save(); this.emit();
    }
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
    this._bump();
    // Day advance carries the post-sleep shared fields so every client lands on
    // the IDENTICAL morning (growth, watering resets, produce-ready animals).
    this._intent({
      t: 'day', day: st.day, season: st.season,
      plots: { ...st.plots },
      livestock: st.livestock.map((a) => ({ ...a })),
    });
    this._dayEvent();
    this.saveNow(); this.emit();
  }
}

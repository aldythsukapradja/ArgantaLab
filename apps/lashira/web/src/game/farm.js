// LashiraBloom farm engine (framework-agnostic). Owns the PixiJS scene, the
// game loop, the world state, and all farming mechanics. React subscribes via
// subscribe() and drives it through the public methods. Persists to localStorage
// (cloud save is a later migration; see supabase/001_lashira_core.sql).
import { Application, Container, Sprite } from 'pixi.js';
import { buildSprites, cropTex, TILE } from './sprites.js';
import { CROPS, SEASONS, DAYS_PER_SEASON, STARTER_SEEDS } from '../data/crops.js';
import { SPECIES, STARTER_LIVESTOCK } from '../data/livestock.js';
import { STARTER_KINS } from '../data/kins.js';

const W = 40, H = 26;                       // world size in tiles
const WORLD_W = W * TILE, WORLD_H = H * TILE;
const FIELD = { x0: 6, y0: 10, x1: 20, y1: 21 }; // tillable rectangle (inclusive)
const BASE_SPEED = 2.4;                      // px/frame at level 1

const BUILDINGS = [
  { key: 'house', type: 'house', tx: 4, ty: 3, w: 3, h: 3 },
  { key: 'barn', type: 'barn', tx: 10, ty: 3, w: 3, h: 2 },
  { key: 'coop', type: 'coop', tx: 15, ty: 3, w: 2, h: 2 },
  { key: 'shop', type: 'shop', tx: 24, ty: 3, w: 2, h: 2 },
  { key: 'bin', type: 'bin', tx: 8, ty: 7, w: 1, h: 1 },
  { key: 'well', type: 'well', tx: 21, ty: 6, w: 1, h: 1 },
];

function tileKey(x, y) { return x + ',' + y; }

export class Farm {
  constructor(profile) {
    this.profile = profile;
    this.listeners = new Set();
    this.controls = { dx: 0, dy: 0 };
    this.facing = 'down';
    this.toast = null;
    this.nearBuilding = null;
    this.app = null;
    this.destroyed = false;

    this.saveKey = 'lashirabloom_save_v1_' + (profile?.id || 'guest');
    this.state = this._defaultState();
    this._load();
    // player pixel pos (feet)
    this.px = this.state.playerTx * TILE + TILE / 2;
    this.py = this.state.playerTy * TILE + TILE / 2;
  }

  // ---------- state ----------
  _defaultState() {
    const plots = {};
    const livestock = STARTER_LIVESTOCK.map((a, i) => ({
      id: 'ls_' + i, species: a.species, name: a.name, affection: 40, fed: false, produce: false,
    }));
    return {
      day: 1, season: 0, // index into SEASONS
      bloom: 120,
      stamina: 40, maxStamina: 40,
      tool: 'hoe', selectedSeed: 'turnip',
      seeds: { turnip: 3, potato: 0, carrot: 0 },
      produce: {}, // cropId/animalProduce -> count
      plots,       // tileKey -> {tilled, watered, cropId, growth}
      livestock,
      kins: STARTER_KINS.map((k) => ({ ...k })),
      playerTx: 12, playerTy: 12,
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) {
        const s = JSON.parse(raw);
        this.state = { ...this._defaultState(), ...s };
      }
    } catch { /* fresh */ }
  }

  save() {
    try {
      this.state.playerTx = Math.floor(this.px / TILE);
      this.state.playerTy = Math.floor(this.py / TILE);
      localStorage.setItem(this.saveKey, JSON.stringify(this.state));
    } catch { /* quota */ }
  }

  // ---------- pub/sub for React HUD ----------
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
      role: this.profile?.role ?? 'user',
      name: this.profile?.displayName ?? 'Farmer',
      guest: !!this.profile?.guest,
      toast: this.toast,
      nearBuilding: this.nearBuilding,
    };
  }

  flash(msg) { this.toast = msg; this.emit(); clearTimeout(this._tt); this._tt = setTimeout(() => { this.toast = null; this.emit(); }, 1600); }

  // ---------- Pixi setup ----------
  async init(host, stickZone) {
    const app = new Application();
    await app.init({ background: '#7cc35a', antialias: false, resizeTo: host, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
    if (this.destroyed) { app.destroy(true); return; }
    this.app = app;
    host.appendChild(app.canvas);
    this.S = buildSprites();

    this.world = new Container();
    app.stage.addChild(this.world);
    this.groundLayer = new Container();
    this.plotLayer = new Container();
    this.objectLayer = new Container();
    this.objectLayer.sortableChildren = true;
    this.world.addChild(this.groundLayer, this.plotLayer, this.objectLayer);

    this._blocked = new Set();
    this._buildGround();
    this._buildStatic();
    this._buildPlayer();
    this._buildLivestock();
    this._buildKins();
    this._renderPlots();

    app.ticker.add(() => this._tick());
    this.emit();
  }

  _buildGround() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tex = ((x + y) % 7 === 0) ? this.S.grass2 : this.S.grass;
        const s = new Sprite(tex); s.x = x * TILE; s.y = y * TILE; this.groundLayer.addChild(s);
      }
    }
    // a path from house down to field
    for (let y = 6; y <= 10; y++) { const s = new Sprite(this.S.path); s.x = 5 * TILE; s.y = y * TILE; this.groundLayer.addChild(s); }
  }

  _addBlockedRect(tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) this._blocked.add(tileKey(x, y));
  }

  _buildStatic() {
    // border of trees (blocked)
    for (let x = 0; x < W; x++) { this._tree(x, 0); this._tree(x, H - 1); }
    for (let y = 1; y < H - 1; y++) { this._tree(0, y); this._tree(W - 1, y); }

    // buildings
    this.buildingSprites = {};
    for (const b of BUILDINGS) {
      const s = new Sprite(this.S[b.type]);
      s.x = b.tx * TILE; s.y = b.ty * TILE;
      s.zIndex = (b.ty + b.h) * TILE;
      this.objectLayer.addChild(s);
      this.buildingSprites[b.key] = b;
      this._addBlockedRect(b.tx, b.ty, b.w, b.h);
    }
    // a couple decorative trees inside
    this._tree(23, 9); this._tree(3, 20);

    // fence around the field
    for (let x = FIELD.x0 - 1; x <= FIELD.x1 + 1; x++) {
      this._fence(x, FIELD.y0 - 1); this._fence(x, FIELD.y1 + 1);
    }
    for (let y = FIELD.y0; y <= FIELD.y1; y++) {
      this._fence(FIELD.x0 - 1, y); this._fence(FIELD.x1 + 1, y);
    }
    // leave a gate in the top fence
    // (we simply don't block the gate tile)
  }

  _tree(x, y) {
    const s = new Sprite(this.S.tree); s.anchor.set(0, 0.5); s.x = x * TILE; s.y = y * TILE + TILE; s.zIndex = y * TILE + TILE;
    this.objectLayer.addChild(s); this._blocked.add(tileKey(x, y));
  }
  _fence(x, y) {
    if (x === FIELD.x0 + 3 && y === FIELD.y0 - 1) return; // gate opening
    const s = new Sprite(this.S.fence); s.x = x * TILE; s.y = y * TILE; s.zIndex = y * TILE + 8;
    this.objectLayer.addChild(s); this._blocked.add(tileKey(x, y));
  }

  _buildPlayer() {
    this.player = new Sprite(this.S.farmer);
    this.player.anchor.set(0.5, 0.9);
    this.objectLayer.addChild(this.player);
  }

  _buildLivestock() {
    this.livestockSprites = [];
    const spots = [
      { x: 11.4, y: 5.6 }, { x: 12.4, y: 6.0 }, { x: 15.5, y: 5.4 },
      { x: 12.0, y: 6.4 }, { x: 16.2, y: 5.8 },
    ];
    this.state.livestock.forEach((a, i) => {
      const sp = SPECIES[a.species];
      const s = new Sprite(this.S[sp.id]); s.anchor.set(0.5, 0.9);
      const spot = spots[i % spots.length];
      s.x = spot.x * TILE; s.y = spot.y * TILE; s.zIndex = s.y;
      s._base = { x: s.x, y: s.y }; s._ph = Math.random() * 6.28;
      this.objectLayer.addChild(s); this.livestockSprites.push(s);
    });
  }

  _buildKins() {
    this.kinSprites = [];
    this.state.kins.forEach((k, i) => {
      const s = new Sprite(this.S.kin(k.color)); s.anchor.set(0.5, 0.9);
      s.x = (26 + i * 1.1) * TILE; s.y = (12 + (i % 2)) * TILE; s.zIndex = s.y;
      s._base = { x: s.x, y: s.y }; s._ph = Math.random() * 6.28;
      this.objectLayer.addChild(s); this.kinSprites.push(s);
    });
  }

  // ---------- plots rendering ----------
  _renderPlots() {
    this.plotLayer.removeChildren();
    for (const [key, p] of Object.entries(this.state.plots)) {
      const [x, y] = key.split(',').map(Number);
      if (!p.tilled) continue;
      const soil = new Sprite(p.watered ? this.S.soilWet : this.S.soil);
      soil.x = x * TILE; soil.y = y * TILE; this.plotLayer.addChild(soil);
      if (p.cropId) {
        const crop = CROPS[p.cropId];
        const stage = this._stageOf(p, crop);
        const cs = new Sprite(cropTex(crop, stage));
        cs.x = x * TILE; cs.y = y * TILE; this.plotLayer.addChild(cs);
      }
    }
  }
  _stageOf(p, crop) {
    if (p.growth <= 0) return 0;
    if (p.growth >= crop.days) return 3;
    const ratio = p.growth / crop.days;
    return ratio < 0.4 ? 1 : 2;
  }

  // ---------- main loop ----------
  _tick() {
    const speed = BASE_SPEED * (1 + ((this.profile?.level ?? 1) - 1) * 0.06);
    let { dx, dy } = this.controls;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
      this.player.scale.x = this.facing === 'left' ? -1 : 1;

      const nx = this.px + dx * speed;
      const ny = this.py + dy * speed;
      if (!this._blockedAt(nx, this.py)) this.px = nx;
      if (!this._blockedAt(this.px, ny)) this.py = ny;
      this.px = Math.max(TILE, Math.min(WORLD_W - TILE, this.px));
      this.py = Math.max(TILE, Math.min(WORLD_H - TILE, this.py));
    }
    this.player.x = this.px; this.player.y = this.py; this.player.zIndex = this.py;

    // idle bob for animals + kins
    const t = performance.now() / 600;
    for (const s of this.livestockSprites) s.x = s._base.x + Math.sin(t + s._ph) * 3;
    for (const s of this.kinSprites) s.y = s._base.y + Math.sin(t * 1.6 + s._ph) * 2;

    // camera
    const sw = this.app.renderer.width / this.app.renderer.resolution;
    const sh = this.app.renderer.height / this.app.renderer.resolution;
    let cx = sw / 2 - this.px, cy = sh / 2 - this.py;
    cx = Math.min(0, Math.max(sw - WORLD_W, cx));
    cy = Math.min(0, Math.max(sh - WORLD_H, cy));
    if (WORLD_W < sw) cx = (sw - WORLD_W) / 2;
    if (WORLD_H < sh) cy = (sh - WORLD_H) / 2;
    this.world.x = Math.round(cx); this.world.y = Math.round(cy);

    // proximity hint
    this._checkNear();
  }

  _blockedAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    return this._blocked.has(tileKey(tx, ty));
  }

  _checkNear() {
    const tx = Math.floor(this.px / TILE), ty = Math.floor(this.py / TILE);
    let near = null;
    for (const b of BUILDINGS) {
      if (tx >= b.tx - 1 && tx <= b.tx + b.w && ty >= b.ty - 1 && ty <= b.ty + b.h + 1) {
        if (b.type === 'shop') near = 'shop';
        else if (b.type === 'barn' || b.type === 'coop') near = 'barn';
        else if (b.type === 'house') near = 'house';
        else if (b.type === 'bin') near = 'bin';
      }
    }
    if (near !== this.nearBuilding) { this.nearBuilding = near; this.emit(); }
  }

  // tile directly in front of the player
  _frontTile() {
    let tx = Math.floor(this.px / TILE), ty = Math.floor(this.py / TILE);
    if (this.facing === 'up') ty -= 1;
    else if (this.facing === 'down') ty += 1;
    else if (this.facing === 'left') tx -= 1;
    else tx += 1;
    return { tx, ty };
  }
  _inField(tx, ty) { return tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1; }

  // ---------- actions (called from UI/keys) ----------
  setTool(tool) { this.state.tool = tool; this.emit(); }
  setSeed(id) { this.state.selectedSeed = id; this.state.tool = 'seed'; this.emit(); }

  _spend(n) {
    if (this.state.stamina < n) { this.flash('Too tired — sleep to restore energy'); return false; }
    this.state.stamina -= n; return true;
  }

  action() {
    const { tx, ty } = this._frontTile();
    const key = tileKey(tx, ty);
    const tool = this.state.tool;

    // harvest ripe first, regardless of tool
    const p = this.state.plots[key];
    if (p && p.cropId && p.growth >= CROPS[p.cropId].days) {
      const crop = CROPS[p.cropId];
      this.state.produce[crop.id] = (this.state.produce[crop.id] || 0) + 1;
      p.cropId = null; p.growth = 0; p.watered = false;
      this.flash('Harvested ' + crop.name + ' ' + crop.emoji);
      this._renderPlots(); this.save(); this.emit(); return;
    }

    if (tool === 'hoe') {
      if (!this._inField(tx, ty)) { this.flash('Till inside the field'); return; }
      if (p && p.tilled) { this.flash('Already tilled'); return; }
      if (!this._spend(1)) return;
      this.state.plots[key] = { tilled: true, watered: false, cropId: null, growth: 0 };
      this._renderPlots(); this.save(); this.emit(); return;
    }
    if (tool === 'seed') {
      if (!p || !p.tilled) { this.flash('Till the soil first (hoe)'); return; }
      if (p.cropId) { this.flash('Something already grows here'); return; }
      const id = this.state.selectedSeed;
      if ((this.state.seeds[id] || 0) <= 0) { this.flash('No ' + CROPS[id].name + ' seeds — buy some'); return; }
      if (!this._spend(1)) return;
      this.state.seeds[id] -= 1; p.cropId = id; p.growth = 0;
      this.flash('Planted ' + CROPS[id].name);
      this._renderPlots(); this.save(); this.emit(); return;
    }
    if (tool === 'can') {
      if (!p || !p.tilled) { this.flash('Nothing to water here'); return; }
      if (p.watered) { this.flash('Already watered'); return; }
      if (!this._spend(1)) return;
      p.watered = true;
      this._renderPlots(); this.save(); this.emit(); return;
    }
  }

  // ---------- economy ----------
  buySeed(id, qty = 1) {
    const crop = CROPS[id];
    const cost = crop.seedCost * qty;
    if (this.state.bloom < cost) { this.flash('Not enough Bloom'); return; }
    this.state.bloom -= cost;
    this.state.seeds[id] = (this.state.seeds[id] || 0) + qty;
    this.flash('Bought ' + qty + '× ' + crop.name + ' seed');
    this.save(); this.emit();
  }

  sellAll() {
    let gain = 0, any = false;
    for (const [id, n] of Object.entries(this.state.produce)) {
      if (n <= 0) continue; any = true;
      const unit = CROPS[id]?.sell ?? this._animalSell(id);
      gain += unit * n;
    }
    if (!any) { this.flash('Nothing to sell'); return; }
    this.state.produce = {};
    this.state.bloom += gain;
    this.flash('Sold for ' + gain + ' 🌸');
    this.save(); this.emit();
  }
  _animalSell(produceId) {
    for (const sp of Object.values(SPECIES)) if (sp.produce === produceId) return sp.sell;
    return 10;
  }

  // ---------- livestock ----------
  feedAll() {
    let fed = 0;
    for (const a of this.state.livestock) if (!a.fed) { a.fed = true; fed++; }
    this.flash(fed ? 'Fed ' + fed + ' animal' + (fed > 1 ? 's' : '') : 'All already fed');
    this.save(); this.emit();
  }
  petAnimal(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (a) { a.affection = Math.min(100, a.affection + 5); this.flash('❤ ' + a.name); this.save(); this.emit(); }
  }
  collectProduce(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (!a || !a.produce) return;
    const sp = SPECIES[a.species];
    this.state.produce[sp.produce] = (this.state.produce[sp.produce] || 0) + 1;
    a.produce = false;
    this.flash('Collected ' + sp.produceName + ' ' + sp.produceEmoji);
    this.save(); this.emit();
  }

  // ---------- kins (harvest sprites) ----------
  assignKin(id, task) {
    const k = this.state.kins.find((x) => x.id === id);
    if (k) { k.task = task; this.save(); this.emit(); }
  }

  // ---------- sleep / new day ----------
  sleep() {
    const st = this.state;
    // Kin helpers act first (auto-water / auto-harvest)
    for (const k of st.kins) {
      if (k.task === 'water') {
        for (const p of Object.values(st.plots)) if (p.tilled && p.cropId && !p.watered) p.watered = true;
      }
    }
    // grow watered crops
    for (const p of Object.values(st.plots)) {
      if (p.tilled && p.cropId && p.watered) {
        const crop = CROPS[p.cropId];
        if (p.growth < crop.days) p.growth += 1;
      }
      p.watered = false; // dries overnight
    }
    // Kin auto-harvest ripe
    for (const k of st.kins) {
      if (k.task === 'harvest') {
        for (const p of Object.values(st.plots)) {
          if (p.cropId && p.growth >= CROPS[p.cropId].days) {
            const crop = CROPS[p.cropId];
            st.produce[crop.id] = (st.produce[crop.id] || 0) + 1;
            p.cropId = null; p.growth = 0;
          }
        }
      }
    }
    // livestock produce from fed animals
    for (const a of st.livestock) {
      if (a.fed) { a.produce = true; a.affection = Math.min(100, a.affection + 3); a.fed = false; }
    }
    // advance calendar + restore
    st.day += 1;
    if (st.day > DAYS_PER_SEASON) { st.day = 1; st.season = (st.season + 1) % SEASONS.length; }
    st.stamina = st.maxStamina;
    this._renderPlots(); this.save();
    this.flash('☀ Day ' + st.day + ' — a new morning');
    this.emit();
  }

  // ---------- controls hookup ----------
  setControl(dx, dy) { this.controls.dx = dx; this.controls.dy = dy; }

  destroy() {
    this.destroyed = true;
    this.save();
    try { if (this.app) this.app.destroy(true, { children: true }); } catch { /* ignore */ }
    this.app = null;
  }
}

import { cx, tileDist, drawPad, drawRing, makeCooldowns } from './util.js';

// Hearthrush Kitchen — Cooking / Service (IMPL §3.1).
// Loop: order ticket appears (patience bar) → walk Pantry→Stove→Window doing
// context taps → serve before the bar empties → Meals + happiness + Bloom →
// next order, slightly faster. One context-sensitive PRIMARY is the easy win.

const STATIONS = {
  pantry: { tx: 24, ty: 30, w: 4, h: 4, color: '#7fd1a0', icon: '🧺', label: 'Pantry' },
  stove: { tx: 29, ty: 30, w: 4, h: 4, color: '#f6a42c', icon: '🔥', label: 'Stove' },
  window: { tx: 34, ty: 30, w: 4, h: 4, color: '#e08bd0', icon: '🍽', label: 'Serve' },
};
const RECIPES = ['🍲', '🥧', '🍜', '🥗', '🍞'];

export function createKitchenModule(api) {
  const cd = makeCooldowns();
  const s = {
    held: null,            // null | 'raw' | 'cooked'
    dish: '🍲',
    cookDone: 0,           // timestamp cooking finishes
    orders: [],            // { id, dish, born, patienceMs }
    nextId: 1,
    nextSpawnAt: performance.now() + 500,
    lost: 0, served: 0,
  };

  const stage = () => api.getMeter().stage || 0;
  const patienceMs = () => Math.max(10000, 18000 - stage() * 1200);
  const maxConcurrent = () => Math.min(3, 1 + Math.floor(stage() / 2));

  function nearStation() {
    const p = api.player();
    for (const [k, st] of Object.entries(STATIONS)) {
      if (tileDist(p.tile[0], p.tile[1], st.tx + st.w / 2 - 0.5, st.ty + st.h / 2 - 0.5) <= 2.4) return k;
    }
    return null;
  }

  function spawnOrder() {
    s.orders.push({ id: s.nextId++, dish: RECIPES[(Math.random() * RECIPES.length) | 0], born: performance.now(), patienceMs: patienceMs() });
  }

  function tick(dt, now) {
    // cooking completes
    if (s.held === 'raw' && s.cookDone && now >= s.cookDone) { s.held = 'cooked'; s.cookDone = 0; api.flash('Cooked! Serve it 🍽'); api.bumpHud(); }
    // spawn orders up to the concurrent cap
    if (s.orders.length < maxConcurrent() && now >= s.nextSpawnAt) { spawnOrder(); s.nextSpawnAt = now + 1600; api.bumpHud(); }
    // expire orders
    let changed = false;
    for (let i = s.orders.length - 1; i >= 0; i--) {
      if (now - s.orders[i].born >= s.orders[i].patienceMs) { s.orders.splice(i, 1); s.lost++; changed = true; }
    }
    if (changed) { api.flash('Order lost! 😣'); s.nextSpawnAt = Math.min(s.nextSpawnAt, now + 900); api.bumpHud(); }
  }

  function primaryLabel() {
    const st = nearStation();
    if (!st) return { label: 'Walk to a station', dis: 'Walk to Pantry / Stove / Serve' };
    if (st === 'pantry') return s.held ? { label: 'Hands full', dis: 'Drop or use what you hold' } : { label: 'Grab', icon: '🧺' };
    if (st === 'stove') {
      if (s.held === 'raw') return s.cookDone ? { label: 'Cooking…', dis: 'Cooking in progress' } : { label: 'Cook', icon: '🔥' };
      return { label: 'Need raw food', dis: 'Grab from the pantry first' };
    }
    if (st === 'window') {
      if (s.held !== 'cooked') return { label: 'Need a dish', dis: 'Cook a dish first' };
      if (!s.orders.length) return { label: 'No orders', dis: 'Wait for an order' };
      return { label: 'Serve', icon: '🍽' };
    }
    return { label: '—' };
  }

  function doPrimary() {
    const st = nearStation();
    const p = api.player();
    if (!st) return;
    api.facePlayer(STATIONS[st].tx + 2, STATIONS[st].ty + 2);
    if (st === 'pantry' && !s.held) { s.held = 'raw'; s.dish = RECIPES[(Math.random() * RECIPES.length) | 0]; api.flash('Grabbed raw food'); }
    else if (st === 'stove' && s.held === 'raw' && !s.cookDone) { s.cookDone = performance.now() + 1100; api.flash('Cooking…'); }
    else if (st === 'window' && s.held === 'cooked' && s.orders.length) {
      const order = s.orders.shift();
      const remain = 1 - Math.min(1, (performance.now() - order.born) / order.patienceMs);
      const perfect = remain > 0.55;
      const bloom = 4 + Math.round(remain * 6) + (perfect ? 4 : 0);
      s.held = null; s.served++;
      api.grant({ meals: 1, bloom, food: 1 }, { source: 'serve', meterGain: 1 });
      api.flash(perfect ? `Perfect! +${bloom} Bloom 🌸` : `Served +${bloom} Bloom`);
      s.nextSpawnAt = Math.min(s.nextSpawnAt, performance.now() + 700);
    }
    api.bumpHud();
  }

  return {
    kind: 'kitchen', movement: true,
    _s: s,
    tick,
    onTapWorld() { doPrimary(); /* tapping the world near a station also acts */ },
    onAction(id) {
      if (id === 'primary') doPrimary();
      else if (id === 'dash') { if (cd.ready('dash')) { const p = api.player(); p.walkMs = 200; cd.trigger('dash', 4000); setTimeout(() => { const pl = api.player(); if (pl) pl.walkMs = 0; }, 1100); api.flash('Dash!'); } }
      else if (id === 'drop') { s.held = null; s.cookDone = 0; api.bumpHud(); }
      else if (id === 'emote') { const p = api.player(); p.oneShot = 'Cheer'; p.oneShotStart = performance.now(); }
      else if (id === 'menu') api.exit();
    },
    controller() {
      const pl = primaryLabel();
      return {
        primary: { id: 'primary', label: pl.label, icon: pl.icon, kind: 'primary', disabledReason: pl.dis },
        ring: [
          { id: 'dash', label: 'Dash', icon: '💨', kind: 'skill', cooldownMs: 4000, cooldownUntil: cd.until('dash') },
          { id: 'drop', label: 'Drop', icon: '🗑', kind: 'tool', disabledReason: s.held ? '' : 'Nothing held' },
          { id: 'emote', label: 'Emote', icon: '☺', kind: 'emote' },
          { id: 'menu', label: 'Exit', icon: '↩', kind: 'utility' },
        ],
      };
    },
    hud() {
      const m = api.getMeter();
      return {
        objective: s.held ? `Holding ${s.held === 'raw' ? 'raw food' : 'a dish ' + s.dish}` : 'Grab → Cook → Serve',
        meter: { value: m.value, max: 12, label: `Happiness · Lv ${(m.stage || 0) + 1}` },
        caps: `Served ${s.served} · lost ${s.lost}`,
      };
    },
    drawUnder(ctx, now) {
      const nearK = nearStation();
      for (const [k, st] of Object.entries(STATIONS)) {
        drawPad(ctx, st.tx, st.ty, st.w, st.h, { color: st.color, icon: st.icon, label: st.label, active: k === nearK });
      }
      // cooking ring over the stove
      if (s.cookDone) {
        const st = STATIONS.stove;
        const pct = 1 - Math.max(0, s.cookDone - now) / 1100;
        drawRing(ctx, cx(st.tx + 2) - 24, cx(st.ty), 16, pct, '#ffd36b');
      }
    },
    Overlay: KitchenOverlay,
    cleanup() {},
  };
}

// DOM overlay: order tickets with live patience bars + the held-item chip.
function KitchenOverlay({ mod }) {
  const s = mod?._s;
  if (!s) return null;
  const now = performance.now();
  return (
    <div className="kitchen-overlay">
      <div className="kitchen-tickets">
        {s.orders.map((o) => {
          const pct = Math.max(0, 1 - (now - o.born) / o.patienceMs);
          const col = pct > 0.5 ? '#57c98a' : pct > 0.25 ? '#f0b23a' : '#e5533d';
          return (
            <div className="kt-ticket" key={o.id}>
              <span className="kt-dish">{o.dish}</span>
              <div className="kt-bar"><span style={{ width: (pct * 100) + '%', background: col }} /></div>
            </div>
          );
        })}
      </div>
      {s.held && <div className={'kt-held ' + s.held}>{s.held === 'raw' ? '🥩 raw' : '✅ ' + s.dish}</div>}
    </div>
  );
}

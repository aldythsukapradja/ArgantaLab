import { cx, euclid, drawPad, drawRing } from './util.js';

// Lashira Keep — Stronghold / City (IMPL §3.4).
// Async loop: district timers fill → tap Collect → spend to Upgrade → meters
// rise, timers lengthen. The whole city is CIRCLE-shared: everyone builds one
// kingdom (state persisted through api.setCity → circle blob).

const DEFAULTS = [
  { key: 'farm', name: 'Farm', icon: '🌾', tx: 22, ty: 25, out: { food: 3, bloom: 1 } },
  { key: 'market', name: 'Market', icon: '🏪', tx: 30, ty: 25, out: { bloom: 2, wood: 2 } },
  { key: 'workshop', name: 'Workshop', icon: '🔨', tx: 38, ty: 25, out: { stone: 3, ore: 1 } },
];
const BASE_CYCLE = 20000;

export function createKeepModule(api) {
  const city = api.getCity() || {};
  const saved = Array.isArray(city.districts) ? city.districts : [];
  const s = {
    districts: DEFAULTS.map((d) => {
      const prev = saved.find((x) => x.key === d.key);
      return { ...d, level: prev?.level || 1, readyAt: prev?.readyAt || (Date.now() + cycleFor(prev?.level || 1)) };
    }),
    collected: 0,
  };

  function cycleFor(level) { return BASE_CYCLE + (level - 1) * 8000; }
  function persist() {
    api.setCity({
      districts: s.districts.map((d) => ({ key: d.key, level: d.level, readyAt: d.readyAt })),
      prosperity: (api.getMeter().stage || 0),
    });
  }
  function isReady(d) { return Date.now() >= d.readyAt; }

  function nearest() {
    const p = api.player();
    let best = null, bd = 4;
    for (const d of s.districts) { const dd = euclid(p.tile[0], p.tile[1], d.tx + 1, d.ty + 1); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }

  function collect(d) {
    if (!d || !isReady(d)) return;
    const out = {}; for (const [k, v] of Object.entries(d.out)) out[k] = v * d.level;
    api.grant(out, { source: 'collect', meterGain: 1 });
    d.readyAt = Date.now() + cycleFor(d.level);
    s.collected++;
    api.facePlayer(d.tx + 1, d.ty + 1);
    api.flash(`Collected ${d.name} +${Object.entries(out).map(([k, v]) => v + ' ' + k).join(', ')}`);
    persist(); api.bumpHud();
  }

  function upgrade(d) {
    if (!d || d.level >= 5) { api.flash(d ? 'Max level' : 'Stand by a district'); return; }
    d.level++;
    api.flash(`${d.name} → Lv ${d.level}`);
    persist(); api.bumpHud();
  }

  return {
    kind: 'keep', movement: true, _s: s,
    tick() {},
    onTapWorld(tx, ty) {
      const d = s.districts.find((x) => tx >= x.tx && tx <= x.tx + 2 && ty >= x.ty && ty <= x.ty + 2);
      if (d) { if (isReady(d)) collect(d); else api.flash(`${d.name} · ${Math.ceil((d.readyAt - Date.now()) / 1000)}s`); }
    },
    onAction(id) {
      if (id === 'primary') { const d = s.districts.find(isReady) ? nearestReady() : nearest(); collect(d); }
      else if (id === 'build') upgrade(nearest());
      else if (id === 'stats') { const c = api.getCity(); api.flash(`Prosperity Lv ${(api.getMeter().stage || 0) + 1} · ${s.collected} collected`); }
      else if (id === 'decorate') api.flash('Decorations coming soon 🎀');
      else if (id === 'menu') api.exit();
    },
    controller() {
      const ready = s.districts.filter(isReady).length;
      return {
        primary: { id: 'primary', label: ready ? `Collect ${ready}` : 'Nothing ready', icon: '🧺', kind: 'primary', disabledReason: ready ? '' : 'Wait for a timer' },
        ring: [
          { id: 'build', label: 'Upgrade', icon: '⬆', kind: 'tool' },
          { id: 'stats', label: 'Stats', icon: '📊', kind: 'utility' },
          { id: 'decorate', label: 'Decorate', icon: '🎀', kind: 'utility' },
          { id: 'menu', label: 'Exit', icon: '↩', kind: 'utility' },
        ],
      };
    },
    hud() {
      const m = api.getMeter();
      const ready = s.districts.filter(isReady).length;
      return { objective: ready ? `${ready} district${ready > 1 ? 's' : ''} ready — Collect!` : 'Building the kingdom…', meter: { value: m.value, max: 100, label: `Prosperity Lv ${(m.stage || 0) + 1}` } };
    },
    drawUnder(ctx) {
      for (const d of s.districts) {
        const ready = isReady(d);
        drawPad(ctx, d.tx, d.ty, 3, 3, { color: ready ? '#7c6cff' : '#9fb0d8', icon: d.icon, label: `${d.name} Lv${d.level}`, active: ready });
        const pct = ready ? 1 : 1 - Math.max(0, d.readyAt - Date.now()) / cycleFor(d.level);
        drawRing(ctx, cx(d.tx + 1), cx(d.ty) - 6, 15, pct, ready ? '#ffd36b' : '#7c6cff');
      }
    },
    cleanup() { persist(); },
  };

  function nearestReady() {
    const p = api.player();
    let best = null, bd = 999;
    for (const d of s.districts) { if (!isReady(d)) continue; const dd = euclid(p.tile[0], p.tile[1], d.tx + 1, d.ty + 1); if (dd < bd) { bd = dd; best = d; } }
    return best || s.districts.find(isReady);
  }
}

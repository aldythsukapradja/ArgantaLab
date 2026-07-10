import { cx, euclid, makeCooldowns } from './util.js';
import { rollPvpDamage } from '@arganta/combat';

// Emberring Arena — Social Competition (IMPL §3.5).
// Score round vs training targets → your best goes on the CIRCLE leaderboard,
// PLUS real PvP against any circle-mate sharing this realm (RealmRoom wires
// presence + a pvp-hit pipeline into every realm — see api.peers/api.pvpHit).
// A live peer in range always takes priority over a dummy for Strike/Burst;
// the dummy score-round keeps running underneath regardless, so solo practice
// and a real duel both just work in the same session.
const PVP_STRIKE_RANGE = 1.6, PVP_BURST_RANGE = 2.6;

const ROUND_MS = 60000;
const SPAWN = () => [26 + ((Math.random() * 14) | 0), 22 + ((Math.random() * 12) | 0)];

export function createArenaModule(api) {
  const cd = makeCooldowns();
  const s = {
    phase: 'fight', endAt: performance.now() + ROUND_MS,
    score: 0, combo: 0, lastHit: 0,
    dummies: Array.from({ length: 4 }, (_, i) => ({ id: i, tx: 0, ty: 0, hp: 20, max: 20, flash: 0 })),
  };
  s.dummies.forEach((d) => { const [x, y] = SPAWN(); d.tx = x; d.ty = y; });

  function hit(d, dmg, now) {
    d.hp -= dmg; d.flash = now;
    if (d.hp <= 0) {
      s.combo = now - s.lastHit < 2200 ? s.combo + 1 : 1; s.lastHit = now;
      const gain = 10 + (s.combo - 1) * 2;
      s.score += gain;
      api.grant({ score: gain }, { source: 'ko', meterGain: 0 });
      const [x, y] = SPAWN(); d.tx = x; d.ty = y; d.hp = d.max;
      api.flash(s.combo > 1 ? `KO! x${s.combo} +${gain}` : `KO! +${gain}`);
    }
  }

  // Nearest live peer within `range`, or null (no peers / all out of range).
  function nearestPeer(p, range) {
    const peers = api.peers ? api.peers() : [];
    let best = null, bd = range;
    for (const peer of peers) {
      const d = euclid(p.tile[0], p.tile[1], peer.tile[0], peer.tile[1]);
      if (d <= bd) { bd = d; best = peer; }
    }
    return best;
  }

  function strike() {
    const now = performance.now(); const p = api.player();
    const peer = nearestPeer(p, PVP_STRIKE_RANGE);
    if (peer) {
      api.facePlayer(peer.tile[0], peer.tile[1]);
      api.playMotion('strike');
      const hc = api.heroCombat ? api.heroCombat() : null;
      const { dmg, miss } = rollPvpDamage(hc?.physPower || 10);
      if (!miss) api.pvpHit(peer.id, dmg, 'phys');
      api.flash(miss ? '⚔ Miss!' : `⚔ Hit ${peer.name || 'them'} for ${dmg}`);
      api.bumpHud();
      return;
    }
    let best = null, bd = 1.7;
    for (const d of s.dummies) { const dd = euclid(p.tile[0], p.tile[1], d.tx, d.ty); if (dd < bd) { bd = dd; best = d; } }
    if (best) api.facePlayer(best.tx, best.ty);
    api.playMotion('strike'); // sword swing, whether or not a target's in range
    if (best) hit(best, 10, now);
    api.bumpHud();
  }

  function skill() {
    if (!cd.ready('skill')) return;
    const now = performance.now(); const p = api.player();
    const peers = api.peers ? api.peers() : [];
    const targets = peers.filter((peer) => euclid(p.tile[0], p.tile[1], peer.tile[0], peer.tile[1]) <= PVP_BURST_RANGE);
    if (targets.length) {
      const hc = api.heroCombat ? api.heroCombat() : null;
      for (const peer of targets) {
        const { dmg, miss } = rollPvpDamage(hc?.skillPower || 14);
        if (!miss) api.pvpHit(peer.id, dmg, 'mag');
      }
      api.flash(`✷ Burst hit ${targets.length} ${targets.length > 1 ? 'foes' : 'foe'}!`);
    } else {
      for (const d of s.dummies) if (euclid(p.tile[0], p.tile[1], d.tx, d.ty) <= 2.6) hit(d, 14, now);
      api.flash('Ember burst!');
    }
    cd.trigger('skill', 8000);
    api.playMotion('cast'); // Ember burst is a magic skill — casts, doesn't swing
  }

  function endRound() {
    s.phase = 'over';
    api.setBoardBest(s.score);
    const board = Object.values(api.getBoard()).sort((a, b) => b.best - a.best);
    const rank = board.findIndex((b) => b.best <= s.score) + 1;
    api.flash(`Round over · ${s.score} pts · circle rank #${rank || board.length}`);
    api.bumpHud();
  }

  function restart() {
    s.phase = 'fight'; s.endAt = performance.now() + ROUND_MS; s.score = 0; s.combo = 0;
    s.dummies.forEach((d) => { const [x, y] = SPAWN(); d.tx = x; d.ty = y; d.hp = d.max; });
    api.bumpHud();
  }

  return {
    kind: 'arena', movement: true, _s: s,
    tick(dt, now) { if (s.phase === 'fight' && now >= s.endAt) endRound(); },
    onTapWorld() { if (s.phase === 'fight') strike(); },
    onAction(id) {
      if (id === 'primary') { if (s.phase === 'over') restart(); else strike(); }
      else if (id === 'skill') skill();
      else if (id === 'dodge') { const p = api.player(); p.walkMs = 190; setTimeout(() => { const pl = api.player(); if (pl) pl.walkMs = 0; }, 900); api.flash('Dodge'); }
      else if (id === 'emote') { const p = api.player(); p.oneShot = 'Victory'; p.oneShotStart = performance.now(); }
      else if (id === 'menu') api.exit();
    },
    controller() {
      return {
        primary: s.phase === 'over'
          ? { id: 'primary', label: 'Rematch', icon: '🔁', kind: 'primary' }
          : { id: 'primary', label: 'Strike', icon: '⚔', kind: 'primary' },
        ring: [
          { id: 'skill', label: 'Burst', icon: '✷', kind: 'skill', cooldownMs: 8000, cooldownUntil: cd.until('skill') },
          { id: 'dodge', label: 'Dodge', icon: '💨', kind: 'skill' },
          { id: 'emote', label: 'Emote', icon: '☺', kind: 'emote' },
          { id: 'menu', label: 'Exit', icon: '↩', kind: 'utility' },
        ],
      };
    },
    hud() {
      const left = Math.max(0, Math.ceil((s.endAt - performance.now()) / 1000));
      const board = Object.values(api.getBoard()).sort((a, b) => b.best - a.best)[0];
      return {
        objective: s.phase === 'over' ? `Final ${s.score} — Rematch?` : `⏱ ${left}s · Score ${s.score}${s.combo > 1 ? ' · x' + s.combo : ''}`,
        meter: null,
        caps: board ? `Circle best: ${board.name} ${board.best}` : 'Set the circle record!',
      };
    },
    drawOver(ctx, now) {
      for (const d of s.dummies) {
        const X = cx(d.tx), Y = cx(d.ty);
        const flash = now - d.flash < 120;
        ctx.save();
        ctx.fillStyle = flash ? '#fff' : '#c94f3d';
        ctx.beginPath(); ctx.arc(X, Y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.font = '17px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎯', X, Y);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(X - 15, Y - 24, 30, 5);
        ctx.fillStyle = '#f0b23a'; ctx.fillRect(X - 15, Y - 24, 30 * Math.max(0, d.hp / d.max), 5);
        ctx.restore();
      }
    },
    cleanup() { if (s.phase === 'fight') api.setBoardBest(s.score); },
  };
}

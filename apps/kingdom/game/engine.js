// Kingdom game engine — data-driven walkable client.
// Maps, transitions and monster spawns all come from KingdomData (data/core JSON).
(function () {
  const VIEW_W = 640;
  const VIEW_H = 480;
  const ZOOM = 2;
  const SPEED = 130; // player speed, map px/sec
  const START_MAP = 'map.60.buya';
  const START_POS = { x: 470, y: 470 };
  const MONSTER_FRAME_MS = 420;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  const mapNameEl = document.getElementById('mapName');
  const mapMetaEl = document.getElementById('mapMeta');
  const toastEl = document.getElementById('toast');

  const images = {};
  function img(src) {
    if (!images[src]) {
      const el = new Image();
      el.src = '../' + src; // core paths are relative to apps/kingdom/
      images[src] = el;
    }
    return images[src];
  }

  const state = {
    mapId: null,
    player: { x: 0, y: 0, dir: 'down', moving: false },
    keys: {},
    monsters: [],
    triggers: [],
    insideTrigger: false,
    history: [],
    fade: 0,
    nearMonster: null
  };
  window.__kingdomState = state;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toastEl.style.opacity = '0'), 1600);
  }

  function currentMap() {
    return KingdomData.db.maps[state.mapId];
  }

  function spawnMonsters(map) {
    const w = map.mapImage?.width || 400;
    const h = map.mapImage?.height || 400;
    const plan = KingdomData.spawnPlan(state.mapId);
    const monsters = [];
    for (const { appearance, monster, count } of plan) {
      for (let i = 0; i < count; i++) {
        const x = 30 + Math.random() * (w - 60);
        const y = 30 + Math.random() * (h - 60);
        monsters.push({
          monster,
          appearance,
          x,
          y,
          homeX: x,
          homeY: y,
          tx: x,
          ty: y,
          speed: 18 + Math.random() * 22,
          pauseUntil: performance.now() + Math.random() * 3000,
          framePhase: Math.random() * MONSTER_FRAME_MS
        });
        monster.images.forEach(img);
      }
    }
    return monsters;
  }

  function enterMap(mapId, pos, { pushHistory = true } = {}) {
    const map = KingdomData.db.maps[mapId];
    if (!map || !map.mapImage?.localPath) {
      showToast('That area has no map image yet.');
      return;
    }
    if (pushHistory && state.mapId) state.history.push(state.mapId);
    state.mapId = mapId;
    state.player.x = pos.x;
    state.player.y = pos.y;
    state.triggers = KingdomData.walkableTargets(mapId);
    state.monsters = spawnMonsters(map);
    state.insideTrigger = true; // require stepping out before a trigger can fire
    state.fade = 1;
    img(map.mapImage.localPath);
    mapNameEl.textContent = map.name || mapId;
    const kinds = [...new Set(state.monsters.map((m) => m.monster.name))];
    mapMetaEl.textContent = kinds.length
      ? `${state.monsters.length} monsters · ${kinds.slice(0, 4).join(', ')}${kinds.length > 4 ? '…' : ''}`
      : 'no monsters here';
  }

  window.addEventListener('keydown', (e) => {
    state.keys[e.key.toLowerCase()] = true;
    if (e.key === 'Backspace') {
      e.preventDefault();
      const prev = state.history.pop();
      if (prev) {
        const pos = KingdomData.arrivalPoint(prev, state.mapId);
        enterMap(prev, pos, { pushHistory: false });
        showToast('Back to ' + (KingdomData.db.maps[prev]?.name || prev));
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    state.keys[e.key.toLowerCase()] = false;
  });

  function rectHit(x, y, [x1, y1, x2, y2]) {
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  }

  function update(now, dt) {
    if (state.fade > 0) state.fade = Math.max(0, state.fade - dt * 3);
    const map = currentMap();
    if (!map) return;
    const w = map.mapImage?.width || 400;
    const h = map.mapImage?.height || 400;

    // --- player ---
    const k = state.keys;
    let dx = 0;
    let dy = 0;
    if (k['arrowleft'] || k['a']) dx -= 1;
    if (k['arrowright'] || k['d']) dx += 1;
    if (k['arrowup'] || k['w']) dy -= 1;
    if (k['arrowdown'] || k['s']) dy += 1;
    state.player.moving = dx !== 0 || dy !== 0;
    if (state.player.moving) {
      const step = (SPEED * dt) / (Math.hypot(dx, dy) || 1);
      state.player.x = Math.max(6, Math.min(w - 6, state.player.x + dx * step));
      state.player.y = Math.max(6, Math.min(h - 6, state.player.y + dy * step));
      state.player.dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }

    // --- transitions (must leave all trigger rects before one can fire again) ---
    const inside = state.triggers.find((t) => rectHit(state.player.x, state.player.y, t.coords));
    if (!inside) {
      state.insideTrigger = false;
    } else if (!state.insideTrigger) {
      state.insideTrigger = true;
      const from = state.mapId;
      const pos = KingdomData.arrivalPoint(inside.targetMapId, from);
      enterMap(inside.targetMapId, pos);
      showToast(inside.label || KingdomData.db.maps[inside.targetMapId]?.name || 'Travelling…');
      return;
    }

    // --- monsters: wander around their home point ---
    for (const m of state.monsters) {
      if (now < m.pauseUntil) continue;
      const ddx = m.tx - m.x;
      const ddy = m.ty - m.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist < 2) {
        m.pauseUntil = now + 800 + Math.random() * 2600;
        const r = 60;
        m.tx = Math.max(20, Math.min(w - 20, m.homeX + (Math.random() * 2 - 1) * r));
        m.ty = Math.max(20, Math.min(h - 20, m.homeY + (Math.random() * 2 - 1) * r));
      } else {
        m.x += (ddx / dist) * m.speed * dt;
        m.y += (ddy / dist) * m.speed * dt;
      }
    }

    // nearest monster within inspect range (for the name label)
    let best = null;
    let bestD = 55;
    for (const m of state.monsters) {
      const d = Math.hypot(m.x - state.player.x, m.y - state.player.y);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    state.nearMonster = best;
  }

  function render(now) {
    const map = currentMap();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0c12';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!map) return;

    const w = map.mapImage?.width || 400;
    const h = map.mapImage?.height || 400;
    const vw = VIEW_W / ZOOM;
    const vh = VIEW_H / ZOOM;
    const camX = Math.max(0, Math.min(Math.max(0, w - vw), state.player.x - vw / 2));
    const camY = Math.max(0, Math.min(Math.max(0, h - vh), state.player.y - vh / 2));

    ctx.save();
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-camX, -camY);

    const bg = img(map.mapImage.localPath);
    if (bg.complete && bg.naturalWidth) {
      ctx.drawImage(bg, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#151a26';
      ctx.fillRect(0, 0, w, h);
    }

    // transition zones
    ctx.strokeStyle = 'rgba(245,200,66,.5)';
    ctx.lineWidth = 1.2;
    for (const t of state.triggers) {
      const [x1, y1, x2, y2] = t.coords;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    // monsters (2-frame GIF flip animation)
    for (const m of state.monsters) {
      const frames = m.monster.images;
      const frameIdx = Math.floor((now + m.framePhase) / MONSTER_FRAME_MS) % frames.length;
      const sprite = img(frames[frameIdx]);
      if (sprite.complete && sprite.naturalWidth) {
        const sw = sprite.naturalWidth;
        const sh = sprite.naturalHeight;
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath();
        ctx.ellipse(m.x, m.y + sh / 2 - 1, sw / 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(sprite, m.x - sw / 2, m.y - sh / 2, sw, sh);
      }
    }

    // nearest-monster label
    if (state.nearMonster) {
      const m = state.nearMonster;
      const label = `${m.monster.name} · ${Number(m.appearance.experience || 0).toLocaleString()} exp`;
      ctx.font = '700 8px monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10,12,20,.8)';
      ctx.fillRect(m.x - tw / 2 - 4, m.y - 26, tw + 8, 11);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(label, m.x - tw / 2, m.y - 17.5);
    }

    window.KingdomSprites.drawPlayer(
      ctx,
      state.player.x,
      state.player.y,
      state.player.dir,
      state.player.moving,
      now
    );
    ctx.restore();

    if (state.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${state.fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(now, dt);
    render(now);
    requestAnimationFrame(tick);
  }

  KingdomData.load()
    .then(() => {
      const requested = new URLSearchParams(location.search).get('map');
      if (requested && KingdomData.db.maps[requested]?.mapImage?.localPath) {
        enterMap(requested, KingdomData.arrivalPoint(requested, null), { pushHistory: false });
      } else {
        enterMap(START_MAP, START_POS, { pushHistory: false });
      }
      requestAnimationFrame(tick);
    })
    .catch((err) => {
      mapNameEl.textContent = 'Data failed to load';
      mapMetaEl.textContent = String(err);
      console.error(err);
    });
})();

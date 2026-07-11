import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const art = path.join(root, 'public', 'farm-art');

const assetFiles = {
  hq: path.join(art, 'basemap.png'),
  keep: path.join(art, 'Worldmap', 'lashira-keep.png'),
  bloomwall: path.join(art, 'Worldmap', 'bloomwall-pass.png'),
  kitchen: path.join(art, 'Worldmap', 'hearthrush-kitchen.png'),
  festival: path.join(art, 'Worldmap', 'fountain-festival.png'),
  arena: path.join(art, 'Worldmap', 'emberring-arena.png'),
};

function dataUrl(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const assets = Object.fromEntries(Object.entries(assetFiles).map(([key, file]) => [key, dataUrl(file)]));
const assetSummary = Object.fromEntries(Object.entries(assetFiles).map(([key, file]) => [key, statSync(file).size]));

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LashiraBloom 5 Worlds Prototype</title>
  <link rel="icon" href="data:," />
  <style>
    :root {
      color-scheme: dark;
      --ink: #172016;
      --paper: rgba(255, 255, 244, .9);
      --glass: rgba(21, 30, 24, .68);
      --line: rgba(255, 255, 255, .26);
      --gold: #ffd36a;
      --green: #5bd47d;
      --blue: #65c7ff;
      --pink: #ff6fa9;
      --red: #ff6b5f;
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #101610; font-family: Inter, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif; }
    button { font: inherit; }
    #app { position: fixed; inset: 0; background: #172016; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: auto; background: #172016; touch-action: none; }

    .landing {
      position: absolute; inset: 0; z-index: 20; display: grid; grid-template-rows: auto 1fr;
      background: #172016 center / cover no-repeat; color: #142016;
    }
    .landing::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(5,18,10,.26)); pointer-events: none; }
    .landing-head { position: relative; padding: 28px clamp(18px, 4vw, 54px) 10px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .brand { color: white; text-shadow: 0 3px 12px rgba(0,0,0,.55); max-width: 680px; }
    .brand h1 { margin: 0; font-size: clamp(28px, 4vw, 56px); letter-spacing: 0; line-height: 1; }
    .brand p { margin: 8px 0 0; font-size: clamp(13px, 1.4vw, 17px); max-width: 560px; color: rgba(255,255,255,.92); }
    .landing-chip { color: white; background: rgba(0,0,0,.42); border: 1px solid rgba(255,255,255,.28); padding: 10px 13px; border-radius: 8px; backdrop-filter: blur(10px); font-weight: 800; }
    .world-grid { position: relative; align-self: end; padding: 12px clamp(14px, 3vw, 42px) 28px; display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; }
    .world-card { min-height: 176px; border: 1px solid rgba(255,255,255,.34); border-radius: 8px; overflow: hidden; cursor: pointer; background: rgba(255,255,255,.82); box-shadow: 0 12px 32px rgba(0,0,0,.28); padding: 0; display: flex; flex-direction: column; text-align: left; }
    .world-card:focus-visible { outline: 3px solid white; outline-offset: 3px; }
    .world-thumb { height: 92px; background-size: cover; background-position: center; border-bottom: 1px solid rgba(0,0,0,.14); }
    .world-info { padding: 10px 11px 12px; color: #172016; }
    .world-info b { display: block; font-size: 15px; line-height: 1.1; }
    .world-info span { display: block; margin-top: 5px; font-size: 12px; line-height: 1.25; color: #3b4937; }
    .world-info em { display: inline-flex; margin-top: 8px; font-size: 11px; font-style: normal; font-weight: 900; color: #fff; background: var(--accent); padding: 4px 8px; border-radius: 999px; }

    .hud { position: absolute; inset: 0; z-index: 10; pointer-events: none; color: white; }
    .panel { pointer-events: auto; background: var(--glass); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,.28); backdrop-filter: blur(10px); }
    .top-left { position: absolute; top: 12px; left: 12px; width: min(360px, calc(100vw - 24px)); padding: 10px; }
    .unit-row { display: grid; grid-template-columns: 46px 1fr; gap: 10px; align-items: center; }
    .avatar { width: 46px; height: 46px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(145deg, #f9d58d, #8fd5ff); border: 2px solid rgba(255,255,255,.72); box-shadow: inset 0 -8px 12px rgba(0,0,0,.18); }
    .unit-name { font-weight: 950; font-size: 15px; line-height: 1; }
    .unit-sub { margin-top: 4px; font-size: 12px; opacity: .86; }
    .bars { display: grid; gap: 5px; margin-top: 8px; }
    .bar { height: 14px; border-radius: 999px; overflow: hidden; background: rgba(0,0,0,.32); border: 1px solid rgba(255,255,255,.18); position: relative; }
    .bar span { display: block; height: 100%; }
    .bar b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10px; text-shadow: 0 1px 2px rgba(0,0,0,.7); }
    .hp span { background: linear-gradient(90deg, #e9455f, #ff9a84); }
    .mp span { background: linear-gradient(90deg, #3f8cff, #8ae7ff); }
    .resources { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 9px; }
    .res { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.16); border-radius: 7px; padding: 5px 6px; font-size: 12px; font-weight: 900; text-align: center; white-space: nowrap; }
    .top-right { position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; }
    .icon-btn { pointer-events: auto; border: 1px solid rgba(255,255,255,.3); color: white; width: 42px; height: 42px; border-radius: 8px; background: rgba(16,22,18,.7); display: grid; place-items: center; cursor: pointer; font-size: 18px; box-shadow: 0 8px 20px rgba(0,0,0,.24); }
    .bottom-left { position: absolute; left: 12px; bottom: 12px; width: min(360px, calc(100vw - 190px)); padding: 10px 12px; }
    .loc-title { font-weight: 950; line-height: 1.1; }
    .loc-hint { margin-top: 5px; font-size: 12px; opacity: .88; line-height: 1.25; }
    .controller { position: absolute; right: 18px; bottom: 16px; width: 208px; height: 198px; pointer-events: auto; }
    .action-main, .orb { position: absolute; border: 1px solid rgba(255,255,255,.5); color: #fff; cursor: pointer; box-shadow: 0 9px 24px rgba(0,0,0,.35), inset 0 2px 8px rgba(255,255,255,.3), inset 0 -8px 14px rgba(0,0,0,.36); }
    .action-main { right: 0; bottom: 0; width: 94px; height: 94px; border-radius: 50%; background: radial-gradient(circle at 35% 24%, #fff7c7 0 7%, var(--accent) 42%, #35254f 100%); font-weight: 950; font-size: 13px; line-height: 1.05; padding: 0 10px; }
    .orb { width: 46px; height: 46px; border-radius: 50%; background: radial-gradient(circle at 34% 25%, #fff 0 8%, var(--accent) 46%, #263226 100%); font-weight: 950; }
    .orb:nth-child(1) { right: 112px; bottom: 10px; }
    .orb:nth-child(2) { right: 112px; bottom: 62px; }
    .orb:nth-child(3) { right: 78px; bottom: 110px; }
    .orb:nth-child(4) { right: 26px; bottom: 138px; }
    .orb:nth-child(5) { right: 150px; bottom: 114px; }
    .toast { position: absolute; left: 50%; bottom: 102px; transform: translateX(-50%); background: rgba(22,28,23,.82); border: 1px solid rgba(255,255,255,.28); color: white; padding: 9px 14px; border-radius: 8px; font-size: 13px; box-shadow: 0 12px 28px rgba(0,0,0,.28); opacity: 0; transition: opacity .18s ease; pointer-events: none; }
    .toast.show { opacity: 1; }
    .overlay { position: absolute; inset: 0; z-index: 30; display: none; place-items: center; background: rgba(3,8,5,.42); color: #172016; }
    .overlay.show { display: grid; }
    .sheet { width: min(720px, calc(100vw - 26px)); max-height: calc(100vh - 32px); overflow: auto; background: rgba(255,255,246,.94); border: 1px solid rgba(255,255,255,.72); border-radius: 10px; padding: 18px; box-shadow: 0 18px 50px rgba(0,0,0,.38); }
    .sheet h2 { margin: 0 0 8px; font-size: 24px; }
    .sheet p { margin: 0 0 12px; color: #3c4a38; }
    .sheet-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .sheet button { border: 1px solid rgba(0,0,0,.15); background: #fff; border-radius: 8px; padding: 10px; text-align: left; cursor: pointer; color: #172016; }

    @media (max-width: 900px) {
      .world-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: auto; align-self: stretch; padding-top: 6px; }
      .world-card { min-height: 146px; }
      .world-thumb { height: 72px; }
      .landing-head { flex-direction: column; }
      .top-left { transform: scale(.86); transform-origin: top left; }
      .controller { transform: scale(.82); transform-origin: bottom right; right: 8px; bottom: 8px; }
      .bottom-left { width: min(300px, calc(100vw - 160px)); }
    }
  </style>
</head>
<body>
  <div id="app">
    <canvas id="game"></canvas>

    <section id="landing" class="landing">
      <div class="landing-head">
        <div class="brand">
          <h1>LashiraBloom</h1>
          <p>Choose one world and jump straight into a playable prototype loop. One character, one resource wallet, five reusable game pillars.</p>
        </div>
        <div class="landing-chip">Single HTML Prototype</div>
      </div>
      <div id="worldGrid" class="world-grid"></div>
    </section>

    <div class="hud" id="hud" hidden>
      <div class="top-left panel">
        <div class="unit-row">
          <div class="avatar">✦</div>
          <div>
            <div class="unit-name">Lashira Hero</div>
            <div class="unit-sub">BLOOM <span id="bloomRank">1</span> · Shared HP/MP</div>
          </div>
        </div>
        <div class="bars">
          <div class="bar hp"><span id="hpBar"></span><b id="hpText"></b></div>
          <div class="bar mp"><span id="mpBar"></span><b id="mpText"></b></div>
        </div>
        <div class="resources">
          <div class="res">Wood <span id="wood">0</span></div>
          <div class="res">Ore <span id="ore">0</span></div>
          <div class="res">Bloom <span id="bloom">0</span></div>
          <div class="res">Dia <span id="diamond">0</span></div>
        </div>
      </div>
      <div class="top-right">
        <button id="homeBtn" class="icon-btn" title="Worlds">⌂</button>
        <button id="menuBtn" class="icon-btn" title="Menu">☰</button>
      </div>
      <div class="bottom-left panel">
        <div class="loc-title" id="locTitle">World</div>
        <div class="loc-hint" id="locHint">Objective</div>
      </div>
      <div class="controller" id="controller">
        <button class="orb" id="act1">↩</button>
        <button class="orb" id="act2">?</button>
        <button class="orb" id="act3">◇</button>
        <button class="orb" id="act4">♞</button>
        <button class="orb" id="act5">☺</button>
        <button class="action-main" id="mainAction">Act</button>
      </div>
      <div class="toast" id="toast"></div>
    </div>

    <div class="overlay" id="overlay">
      <div class="sheet">
        <h2>Prototype Menu</h2>
        <p>Jump between worlds, reset the in-memory prototype, or inspect the page strategy.</p>
        <div class="sheet-grid" id="menuWorlds"></div>
      </div>
    </div>
  </div>

  <script>
    const ASSETS = ${JSON.stringify(assets)};
    const ASSET_SUMMARY = ${JSON.stringify(assetSummary)};

    const WORLDS = {
      keep: {
        id: 'keep', name: 'Lashira Keep', module: 'keep', map: 'keep', accent: '#7c6cff',
        summary: 'Upgrade the command center and feed every other world.',
        objective: 'Upgrade one district and bank shared resources.',
        actions: ['Upgrade', 'Return', 'Inspect', 'Map', 'Mount', 'Emote'],
        spawn: [575, 650],
      },
      bloomwall: {
        id: 'bloomwall', name: 'Bloomwall Pass', module: 'defense', map: 'bloomwall', accent: '#3cc76b',
        summary: 'Place towers and survive a short defense wave.',
        objective: 'Start waves, place towers, stop enemies near the gate.',
        actions: ['Wave', 'Return', 'Tower', 'Map', 'Mount', 'Emote'],
        spawn: [610, 770],
      },
      kitchen: {
        id: 'kitchen', name: 'Hearthrush Kitchen', module: 'kitchen', map: 'kitchen', accent: '#f6a42c',
        summary: 'Prep, cook, and serve orders before patience runs out.',
        objective: 'Complete three orders with the shared action button.',
        actions: ['Action', 'Return', 'Dash', 'Orders', 'Mount', 'Emote'],
        spawn: [575, 790],
      },
      festival: {
        id: 'festival', name: 'Fountain Festival', module: 'festival', map: 'festival', accent: '#e9508a',
        summary: 'Play Bloom Gambit chess or rest with a picture board.',
        objective: 'Solve the plaza chess puzzle, or switch to picture mode when you want a softer loop.',
        actions: ['Play', 'Return', 'Hint', 'Switch', 'Mount', 'Emote'],
        spawn: [520, 620],
      },
      arena: {
        id: 'arena', name: 'Emberring Arena', module: 'arena', map: 'arena', accent: '#e84d42',
        summary: 'Short score challenge with normalized HP and MP.',
        objective: 'Collect sparks and tag bots for a 60 second score.',
        actions: ['Strike', 'Return', 'Dash', 'Score', 'Mount', 'Emote'],
        spawn: [575, 650],
      },
    };

    const state = {
      screen: 'landing',
      worldId: 'keep',
      player: { x: 575, y: 650, r: 16, speed: 190, hp: 120, maxHp: 120, mp: 80, maxMp: 80, facing: 'south', dashCooldown: 0, dashTime: 0, dashVx: 0, dashVy: 0 },
      resources: { wood: 40, ore: 20, bloom: 120, diamond: 1000 },
      keep: { level: 1, districts: { command: 1, kitchen: 1, defense: 1, festival: 1, arena: 1 } },
      defense: { wave: 0, towers: [], enemies: [], timer: 0 },
      kitchen: { orders: 0, phase: 0, patience: 100, station: 'Entrance', orderIndex: 0 },
      festival: { bloom: 0, mode: 'chess', puzzle: 0, picture: 0 },
      arena: { score: 0, bots: [], time: 60 },
      keys: new Set(),
      pointer: null,
      camera: { scale: 1, camX: 0, camY: 0 },
      toastUntil: 0,
      toastText: '',
    };

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const landing = document.getElementById('landing');
    const hud = document.getElementById('hud');
    const overlay = document.getElementById('overlay');
    const images = {};

    function loadImages() {
      return Promise.all(Object.entries(ASSETS).map(([k, src]) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => { images[k] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = src;
      })));
    }

    function resize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function imgUrl(key) { return ASSETS[key]; }

    function showToast(text) {
      state.toastText = text;
      state.toastUntil = performance.now() + 1400;
    }

    function enterWorld(id) {
      const w = WORLDS[id];
      state.worldId = id;
      state.screen = 'play';
      state.player.x = w.spawn[0];
      state.player.y = w.spawn[1];
      landing.hidden = true;
      hud.hidden = false;
      overlay.classList.remove('show');
      document.documentElement.style.setProperty('--accent', w.accent);
      resetModule(id, false);
      showToast('Entered ' + w.name);
      updateHud();
    }

    function showLanding() {
      state.screen = 'landing';
      landing.hidden = false;
      hud.hidden = true;
      overlay.classList.remove('show');
    }

    function resetModule(id, hard = false) {
      if (id === 'bloomwall' && (hard || !state.defense.enemies.length)) {
        state.defense.towers = [{ x: 380, y: 400, cd: 0 }, { x: 570, y: 330, cd: 0 }];
        state.defense.enemies = [];
      }
      if (id === 'festival' && hard) state.festival = { bloom: 0, mode: 'chess', puzzle: 0, picture: 0 };
      if (id === 'arena' && (hard || !state.arena.bots.length)) {
        state.arena.bots = [{ x: 420, y: 410, vx: 45, vy: 26 }, { x: 710, y: 520, vx: -35, vy: 34 }];
        state.arena.time = 60;
      }
    }

    function updateHud() {
      const w = WORLDS[state.worldId];
      document.getElementById('bloomRank').textContent = state.keep.level;
      document.getElementById('hpBar').style.width = Math.round(state.player.hp / state.player.maxHp * 100) + '%';
      document.getElementById('mpBar').style.width = Math.round(state.player.mp / state.player.maxMp * 100) + '%';
      document.getElementById('hpText').textContent = Math.round(state.player.hp) + '/' + state.player.maxHp;
      document.getElementById('mpText').textContent = Math.round(state.player.mp) + '/' + state.player.maxMp;
      document.getElementById('wood').textContent = state.resources.wood;
      document.getElementById('ore').textContent = state.resources.ore;
      document.getElementById('bloom').textContent = state.resources.bloom;
      document.getElementById('diamond').textContent = state.resources.diamond;
      document.getElementById('locTitle').textContent = w.name;
      document.getElementById('locHint').textContent = w.objective + ' · ' + moduleStatus();
      [1,2,3,4,5].forEach(i => document.getElementById('act' + i).textContent = w.actions[i]);
      document.getElementById('mainAction').textContent = w.actions[0];
    }

    function moduleStatus() {
      const id = state.worldId;
      if (id === 'keep') return 'BLOOM rank ' + state.keep.level;
      if (id === 'bloomwall') return 'Wave ' + state.defense.wave + ', enemies ' + state.defense.enemies.length;
      if (id === 'kitchen') return currentKitchenOrder().name + ' · ' + kitchenStepText();
      if (id === 'festival') return (state.festival.mode === 'chess' ? 'Bloom Gambit' : 'Picture Bloom') + ', BLOOM +' + state.festival.bloom;
      if (id === 'arena') return 'Score ' + state.arena.score;
      return '';
    }

    function kitchenOrders() {
      return [
        { name: 'Garden Stew', ingredient: 'carrots + herbs', method: 'slow pot', table: 'Table 1' },
        { name: 'Bloom Omelet', ingredient: 'egg + greens', method: 'pan sear', table: 'Table 2' },
        { name: 'Moonberry Tart', ingredient: 'berries + flour', method: 'oven bake', table: 'Table 3' },
        { name: 'Sunrise Soup', ingredient: 'pumpkin + spice', method: 'simmer', table: 'Counter Seat' },
      ];
    }

    function currentKitchenOrder() {
      const orders = kitchenOrders();
      return orders[state.kitchen.orderIndex % orders.length];
    }

    function kitchenStepText() {
      const order = currentKitchenOrder();
      return [
        'Get ' + order.ingredient,
        'Prep ' + order.name,
        'Cook with ' + order.method,
        'Serve to ' + order.table,
      ][state.kitchen.phase];
    }

    function mainAction() {
      const id = state.worldId;
      if (id === 'keep') {
        const cost = 20 * state.keep.level;
        if (state.resources.wood >= cost) {
          state.resources.wood -= cost;
          state.keep.level += 1;
          state.resources.bloom += 25;
          showToast('Keep upgraded. Other worlds feel stronger.');
        } else showToast('Need more Wood for the Keep.');
      } else if (id === 'bloomwall') {
        state.defense.wave += 1;
        for (let i = 0; i < 4 + state.defense.wave; i++) state.defense.enemies.push({ x: 170 - i * 38, y: 210, hp: 30 + state.defense.wave * 8, t: 0 });
        showToast('Wave ' + state.defense.wave + ' started.');
      } else if (id === 'kitchen') {
        runKitchenAction();
      } else if (id === 'festival') {
        if (state.festival.mode === 'chess') {
          state.festival.puzzle = (state.festival.puzzle + 1) % 3;
          state.festival.bloom += 12;
          state.resources.bloom += 12;
          showToast('Bloom Gambit solved. +12 BLOOM');
        } else {
          state.festival.bloom += 5;
          state.resources.bloom += 5;
          showToast('Picture Bloom placed. +5 BLOOM');
        }
      } else if (id === 'arena') {
        let hit = false;
        for (const b of state.arena.bots) {
          const d = Math.hypot(b.x - state.player.x, b.y - state.player.y);
          if (d < 70) { state.arena.score += 10; hit = true; b.x = 300 + Math.random() * 500; b.y = 260 + Math.random() * 390; }
        }
        showToast(hit ? 'Clean tag. +10 score' : 'No target in range.');
      }
      updateHud();
    }

    function runKitchenAction() {
      const near = nearestKitchenStation();
      if (!near || near.dist > 125) {
        showToast('Move near a kitchen station.');
        return;
      }
      state.kitchen.station = near.name;
      const order = currentKitchenOrder();
      const expected = ['Ingredients', 'Prep', 'Cook', 'Serve'][state.kitchen.phase];
      if (near.name === 'Orders') {
        showToast('Order: ' + order.name + '. Next: ' + kitchenStepText());
        return;
      }
      if (near.name !== expected) {
        showToast('Next: ' + expected + ' - ' + kitchenStepText() + '.');
        return;
      }
      state.kitchen.phase += 1;
      state.kitchen.patience = Math.min(100, state.kitchen.patience + 14);
      if (state.kitchen.phase >= 4) {
        state.kitchen.phase = 0;
        state.kitchen.orders += 1;
        state.kitchen.orderIndex = (state.kitchen.orderIndex + 1) % kitchenOrders().length;
        state.resources.bloom += 12;
        showToast(order.name + ' served to ' + order.table + '. +12 BLOOM');
      } else {
        showToast(expected + ' done. Next: ' + kitchenStepText());
      }
    }

    function secondaryAction(i) {
      if (i === 1) return showLanding();
      if (i === 2 && state.worldId === 'bloomwall') {
        state.defense.towers.push({ x: state.player.x, y: state.player.y, cd: 0 });
        state.resources.ore = Math.max(0, state.resources.ore - 3);
        showToast('Tower marker placed.');
      } else if (i === 2 && state.worldId === 'kitchen') {
        dashPlayer();
      } else if (i === 3 && state.worldId === 'kitchen') {
        showToast(currentKitchenOrder().name + ': ' + kitchenStepText());
      } else if (i === 2 && state.worldId === 'festival') {
        showToast(state.festival.mode === 'chess' ? 'Hint: move the queen toward the glowing file.' : 'Hint: use the side arrows to pick a picture.');
      } else if (i === 2 && state.worldId === 'arena') {
        state.player.x += 60;
        showToast('Dash.');
      } else if (i === 3 && state.worldId === 'festival') {
        toggleFestivalMode();
      } else if (i === 3) {
        showToast(moduleStatus());
      } else if (i === 4) {
        showToast('Mount is cosmetic in this prototype.');
      } else if (i === 5) {
        showToast('Lashira Hero waves.');
      } else {
        showToast('Inspect: ' + WORLDS[state.worldId].name);
      }
    }

    function toggleFestivalMode() {
      state.festival.mode = state.festival.mode === 'chess' ? 'picture' : 'chess';
      showToast(state.festival.mode === 'chess' ? 'Bloom Gambit ready.' : 'Picture Bloom ready.');
      updateHud();
    }

    function cycleFestivalPicture(dir) {
      state.festival.mode = 'picture';
      state.festival.picture = (state.festival.picture + dir + 3) % 3;
      showToast('Picture Bloom ' + (state.festival.picture + 1));
      updateHud();
    }

    function kitchenStations() {
      return [
        { name: 'Ingredients', icon: 'I', x: 360, y: 292, color: '#79d66f', hint: 'Collect vegetables and pantry items' },
        { name: 'Prep', icon: 'P', x: 338, y: 620, color: '#7ec7ff', hint: 'Chop and assemble the order' },
        { name: 'Cook', icon: 'C', x: 654, y: 420, color: '#ff9b43', hint: 'Use the stove and ovens' },
        { name: 'Serve', icon: 'S', x: 650, y: 628, color: '#ffd66b', hint: 'Plate at the counter' },
        { name: 'Orders', icon: 'O', x: 736, y: 782, color: '#ff7fb3', hint: 'Check tables and order queue' },
      ];
    }

    function kitchenObstacles() {
      return [
        { x: 0, y: 0, w: 1152, h: 118 },
        { x: 0, y: 0, w: 28, h: 928 },
        { x: 1120, y: 0, w: 32, h: 928 },
        { x: 0, y: 852, w: 1152, h: 76 },
        { x: 42, y: 126, w: 296, h: 128 },
        { x: 430, y: 124, w: 405, h: 246 },
        { x: 218, y: 468, w: 190, h: 98 },
        { x: 490, y: 486, w: 304, h: 82 },
        { x: 782, y: 352, w: 68, h: 456 },
        { x: 906, y: 184, w: 186, h: 128 },
        { x: 850, y: 470, w: 262, h: 280 },
        { x: 38, y: 330, w: 58, h: 430 },
      ];
    }

    function nearestKitchenStation() {
      if (state.worldId !== 'kitchen') return null;
      let best = null;
      for (const s of kitchenStations()) {
        const dist = Math.hypot(s.x - state.player.x, s.y - state.player.y);
        if (!best || dist < best.dist) best = { ...s, dist };
      }
      return best;
    }

    function circleHitsRect(cx, cy, radius, rect) {
      const px = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
      const py = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
      return Math.hypot(cx - px, cy - py) < radius;
    }

    function canMoveTo(x, y) {
      if (state.worldId !== 'kitchen') return true;
      return !kitchenObstacles().some(rect => circleHitsRect(x, y, state.player.r + 5, rect));
    }

    function dashPlayer() {
      if (state.screen !== 'play') return;
      const p = state.player;
      if (p.dashCooldown > 0 || p.mp < 8) {
        showToast(p.mp < 8 ? 'Need MP to dash.' : 'Dash cooling down.');
        return;
      }
      let dx = 0, dy = 0;
      if (state.keys.has('arrowleft') || state.keys.has('a')) dx -= 1;
      if (state.keys.has('arrowright') || state.keys.has('d')) dx += 1;
      if (state.keys.has('arrowup') || state.keys.has('w')) dy -= 1;
      if (state.keys.has('arrowdown') || state.keys.has('s')) dy += 1;
      if (!dx && !dy) {
        if (p.facing === 'west') dx = -1;
        else if (p.facing === 'east') dx = 1;
        else if (p.facing === 'north') dy = -1;
        else dy = 1;
      }
      const len = Math.hypot(dx, dy) || 1;
      p.dashVx = dx / len;
      p.dashVy = dy / len;
      p.dashTime = .16;
      p.dashCooldown = .55;
      p.mp = Math.max(0, p.mp - 8);
      showToast('Dash');
      updateHud();
    }

    function update(dt) {
      if (state.screen !== 'play') return;
      const p = state.player;
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, Math.round((p.mp + dt * 5) * 10) / 10);
      let dx = 0, dy = 0;
      if (state.keys.has('arrowleft') || state.keys.has('a')) dx -= 1;
      if (state.keys.has('arrowright') || state.keys.has('d')) dx += 1;
      if (state.keys.has('arrowup') || state.keys.has('w')) dy -= 1;
      if (state.keys.has('arrowdown') || state.keys.has('s')) dy += 1;
      if (state.pointer) { dx += state.pointer.x; dy += state.pointer.y; }
      const len = Math.hypot(dx, dy);
      if (p.dashTime > 0) {
        p.dashTime = Math.max(0, p.dashTime - dt);
        dx = p.dashVx;
        dy = p.dashVy;
      }
      const moveLen = Math.hypot(dx, dy);
      if (moveLen > 0) {
        const speed = p.dashTime > 0 ? 720 : p.speed;
        const nx = p.x + dx / moveLen * speed * dt;
        const ny = p.y + dy / moveLen * speed * dt;
        if (canMoveTo(nx, p.y)) p.x = nx;
        if (canMoveTo(p.x, ny)) p.y = ny;
        p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      }
      const img = images[WORLDS[state.worldId].map];
      if (img) {
        p.x = Math.max(24, Math.min(img.naturalWidth - 24, p.x));
        p.y = Math.max(42, Math.min(img.naturalHeight - 16, p.y));
      }
      updateModule(dt);
    }

    function updateModule(dt) {
      if (state.worldId === 'bloomwall') {
        const enemies = state.defense.enemies;
        for (const e of enemies) {
          e.t += dt * (0.06 + state.defense.wave * 0.004);
          e.x = 150 + e.t * 760;
          e.y = 200 + Math.sin(e.t * 5) * 80 + e.t * 420;
        }
        for (const t of state.defense.towers) {
          t.cd -= dt;
          if (t.cd <= 0) {
            const target = enemies.find(e => Math.hypot(e.x - t.x, e.y - t.y) < 190);
            if (target) { target.hp -= 18; t.cd = .55; }
          }
        }
        state.defense.enemies = enemies.filter(e => e.hp > 0 && e.x < 1020 && e.y < 860);
      }
      if (state.worldId === 'kitchen') {
        state.kitchen.patience = Math.max(0, state.kitchen.patience - dt * 6);
      }
      if (state.worldId === 'arena') {
        for (const b of state.arena.bots) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < 260 || b.x > 890) b.vx *= -1;
          if (b.y < 230 || b.y > 760) b.vy *= -1;
        }
      }
    }

    function draw() {
      ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (state.screen !== 'play') return;
      const w = WORLDS[state.worldId];
      const img = images[w.map];
      if (!img) return;
      const scale = Math.max(innerWidth / img.naturalWidth, innerHeight / img.naturalHeight);
      const viewW = innerWidth / scale, viewH = innerHeight / scale;
      const targetX = state.player.x - viewW / 2;
      const targetY = w.id === 'kitchen' ? state.player.y - viewH * .62 : state.player.y - viewH / 2;
      const camX = Math.max(0, Math.min(img.naturalWidth - viewW, targetX));
      const camY = Math.max(0, Math.min(img.naturalHeight - viewH, targetY));
      state.camera = { scale, camX, camY };
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);
      ctx.drawImage(img, 0, 0);
      drawModuleWorld(w);
      drawHero(state.player.x, state.player.y, w.accent);
      ctx.restore();
      drawToast();
    }

    function drawHero(x, y, accent) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(x, y + 8, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6c47a'; ctx.fillRect(x - 8, y - 42, 16, 16);
      ctx.fillStyle = accent; ctx.fillRect(x - 12, y - 27, 24, 28);
      ctx.fillStyle = '#2a3228'; ctx.fillRect(x - 14, y - 44, 28, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5, y - 37, 3, 3); ctx.fillRect(x + 4, y - 37, 3, 3);
      ctx.fillStyle = '#3a2819'; ctx.fillRect(x - 10, y + 1, 8, 14); ctx.fillRect(x + 2, y + 1, 8, 14);
      ctx.restore();
    }

    function drawModuleWorld(w) {
      if (w.id === 'bloomwall') {
        ctx.fillStyle = 'rgba(80,255,130,.32)';
        for (const t of state.defense.towers) { ctx.beginPath(); ctx.arc(t.x, t.y, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d8ffd2'; ctx.stroke(); }
        for (const e of state.defense.enemies) { ctx.fillStyle = '#70351d'; ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#eaffd5'; ctx.fillRect(e.x - 14, e.y - 24, Math.max(2, e.hp / 2), 4); }
      }
      if (w.id === 'kitchen') {
        drawKitchenLayer();
      }
      if (w.id === 'festival') drawFestivalBoard();
      if (w.id === 'arena') {
        ctx.fillStyle = '#ff704dcc';
        for (const b of state.arena.bots) { ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, Math.PI * 2); ctx.fill(); }
      }
    }

    function drawKitchenLayer() {
      const next = ['Ingredients', 'Prep', 'Cook', 'Serve'][state.kitchen.phase];
      const order = currentKitchenOrder();
      const near = nearestKitchenStation();
      state.kitchen.station = near ? near.name : 'Entrance';

      for (const s of kitchenStations()) {
        const active = s.name === next;
        const close = near && near.name === s.name && near.dist < 125;
        ctx.save();
        ctx.globalAlpha = active ? .78 : .42;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 10, active ? 42 : 32, active ? 18 : 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = close ? '#fffdf2' : 'rgba(255,255,255,.88)';
        ctx.strokeStyle = active ? s.color : 'rgba(45,38,30,.55)';
        ctx.lineWidth = active ? 5 : 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 26, active ? 22 : 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2b241c';
        ctx.font = '900 16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.icon, s.x, s.y - 26);
        if (active || close) {
          ctx.fillStyle = 'rgba(35,28,21,.82)';
          ctx.beginPath();
          ctx.roundRect(s.x - 74, s.y - 76, 148, 28, 8);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '900 13px system-ui';
          ctx.fillText(s.name, s.x, s.y - 57);
        }
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = 'rgba(43,36,28,.84)';
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(34, 34, 260, 78, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffaf0';
      ctx.font = '900 18px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Kitchen Flow', 50, 60);
      ctx.font = '13px system-ui';
      ctx.fillText('Next: ' + next + '  ·  ' + order.name, 50, 82);
      ctx.fillText('Patience ' + Math.round(state.kitchen.patience) + '%  ·  Space = Dash', 50, 100);
      ctx.restore();

      drawKitchenOrderTicket(order);
      drawKitchenCustomerBubble(order);
    }

    function drawKitchenOrderTicket(order) {
      const steps = [
        ['Ingredients', 'Get ' + order.ingredient],
        ['Prep', 'Prep ' + order.name],
        ['Cook', 'Cook: ' + order.method],
        ['Serve', 'Serve: ' + order.table],
      ];
      const x = 34, y = 126, w = 286, h = 164;
      ctx.save();
      ctx.fillStyle = 'rgba(255,250,232,.94)';
      ctx.strokeStyle = 'rgba(110,76,45,.72)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a2a1d';
      ctx.font = '900 18px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Order Ticket', x + 16, y + 28);
      ctx.font = '900 15px system-ui';
      ctx.fillText(order.name, x + 16, y + 52);
      ctx.font = '12px system-ui';
      ctx.fillText('For ' + order.table + ' · served ' + state.kitchen.orders, x + 16, y + 70);
      for (let i = 0; i < steps.length; i++) {
        const rowY = y + 94 + i * 17;
        const done = i < state.kitchen.phase;
        const current = i === state.kitchen.phase;
        ctx.fillStyle = done ? '#4a9f57' : current ? '#e49a2f' : '#8a8175';
        ctx.beginPath();
        ctx.arc(x + 20, rowY - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = current ? '#2d2117' : '#625548';
        ctx.font = current ? '900 12px system-ui' : '12px system-ui';
        ctx.fillText(steps[i][0] + ': ' + steps[i][1], x + 34, rowY);
      }
      ctx.restore();
    }

    function drawKitchenCustomerBubble(order) {
      ctx.save();
      const x = 914, y = 396;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.strokeStyle = '#ff7fb3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, 178, 64, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a2a1d';
      ctx.font = '900 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(order.table, x + 89, y + 23);
      ctx.font = '12px system-ui';
      ctx.fillText('wants ' + order.name, x + 89, y + 44);
      ctx.fillStyle = '#ff7fb3';
      ctx.beginPath();
      ctx.moveTo(x + 80, y + 64);
      ctx.lineTo(x + 96, y + 64);
      ctx.lineTo(x + 88, y + 82);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function festivalBoardRect() {
      return { x: 470, y: 150, cell: 50, size: 400, leftArrowX: 414, rightArrowX: 884, arrowY: 328 };
    }

    function drawFestivalBoard() {
      const r = festivalBoardRect();
      drawFestivalArrows(r);
      if (state.festival.mode === 'picture') drawPictureBloom(r);
      else drawBloomGambit(r);
    }

    function drawFestivalArrows(r) {
      for (const a of [{ x: r.leftArrowX, label: '<' }, { x: r.rightArrowX, label: '>' }]) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,244,250,.9)';
        ctx.strokeStyle = '#e9508a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(a.x, r.arrowY, 42, 64, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#8a2758';
        ctx.font = '900 32px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(a.label, a.x + 21, r.arrowY + 32);
        ctx.restore();
      }
    }

    function drawBloomGambit(r) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,250,.92)';
      ctx.strokeStyle = 'rgba(92,61,42,.85)';
      ctx.lineWidth = 5;
      ctx.fillRect(r.x - 8, r.y - 8, r.size + 16, r.size + 16);
      ctx.strokeRect(r.x - 8, r.y - 8, r.size + 16, r.size + 16);
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          ctx.fillStyle = (row + col) % 2 ? 'rgba(114,157,96,.82)' : 'rgba(255,239,197,.92)';
          ctx.fillRect(r.x + col * r.cell, r.y + row * r.cell, r.cell, r.cell);
        }
      }
      const pieces = [
        ['♜',0,0,'#2b2520'], ['♞',1,0,'#2b2520'], ['♝',2,0,'#2b2520'], ['♛',3,0,'#2b2520'], ['♚',4,0,'#2b2520'], ['♝',5,0,'#2b2520'], ['♞',6,0,'#2b2520'], ['♜',7,0,'#2b2520'],
        ['♟',0,1,'#2b2520'], ['♟',1,1,'#2b2520'], ['♟',2,1,'#2b2520'], ['♟',5,1,'#2b2520'], ['♟',6,1,'#2b2520'], ['♟',7,1,'#2b2520'],
        ['♙',0,6,'#fff8e6'], ['♙',1,6,'#fff8e6'], ['♙',2,6,'#fff8e6'], ['♙',5,6,'#fff8e6'], ['♙',6,6,'#fff8e6'], ['♙',7,6,'#fff8e6'],
        ['♖',0,7,'#fff8e6'], ['♘',1,7,'#fff8e6'], ['♗',2,7,'#fff8e6'], ['♕',3,7,'#fff8e6'], ['♔',4,7,'#fff8e6'], ['♗',5,7,'#fff8e6'], ['♘',6,7,'#fff8e6'], ['♖',7,7,'#fff8e6'],
      ];
      const puzzle = [['♕', 4, 4], ['♔', 6, 6], ['♚', 4, 1]][state.festival.puzzle];
      ctx.fillStyle = 'rgba(233,80,138,.38)';
      ctx.fillRect(r.x + puzzle[1] * r.cell, r.y + puzzle[2] * r.cell, r.cell, r.cell);
      pieces.push([puzzle[0], puzzle[1], puzzle[2], puzzle[0] === '♚' ? '#2b2520' : '#fff8e6']);
      ctx.font = '39px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [piece, col, row, color] of pieces) {
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillText(piece, r.x + col * r.cell + 27, r.y + row * r.cell + 29);
        ctx.fillStyle = color;
        ctx.fillText(piece, r.x + col * r.cell + 25, r.y + row * r.cell + 25);
      }
      drawBoardLabel(r, 'Bloom Gambit', 'Press Play to solve. Side arrows switch to Picture Bloom.');
      ctx.restore();
    }

    function drawPictureBloom(r) {
      const themes = [
        ['Fountain Memory', '#9ee7ff', '#f7d36a'],
        ['Petal Portrait', '#ffc1d8', '#8bd97f'],
        ['Moonlit Keep', '#7b87d8', '#f5f1dc'],
      ];
      const t = themes[state.festival.picture];
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,250,.94)';
      ctx.strokeStyle = '#e9508a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(r.x - 8, r.y - 8, r.size + 16, r.size + 16, 12);
      ctx.fill();
      ctx.stroke();
      const g = ctx.createLinearGradient(r.x, r.y, r.x + r.size, r.y + r.size);
      g.addColorStop(0, t[1]);
      g.addColorStop(1, t[2]);
      ctx.fillStyle = g;
      ctx.fillRect(r.x + 18, r.y + 18, r.size - 36, r.size - 36);
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(r.x + 70 + i * 42, r.y + 90 + Math.sin(i + state.festival.picture) * 36, 16 + (i % 3) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(42,54,40,.78)';
      ctx.fillRect(r.x + 54, r.y + 276, r.size - 108, 46);
      ctx.fillStyle = '#fffdf2';
      ctx.font = '900 26px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t[0], r.x + r.size / 2, r.y + 300);
      drawBoardLabel(r, 'Picture Bloom', 'Use side arrows to cycle pictures. Press Play to place.');
      ctx.restore();
    }

    function drawBoardLabel(r, title, subtitle) {
      ctx.fillStyle = 'rgba(23,32,22,.82)';
      ctx.fillRect(r.x, r.y + r.size + 14, r.size, 54);
      ctx.fillStyle = '#fff';
      ctx.font = '900 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(title + ' · BLOOM +' + state.festival.bloom, r.x + r.size / 2, r.y + r.size + 36);
      ctx.font = '12px system-ui';
      ctx.fillText(subtitle, r.x + r.size / 2, r.y + r.size + 52);
    }

    function hitFestivalArrow(clientX, clientY) {
      if (state.screen !== 'play' || state.worldId !== 'festival') return false;
      const r = festivalBoardRect();
      const worldX = state.camera.camX + clientX / state.camera.scale;
      const worldY = state.camera.camY + clientY / state.camera.scale;
      const hit = (x) => worldX >= x && worldX <= x + 42 && worldY >= r.arrowY && worldY <= r.arrowY + 64;
      if (hit(r.leftArrowX)) { cycleFestivalPicture(-1); return true; }
      if (hit(r.rightArrowX)) { cycleFestivalPicture(1); return true; }
      return false;
    }

    function drawToast() {
      const el = document.getElementById('toast');
      if (performance.now() < state.toastUntil) { el.textContent = state.toastText; el.classList.add('show'); }
      else el.classList.remove('show');
    }

    function buildLanding() {
      landing.style.backgroundImage = 'url(' + imgUrl('hq') + ')';
      const grid = document.getElementById('worldGrid');
      const menu = document.getElementById('menuWorlds');
      grid.innerHTML = '';
      menu.innerHTML = '';
      Object.values(WORLDS).forEach(w => {
        const btn = document.createElement('button');
        btn.className = 'world-card';
        btn.style.setProperty('--accent', w.accent);
        btn.innerHTML =
          '<div class="world-thumb" style="background-image:url(' + imgUrl(w.map) + ')"></div>' +
          '<div class="world-info"><b>' + w.name + '</b><span>' + w.summary + '</span><em>' + w.actions[0] + '</em></div>';
        btn.onclick = () => enterWorld(w.id);
        grid.appendChild(btn);
        const m = document.createElement('button');
        m.innerHTML = '<b>' + w.name + '</b><br><span>' + w.summary + '</span>';
        m.onclick = () => enterWorld(w.id);
        menu.appendChild(m);
      });
    }

    document.getElementById('mainAction').onclick = mainAction;
    [1,2,3,4,5].forEach(i => document.getElementById('act' + i).onclick = () => secondaryAction(i));
    document.getElementById('homeBtn').onclick = showLanding;
    document.getElementById('menuBtn').onclick = () => overlay.classList.add('show');
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('show'); };
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      state.keys.add(k);
      if (k === 'escape') showLanding();
      if (k === ' ') { e.preventDefault(); if (!e.repeat) dashPlayer(); }
      if (k === 'enter') mainAction();
    });
    addEventListener('keyup', e => state.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('pointerdown', e => {
      if (hitFestivalArrow(e.clientX, e.clientY)) return;
      state.pointer = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: 0, y: 0 };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => { if (!state.pointer || state.pointer.id !== e.pointerId) return; const dx = e.clientX - state.pointer.sx, dy = e.clientY - state.pointer.sy; const d = Math.hypot(dx, dy) || 1; state.pointer.x = Math.max(-1, Math.min(1, dx / d)); state.pointer.y = Math.max(-1, Math.min(1, dy / d)); });
    canvas.addEventListener('pointerup', () => state.pointer = null);
    canvas.addEventListener('pointercancel', () => state.pointer = null);
    addEventListener('resize', resize);

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      requestAnimationFrame(loop);
    }

    resize();
    loadImages().then(() => { buildLanding(); updateHud(); requestAnimationFrame(loop); });
  </script>
</body>
</html>`;

const out = path.join(root, 'public', 'lashira-5worlds-prototype.html');
writeFileSync(out, html, 'utf8');
console.log(`Wrote ${out}`);

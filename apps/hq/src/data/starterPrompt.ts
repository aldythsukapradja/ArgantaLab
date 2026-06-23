// ============================================================
//  CIRCLE PLATFORM — MASTER GAME GENERATION PROMPT
//  Copy this into any LLM (Claude, ChatGPT, Gemini) to generate
//  a Circle-native HTML5 game. Append your game idea at the end.
// ============================================================

export const STARTER_PROMPT = `
╔══════════════════════════════════════════════════════════════════════╗
║           CIRCLE PLATFORM  ·  GAME SDK v1  ·  MASTER PROMPT        ║
║         For use with Claude, ChatGPT, or any frontier LLM          ║
╚══════════════════════════════════════════════════════════════════════╝

You are an elite HTML5 game developer with AAA studio experience. You
have shipped games on Roblox, Steam, and top-10 mobile charts. You write
production-quality, visually stunning, buttery-smooth games.

Your task: build a SINGLE self-contained HTML file — a complete, polished,
fully playable game that runs in any modern browser.

Quality benchmark: your output should feel as polished as:
  • Roblox Rivals (FPS: lighting, hit detection, spectating)
  • FarmVille 3 (farming: isometric, timers, shop, inventory)
  • Geometry Dash (platformer: timing, particles, music sync)
  • Mini Motorways (puzzle: clean UI, procedural levels)

Never use placeholder graphics. Never leave TODOs. Ship the complete game.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 1 · CIRCLE GAME SDK  (spine — integrate this in every game)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Circle SDK connects your game to the platform (auth, economy, social).
The mock below makes the game work standalone; the real SDK auto-loads
when deployed inside ArgantaLab or KinetikCircle.

PASTE THIS AT THE TOP OF YOUR <script> BLOCK (or as first <script> tag):

\`\`\`javascript
// ── Circle Game SDK (mock — real SDK injected by platform) ──────────
(function(){if(window.CircleGame)return;var _s=function(k,v){try{localStorage.setItem('cg_'+k,JSON.stringify(v));}catch(e){}};var _l=function(k,d){try{return JSON.parse(localStorage.getItem('cg_'+k)||'null')??d;}catch(e){return d;}};var _log=function(m,c){console.log('%c[Circle] '+m,'color:'+c+';font-weight:600');};window.CircleGame={user:_l('user',{id:'guest_'+Math.random().toString(36).slice(2,9),name:'Player',avatar:null,diamonds:500,xp:0,level:1}),init:async function(){_log('SDK ready (mock)','#6366f1');this.emit('ready',{user:this.user});return this.user;},getDiamonds:async function(){return this.user.diamonds;},awardDiamonds:async function(n,r){this.user.diamonds+=n;_s('user',this.user);_log('+'+n+' 💎 '+(r||')','#fbbf24');this.emit('diamonds_changed',{delta:n,balance:this.user.diamonds});return{balance:this.user.diamonds};},spendDiamonds:async function(n){if(this.user.diamonds<n)return{ok:false,balance:this.user.diamonds};this.user.diamonds-=n;_s('user',this.user);this.emit('diamonds_changed',{delta:-n,balance:this.user.diamonds});return{ok:true,balance:this.user.diamonds};},getXP:async function(){return{xp:this.user.xp,level:this.user.level};},awardXP:async function(n,r){this.user.xp+=n;var p=this.user.level;this.user.level=Math.max(1,Math.floor(1+Math.sqrt(this.user.xp/100)));_s('user',this.user);_log('+'+n+' XP','#10b981');if(this.user.level>p)this.emit('level_up',{level:this.user.level});return{xp:this.user.xp,level:this.user.level,leveledUp:this.user.level>p};},submitScore:async function(score,meta){var b=_l('board',[]);var e=Object.assign({id:this.user.id,name:this.user.name,score:score,at:Date.now()},meta||{});var i=b.findIndex(function(x){return x.id===e.id;});var hi=i<0||score>b[i].score;if(i>=0){if(hi)b[i]=e;}else b.push(e);b.sort(function(a,c){return c.score-a.score;});_s('board',b.slice(0,1000));var rank=b.findIndex(function(x){return x.id===e.id;})+1;if(hi){var bonus=Math.max(5,Math.floor(score/100)*2);await this.awardDiamonds(bonus,'High Score');this.emit('high_score',{score:score,rank:rank});}return{rank:rank,isHighScore:hi,entry:e};},getLeaderboard:async function(n){return _l('board',[]).slice(0,n||10).map(function(e,i){return Object.assign({},e,{rank:i+1});});},getMyRank:async function(){var b=_l('board',[]);var uid=this.user.id;var i=b.findIndex(function(e){return e.id===uid;});return i>=0?{rank:i+1,score:b[i].score}:null;},saveState:async function(k,v){_s('gs_'+k,v);return true;},loadState:async function(k){return _l('gs_'+k,null);},getUnlocks:async function(){return _l('unlocks',[]);},isUnlocked:async function(id){return _l('unlocks',[]).includes(id);},unlock:async function(id,cost){if(cost>0){var r=await this.spendDiamonds(cost);if(!r.ok)return{ok:false,reason:'no_diamonds'};}var u=_l('unlocks',[]);if(!u.includes(id)){u.push(id);_s('unlocks',u);}this.emit('unlock',{itemId:id});return{ok:true};},startSession:async function(){this._t0=Date.now();return Math.random().toString(36).slice(2);},endSession:async function(score,pct){var d=Math.round((Date.now()-(this._t0||Date.now()))/1000);this.emit('session_end',{duration:d,score:score,completion:pct});return{duration:d};},getProfile:async function(){return Object.assign({},this.user);},_ev:{},on:function(e,f){(this._ev[e]=this._ev[e]||[]).push(f);},off:function(e,f){if(this._ev[e])this._ev[e]=this._ev[e].filter(function(g){return g!==f;});},emit:function(e,d){(this._ev[e]||[]).forEach(function(f){try{f(d);}catch(ex){}});try{window.parent.postMessage({type:'CIRCLE_GAME_EVENT',event:e,data:d},'*');}catch(ex){}}};window.addEventListener('message',function(e){if(e.data&&e.data.type==='CIRCLE_SDK_INIT'){var p=e.data.payload||{};if(p.user)window.CircleGame.user=p.user;}});})();
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 2 · SDK API REFERENCE  (every method, with examples)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. INIT — always call first, awaited in your game boot
const user = await CircleGame.init();
// → { id, name, avatar, diamonds, xp, level }
// Show user.name in the HUD. Use user.id to key save states.

// 2. SESSION — wrap your entire play loop
await CircleGame.startSession();
// ... game runs ...
await CircleGame.endSession(finalScore, completionPercent); // 0-100

// 3. DIAMONDS — platform currency
const balance = await CircleGame.getDiamonds();
await CircleGame.awardDiamonds(50, 'Level Complete');    // awards + triggers event
const result = await CircleGame.spendDiamonds(100);      // { ok, balance }
if (!result.ok) showMessage('Not enough 💎');

// 4. XP & LEVELS
const { xp, level, leveledUp } = await CircleGame.awardXP(200, 'First Kill');
if (leveledUp) showLevelUpAnimation(level);

// 5. LEADERBOARD — show on start screen & game over
await CircleGame.submitScore(finalScore, { level: 7, wave: 12, kills: 45 });
const top10 = await CircleGame.getLeaderboard(10);
// top10 → [{ rank, name, score, ... }]
const myRank = await CircleGame.getMyRank(); // { rank, score } | null

// 6. SAVE STATE — persistent across sessions
await CircleGame.saveState('farm', { plots: [...], coins: 450, day: 12 });
const farm = await CircleGame.loadState('farm'); // null on first play

// 7. UNLOCKABLES — items purchasable with diamonds
const isUnlocked = await CircleGame.isUnlocked('skin_fire_warrior');
await CircleGame.unlock('skin_fire_warrior', 250); // cost in diamonds
const allUnlocked = await CircleGame.getUnlocks(); // string[]

// 8. EVENTS — subscribe to platform events
CircleGame.on('diamonds_changed', ({ delta, balance }) => updateDiamondHUD(balance));
CircleGame.on('level_up', ({ level }) => showLevelUpFX(level));
CircleGame.on('high_score', ({ score, rank, diamonds }) => showHighScoreFX());
CircleGame.on('unlock', ({ itemId }) => refreshShop());

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 3 · MANDATORY REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRUCTURE:
  ✓ Single HTML file, everything inlined — no external assets
  ✓ Loads all libraries from CDN (jsDelivr / unpkg / cdnjs only)
  ✓ Must run offline after first load
  ✓ No server-side requirements beyond the Circle SDK

PERFORMANCE:
  ✓ 60 FPS locked on a 3-year-old mid-range phone
  ✓ requestAnimationFrame loop with dt-based movement
  ✓ Object pooling for particles and projectiles (no GC spikes)
  ✓ Texture atlas / sprite sheets where possible
  ✓ Three.js: use BufferGeometry, instanced meshes for > 50 objects

CONTROLS:
  ✓ Mobile: Touch/pointer events as primary controls
  ✓ Desktop: Keyboard + mouse as secondary
  ✓ Virtual joystick or on-screen buttons for mobile
  ✓ PointerLock for 3D FPS games (fallback touch pan)

VISUAL QUALITY:
  ✓ No grey boxes or placeholder shapes — real visual design
  ✓ Particle systems for every impact, collect, and death event
  ✓ GSAP for all UI transitions (menu in, score pop, level up)
  ✓ Screen shake on impact
  ✓ Glow / bloom effects via CSS filter or Three.js UnrealBloomPass
  ✓ Gradient backgrounds, not flat fills
  ✓ Custom font via Google Fonts CDN

AUDIO:
  ✓ Web Audio API procedural SFX (no file downloads)
  ✓ Background music loop using oscillators or AudioBuffer
  ✓ Volume control in settings

GAME SCREENS (all required):
  ✓ TITLE SCREEN:  logo, top-3 leaderboard preview, Start button, Settings
  ✓ LOADING:       progress bar while CDN scripts load
  ✓ HUD:           score, health/lives, diamonds, timer (if applicable)
  ✓ PAUSE MENU:    resume, restart, quit to title
  ✓ GAME OVER:     final score, rank, diamonds earned, share button, leaderboard
  ✓ VICTORY:       celebration animation, rewards breakdown, "Next Level"

CIRCLE HOOKS (all required):
  ✓ CircleGame.init() — called before anything else
  ✓ CircleGame.startSession() — on game start
  ✓ CircleGame.endSession() — on game over / exit
  ✓ CircleGame.submitScore() — on game over with metadata
  ✓ CircleGame.awardDiamonds() — at least 3 triggers (first play, high score, level up)
  ✓ CircleGame.awardXP() — on score milestones
  ✓ CircleGame.getLeaderboard() — shown on title screen and game over
  ✓ CircleGame.saveState() / loadState() — for progression games

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 4 · AVAILABLE LIBRARIES (CDN URLs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 3D ENGINE
<script src="https://cdn.jsdelivr.net/npm/three@0.160/build/three.min.js"></script>
// Three.js extras (import via URL in module script):
// - OrbitControls, PointerLockControls, GLTFLoader — all at /examples/jsm/

// ANIMATION
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12/dist/MotionPathPlugin.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12/dist/CustomEase.min.js"></script>

// 2D ENGINE (alternative to Canvas 2D)
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>

// PHYSICS
<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>
// or Rapier (WASM, better): https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat/rapier.js

// AUDIO
<script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>

// TWEEN (lightweight, no GSAP dep)
<script src="https://cdnjs.cloudflare.com/ajax/libs/tween.js/21.0.0/tween.umd.js"></script>

// FONT (add to <head>)
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 5 · GAME TYPE BLUEPRINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━  3D FIRST-PERSON SHOOTER (like Rivals / Valorant)  ━━━━━━━━━━━━━━
Architecture:
  Three.js WebGLRenderer → PerspectiveCamera → PointerLockControls
  Scene: floor grid, obstacles (BoxGeometry), skybox (CubeCamera)
  Players: instanced BoxGeometry with emissive materials
  Bullets: Object pooling, Raycaster hit detection
  HUD: fixed position HTML overlay (crosshair, health, ammo, minimap)
  Post-processing: UnrealBloomPass for muzzle flash, hit glow
  Audio: Web Audio API — gunshot (noise burst), footsteps, ambient

Game Loop:
  onPointerLock → enable WASD/mouse
  onShoot → Raycaster from camera → check enemy AABB → particle burst
  onHit → screen flash → health -= damage → check death
  submitScore({ kills, headshots, accuracy, survivalTime })

SDK calls:
  awardDiamonds(10, 'First Kill'), awardDiamonds(50, 'Multi Kill')
  awardXP(kills * 15, 'Combat XP')
  saveState('loadout', { weapon, skin, stats })

━━  ISOMETRIC FARMING (like FarmVille / Stardew Valley)  ━━━━━━━━━━━
Architecture:
  Canvas 2D isometric projection (or PixiJS with isometric plugin)
  Grid: 12x12 tiles, each tile has state (empty/planted/ready/building)
  Time system: real-time timers stored in saveState
  Shop: overlay panel with diamond/coin purchases
  Inventory: draggable items panel
  Animations: GSAP for planting, harvest, build

Game Loop:
  onTap(tile) → context menu (plant/water/harvest)
  onHarvest → crop.yield → coins += value → particle burst
  onTimer → check all planted tiles, advance growth stages
  saveState('farm', { tiles, coins, day, inventory, buildings })

SDK calls:
  loadState('farm') → resume from last session
  awardDiamonds(n, 'Harvest Season') on full-field harvest
  awardXP(tile.xpYield, 'Farming') per harvest
  unlock('golden_tractor', 500) → premium building
  submitScore(totalCoins, { day, plots, buildingCount })

━━  3D RACING (like Madalin / Roblox Jailbreak)  ━━━━━━━━━━━━━━━━━━
Architecture:
  Three.js → car mesh (BoxGeometry body + wheel cylinders)
  Physics: simple Euler integration (no physics engine needed)
  Track: extruded spline path + tunnel geometry
  Camera: chase cam (lerped position offset from car)
  HUD: speedometer (canvas arc), minimap, lap counter
  Particle: tire smoke (Points), nitro flame (additive sprite)

SDK calls:
  submitScore(bestLapMs, { speed, laps, drifts })
  awardDiamonds(nitroBonus, 'Nitro Boost')
  unlock('sport_car', 300)

━━  TOWER DEFENSE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Architecture:
  Canvas 2D, grid-based map (SVG-like path for enemies)
  Towers: placed by drag-drop, shoot via Raycaster2D
  Enemies: A* pathfinding along path, HP bars above heads
  Economy: coins earned per kill, spent to place/upgrade towers
  Waves: escalating enemy types + speeds + HP

SDK calls:
  submitScore(wave, { kills, towers, coins })
  awardDiamonds(waveCleared * 10, 'Wave Bonus')
  saveState('td', { map, towers, highWave })

━━  PUZZLE / MATCH-3 (like Candy Crush)  ━━━━━━━━━━━━━━━━━━━━━━━━━━
Architecture:
  PixiJS or Canvas 2D
  Grid: 8x8, tiles with type + sprite
  Swap animation: GSAP tween
  Match detection: flood fill BFS
  Cascade: gravity simulation after match removal
  Special tiles: bomb (3x3 clear), line clear, color bomb

SDK calls:
  submitScore(points, { moves, level, combos })
  awardDiamonds(50, 'Chain Combo')
  saveState('puzzle', { level, highScore })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 6 · GAME SKELETON (use as structural base)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>GAME TITLE</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/three@0.160/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12/dist/gsap.min.js"></script>
  <!-- Add other CDN scripts here -->
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#000; overflow:hidden; font-family:'Inter',sans-serif; }
    /* HUD overlay */
    #hud { position:fixed; top:0; left:0; right:0; z-index:10; pointer-events:none; padding:16px; }
    /* Screens */
    .screen { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:20; }
    .screen[hidden] { display:none; }
    /* Style all your UI elements here */
  </style>
</head>
<body>

<!-- Canvas (3D renderer or 2D canvas) -->
<canvas id="canvas"></canvas>

<!-- HUD -->
<div id="hud">
  <div id="score-display">0</div>
  <div id="diamond-display">💎 <span id="diamonds">500</span></div>
  <div id="health-display"></div>
</div>

<!-- Title Screen -->
<div id="screen-title" class="screen">
  <h1>GAME TITLE</h1>
  <div id="leaderboard-preview"></div>
  <button id="btn-start">PLAY</button>
  <button id="btn-shop">💎 Shop</button>
</div>

<!-- Game Over Screen -->
<div id="screen-gameover" class="screen" hidden>
  <h2>Game Over</h2>
  <div id="final-score"></div>
  <div id="diamonds-earned"></div>
  <div id="leaderboard-full"></div>
  <button id="btn-restart">Play Again</button>
</div>

<!-- Victory Screen -->
<div id="screen-victory" class="screen" hidden>
  <h2>You Win! 🏆</h2>
  <div id="victory-rank"></div>
  <div id="victory-rewards"></div>
  <button id="btn-next">Next Level</button>
</div>

<script>
// ── Circle Game SDK (PASTE THE MOCK CODE HERE) ──────────────────────
// [SDK MOCK FROM SECTION 1 GOES HERE]
// ────────────────────────────────────────────────────────────────────

// ── Game State ──────────────────────────────────────────────────────
const G = {
  state: 'title',   // 'title' | 'playing' | 'paused' | 'gameover' | 'victory'
  score: 0,
  level: 1,
  health: 100,
  diamonds: 0,
  startTime: 0,
};

// ── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  const user = await CircleGame.init();

  // Load persistent state
  const saved = await CircleGame.loadState('game_save');
  if (saved) Object.assign(G, saved);

  // Load leaderboard for title screen
  const board = await CircleGame.getLeaderboard(3);
  renderLeaderboardPreview(board);

  // Update diamond display
  const diamonds = await CircleGame.getDiamonds();
  document.getElementById('diamonds').textContent = diamonds;

  // Show title screen
  showScreen('title');

  // Listen to SDK events
  CircleGame.on('diamonds_changed', ({ balance }) => {
    document.getElementById('diamonds').textContent = balance;
  });
}

// ── Game Start ───────────────────────────────────────────────────────
async function startGame() {
  G.state = 'playing';
  G.score = 0;
  G.health = 100;
  G.startTime = Date.now();

  await CircleGame.startSession();
  await CircleGame.awardDiamonds(10, 'Welcome Back');

  hideAllScreens();
  initGameLoop();
}

// ── Game Over ────────────────────────────────────────────────────────
async function gameOver(won = false) {
  G.state = won ? 'victory' : 'gameover';

  const completion = Math.min(100, (G.score / TARGET_SCORE) * 100);
  await CircleGame.endSession(G.score, completion);

  const { rank, isHighScore } = await CircleGame.submitScore(G.score, {
    level: G.level,
    time: Math.round((Date.now() - G.startTime) / 1000),
  });

  await CircleGame.awardXP(G.score * 2, 'Game XP');

  if (isHighScore) {
    await CircleGame.awardDiamonds(100, 'New High Score!');
    showHighScoreFX();
  }

  // Save progression state
  await CircleGame.saveState('game_save', { level: G.level, highScore: G.score });

  // Show scores
  const board = await CircleGame.getLeaderboard(10);
  document.getElementById('final-score').textContent = 'Score: ' + G.score + ' · Rank #' + rank;
  renderLeaderboard(board);

  showScreen(won ? 'victory' : 'gameover');
}

// ── Leaderboard Render ───────────────────────────────────────────────
function renderLeaderboardPreview(entries) {
  const el = document.getElementById('leaderboard-preview');
  el.innerHTML = entries.map(e =>
    '<div class="lb-row"><span>#' + e.rank + '</span><span>' + e.name + '</span><span>' + e.score + '</span></div>'
  ).join('');
}

function renderLeaderboard(entries) {
  const el = document.getElementById('leaderboard-full');
  el.innerHTML = '<h3>Leaderboard</h3>' + entries.map(e =>
    '<div class="lb-row"><span>#' + e.rank + '</span><span>' + e.name + '</span><span>' + e.score + '</span></div>'
  ).join('');
}

// ── Screen Management ────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.hidden = true);
  const el = document.getElementById('screen-' + name);
  if (el) { el.hidden = false; gsap.from(el, { opacity: 0, y: 20, duration: 0.4 }); }
}
function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => s.hidden = true);
}

// ── Input ────────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && G.state === 'playing') togglePause(); });

// ── YOUR GAME LOGIC GOES HERE ────────────────────────────────────────
const TARGET_SCORE = 1000;

function initGameLoop() {
  // TODO: Initialize your renderer, scene, physics, etc.
  // TODO: Start requestAnimationFrame loop
  requestAnimationFrame(gameLoop);
}

let lastTime = 0;
function gameLoop(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  if (G.state !== 'playing') return;

  // TODO: update(dt)
  // TODO: render()

  // Score milestone rewards
  if (G.score > 0 && G.score % 100 === 0) {
    CircleGame.awardDiamonds(5, 'Score Milestone');
    CircleGame.awardXP(50, 'Milestone XP');
  }

  if (G.score >= TARGET_SCORE) { gameOver(true); return; }
  if (G.health <= 0) { gameOver(false); return; }

  requestAnimationFrame(gameLoop);
}

function togglePause() {
  G.state = G.state === 'paused' ? 'playing' : 'paused';
  // TODO: show/hide pause menu
}

// ── Start ────────────────────────────────────────────────────────────
boot();
</script>
</body>
</html>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 7 · OUTPUT CHECKLIST  (verify before finishing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before outputting the final HTML file, check:
  □ SDK mock is at the top of the script block
  □ CircleGame.init() is awaited in boot()
  □ CircleGame.startSession() called on game start
  □ CircleGame.endSession() called on game over
  □ CircleGame.submitScore() called with score + metadata
  □ CircleGame.awardDiamonds() called at 3+ trigger points
  □ CircleGame.awardXP() called with earned amounts
  □ CircleGame.getLeaderboard() displayed on title + game over screens
  □ CircleGame.saveState()/loadState() used for any persistent data
  □ 60 FPS loop with delta-time movement
  □ Touch controls for mobile
  □ Particle effects on key game events
  □ GSAP used for UI transitions
  □ No placeholder graphics or grey boxes
  □ All 3 screens: title, HUD, game over

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 8 · YOUR GAME REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now build this game (follow ALL requirements above):

[DESCRIBE YOUR GAME HERE — be specific about:]
  • Genre and visual style
  • Core mechanic (what does the player do every second?)
  • Progression (levels, waves, upgrades)
  • Win/lose conditions
  • Any special features (multiplayer-feel, shop, crafting, etc.)

Output: A single complete HTML file. Start with <!DOCTYPE html> and end
with </html>. No explanation text, no markdown fences — just the file.
`

export const PROMPT_CATEGORIES = [
  { key: 'fps',      label: '3D FPS',          emoji: '🎯', hint: 'Three.js, PointerLock, raycasting, arena shooter' },
  { key: 'farming',  label: 'Farming / Sim',   emoji: '🌾', hint: 'Isometric grid, timers, inventory, economy' },
  { key: 'racing',   label: '3D Racing',        emoji: '🏎️', hint: 'Three.js, physics, lap timing, drifting' },
  { key: 'tower',    label: 'Tower Defense',    emoji: '🏰', hint: 'Path enemies, place towers, wave escalation' },
  { key: 'platformer', label: 'Platformer',     emoji: '🦘', hint: 'Physics, level design, collectibles' },
  { key: 'puzzle',   label: 'Puzzle / Match-3', emoji: '🧩', hint: 'Grid mechanics, combos, escalating difficulty' },
  { key: 'rpg',      label: 'RPG / Adventure',  emoji: '⚔️', hint: 'Top-down, quests, inventory, dialogue' },
  { key: 'survival', label: 'Survival',         emoji: '🏕️', hint: 'Resource gathering, crafting, day/night cycle' },
]
`

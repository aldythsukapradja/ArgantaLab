// GB-2 · Stage-0 deterministic GAME shell — the game twin of appShell.ts's
// makeAppShell() and engines.ts's makeWebsite(). Same discipline: same brief →
// same output, $0, instant, never depends on AI succeeding.
//
// This is a REAL, complete, playable arcade game — not a placeholder — because
// it is the honest fallback when Stage-1 AI generation fails the validation
// gate (Single-File-Builder.md's tiered generation). A founder who lands here
// gets something they can actually play and ship, not a canvas with a TODO on
// it. It satisfies every kind:'game' check in @arganta/builder's validate.js by
// construction: canvas surface, rAF loop with delta-time, keyboard AND pointer
// input, on-screen score, ramping difficulty, game-over + restart, and a
// guarded CircleGame.submitScore() so it links to the circle when the SDK is
// injected and still runs standalone when it isn't.
//
// The genre tunes the SKIN and the objective language, not a different engine —
// one honest arcade core, dressed. Anything more elaborate is Stage-1's job.
import { makeBrand, type BrandKit } from '../surfaces/studios/engines'

function esc(s: string) { return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]!)) }

function titleFrom(brief: string): string {
  const first = (brief.split(/[—\-,.\n]/)[0] || 'Game').trim()
  return first.slice(0, 40) || 'Game'
}

/** Per-genre dressing for the one arcade core: what you are, what you collect,
 * what you dodge, and what the objective is called. Deliberately small — this
 * is a floor, and pretending otherwise would be the dishonest move. */
interface GenreSkin { player: string; good: string; bad: string; verb: string; objective: string }
const SKINS: Record<string, GenreSkin> = {
  arcade:     { player: '🚀', good: '⭐', bad: '☄️',  verb: 'Collect', objective: 'stars' },
  puzzle:     { player: '🧩', good: '🔷', bad: '💥', verb: 'Match',   objective: 'pieces' },
  platformer: { player: '🦘', good: '🍒', bad: '🌵', verb: 'Grab',    objective: 'cherries' },
  shooter:    { player: '🛸', good: '🎯', bad: '👾', verb: 'Hit',     objective: 'targets' },
  racing:     { player: '🏎️', good: '⛽', bad: '🚧', verb: 'Fuel up on', objective: 'cans' },
  tower:      { player: '🏰', good: '🛡️', bad: '⚔️', verb: 'Defend with', objective: 'shields' },
  rpg:        { player: '🧙', good: '💎', bad: '👹', verb: 'Loot',    objective: 'gems' },
  survival:   { player: '🧭', good: '🍖', bad: '🧟', verb: 'Forage',  objective: 'rations' },
  farming:    { player: '🧑‍🌾', good: '🌾', bad: '🐛', verb: 'Harvest', objective: 'crops' },
  strategy:   { player: '♟️', good: '🏳️', bad: '🔥', verb: 'Claim',   objective: 'flags' },
  rhythm:     { player: '🎧', good: '🎵', bad: '🔇', verb: 'Catch',   objective: 'notes' },
  custom:     { player: '🟣', good: '🟡', bad: '🔴', verb: 'Collect', objective: 'orbs' },
}

/**
 * A complete single-file arcade game: move to catch the good things, dodge the
 * bad ones, difficulty ramps with score, three lives, game over + restart.
 * Deterministic — the same brief always yields the same game.
 */
export function makeGameShell(brief: string, genre = 'custom', brand: BrandKit = makeBrand(brief)): string {
  const title = titleFrom(brief)
  const skin = SKINS[genre] || SKINS.custom
  const c = brand.colors
  const bestKey = 'arganta_game_' + Math.abs(hashCode(brief)).toString(36)
  return `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>${esc(title)}</title><style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:${brand.fonts.body};background:${c.bg};color:${c.ink};min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px;overflow:hidden;touch-action:none}
h1{font-family:${brand.fonts.head};font-size:clamp(16px,4vw,22px);font-weight:700;letter-spacing:.01em}
#hud{display:flex;gap:18px;align-items:center;font-variant-numeric:tabular-nums;font-size:14px;font-weight:600}
#hud b{color:${c.accent}}
#wrap{position:relative;width:min(96vw,520px);aspect-ratio:5/6;max-height:72vh}
canvas{width:100%;height:100%;display:block;border-radius:16px;background:#00000030;border:1px solid #ffffff1f;touch-action:none}
#overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:8vw;background:#0b0718cc;backdrop-filter:blur(6px);border-radius:16px}
#overlay[hidden]{display:none}
#overlay h2{font-family:${brand.fonts.head};font-size:clamp(18px,5vw,26px)}
#overlay p{opacity:.75;font-size:14px;line-height:1.5;max-width:32ch}
button{padding:13px 26px;min-height:44px;border:0;border-radius:999px;background:${c.accent};color:#1a1030;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
button:active{transform:scale(.97)}
#hint{font-size:12px;opacity:.55;text-align:center}
@media (max-width:600px){#hud{font-size:13px;gap:12px}}
</style></head><body>
<h1>${esc(title)}</h1>
<div id="hud"><span>Score <b id="score">0</b></span><span>Best <b id="best">0</b></span><span id="lives">❤️❤️❤️</span></div>
<div id="wrap">
  <canvas id="c" aria-label="${esc(title)} play area"></canvas>
  <div id="overlay">
    <h2 id="ov-title">${esc(title)}</h2>
    <p id="ov-text">${skin.verb} the ${skin.good} — dodge the ${skin.bad}. Drag or use ← → / A D to move. It gets faster the better you do.</p>
    <button id="start">Play</button>
  </div>
</div>
<div id="hint">Drag anywhere on the board, or use the arrow keys</div>
<script>
(function(){
  var BEST_KEY='${bestKey}';
  var cv=document.getElementById('c'), ctx=cv.getContext('2d');
  var scoreEl=document.getElementById('score'), bestEl=document.getElementById('best'), livesEl=document.getElementById('lives');
  var overlay=document.getElementById('overlay'), ovTitle=document.getElementById('ov-title'), ovText=document.getElementById('ov-text'), startBtn=document.getElementById('start');
  var W=0,H=0,DPR=Math.min(window.devicePixelRatio||1,2);

  function resize(){
    var r=cv.getBoundingClientRect();
    W=r.width; H=r.height;
    cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize',resize);

  var best=0; try{ best=parseInt(localStorage.getItem(BEST_KEY)||'0',10)||0; }catch(e){}
  bestEl.textContent=best;

  var state='idle', score=0, lives=3, t=0, spawnAt=0, things=[], px=0.5, targetX=0.5;

  function reset(){
    score=0; lives=3; t=0; spawnAt=0; things=[]; px=0.5; targetX=0.5;
    scoreEl.textContent='0'; livesEl.textContent='❤️❤️❤️';
  }
  function start(){ reset(); state='play'; overlay.hidden=true; last=performance.now(); }
  function gameOver(){
    state='over';
    if(score>best){ best=score; try{ localStorage.setItem(BEST_KEY,String(best)); }catch(e){} bestEl.textContent=best; }
    // Circle link — guarded so the game is fully playable standalone.
    try{ if(typeof CircleGame!=='undefined'&&CircleGame.submitScore) CircleGame.submitScore(score); }catch(e){}
    ovTitle.textContent='Game over';
    ovText.textContent='You scored '+score+'. '+(score>=best&&score>0?'A new best!':'Best is '+best+'.');
    startBtn.textContent='Play again';
    overlay.hidden=false;
  }

  // Difficulty ramps with score — never flat, never unbounded.
  // Tuned against a stepped simulation, not by eye: at 0.16/s an object took
  // ~6s to cross the board and the first catch landed 11s in, which reads as
  // broken rather than calm. 0.44 puts a fall at ~2.2s and the first catch
  // inside the first few seconds, while the caps keep it playable at high score.
  function fallSpeed(){ return 0.44+Math.min(score*0.006,0.5); }
  function spawnGap(){ return Math.max(300,780-score*12); }
  function badChance(){ return Math.min(0.22+score*0.006,0.55); }

  function spawn(){
    things.push({ x:0.09+Math.random()*0.82, y:-0.06, bad:Math.random()<badChance(), r:0.055 });
  }

  var last=performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    var dt=Math.min((now-last)/1000,0.05); last=now;   // delta-time — never frame-rate dependent
    if(state!=='play'){ draw(); return; }
    t+=dt*1000;

    px+=(targetX-px)*Math.min(dt*14,1);
    px=Math.max(0.06,Math.min(0.94,px));

    if(t>spawnAt){ spawn(); spawnAt=t+spawnGap(); }

    var py=0.88;
    for(var i=things.length-1;i>=0;i--){
      var o=things[i];
      o.y+=fallSpeed()*dt;
      var dx=(o.x-px)*W, dy=(o.y-py)*H, hit=Math.sqrt(dx*dx+dy*dy)<(o.r*W*0.5+W*0.05);
      if(hit){
        things.splice(i,1);
        if(o.bad){
          lives--; livesEl.textContent=lives>0?'❤️'.repeat(lives):'💀';
          if(lives<=0){ gameOver(); return; }
        } else {
          score++; scoreEl.textContent=score;
        }
      } else if(o.y>1.1){ things.splice(i,1); }
    }
    draw();
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    var f=Math.round(W*0.085);
    ctx.font=f+'px system-ui,"Segoe UI Emoji",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(var i=0;i<things.length;i++){
      var o=things[i];
      ctx.fillText(o.bad?'${skin.bad}':'${skin.good}', o.x*W, o.y*H);
    }
    ctx.font=Math.round(W*0.1)+'px system-ui,"Segoe UI Emoji",sans-serif';
    ctx.fillText('${skin.player}', px*W, 0.88*H);
  }
  requestAnimationFrame(frame);

  // ── input: keyboard AND pointer, both first-class ──
  var keys={};
  window.addEventListener('keydown',function(e){
    keys[e.key]=true;
    if((e.key===' '||e.key==='Enter')&&state!=='play'){ start(); }
    if(['ArrowLeft','ArrowRight',' '].indexOf(e.key)>=0) e.preventDefault();
  });
  window.addEventListener('keyup',function(e){ keys[e.key]=false; });
  setInterval(function(){
    if(state!=='play') return;
    if(keys.ArrowLeft||keys.a||keys.A) targetX-=0.045;
    if(keys.ArrowRight||keys.d||keys.D) targetX+=0.045;
    targetX=Math.max(0.06,Math.min(0.94,targetX));
  },16);

  function pointAt(e){
    var r=cv.getBoundingClientRect();
    targetX=Math.max(0.06,Math.min(0.94,(e.clientX-r.left)/r.width));
  }
  cv.addEventListener('pointerdown',function(e){ cv.setPointerCapture(e.pointerId); pointAt(e); });
  cv.addEventListener('pointermove',function(e){ if(e.pressure>0||e.buttons) pointAt(e); });
  startBtn.addEventListener('click',start);

  resize();
  draw();
})();
</script>
</body></html>`
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return h
}

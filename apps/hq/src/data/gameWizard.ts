// Self-contained copy of the wizard config, options, and game generator.
// Kept separate from apps/web to avoid cross-app dependency.

export interface WizardConfig {
  type: string
  world: string
  character: string
  style: string
  speed: string
  difficulty: string
  powerups: string[]
  title: string
}

export interface Opt {
  key: string
  label: string
  emoji: string
  note?: string
  price?: number
  rarity?: 'rare' | 'epic' | 'legendary'
}

export const GAME_TYPES: Opt[] = [
  { key: 'catch', label: 'Catch',  emoji: '🧺', note: 'Catch the good stuff, dodge the bombs.' },
  { key: 'dodge', label: 'Dodge',  emoji: '🏎️', note: 'Weave through obstacles, grab coins.' },
  { key: 'blast', label: 'Blast',  emoji: '🚀', note: 'Shoot the invaders before they land.' },
]

export const WORLDS: Opt[] = [
  { key: 'space',   label: 'Space',       emoji: '🌌' },
  { key: 'ocean',   label: 'Ocean',       emoji: '🌊' },
  { key: 'volcano', label: 'Volcano',     emoji: '🌋' },
  { key: 'ice',     label: 'Ice Kingdom', emoji: '🧊' },
  { key: 'jungle',  label: 'Jungle',      emoji: '🌿' },
  { key: 'city',    label: 'Neon City',   emoji: '🏙️' },
  { key: 'desert',  label: 'Lost Desert', emoji: '🏜️', price: 60, rarity: 'rare' },
  { key: 'candy',   label: 'Candy Land',  emoji: '🍭', price: 90, rarity: 'epic' },
  { key: 'galaxy',  label: 'Galaxy',      emoji: '🌠', price: 120, rarity: 'legendary' },
]

export const CHARACTERS: Opt[] = [
  { key: 'robot',    label: 'Robot',         emoji: '🤖' },
  { key: 'dino',     label: 'Dino',          emoji: '🦕' },
  { key: 'dragon',   label: 'Dragon',        emoji: '🐉' },
  { key: 'unicorn',  label: 'Unicorn',       emoji: '🦄' },
  { key: 'ninja',    label: 'Ninja',         emoji: '🥷' },
  { key: 'astro',    label: 'Astronaut',     emoji: '👨‍🚀' },
  { key: 'wizard',   label: 'Wizard',        emoji: '🧙' },
  { key: 'cat',      label: 'Cat',           emoji: '🐱' },
  { key: 'ghost',    label: 'Ghost',         emoji: '👻', price: 50,  rarity: 'rare' },
  { key: 'alien',    label: 'Alien',         emoji: '👽', price: 60,  rarity: 'rare' },
  { key: 'fairy',    label: 'Fairy',         emoji: '🧚', price: 70,  rarity: 'rare' },
  { key: 'trex',     label: 'T-Rex',         emoji: '🦖', price: 90,  rarity: 'epic' },
  { key: 'hero',     label: 'Super Hero',    emoji: '🦸', price: 120, rarity: 'epic' },
  { key: 'gdragon',  label: 'Golden Dragon', emoji: '🐲', price: 180, rarity: 'legendary' },
]

export const STYLES: Opt[] = [
  { key: 'classic', label: 'Classic',    emoji: '🎮' },
  { key: 'neon',    label: 'Neon',       emoji: '⚡' },
  { key: 'kawaii',  label: 'Kawaii',     emoji: '🌸' },
  { key: 'retro',   label: 'Retro 8-bit', emoji: '👾' },
]

export const SPEEDS: Opt[] = [
  { key: 'slow',   label: 'Slow',   emoji: '🐢' },
  { key: 'normal', label: 'Normal', emoji: '🐕' },
  { key: 'fast',   label: 'Fast',   emoji: '🐆' },
  { key: 'turbo',  label: 'Turbo',  emoji: '🚀' },
]

export const DIFFICULTIES: Opt[] = [
  { key: 'easy',   label: 'Easy',   emoji: '⭐' },
  { key: 'medium', label: 'Medium', emoji: '⭐⭐' },
  { key: 'hard',   label: 'Hard',   emoji: '⭐⭐⭐' },
]

export const POWERUPS: Opt[] = [
  { key: 'shield', label: 'Shield',       emoji: '🛡️', note: 'Invincible for a few seconds.' },
  { key: 'magnet', label: 'Magnet',       emoji: '🧲', note: 'Pulls good items toward you.' },
  { key: 'double', label: 'Double Score', emoji: '⭐', note: 'Points count twice for a while.' },
  { key: 'life',   label: 'Extra Life',   emoji: '❤️', note: 'Find one to win back a heart.' },
]

export const WORLD_GRADS: Record<string, string> = {
  space:   'linear-gradient(135deg,#0a0e27,#1a1147)',
  ocean:   'linear-gradient(135deg,#012a4a,#01497c)',
  volcano: 'linear-gradient(135deg,#2b0a0a,#6a1212)',
  ice:     'linear-gradient(135deg,#0a2a3a,#16526b)',
  jungle:  'linear-gradient(135deg,#0c2a12,#1a4d24)',
  city:    'linear-gradient(135deg,#0a0a1a,#241047)',
  desert:  'linear-gradient(135deg,#2a1a05,#5a3a12)',
  candy:   'linear-gradient(135deg,#3a0a2a,#6a1247)',
  galaxy:  'linear-gradient(135deg,#05031a,#1a0a47)',
}

export function defaultConfig(): WizardConfig {
  return { type: '', world: '', character: '', style: 'classic', speed: 'normal', difficulty: 'easy', powerups: [], title: '' }
}

export function suggestTitle(c: WizardConfig): string {
  const style = STYLES.find(s => s.key === c.style)?.label ?? ''
  const char  = CHARACTERS.find(s => s.key === c.character)?.label ?? ''
  const type  = GAME_TYPES.find(s => s.key === c.type)?.label ?? 'Game'
  return [style !== 'Classic' ? style : '', char, type].filter(Boolean).join(' ').trim() || 'My Game'
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

export function generateGame(cfg: WizardConfig): string {
  const json = JSON.stringify(cfg)
  return HTML.replace('__CFG__', json).replace('__TITLE__', escapeHtml(cfg.title || 'My Game'))
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="generator" content="ArgantaLab Game Wizard">
<title>__TITLE__</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
  html,body{height:100%;overflow:hidden;background:#05070f;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;touch-action:none}
  #c{position:fixed;inset:0;width:100%;height:100%;display:block}
  .ov{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    text-align:center;color:#fff;z-index:10;padding:24px;background:rgba(5,7,15,.55);backdrop-filter:blur(6px)}
  .ov[hidden]{display:none}
  .ov h1{font-size:clamp(28px,8vw,52px);font-weight:900;letter-spacing:-.02em;text-shadow:0 4px 30px rgba(0,0,0,.6)}
  .ov p{font-size:15px;color:rgba(255,255,255,.82);max-width:340px;line-height:1.5}
  .ov .big{font-size:clamp(40px,12vw,80px)}
  .btn{margin-top:6px;padding:15px 34px;border:none;border-radius:18px;font-size:17px;font-weight:800;color:#fff;cursor:pointer;
    background:var(--ac,#4D9FFF);box-shadow:0 12px 34px rgba(0,0,0,.4);transition:transform .15s}
  .btn:active{transform:scale(.94)}
  #hud{position:fixed;top:0;left:0;right:0;z-index:8;display:flex;align-items:center;gap:12px;padding:14px 16px;
    color:#fff;font-weight:800;font-size:16px;pointer-events:none;text-shadow:0 2px 10px rgba(0,0,0,.6)}
  #hud .sp{flex:1}
  #bar{position:fixed;top:52px;left:16px;right:16px;height:5px;border-radius:6px;background:rgba(255,255,255,.16);z-index:8;overflow:hidden;opacity:0;transition:opacity .3s}
  #bar i{display:block;height:100%;width:100%;background:#FFC24B;border-radius:6px;transform-origin:left}
  #pad{position:fixed;bottom:0;left:0;right:0;z-index:8;display:flex;justify-content:space-between;padding:20px;pointer-events:none}
  .pb{pointer-events:auto;width:74px;height:74px;border-radius:50%;background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.3);
    color:#fff;font-size:30px;display:grid;place-items:center;backdrop-filter:blur(6px)}
  .pb:active{background:rgba(255,255,255,.28)}
  @media(hover:hover){#pad{display:none}}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="hud"><span id="score">0</span><span class="sp"></span><span id="hearts"></span></div>
<div id="bar"><i id="barfill"></i></div>
<div id="pad"><button class="pb" id="bl">◀</button><button class="pb" id="br">▶</button></div>
<div id="start" class="ov"><h1 id="title">Game</h1><p id="howto"></p><button class="btn" id="play">Tap to Play ▶</button></div>
<div id="over" class="ov" hidden><div class="big" id="oemoji">🏆</div><h1 id="otitle">You Win!</h1><p id="oscore"></p><button class="btn" id="again">Play Again ↻</button></div>
<script>
var CFG = __CFG__;

var WORLDS = {
  space:   { bg:['#0a0e27','#1a1147'], good:['⭐','💎','🛸','🪐'], bad:'☄️', ac:'#4D9FFF', amb:'stars' },
  ocean:   { bg:['#012a4a','#01497c'], good:['🐠','🐟','🦀','🐚'], bad:'🦈', ac:'#34E5FF', amb:'bubbles' },
  volcano: { bg:['#2b0a0a','#6a1212'], good:['💎','🔥','🪙','💰'], bad:'🪨', ac:'#FF7A2F', amb:'embers' },
  ice:     { bg:['#0a2a3a','#16526b'], good:['❄️','💎','⛄','🧊'], bad:'🪨', ac:'#9fe8ff', amb:'snow' },
  jungle:  { bg:['#0c2a12','#1a4d24'], good:['🍌','🥭','🍃','🥥'], bad:'🐍', ac:'#3DE08A', amb:'leaves' },
  city:    { bg:['#0a0a1a','#241047'], good:['💠','🪙','⚡','💿'], bad:'🤖', ac:'#FF5EA0', amb:'grid' },
  candy:   { bg:['#3a0a2a','#6a1247'], good:['🍭','🍬','🧁','🍰'], bad:'🦷', ac:'#FF5EA0', amb:'bubbles' },
  galaxy:  { bg:['#05031a','#1a0a47'], good:['🌟','💫','🌠','🪐'], bad:'👾', ac:'#A855F7', amb:'stars' },
  desert:  { bg:['#2a1a05','#5a3a12'], good:['🌵','🪙','💎','🏺'], bad:'🦂', ac:'#FFC24B', amb:'embers' }
};
var CHARS = { robot:'🤖', dino:'🦕', dragon:'🐉', unicorn:'🦄', ninja:'🥷', astro:'👨‍🚀', wizard:'🧙', cat:'🐱',
  hero:'🦸', alien:'👽', ghost:'👻', gdragon:'🐲', trex:'🦖', fairy:'🧚' };
var SPEED = { slow:0.7, normal:1, fast:1.4, turbo:1.9 };
var DIFF = { easy:{lives:5,target:200,spawn:1}, medium:{lives:3,target:350,spawn:1.3}, hard:{lives:3,target:520,spawn:1.7} };
var PU = { shield:'🛡️', magnet:'🧲', double:'⭐', life:'❤️' };

var W = WORLDS[CFG.world] || WORLDS.space;
var HERO = CHARS[CFG.character] || '🤖';
var SP = SPEED[CFG.speed] || 1;
var D = DIFF[CFG.difficulty] || DIFF.easy;
var STYLE = CFG.style || 'classic';
var NEON = STYLE === 'neon', RETRO = STYLE === 'retro', KAWAII = STYLE === 'kawaii';

document.documentElement.style.setProperty('--ac', W.ac);

var DEV = window.ARGANTA_DEVICE || (('ontouchstart' in window) ? 'iphone' : 'desktop');

var cv = document.getElementById('c'), ctx = cv.getContext('2d');
var DPR = Math.min(window.devicePixelRatio || 1, 2), w = 0, h = 0;
function resize(){ w = cv.clientWidth; h = cv.clientHeight; cv.width = w*DPR; cv.height = h*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }
window.addEventListener('resize', resize); resize();

var state = 'start', score = 0, lives = D.lives, items = [], bullets = [], parts = [], amb = [];
var player = { x: w/2, y: 0, tx: w/2, size: 46 };
var pu = { shield:0, magnet:0, double:0 }, spawnT = 0, shootT = 0, t = 0, shake = 0;
var keys = {};

for (var i=0;i<46;i++) amb.push({ x:Math.random()*w, y:Math.random()*h, s:0.3+Math.random()*1.2, r:1+Math.random()*2 });

function reset(){ score=0; lives=D.lives; items=[]; bullets=[]; parts=[]; pu={shield:0,magnet:0,double:0}; player.x=w/2; player.tx=w/2; player.y=h-90; spawnT=0; shootT=0; }

function start(){ reset(); state='play'; document.getElementById('start').hidden=true; document.getElementById('over').hidden=true; document.getElementById('bar').style.opacity='0'; }
function gameOver(win){ state='over'; var o=document.getElementById('over');
  document.getElementById('oemoji').textContent = win?'🏆':'💔';
  document.getElementById('otitle').textContent = win?'You Win!':'Game Over';
  document.getElementById('oscore').textContent = 'Score: '+score;
  o.hidden=false; }

function drawEmoji(e,x,y,size){ ctx.font = size+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(e,x,y); }

function spawn(){
  var r = Math.random();
  var puKeys = CFG.powerups || [];
  if (puKeys.length && r < 0.06){ var k = puKeys[(Math.random()*puKeys.length)|0]; items.push({ x:30+Math.random()*(w-60), y:-30, vy:(1.3+Math.random()*0.6)*SP*60, e:PU[k], kind:'pu', pk:k, size:34 }); return; }
  if (CFG.type === 'blast'){ items.push({ x:30+Math.random()*(w-60), y:-30, vy:(1.1+Math.random()*0.7)*SP*60, e:W.bad, kind:'enemy', size:36 }); return; }
  if (r < 0.78){ var g = W.good[(Math.random()*W.good.length)|0]; items.push({ x:30+Math.random()*(w-60), y:-30, vy:(1.4+Math.random()*0.9)*SP*60, e:g, kind:'good', size:32 }); }
  else { items.push({ x:30+Math.random()*(w-60), y:-30, vy:(1.6+Math.random()*1)*SP*60, e:W.bad, kind:'bad', size:34 }); }
}

function burst(x,y,col){ for(var i=0;i<8;i++){ var a=Math.random()*6.28; parts.push({ x:x,y:y,vx:Math.cos(a)*120,vy:Math.sin(a)*120,life:0.5,col:col }); } }

function hit(a,b,pad){ return Math.abs(a.x-b.x) < (a.size/2+b.size/2-(pad||6)) && Math.abs(a.y-b.y) < (a.size/2+b.size/2-(pad||6)); }

var last = 0;
function loop(ts){
  requestAnimationFrame(loop);
  var dt = Math.min(0.05,(ts-last)/1000)||0; last=ts; t+=dt;

  var g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,W.bg[0]); g.addColorStop(1,W.bg[1]);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,255,255,'+(W.amb==='grid'?0.05:0.5)+')';
  for(var i=0;i<amb.length;i++){ var p=amb[i]; p.y+=p.s*30*dt; if(p.y>h){p.y=-4;p.x=Math.random()*w;}
    ctx.globalAlpha = W.amb==='stars'?(0.3+0.5*Math.sin(t*2+i)):0.4;
    if(W.amb==='leaves'||W.amb==='bubbles'){ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill(); }
    else ctx.fillRect(p.x,p.y,p.r,p.r);
  }
  ctx.globalAlpha=1;

  var sx=0, sy=0; if(shake>0){ shake-=dt; sx=(Math.random()-0.5)*10; sy=(Math.random()-0.5)*10; }
  ctx.save(); ctx.translate(sx,sy);

  if(NEON){ ctx.shadowColor=W.ac; ctx.shadowBlur=18; }

  if(state==='play'){
    if(keys.l) player.tx-=520*dt; if(keys.r) player.tx+=520*dt;
    player.tx=Math.max(26,Math.min(w-26,player.tx));
    player.x += (player.tx-player.x)*Math.min(1,dt*14);
    player.y = h-90;

    spawnT-=dt; var rate=0.85/(SP*D.spawn);
    if(spawnT<=0){ spawn(); spawnT=rate*(0.6+Math.random()*0.8); }

    if(CFG.type==='blast'){ shootT-=dt; if(shootT<=0){ bullets.push({x:player.x,y:player.y-26,vy:-560}); shootT=0.32; } }

    if(pu.shield>0)pu.shield-=dt; if(pu.magnet>0)pu.magnet-=dt; if(pu.double>0)pu.double-=dt;
    var act = pu.shield>0?'shield':pu.magnet>0?'magnet':pu.double>0?'double':null;
    var bar=document.getElementById('bar');
    if(act){ bar.style.opacity='1'; document.getElementById('barfill').style.transform='scaleX('+Math.max(0,pu[act]/6)+')'; }
    else bar.style.opacity='0';

    for(var i=items.length-1;i>=0;i--){ var it=items[i];
      if(pu.magnet>0 && (it.kind==='good'||it.kind==='pu')){ it.x += (player.x-it.x)*Math.min(1,dt*3); }
      it.y += it.vy*dt;
      if(it.y>h+40){ if(CFG.type==='blast'&&it.kind==='enemy' && pu.shield<=0){ lives--; shake=0.3; if(lives<=0){gameOver(false);} } items.splice(i,1); continue; }
      if(hit(it,player,8)){
        if(it.kind==='good'){ score+=10*(pu.double>0?2:1); burst(it.x,it.y,'#3DE08A'); items.splice(i,1); }
        else if(it.kind==='pu'){ if(it.pk==='life'){lives++;} else {pu[it.pk]=6;} burst(it.x,it.y,W.ac); items.splice(i,1); }
        else if(it.kind==='bad'||it.kind==='enemy'){ if(pu.shield>0){ burst(it.x,it.y,'#FFC24B'); items.splice(i,1); } else { lives--; shake=0.35; burst(it.x,it.y,'#FF5D5D'); items.splice(i,1); if(lives<=0)gameOver(false); } }
        continue;
      }
      drawEmoji(it.e,it.x,it.y,it.size);
    }

    for(var i=bullets.length-1;i>=0;i--){ var b=bullets[i]; b.y+=b.vy*dt;
      if(b.y<-20){ bullets.splice(i,1); continue; }
      var bhit=false;
      for(var j=items.length-1;j>=0;j--){ var e=items[j]; if(e.kind==='enemy' && Math.abs(e.x-b.x)<22 && Math.abs(e.y-b.y)<22){ score+=10*(pu.double>0?2:1); burst(e.x,e.y,W.ac); items.splice(j,1); bhit=true; break; } }
      if(bhit){ bullets.splice(i,1); continue; }
      ctx.save(); ctx.shadowColor=W.ac; ctx.shadowBlur=12; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(b.x,b.y,4,0,6.28); ctx.fill(); ctx.restore();
    }

    if(score>=D.target) gameOver(true);
  }

  for(var i=parts.length-1;i>=0;i--){ var p=parts[i]; p.life-=dt; if(p.life<=0){parts.splice(i,1);continue;} p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;
    ctx.globalAlpha=Math.max(0,p.life*2); ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,6.28); ctx.fill(); ctx.globalAlpha=1; }

  if(state!=='start'){
    if(pu.shield>0){ ctx.save(); ctx.globalAlpha=0.35+0.25*Math.sin(t*10); ctx.fillStyle=W.ac; ctx.beginPath(); ctx.arc(player.x,player.y,40,0,6.28); ctx.fill(); ctx.restore(); }
    drawEmoji(HERO,player.x,player.y,player.size);
  }

  ctx.shadowBlur=0; ctx.restore();

  document.getElementById('score').textContent = '⭐ '+score+' / '+D.target;
  var hs=''; for(var i=0;i<lives;i++)hs+='❤️'; document.getElementById('hearts').textContent=hs;

  if(RETRO){ ctx.globalAlpha=0.06; ctx.fillStyle='#000'; for(var y=0;y<h;y+=3)ctx.fillRect(0,y,w,1); ctx.globalAlpha=1; }
}
requestAnimationFrame(loop);

window.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'||e.key==='a')keys.l=1; if(e.key==='ArrowRight'||e.key==='d')keys.r=1; if((e.key===' '||e.key==='Enter')&&state!=='play'){ start(); } });
window.addEventListener('keyup',function(e){ if(e.key==='ArrowLeft'||e.key==='a')keys.l=0; if(e.key==='ArrowRight'||e.key==='d')keys.r=0; });
cv.addEventListener('pointermove',function(e){ if(state==='play'){ var rect=cv.getBoundingClientRect(); player.tx=e.clientX-rect.left; } });
cv.addEventListener('pointerdown',function(e){ if(state==='play'){ var rect=cv.getBoundingClientRect(); player.tx=e.clientX-rect.left; } });
function hold(id,side){ var el=document.getElementById(id); var on=function(e){e.preventDefault();keys[side]=1;}, off=function(){keys[side]=0;};
  el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off); el.addEventListener('pointerleave',off); el.addEventListener('pointercancel',off); }
hold('bl','l'); hold('br','r');
document.getElementById('pad').style.display = (DEV === 'desktop') ? 'none' : 'flex';
document.getElementById('play').addEventListener('click',start);
document.getElementById('again').addEventListener('click',start);

document.getElementById('title').textContent = CFG.title || 'My Game';
var how = CFG.type==='blast' ? 'Move to aim — you shoot automatically! Blast the invaders.'
        : CFG.type==='dodge' ? 'Move left and right. Grab the good things, dodge the bad ones!'
        : 'Move left and right to catch the good things. Avoid the bad ones!';
document.getElementById('howto').textContent = how + ' Reach ' + DIFF[CFG.difficulty||'easy'].target + ' points to win!';
</script>
</body>
</html>`

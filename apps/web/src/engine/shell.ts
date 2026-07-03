// ============================================================
//  SHELL — the DOM chrome around every generated game.
//  Title screen, HUD (score/pause/mute), pause menu with save
//  slots, game-over screen with leaderboard tabs. Genres never
//  touch the DOM; they draw to canvas and the shell frames them.
// ============================================================

import type { GameSpec, SaveSlot, ScoreRow } from './types'
import { G, type GenreGame } from './core'

const CSS = `
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { width:100%; height:100%; overflow:hidden; background:#05060f; font-family:'Segoe UI',system-ui,sans-serif; }
  #stage { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }
  canvas { max-width:100vw; max-height:100vh; display:block; touch-action:none; }
  #hud { position:fixed; top:0; left:0; right:0; display:flex; align-items:center; justify-content:space-between;
         padding:10px 14px; pointer-events:none; z-index:5; }
  #hud b { color:#fff; font-size:18px; text-shadow:0 2px 8px rgba(0,0,0,.6); letter-spacing:.5px; }
  .hbtns { display:flex; gap:8px; pointer-events:auto; }
  .hbtn { width:38px; height:38px; border-radius:12px; border:1px solid rgba(255,255,255,.2);
          background:rgba(10,12,30,.65); color:#fff; font-size:17px; cursor:pointer; backdrop-filter:blur(6px); }
  .ovl { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:10;
         background:rgba(5,6,15,.78); backdrop-filter:blur(8px); }
  .card { width:min(92vw,420px); max-height:92vh; overflow:auto; border-radius:22px; padding:26px 22px; text-align:center;
          background:linear-gradient(160deg,rgba(30,34,70,.95),rgba(12,14,34,.97)); border:1px solid rgba(255,255,255,.14);
          box-shadow:0 24px 80px rgba(0,0,0,.5); color:#eef; }
  .card h1 { font-size:26px; margin-bottom:4px; }
  .card .sub { opacity:.65; font-size:13px; margin-bottom:14px; }
  .tagchip { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase;
             background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.15); border-radius:99px;
             padding:4px 12px; margin-bottom:12px; opacity:.85; }
  .bigbtn { display:block; width:100%; margin-top:10px; padding:14px; border-radius:14px; border:0; cursor:pointer;
            font-size:16px; font-weight:800; color:#fff; background:linear-gradient(135deg,#6366f1,#8b5cf6);
            box-shadow:0 8px 24px rgba(99,102,241,.4); }
  .bigbtn.soft { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16); box-shadow:none; }
  .bigbtn:active { transform:scale(.97); }
  .scorebig { font-size:44px; font-weight:900; margin:8px 0 2px;
              background:linear-gradient(135deg,#fbbf24,#f97316); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .lb { margin-top:14px; text-align:left; }
  .lbtabs { display:flex; gap:6px; margin-bottom:8px; }
  .lbtab { flex:1; padding:8px; font-size:12px; font-weight:700; border-radius:10px; border:1px solid rgba(255,255,255,.14);
           background:transparent; color:#cdd3ff; cursor:pointer; }
  .lbtab.on { background:rgba(99,102,241,.3); border-color:#818cf8; color:#fff; }
  .lbrow { display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:10px; font-size:14px; }
  .lbrow.me { background:rgba(251,191,36,.14); border:1px solid rgba(251,191,36,.35); }
  .lbrow .rk { width:22px; font-weight:900; opacity:.6; }
  .lbrow .nm { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .lbrow .sc { font-weight:800; }
  .slots { margin-top:12px; display:grid; gap:8px; }
  .slot { display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:12px; text-align:left;
          background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); color:#eef; cursor:pointer; font-size:13px; }
  .slot b { display:block; font-size:14px; }
  .slot span { opacity:.6; font-size:11px; }
  .slot .ic { font-size:20px; }
  #toast { position:fixed; bottom:18px; left:50%; transform:translateX(-50%) translateY(80px); transition:transform .25s;
           background:rgba(15,18,40,.92); border:1px solid rgba(255,255,255,.18); color:#fff; padding:10px 18px;
           border-radius:99px; font-size:14px; font-weight:600; z-index:20; }
  #toast.show { transform:translateX(-50%) translateY(0); }
  .hint { margin-top:12px; font-size:12px; opacity:.55; }
  .powered { margin-top:14px; font-size:10px; letter-spacing:1px; text-transform:uppercase; opacity:.35; }
`

export interface ShellMeta { genreName: string; analog: string; hint: string; emoji: string }

export function runShell(spec: GameSpec, gameId: string, meta: ShellMeta, make: (g: G) => GenreGame) {
  document.title = spec.title
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style)
  document.body.innerHTML = `
    <div id="stage"><canvas id="cv"></canvas></div>
    <div id="hud" style="display:none">
      <b id="score">0</b>
      <div class="hbtns">
        <button class="hbtn" id="mute">🔊</button>
        <button class="hbtn" id="pause">⏸️</button>
      </div>
    </div>
    <div id="ovl"></div>
    <div id="toast"></div>`

  const g = new G(spec, gameId)
  const game = make(g)
  g.attach(document.getElementById('cv') as HTMLCanvasElement, game.w, game.h)

  const hud = document.getElementById('hud')!
  const scoreEl = document.getElementById('score')!
  const ovl = document.getElementById('ovl')!
  const toastEl = document.getElementById('toast')!
  let toastTimer = 0

  g.onScore = s => { scoreEl.textContent = String(s) }
  g.onToast = t => {
    toastEl.textContent = t; toastEl.classList.add('show')
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1800)
  }
  g.onGameOver = (score, win, stats) => showGameOver(score, win, stats)

  document.getElementById('mute')!.onclick = e => {
    g.sfx.muted = !g.sfx.muted
    ;(e.currentTarget as HTMLElement).textContent = g.sfx.muted ? '🔇' : '🔊'
  }
  document.getElementById('pause')!.onclick = () => { if (g.state === 'play') showPause() }

  const canSave = !!game.serialize && spec.services.cloudSave

  // ── overlays ──
  function card(html: string): HTMLElement {
    ovl.innerHTML = `<div class="ovl"><div class="card">${html}</div></div>`
    return ovl.querySelector('.card') as HTMLElement
  }
  function closeOvl() { ovl.innerHTML = '' }

  function slotRows(slots: SaveSlot[], mode: 'save' | 'load'): string {
    return `<div class="slots">${[1, 2, 3].map(n => {
      const s = slots.find(x => x.slot === n)
      return `<button class="slot" data-slot="${n}" data-has="${s ? 1 : 0}">
        <span class="ic">${s ? '💾' : '▫️'}</span>
        <div style="flex:1"><b>Slot ${n}${s ? '' : ' — empty'}</b>
        ${s ? `<b style="font-weight:600">${s.label}</b><span>${new Date(s.savedAt).toLocaleString()}</span>` : `<span>${mode === 'save' ? 'Tap to save here' : 'Nothing saved yet'}</span>`}</div>
      </button>`
    }).join('')}</div>`
  }

  async function showTitle() {
    g.state = 'title'; hud.style.display = 'none'
    let continueBtn = ''
    let slots: SaveSlot[] = []
    if (canSave) {
      slots = await g.bridge.load()
      if (slots.length) continueBtn = `<button class="bigbtn" id="continue">▶️ Continue</button>`
    }
    const c = card(`
      <div class="tagchip">${meta.emoji} ${meta.genreName} · inspired by ${meta.analog}</div>
      <h1>${spec.title}</h1>
      <div class="sub">by ${spec.hero.name}${spec.sidekick ? ` · with ${spec.sidekick.name} ${spec.sidekick.emoji}` : ''}</div>
      ${continueBtn}
      <button class="bigbtn${continueBtn ? ' soft' : ''}" id="play">${continueBtn ? '🌱 New Game' : '▶️ Play'}</button>
      <div class="hint">${meta.hint}</div>
      <div class="powered">Built in Arganta Studio</div>`)
    c.querySelector<HTMLElement>('#play')!.onclick = () => { closeOvl(); startPlay() }
    c.querySelector<HTMLElement>('#continue')?.addEventListener('click', () => {
      const latest = [...slots].sort((a, b) => b.savedAt - a.savedAt)[0]
      if (latest && game.restore) game.restore(latest.data)
      closeOvl(); startPlay()
    })
  }

  function startPlay() { g.state = 'play'; hud.style.display = 'flex'; g.sfx.coin() }

  async function showPause() {
    g.state = 'pause'
    const slots = canSave ? await g.bridge.load() : []
    const c = card(`
      <h1>Paused</h1>
      <button class="bigbtn" id="resume">▶️ Resume</button>
      ${canSave ? `<div class="sub" style="margin-top:14px">Save files</div>${slotRows(slots, 'save')}` : ''}
      <button class="bigbtn soft" id="restart">🔄 Restart</button>
      <button class="bigbtn soft" id="quit">🚪 Exit game</button>`)
    c.querySelector<HTMLElement>('#resume')!.onclick = () => { closeOvl(); g.state = 'play' }
    c.querySelector<HTMLElement>('#restart')!.onclick = () => location.reload()
    c.querySelector<HTMLElement>('#quit')!.onclick = () => { g.bridge.quit(); location.reload() }
    if (canSave) c.querySelectorAll<HTMLElement>('.slot').forEach(el => {
      el.onclick = async () => {
        const slot = Number(el.dataset.slot)
        await g.bridge.save(slot, game.serialize!(), `${meta.genreName} — score ${g.score}`)
        g.toast(`Saved to slot ${slot} 💾`); g.sfx.coin(); showPause()
      }
    })
  }

  async function showGameOver(score: number, win: boolean, stats?: Record<string, string | number>) {
    hud.style.display = 'none'
    if (spec.services.db) await g.bridge.submitScore(score)
    let lb: { best: ScoreRow[]; circle: ScoreRow[] } = { best: [], circle: [] }
    if (spec.services.leaderboard) lb = await g.bridge.leaderboard()
    const statHtml = stats
      ? `<div class="sub">${Object.entries(stats).map(([k, v]) => `${k}: <b>${v}</b>`).join(' · ')}</div>` : ''
    const lbHtml = spec.services.leaderboard ? `
      <div class="lb">
        <div class="lbtabs">
          <button class="lbtab on" data-tab="circle">👨‍👩‍👧 My Circle</button>
          <button class="lbtab" data-tab="best">⭐ My Best</button>
        </div>
        <div id="lbrows"></div>
      </div>` : ''
    const c = card(`
      <div class="tagchip">${win ? '🏆 VICTORY' : 'GAME OVER'}</div>
      <h1>${spec.title}</h1>
      <div class="scorebig">${score}</div>
      <div class="sub">${spec.services.login ? spec.hero.name : 'Anonymous'}${win ? ' — you win!' : ''}</div>
      ${statHtml}${lbHtml}
      <button class="bigbtn" id="again">🔄 Play again</button>
      <button class="bigbtn soft" id="quit">🚪 Exit game</button>`)
    c.querySelector<HTMLElement>('#again')!.onclick = () => location.reload()
    c.querySelector<HTMLElement>('#quit')!.onclick = () => { g.bridge.quit(); location.reload() }
    const rowsEl = c.querySelector<HTMLElement>('#lbrows')
    const render = (rows: ScoreRow[]) => {
      if (!rowsEl) return
      rowsEl.innerHTML = rows.length
        ? rows.slice(0, 8).map((r, i) => `<div class="lbrow${r.me ? ' me' : ''}">
            <span class="rk">${['🥇', '🥈', '🥉'][i] ?? i + 1}</span><span class="nm">${r.name}</span><span class="sc">${r.score}</span></div>`).join('')
        : `<div class="lbrow"><span class="nm" style="opacity:.5">No scores yet — you're first!</span></div>`
    }
    render(lb.circle)
    c.querySelectorAll<HTMLElement>('.lbtab').forEach(t => {
      t.onclick = () => {
        c.querySelectorAll('.lbtab').forEach(x => x.classList.remove('on')); t.classList.add('on')
        render(t.dataset.tab === 'best' ? lb.best : lb.circle)
      }
    })
  }

  // ── loop ──
  let last = performance.now()
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    const c = g.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, g.w, g.h)
    c.save()
    g.applyShake()
    if (g.state === 'play') { game.update(dt); g.updateFx(dt) }
    game.draw()
    g.drawFx()
    c.restore()
    g.endFrame()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  showTitle()
}

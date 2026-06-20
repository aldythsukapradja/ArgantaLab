import { useRef, useEffect } from 'react'
import { useAppStore } from '@store/appStore'

/* ── canvas game engines ── */
function runTetris(canvas: HTMLCanvasElement, onScore: (s: number) => void) {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width = canvas.offsetWidth || 360
  const H = canvas.height = canvas.offsetHeight || 520
  const COLS = 10, ROWS = 20
  const BS = Math.floor(Math.min(W / COLS, H / ROWS))
  const OX = Math.floor((W - BS * COLS) / 2)
  const OY = H - BS * ROWS

  const PIECES = [
    [[1,1,1,1]],[[1,1],[1,1]],[[0,1,1],[1,1,0]],
    [[1,1,0],[0,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,0],[1,1,1]],
  ]
  const COLORS = ['#34E5FF','#FFC24B','#3DE08A','#FF5EA0','#4D9FFF','#FF7A00','#8B5CF6']

  const board: number[][] = Array.from({length: ROWS}, () => Array(COLS).fill(0))
  let piece: number[][] = [], px = 0, py = 0, pi = 0, score = 0, running = true
  let raf = 0, lastDrop = 0, dropInterval = 600

  const spawn = () => {
    pi = Math.floor(Math.random() * PIECES.length)
    piece = PIECES[pi].map(r => [...r])
    px = Math.floor((COLS - piece[0].length) / 2)
    py = 0
    if (!fits(piece, px, py)) running = false
  }

  const fits = (p: number[][], x: number, y: number) =>
    p.every((row, r) => row.every((v, c) => !v || (x+c>=0 && x+c<COLS && y+r<ROWS && !board[y+r]?.[x+c])))

  const place = () => {
    piece.forEach((row, r) => row.forEach((v, c) => { if (v) board[py+r][px+c] = pi+1 }))
    let cleared = 0
    for (let r = ROWS - 1; r >= 0; r--) {
      while (board[r].every(Boolean)) { board.splice(r, 1); board.unshift(Array(COLS).fill(0)); cleared++ }
    }
    if (cleared) { score += [0,100,300,500,800][cleared]; onScore(score) }
    spawn()
  }

  const rotate = (p: number[][]) => p[0].map((_, i) => p.map(r => r[i]).reverse())

  const draw = (ts: number) => {
    if (!running) { ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.font='bold 28px sans-serif'; ctx.textAlign='center'; ctx.fillText('GAME OVER',W/2,H/2-20); ctx.font='18px sans-serif'; ctx.fillText(`Score: ${score}`,W/2,H/2+16); return }
    if (ts - lastDrop > dropInterval) { if (fits(piece, px, py+1)) py++; else place(); lastDrop = ts }
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0a0f1a'
    ctx.fillRect(0, 0, W, H)
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.06)'
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) { ctx.strokeRect(OX+c*BS,OY+r*BS,BS,BS) }
    // board
    board.forEach((row, r) => row.forEach((v, c) => { if (v) { ctx.fillStyle=COLORS[v-1]; ctx.fillRect(OX+c*BS+1,OY+r*BS+1,BS-2,BS-2) } }))
    // piece
    piece.forEach((row, r) => row.forEach((v, c) => { if (v) { ctx.fillStyle=COLORS[pi]; ctx.fillRect(OX+(px+c)*BS+1,OY+(py+r)*BS+1,BS-2,BS-2) } }))
    // score
    ctx.fillStyle = '#9AA6C4'; ctx.font = `bold ${Math.floor(BS*0.55)}px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(`Score: ${score}`, 6, 20)
    raf = requestAnimationFrame(draw)
  }

  spawn()
  raf = requestAnimationFrame(draw)

  const keys = (e: KeyboardEvent) => {
    if (e.key==='ArrowLeft'&&fits(piece,px-1,py)) px--
    if (e.key==='ArrowRight'&&fits(piece,px+1,py)) px++
    if (e.key==='ArrowDown'&&fits(piece,px,py+1)) py++
    if (e.key==='ArrowUp') { const r=rotate(piece); if (fits(r,px,py)) piece=r }
    if (e.key===' ') { while (fits(piece,px,py+1)) py++; place() }
  }
  window.addEventListener('keydown', keys)
  return () => { running=false; cancelAnimationFrame(raf); window.removeEventListener('keydown', keys) }
}

function runInvaders(canvas: HTMLCanvasElement, onScore: (s: number) => void) {
  const W = canvas.width = canvas.offsetWidth || 360
  const H = canvas.height = canvas.offsetHeight || 520
  const ctx = canvas.getContext('2d')!

  type Alien = { x: number; y: number; alive: boolean }
  type Bullet = { x: number; y: number; dy: number }

  let player = { x: W/2, w: 40, h: 12 }
  let aliens: Alien[] = []
  let bullets: Bullet[] = []
  let alienDir = 1, score = 0, lives = 3, level = 1, running = true, raf = 0

  const spawnAliens = () => {
    aliens = []
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) aliens.push({ x: 46 + c * 36, y: 50 + r * 34, alive: true })
  }

  spawnAliens()

  const shoot = () => bullets.push({ x: player.x, y: H - 36, dy: -7 })
  const alienShoot = () => {
    const live = aliens.filter(a => a.alive)
    if (!live.length) return
    const a = live[Math.floor(Math.random() * live.length)]
    bullets.push({ x: a.x, y: a.y + 10, dy: 4 + level })
  }

  let lastFrame = 0, alienTick = 0, shootTick = 0

  const draw = (ts: number) => {
    const dt = ts - lastFrame; lastFrame = ts
    if (!running) { ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.font='bold 28px sans-serif'; ctx.textAlign='center'; ctx.fillText('GAME OVER',W/2,H/2-20); ctx.fillText(`Score: ${score}`,W/2,H/2+16); return }

    // move aliens
    alienTick += dt
    if (alienTick > 900 - level*80) {
      alienTick = 0
      const live = aliens.filter(a => a.alive)
      const maxX = Math.max(...live.map(a => a.x))
      const minX = Math.min(...live.map(a => a.x))
      if ((alienDir>0&&maxX>W-30)||(alienDir<0&&minX<30)) { alienDir*=-1; aliens.forEach(a => a.y+=16) }
      aliens.forEach(a => { if (a.alive) a.x += 18*alienDir })
    }

    // alien shoot
    shootTick += dt
    if (shootTick > 1400 - level*100) { shootTick=0; alienShoot() }

    // bullets
    bullets.forEach(b => b.y += b.dy)
    bullets = bullets.filter(b => b.y > 0 && b.y < H)

    // collisions player bullets
    bullets.forEach(b => {
      if (b.dy >= 0) return
      aliens.forEach(a => { if (a.alive && Math.abs(b.x-a.x)<16 && Math.abs(b.y-a.y)<14) { a.alive=false; b.y=-999; score+=10*(level); onScore(score) } })
    })

    // alien bullets hit player
    bullets.forEach(b => {
      if (b.dy <= 0) return
      if (Math.abs(b.x - player.x) < 22 && b.y > H - 50) { b.y=-999; lives--; if (lives<=0) running=false }
    })

    // aliens reach bottom
    if (aliens.some(a => a.alive && a.y > H - 60)) running = false

    // level up
    if (aliens.every(a => !a.alive)) { level++; spawnAliens() }

    // draw
    ctx.clearRect(0,0,W,H)
    ctx.fillStyle='#050916'; ctx.fillRect(0,0,W,H)
    // stars
    ctx.fillStyle='rgba(255,255,255,.5)'
    for (let s=0;s<30;s++) { const sx=(s*W/30)%W, sy=(s*H/29)%H; ctx.fillRect(sx,sy,1,1) }
    // aliens
    ctx.fillStyle='#4D9FFF'
    aliens.filter(a=>a.alive).forEach(a => {
      ctx.fillRect(a.x-12,a.y-8,24,16)
      ctx.fillStyle='#8B5CF6'; ctx.fillRect(a.x-6,a.y-4,12,8); ctx.fillStyle='#4D9FFF'
    })
    // player
    ctx.fillStyle='#3DE08A'; ctx.fillRect(player.x-player.w/2,H-30,player.w,player.h)
    // bullets
    bullets.forEach(b => {
      ctx.fillStyle = b.dy<0 ? '#FFC24B' : '#FF5EA0'
      ctx.fillRect(b.x-2, b.y-6, 4, 12)
    })
    // hud
    ctx.fillStyle='#9AA6C4'; ctx.font='bold 13px sans-serif'; ctx.textAlign='left'
    ctx.fillText(`Score: ${score}`, 6, 18)
    ctx.fillText(`Lives: ${'♥ '.repeat(lives)}`, 6, 34)
    ctx.textAlign='right'; ctx.fillText(`Level ${level}`, W-6, 18)
    raf = requestAnimationFrame(draw)
  }

  raf = requestAnimationFrame(draw)

  const keys = (e: KeyboardEvent) => {
    if (e.key==='ArrowLeft') player.x = Math.max(26, player.x - 22)
    if (e.key==='ArrowRight') player.x = Math.min(W-26, player.x + 22)
    if (e.key==='ArrowUp'||e.key===' ') shoot()
  }
  window.addEventListener('keydown', keys)
  return () => { running=false; cancelAnimationFrame(raf); window.removeEventListener('keydown', keys) }
}

/* ── send-icon ── */
const SendIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>

/* ── Game canvas wrapper ── */
function GameCanvas({ type }: { type: 'tetris' | 'invaders' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanup = useRef<() => void>()
  const { addToast } = useAppStore()

  useEffect(() => {
    cleanup.current?.()
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (s: number) => { if (s > 0 && s % 100 === 0) addToast(`Score: ${s}`, '🎮') }
    if (type === 'tetris') cleanup.current = runTetris(canvas, handler)
    else cleanup.current = runInvaders(canvas, handler)
    return () => cleanup.current?.()
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className="studio-game-canvas" />
}

/* ── mobile control button helpers ── */
function Controls({ type, onKey }: { type: 'tetris' | 'invaders'; onKey: (k: string) => void }) {
  if (type === 'tetris') return (
    <div className="studio-controls">
      <button onClick={() => onKey('ArrowLeft')}>◀</button>
      <button className="primary" onClick={() => onKey('ArrowUp')}>↺ Rotate</button>
      <button onClick={() => onKey('ArrowRight')}>▶</button>
      <button onClick={() => onKey('ArrowDown')}>▼</button>
      <button onClick={() => onKey(' ')}>⬇ Drop</button>
    </div>
  )
  return (
    <div className="studio-controls">
      <button onClick={() => onKey('ArrowLeft')}>◀</button>
      <button className="primary" onClick={() => onKey('ArrowUp')}>🚀 Fire!</button>
      <button onClick={() => onKey('ArrowRight')}>▶</button>
    </div>
  )
}

/* ── Template cards ── */
const TEMPLATES = [
  { id: 'tetris', title: 'Neon Blocks', sub: 'Falling block puzzle' },
  { id: 'invaders', title: 'Star Defender', sub: 'Arcade space shooter' },
]

/* ── Chat bubble ── */
function ChatBubble({ msg }: { msg: { role: string; html?: string; text?: string } }) {
  return (
    <div className={`chat-bubble ${msg.role}`} dangerouslySetInnerHTML={{ __html: msg.html ?? msg.text ?? '' }} />
  )
}

/* ── STUDIO MAIN ── */
export default function Studio() {
  const {
    studioDevice, studioDemo, studioInput, studioBuilding, studioBuildStep,
    studioMessages, setStudioDevice, setStudioDemo, runStudioBuild,
  } = useAppStore((s) => ({
    studioDevice: s.studioDevice, studioDemo: s.studioDemo, studioInput: s.studioInput,
    studioBuilding: s.studioBuilding, studioBuildStep: s.studioBuildStep,
    studioMessages: s.studioMessages, setStudioDevice: s.setStudioDevice,
    setStudioDemo: s.setStudioDemo, runStudioBuild: s.runStudioBuild,
  }))

  const setInput = (v: string) => useAppStore.setState({ studioInput: v })
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [studioMessages, studioBuilding])

  const fakeKey = (k: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  }

  const DEVICE_LABELS: Record<string, string> = { desktop: '💻 Desktop', tablet: '📱 Tablet', iphone: '📱 Phone' }

  return (
    <div className="screen studio">
      <div className="studio-shell">
        {/* ── app bar ── */}
        <div className="studio-appbar">
          <div className="studio-brand">
            <div className="orb">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" width="16" height="16"><polygon points="12 2 2 7 12 22 22 7 12 2"/></svg>
            </div>
            <div>
              ArgantaLab Studio
              <small>Build with AI</small>
            </div>
          </div>
          <div className="studio-tabs">
            {TEMPLATES.map(t => (
              <button key={t.id} className={studioDemo === t.id ? 'on' : ''} onClick={() => setStudioDemo(t.id as 'tetris' | 'invaders')}>{t.title}</button>
            ))}
          </div>
          <button className="studio-publish">🚀 Share</button>
        </div>

        {/* ── workspace ── */}
        <div className="studio-workspace">
          {/* LEFT – AI chat */}
          <div className="studio-chat">
            <div className="studio-chat-top">
              <h2>🤖 AI Builder</h2>
              <span>● Online</span>
            </div>

            {/* template cards */}
            <div className="template-grid">
              {TEMPLATES.map(t => (
                <button key={t.id} className={`template-card${studioDemo===t.id ? ' on' : ''}`} onClick={() => setStudioDemo(t.id as 'tetris' | 'invaders')}>
                  <b>{t.title}</b>
                  <span>{t.sub}</span>
                </button>
              ))}
            </div>

            {/* chat messages */}
            <div className="chat-stream" ref={chatRef}>
              {studioMessages.map((m, i) => <ChatBubble key={i} msg={m} />)}
              {studioBuilding && (
                <div className="thinking-line">
                  <div className="thinking-core">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" width="14" height="14"><polygon points="12 2 2 7 12 22 22 7 12 2"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>{studioBuildStep}</div>
                    <div className="thinking-dots"><i/><i/><i/></div>
                    <div className="build-meter"><i/></div>
                  </div>
                </div>
              )}
            </div>

            {/* prompt input */}
            <div className="studio-prompt">
              <input
                placeholder="What do you want to build?"
                value={studioInput}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && studioInput.trim()) { runStudioBuild(studioInput); setInput('') } }}
              />
              <button onClick={() => { if (studioInput.trim()) { runStudioBuild(studioInput); setInput('') } }} disabled={studioBuilding}>
                <SendIcon />
              </button>
            </div>
          </div>

          {/* RIGHT – game preview */}
          <div className="studio-stage">
            <div className="studio-toolbar">
              <div className="studio-status">
                <i />
                Live preview · {studioDemo === 'tetris' ? 'Neon Blocks' : 'Star Defender'}
              </div>
              <div className="device-tabs">
                {(['desktop','tablet','iphone'] as const).map(d => (
                  <button key={d} className={studioDevice===d?'on':''} onClick={() => setStudioDevice(d)}>{DEVICE_LABELS[d]}</button>
                ))}
              </div>
            </div>

            <div className="preview-area">
              <div className={`device-frame ${studioDevice}`}>
                <div className="device-bar"><span/><span/><span/></div>
                <div className="studio-game-shell">
                  <div className="studio-game-top">
                    <b>{studioDemo === 'tetris' ? '🟦 Neon Blocks' : '👾 Star Defender'}</b>
                    <small>Arrow keys · Space to {studioDemo === 'tetris' ? 'drop' : 'fire'}</small>
                  </div>
                  <GameCanvas type={studioDemo} />
                  <Controls type={studioDemo} onKey={fakeKey} />
                </div>
              </div>
            </div>

            <div className="studio-specs">
              <div className="studio-spec"><b>Engine</b><span>HTML5 Canvas</span></div>
              <div className="studio-spec"><b>Lang</b><span>TypeScript</span></div>
              <div className="studio-spec"><b>Status</b><span style={{ color: 'var(--green)' }}>Running</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  ARGANTA STUDIO — the v2 Game Wizard.
//  You run a game studio: pick a genre (15 viral-game analogs),
//  costume your avatar, hire a sidekick, forge a world, tune the
//  engine, flip on real backend services, then deploy. Every
//  choice compiles into a GameSpec the shared engine boots from.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useAppStore } from '@store/appStore'
import {
  GENRES, genreDef, SIDEKICKS,
  STUDIO_WORLDS, LAYOUTS, SERVICES, defaultSpec, defaultParams, suggestSpecTitle,
  type GameSpec, type GenreDef, type ParamDef,
} from '@/data/studio'
import type { SidekickSpec } from '@/engine/types'
import Buddy from '@components/avatar/Buddy'
import { generateGameV2 } from '@lib/gameGen'
import { saveMyGame, loadMyGames, newGameId, type SavedGame } from '@lib/myGames'
import { pushGame } from '@lib/gamesCloud'
import { bestScore } from '@lib/gameServices'
import { loadSave } from '@lib/kinquest/save'
import { kin as kinDef } from '@/data/openworld'
import { MOUNT_BY_ID } from '@/data/openworld/mounts'
import { myMounts } from '@lib/mounts'
import '@/styles/studio.css'

const PAGES = ['gate', 'genre', 'hero', 'world', 'engine', 'backend', 'launch'] as const
type Page = typeof PAGES[number]

const PAGE_META: Record<Page, { dept: string; icon: string; lesson: string }> = {
  gate:    { dept: 'Studio HQ',    icon: '🏢', lesson: '' },
  genre:   { dept: 'Design Floor', icon: '🎨', lesson: 'Genre = the game loop — the rules the code repeats every frame.' },
  hero:    { dept: 'Casting Dept', icon: '🎭', lesson: 'Your hero is a sprite: one drawing, redrawn 60 times a second.' },
  world:   { dept: 'World Forge',  icon: '🗺️', lesson: 'Worlds are just data — the same engine paints different palettes.' },
  engine:  { dept: 'Engine Room',  icon: '⚙️', lesson: 'These dials are variables. Change a number, change the game.' },
  backend: { dept: 'Backend Bay',  icon: '🗄️', lesson: 'Real games need servers: a database remembers, auth knows who you are.' },
  launch:  { dept: 'Launch Pad',   icon: '🚀', lesson: 'Deploying = packaging your code and putting it on the internet.' },
}

export default function Wizard() {
  const { requireAuth, addXp, addToast, go, ownsItem, buyItem, session, learnerName } = useAppStore()
  const resolvedOutfit = useAppStore(s => s.resolvedOutfit)
  const outfit = useAppStore(s => s.outfit)
  const [page, setPage] = useState<Page>('gate')
  const [spec, setSpec] = useState<GameSpec>(() => ({
    ...defaultSpec(),
    hero: { ...defaultSpec().hero, name: learnerName, initial: (learnerName[0] || 'P').toUpperCase() },
  }))
  const [gameId, setGameId] = useState<string>(() => newGameId())
  const [savedId, setSavedId] = useState<string | null>(null)

  // The hero IS the kid's real Buddy: serialize the avatar (current outfit
  // included) into the spec so the engine draws the same character in-game.
  const heroSvg = useMemo(
    () => renderToStaticMarkup(<Buddy outfit={resolvedOutfit()} mood="happy" bob={false} size={100} />)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outfit],
  )

  // keep the hero identity + look synced to the signed-in kid
  useEffect(() => {
    setSpec(s => ({ ...s, hero: { ...s.hero, name: learnerName, initial: (learnerName[0] || 'P').toUpperCase(), svg: heroSvg } }))
  }, [learnerName, heroSvg])

  const patch = (p: Partial<GameSpec>) => setSpec(s => ({ ...s, ...p }))
  const idx = PAGES.indexOf(page)
  const meta = PAGE_META[page]

  const canNext =
    page === 'genre' ? !!spec.genre :
    page === 'world' ? !!spec.world :
    true

  const next = () => {
    if (page === 'gate' && !requireAuth('to build games')) return
    setPage(PAGES[Math.min(PAGES.length - 1, idx + 1)])
  }
  const back = () => setPage(PAGES[Math.max(0, idx - 1)])
  const restart = () => {
    setSpec({ ...defaultSpec(), hero: { ...defaultSpec().hero, name: learnerName, initial: (learnerName[0] || 'P').toUpperCase() } })
    setGameId(newGameId())
    setSavedId(null)
    setPage('gate')
  }

  const save = (html: string) => {
    const title = spec.title || suggestSpecTitle(spec)
    const game: SavedGame = {
      id: gameId, title, source: 'studio', spec: { ...spec, title },
      html, createdAt: Date.now(), plays: 0,
    }
    saveMyGame(game)
    if (session && session !== 'loading') pushGame(session.user.id, game)
    if (!savedId) addXp(40)
    setSavedId(gameId)
    addToast(`Saved “${title}” to your games!`, '🎮')
  }

  const remix = (g: SavedGame) => {
    if (!g.spec) return
    setSpec(g.spec)
    setGameId(g.id)
    setSavedId(g.id)
    setPage('genre')
    addToast(`Remixing “${g.title}”`, '🎛️')
  }

  return (
    <div className="stu">
      <header className="stu-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Arganta Studio · {meta.icon} {meta.dept}</div>
          <h1 className="stu-title">
            {page === 'gate' ? `${learnerName} Studios` :
             page === 'launch' ? 'Launch Pad' :
             `Step ${idx} of 5 — ${meta.dept}`}
          </h1>
        </div>
        {spec.genre && page !== 'gate' && <SpecChip spec={spec} />}
      </header>

      {page !== 'gate' && (
        <div className="stu-pipe">
          {PAGES.slice(1).map((p, i) => (
            <button key={p} className={`stu-pip${PAGES[i + 1] === page ? ' on' : ''}${i + 1 < idx ? ' done' : ''}`}
              onClick={() => i + 1 < idx && setPage(p)} disabled={i + 1 > idx}>
              <span>{PAGE_META[p].icon}</span>
              <b>{PAGE_META[p].dept}</b>
            </button>
          ))}
        </div>
      )}

      <div className="stu-body">
        {page === 'gate' && <GatePage onStart={next} onRemix={remix} onPlayShelf={() => go({ tab: 'library' })} name={learnerName} spec={spec} />}
        {page === 'genre' && <GenrePage value={spec.genre} owns={ownsItem} buy={buyItem}
          onPick={k => patch({ genre: k as GameSpec['genre'], params: defaultParams(k as GameSpec['genre']) })} />}
        {page === 'hero' && <HeroPage spec={spec} patch={patch} owns={ownsItem} buy={buyItem} onDressingRoom={() => go({ tab: 'avatar' })} />}
        {page === 'world' && <WorldPage spec={spec} patch={patch} owns={ownsItem} buy={buyItem} />}
        {page === 'engine' && <EnginePage spec={spec} patch={patch} />}
        {page === 'backend' && <BackendPage spec={spec} patch={patch} />}
        {page === 'launch' && <LaunchPad spec={spec} gameId={gameId} saved={!!savedId}
          onTitle={t => patch({ title: t })} onSave={save} onRestart={restart}
          onPitch={() => go({ tab: 'pitch' })} />}

        {meta.lesson && page !== 'launch' && (
          <div className="stu-lesson"><span>💡 Studio School</span><p>{meta.lesson}</p></div>
        )}
      </div>

      {page !== 'gate' && page !== 'launch' && (
        <div className="stu-nav">
          <button className="btn btn-ghost" onClick={back}>← Back</button>
          <button className="btn btn-primary" disabled={!canNext} onClick={next}>
            {page === 'backend' ? '🚀 Deploy!' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── your real Buddy, straight from the store ──────────────── */
function MyBuddy({ size, mood = 'happy', className }: { size: number; mood?: 'idle' | 'happy' | 'celebrate' | 'wave'; className?: string }) {
  const resolvedOutfit = useAppStore(s => s.resolvedOutfit)
  const outfit = useAppStore(s => s.outfit)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolved = useMemo(() => resolvedOutfit(), [outfit])
  return <Buddy outfit={resolved} mood={mood} size={size} className={className} />
}

/* ── live spec chip in the header ─────────────────────────── */
function SpecChip({ spec }: { spec: GameSpec }) {
  const gd = genreDef(spec.genre)
  const wd = STUDIO_WORLDS.find(w => w.key === spec.world)
  const title = spec.title || suggestSpecTitle(spec)
  const sub = [gd?.name !== title ? gd?.name : '', wd?.label, spec.sidekick ? `+ ${spec.sidekick.name}` : '']
    .filter(Boolean).join(' · ')
  return (
    <div className="stu-chip" style={wd ? { background: `linear-gradient(135deg,${wd.bg1},${wd.bg2})` } : undefined}>
      <MyBuddy size={44} mood="idle" />
      <div>
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}

/* ── PAGE 0 · Studio Gate ──────────────────────────────────── */
function GatePage({ onStart, onRemix, onPlayShelf, name, spec }: {
  onStart: () => void; onRemix: (g: SavedGame) => void; onPlayShelf: () => void; name: string; spec: GameSpec
}) {
  const games = useMemo(() => loadMyGames().filter(g => g.source === 'studio' || g.source === 'wizard'), [])
  return (
    <div className="stu-gate">
      <div className="stu-gate-hero">
        <MyBuddy size={130} mood="wave" className="stu-gate-avatar" />
        <div className="stu-gate-sign">
          <h2>{name} Studios</h2>
          <p>Where your games get made. Pick a genre, star in it, ship it to the world.</p>
          <button className="btn btn-primary stu-cta" onClick={onStart}>🎬 Start a new game</button>
        </div>
      </div>
      <div className="stu-shelf">
        <div className="stu-shelf-head">
          <h3>🕹️ Your cartridge shelf</h3>
          {games.length > 0 && <button className="btn btn-ghost" onClick={onPlayShelf}>Library →</button>}
        </div>
        {games.length === 0
          ? <p className="stu-empty">No games yet — your first cartridge is one deploy away.</p>
          : <div className="stu-carts">
              {games.slice(0, 8).map(g => {
                const gd = g.spec ? genreDef(g.spec.genre) : undefined
                const wd = g.spec ? STUDIO_WORLDS.find(w => w.key === g.spec!.world) : undefined
                const best = bestScore(g.id)
                return (
                  <button key={g.id} className="stu-cart" onClick={() => g.spec ? onRemix(g) : undefined}
                    style={wd ? { background: `linear-gradient(160deg,${wd.bg2},${wd.bg1})` } : undefined}>
                    <span className="stu-cart-e">{gd?.emoji ?? '🎮'}</span>
                    <b>{g.title}</b>
                    <span className="stu-cart-sub">{gd?.name ?? 'Classic wizard'}{best > 0 ? ` · ⭐${best}` : ''}</span>
                    {g.spec && <span className="stu-cart-remix">tap to remix</span>}
                  </button>
                )
              })}
            </div>}
      </div>
    </div>
  )
}

/* ── PAGE 1 · Genre Hall ───────────────────────────────────── */
function GenrePage({ value, onPick, owns, buy }: {
  value: string; onPick: (k: string) => void
  owns: (k: string) => boolean; buy: (k: string, price: number, name: string) => boolean
}) {
  const pick = (gd: GenreDef) => {
    const key = `genre_${gd.key}`
    if (gd.price && !owns(key)) { if (buy(key, gd.price, gd.name)) onPick(gd.key); return }
    onPick(gd.key)
  }
  return (
    <div className="stu-pick">
      <h2 className="stu-q">What are we making? <span className="stu-q-sub">15 engines, sorted by what the world plays most</span></h2>
      <div className="stu-genres">
        {GENRES.map((gd, i) => {
          const locked = !!gd.price && !owns(`genre_${gd.key}`)
          return (
            <button key={gd.key} className={`stu-genre${value === gd.key ? ' sel' : ''}${locked ? ' locked' : ''}${gd.rarity ? ' ' + gd.rarity : ''}`} onClick={() => pick(gd)}>
              <div className="stu-genre-top">
                <span className="stu-genre-e">{gd.emoji}</span>
                {i < 3 && <span className="stu-genre-hot">🔥 top {i + 1}</span>}
                {locked && <span className="stu-genre-price">💎 {gd.price}</span>}
              </div>
              <b>{gd.name}</b>
              <span className="stu-genre-analog">inspired by {gd.analog}</span>
              <p>{gd.tagline}</p>
              <div className="stu-genre-meta">
                {gd.tags.map(t => <i key={t}>{t}</i>)}
                <i className="stars">engine {'★'.repeat(gd.stars)}{'☆'.repeat(3 - gd.stars)}</i>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── PAGE 2 · Casting: your real Buddy stars + pick a sidekick ── */
function HeroPage({ spec, patch, owns, buy, onDressingRoom }: {
  spec: GameSpec; patch: (p: Partial<GameSpec>) => void
  owns: (k: string) => boolean; buy: (k: string, price: number, name: string) => boolean
  onDressingRoom: () => void
}) {
  const gd = genreDef(spec.genre)
  const [kinSidekicks, setKinSidekicks] = useState<SidekickSpec[]>([])
  const [mountSidekicks, setMountSidekicks] = useState<SidekickSpec[]>([])

  useEffect(() => {
    // Kins from the KinQuest party = free premier sidekicks
    try {
      const party = loadSave().party
      setKinSidekicks(party.map(p => {
        const d = kinDef(`kin:${p.render}`)
        return { key: `kin:${p.render}`, name: d?.name ?? p.render, emoji: '🐾', color: d?.color ?? '#818cf8', power: 'luck' as const }
      }))
    } catch { /* no save yet */ }
    // Owned mounts ride along too
    myMounts().then(m => {
      setMountSidekicks((m.owned ?? []).map(id => {
        const d = MOUNT_BY_ID[id]
        return { key: id, name: d?.name ?? 'Mount', emoji: '🐎', color: d?.color ?? '#f59e0b', power: 'boost' as const }
      }))
    })
  }, [])

  const pickSidekick = (sk: SidekickSpec | null, price?: number) => {
    if (sk && price && !owns(sk.key)) { if (!buy(sk.key, price, sk.name)) return }
    patch({ sidekick: sk })
  }

  return (
    <div className="stu-hero-page">
      <div className="stu-pedestal">
        <MyBuddy size={170} mood="celebrate" className="stu-pedestal-cv" />
        <b>{spec.hero.name} the {gd?.fit ?? 'Hero'}</b>
        <span>your Buddy stars in every game you build</span>
        <button className="btn btn-soft stu-dress" onClick={onDressingRoom}>👕 Change my look</button>
        {spec.sidekick && <div className="stu-pedestal-sk"><span>{spec.sidekick.emoji}</span> with {spec.sidekick.name}</div>}
      </div>

      <div className="stu-hero-opts">
        <h3>🤝 Sidekick <span className="stu-h-sub">{gd ? `— in ${gd.name}, your sidekick ${gd.sidekickRole}` : ''}</span></h3>
        <div className="stu-sidekicks">
          <button className={`stu-sk${!spec.sidekick ? ' sel' : ''}`} onClick={() => pickSidekick(null)}>
            <span className="stu-sk-e">🚫</span><b>Solo run</b><i>no sidekick</i>
          </button>
          {kinSidekicks.map(sk => (
            <button key={sk.key} className={`stu-sk kin${spec.sidekick?.key === sk.key ? ' sel' : ''}`} onClick={() => pickSidekick(sk)}>
              <span className="stu-sk-e" style={{ background: sk.color }}>{sk.emoji}</span>
              <b>{sk.name}</b><i>your Kin · free</i>
            </button>
          ))}
          {mountSidekicks.map(sk => (
            <button key={sk.key} className={`stu-sk kin${spec.sidekick?.key === sk.key ? ' sel' : ''}`} onClick={() => pickSidekick(sk)}>
              <span className="stu-sk-e" style={{ background: sk.color }}>{sk.emoji}</span>
              <b>{sk.name}</b><i>your mount · free</i>
            </button>
          ))}
          {SIDEKICKS.map(sd => {
            const sk: SidekickSpec = { key: sd.key, name: sd.name, emoji: sd.emoji, color: sd.color, power: sd.power }
            const locked = !!sd.price && !owns(sd.key)
            return (
              <button key={sd.key} className={`stu-sk${spec.sidekick?.key === sd.key ? ' sel' : ''}${locked ? ' locked' : ''}${sd.rarity ? ' ' + sd.rarity : ''}`}
                onClick={() => pickSidekick(sk, sd.price)}>
                <span className="stu-sk-e" style={{ background: sd.color }}>{sd.emoji}</span>
                <b>{sd.name}</b>
                <i>{sd.perk}</i>
                {locked && <em>💎 {sd.price}</em>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── PAGE 3 · World Forge ──────────────────────────────────── */
function WorldPage({ spec, patch, owns, buy }: {
  spec: GameSpec; patch: (p: Partial<GameSpec>) => void
  owns: (k: string) => boolean; buy: (k: string, price: number, name: string) => boolean
}) {
  return (
    <div className="stu-pick">
      <h2 className="stu-q">Forge the world <span className="stu-q-sub">palette + map seed — same engine, different planet</span></h2>
      <div className="stu-worlds">
        {STUDIO_WORLDS.map(wd => {
          const locked = !!wd.price && !owns(wd.key)
          return (
            <button key={wd.key} className={`stu-world${spec.world === wd.key ? ' sel' : ''}${locked ? ' locked' : ''}${wd.rarity ? ' ' + wd.rarity : ''}`}
              style={{ background: `linear-gradient(150deg,${wd.bg1},${wd.bg2})` }}
              onClick={() => locked ? (buy(wd.key, wd.price!, wd.label) && patch({ world: wd.key })) : patch({ world: wd.key })}>
              <span className="stu-world-e">{wd.emoji}</span>
              <b>{wd.label}</b>
              <span className="stu-world-dots">
                <i style={{ background: wd.tile }} /><i style={{ background: wd.accent }} /><i style={{ background: wd.glow }} />
              </span>
              {locked && <em>💎 {wd.price}</em>}
              {wd.rarity && <span className="stu-rarity">{wd.rarity}</span>}
            </button>
          )
        })}
      </div>
      <h3 className="stu-sub-h">🧬 Map seed</h3>
      <div className="stu-row">
        {LAYOUTS.map((l, i) => (
          <button key={l} className={`stu-opt${spec.layout === i ? ' sel' : ''}`} onClick={() => patch({ layout: i })}>
            <span>{['🅰️', '🅱️', '🆎'][i]}</span><b>{l}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── PAGE 4 · Engine Room ──────────────────────────────────── */
function EnginePage({ spec, patch, }: { spec: GameSpec; patch: (p: Partial<GameSpec>) => void }) {
  const gd = genreDef(spec.genre)
  if (!gd) return null
  const setParam = (k: string, v: number | string | boolean) => patch({ params: { ...spec.params, [k]: v } })
  return (
    <div className="stu-pick">
      <h2 className="stu-q">{gd.emoji} {gd.name} — Engine Room <span className="stu-q-sub">every dial is a variable in your game's code</span></h2>
      <div className="stu-engine">
        {gd.params.map(p => <ParamControl key={p.key} def={p} value={spec.params[p.key] ?? p.def} onChange={v => setParam(p.key, v)} />)}
      </div>
    </div>
  )
}

function ParamControl({ def, value, onChange }: { def: ParamDef; value: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
  if (def.type === 'slider') {
    const v = typeof value === 'number' ? value : Number(def.def)
    return (
      <div className="stu-param">
        <label>{def.label}<b>{v}</b></label>
        <input type="range" min={def.min} max={def.max} step={def.step ?? 1} value={v}
          onChange={e => onChange(Number(e.target.value))} />
        {def.hint && <span className="stu-param-hint">{`// ${def.hint}`}</span>}
      </div>
    )
  }
  if (def.type === 'toggle') {
    const v = typeof value === 'boolean' ? value : Boolean(def.def)
    return (
      <div className="stu-param">
        <label>{def.label}</label>
        <button className={`stu-toggle${v ? ' on' : ''}`} onClick={() => onChange(!v)}><i /></button>
        {def.hint && <span className="stu-param-hint">{`// ${def.hint}`}</span>}
      </div>
    )
  }
  return (
    <div className="stu-param">
      <label>{def.label}</label>
      <div className="stu-row">
        {def.opts?.map(o => (
          <button key={o.key} className={`stu-opt small${value === o.key ? ' sel' : ''}`} onClick={() => onChange(o.key)}>
            <b>{o.label}</b>
          </button>
        ))}
      </div>
      {def.hint && <span className="stu-param-hint">{`// ${def.hint}`}</span>}
    </div>
  )
}

/* ── PAGE 5 · Backend Bay ──────────────────────────────────── */
function BackendPage({ spec, patch }: { spec: GameSpec; patch: (p: Partial<GameSpec>) => void }) {
  const [lines, setLines] = useState<string[]>(['> arganta backend console — flip a switch'])
  const toggle = (key: keyof GameSpec['services']) => {
    const on = !spec.services[key]
    patch({ services: { ...spec.services, [key]: on } })
    const svc = SERVICES.find(s => s.key === key)!
    setLines(l => [...l.slice(-6), on ? `> ${svc.line} ✓` : `> ${svc.label.toLowerCase()} disabled ✗`])
  }
  return (
    <div className="stu-pick">
      <h2 className="stu-q">Provision the backend <span className="stu-q-sub">these switches turn on REAL features in your game</span></h2>
      <div className="stu-backend">
        <div className="stu-services">
          {SERVICES.map(svc => (
            <button key={svc.key} className={`stu-svc${spec.services[svc.key] ? ' on' : ''}`} onClick={() => toggle(svc.key)}>
              <span className="stu-svc-e">{svc.emoji}</span>
              <div><b>{svc.label}</b><p>{svc.kid}</p></div>
              <span className={`stu-toggle${spec.services[svc.key] ? ' on' : ''}`}><i /></span>
            </button>
          ))}
        </div>
        <div className="stu-terminal">
          {lines.map((l, i) => <div key={i} className="stu-term-line">{l}</div>)}
          <div className="stu-term-line blink">▌</div>
        </div>
      </div>
    </div>
  )
}

/* ── PAGE 6 · Launch Pad ───────────────────────────────────── */
const DEPLOY_STAGES = [
  { pct: 15, line: '> compiling sprites…', svc: null },
  { pct: 34, line: '> bundling arganta engine…', svc: null },
  { pct: 52, line: '> provisioning database…', svc: 'db' as const },
  { pct: 66, line: '> enabling player auth…', svc: 'login' as const },
  { pct: 80, line: '> mounting save slots…', svc: 'cloudSave' as const },
  { pct: 92, line: '> uploading to cloud…', svc: null },
  { pct: 100, line: '> LIVE ✓ — your game is on the air!', svc: null },
]

function LaunchPad({ spec, gameId, saved, onTitle, onSave, onRestart, onPitch }: {
  spec: GameSpec; gameId: string; saved: boolean
  onTitle: (t: string) => void; onSave: (html: string) => void; onRestart: () => void; onPitch: () => void
}) {
  const [pct, setPct] = useState(0)
  const [lines, setLines] = useState<string[]>([])
  const [live, setLive] = useState(false)
  const finalSpec = useMemo(() => ({ ...spec, title: spec.title || suggestSpecTitle(spec) }), [spec])
  const html = useMemo(() => (live ? generateGameV2(finalSpec, gameId) : ''), [live, finalSpec, gameId])

  useEffect(() => {
    let cancelled = false
    const stages = DEPLOY_STAGES.filter(s => !s.svc || spec.services[s.svc])
    let i = 0
    const step = () => {
      if (cancelled) return
      if (i >= stages.length) { setLive(true); return }
      const s = stages[i++]
      setPct(s.pct)
      setLines(l => [...l, s.line])
      setTimeout(step, 420 + Math.random() * 300)
    }
    step()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="stu-launch">
      {!live ? (
        <div className="stu-deploy">
          <h2>🚀 Deploying {finalSpec.title}…</h2>
          <div className="stu-deploy-bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="stu-terminal tall">
            {lines.map((l, i) => <div key={i} className="stu-term-line">{l}</div>)}
            <div className="stu-term-line blink">▌</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setLive(true)}>skip ⏭</button>
        </div>
      ) : (
        <div className="stu-live">
          <div className="stu-frame">
            <iframe title="your game" srcDoc={html} sandbox="allow-scripts allow-pointer-lock" />
          </div>
          <div className="stu-live-panel">
            <div className="stu-live-badge">🟢 LIVE</div>
            <label className="stu-label">Name your game</label>
            <input className="stu-name" value={spec.title} placeholder={suggestSpecTitle(spec)}
              onChange={e => onTitle(e.target.value)} />
            {!saved
              ? <button className="btn btn-primary stu-cta" onClick={() => onSave(html)}>💾 Save to My Games (+40 XP)</button>
              : <div className="stu-saved">✓ Saved! It's on your cartridge shelf.</div>}
            <button className="btn btn-soft" onClick={onPitch}>🎤 Pitch it in Pitch Studio</button>
            <button className="btn btn-ghost" onClick={onRestart}>🎬 Make another</button>
            <div className="stu-live-meta">
              {[
                ['Genre', genreDef(spec.genre)?.name],
                ['World', STUDIO_WORLDS.find(w => w.key === spec.world)?.label],
                ['Sidekick', spec.sidekick?.name ?? 'Solo'],
                ['Database', spec.services.db ? 'on' : 'off'],
                ['Leaderboard', spec.services.leaderboard ? 'on' : 'off'],
                ['Cloud Save', spec.services.cloudSave ? 'on' : 'off'],
              ].map(([k, v]) => <div key={k as string}><span>{k}</span><b>{v}</b></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

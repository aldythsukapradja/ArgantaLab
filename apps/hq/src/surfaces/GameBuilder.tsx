import { useState, useMemo, useEffect, useCallback } from 'react'
import { Gamepad2, Plus, Send, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react'
import {
  GAME_TYPES, WORLDS, CHARACTERS, STYLES, SPEEDS, DIFFICULTIES, POWERUPS,
  WORLD_GRADS, defaultConfig, suggestTitle, generateGame,
  type WizardConfig, type Opt,
} from '../data/gameWizard'
import { live, type PublishedGame } from '../data/live'
import { supabase, cloudEnabled } from '../lib/supabase'
import { Empty, Loading } from '../components/Empty'

type View = 'catalog' | 'build'

export function GameBuilder() {
  const [view, setView] = useState<View>('catalog')
  const [games, setGames] = useState<PublishedGame[] | undefined>(undefined)
  const [cfg, setCfg] = useState<WizardConfig>(defaultConfig())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGames = useCallback(() => {
    setGames(undefined)
    live.listGames().then(g => setGames(g))
  }, [])

  useEffect(() => { loadGames() }, [loadGames])

  const html = useMemo(() => {
    if (!cfg.type || !cfg.world || !cfg.character) return ''
    return generateGame({ ...cfg, title: cfg.title || suggestTitle(cfg) })
  }, [cfg])

  const openNew = () => {
    setCfg(defaultConfig())
    setEditingId(null)
    setPublished(false)
    setError(null)
    setView('build')
  }

  const openEdit = (g: PublishedGame) => {
    setCfg(g.config ?? defaultConfig())
    setEditingId(g.id)
    setPublished(g.visibility === 'public')
    setError(null)
    setView('build')
  }

  const publish = async () => {
    setPublishing(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sign in to publish games.'); setPublishing(false); return }

    const id = editingId ?? crypto.randomUUID()
    const title = cfg.title || suggestTitle(cfg)
    const ok = await live.publishGame({
      id,
      title,
      config: { ...cfg, title },
      html: generateGame({ ...cfg, title }),
      userId: session.user.id,
    })

    if (ok) {
      setEditingId(id)
      setPublished(true)
      loadGames()
    } else {
      setError('Publish failed — check Supabase connection.')
    }
    setPublishing(false)
  }

  const unpublish = async () => {
    if (!editingId) return
    setPublishing(true)
    const ok = await live.unpublishGame(editingId)
    if (ok) { setPublished(false); loadGames() }
    setPublishing(false)
  }

  if (view === 'catalog') {
    return <CatalogView games={games} onNew={openNew} onEdit={openEdit} onRefresh={loadGames} />
  }

  return (
    <BuildView
      cfg={cfg}
      onChange={p => setCfg(c => ({ ...c, ...p }))}
      html={html}
      publishing={publishing}
      published={published}
      error={error}
      onPublish={publish}
      onUnpublish={unpublish}
      onBack={() => setView('catalog')}
    />
  )
}

// ── Catalog ────────────────────────────────────────────────────

function CatalogView({ games, onNew, onEdit, onRefresh }: {
  games: PublishedGame[] | undefined
  onNew: () => void
  onEdit: (g: PublishedGame) => void
  onRefresh: () => void
}) {
  const pub  = games?.filter(g => g.visibility === 'public')  ?? []
  const priv = games?.filter(g => g.visibility !== 'public')  ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="spread">
        <div>
          <div className="h1">Game Builder</div>
          <div className="sub">Create and publish games — they appear instantly in ArgantaLab's Discover tab</div>
        </div>
        <div className="row">
          <button className="chip" onClick={onRefresh} title="Refresh"><RefreshCw size={13} /></button>
          <button
            className="chip"
            style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)', gap: 6 }}
            onClick={onNew}
          >
            <Plus size={13} /> New Game
          </button>
        </div>
      </div>

      {!cloudEnabled && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>Connect Supabase to publish games to ArgantaLab. Games appear instantly for kids to play.</div>
        </div>
      )}

      {games === undefined && <Loading label="Loading game catalog…" />}

      {games !== undefined && games.length === 0 && (
        <Empty icon={<Gamepad2 />} title="No games yet">
          Hit <b>New Game</b> to build your first — the wizard takes 30 seconds.
        </Empty>
      )}

      {pub.length > 0 && (
        <Section label={`Published (${pub.length})`} badge="pill-ok">
          <GameGrid games={pub} onEdit={onEdit} />
        </Section>
      )}

      {priv.length > 0 && (
        <Section label={`Drafts (${priv.length})`}>
          <GameGrid games={priv} onEdit={onEdit} />
        </Section>
      )}
    </div>
  )
}

function Section({ label, badge = 'pill-mut', children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row">
        <span className={`pill ${badge}`}>{label}</span>
      </div>
      {children}
    </div>
  )
}

function GameGrid({ games, onEdit }: { games: PublishedGame[]; onEdit: (g: PublishedGame) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
      {games.map(g => <GameCard key={g.id} game={g} onClick={() => onEdit(g)} />)}
    </div>
  )
}

function GameCard({ game, onClick }: { game: PublishedGame; onClick: () => void }) {
  const world = game.config ? WORLDS.find(w => w.key === game.config!.world) : null
  const char  = game.config ? CHARACTERS.find(c => c.key === game.config!.character) : null
  const type  = game.config ? GAME_TYPES.find(t => t.key === game.config!.type) : null
  const grad  = WORLD_GRADS[game.config?.world ?? ''] ?? 'var(--bg3)'

  return (
    <button
      className="card"
      onClick={onClick}
      style={{ padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', width: '100%' }}
    >
      <div style={{ height: 76, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
        {char?.emoji ?? '🎮'}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{game.title || 'Untitled'}</div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', gap: 5 }}>
          {type && <span>{type.emoji} {type.label}</span>}
          {world && <span>· {world.label}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 5 }}>
          {game.plays} plays
          {game.visibility === 'public'
            ? <span style={{ color: 'var(--ok)', marginLeft: 6 }}>● Live</span>
            : <span style={{ color: 'var(--tx3)', marginLeft: 6 }}>● Draft</span>}
        </div>
      </div>
    </button>
  )
}

// ── Build view ─────────────────────────────────────────────────

function BuildView({ cfg, onChange, html, publishing, published, error, onPublish, onUnpublish, onBack }: {
  cfg: WizardConfig
  onChange: (p: Partial<WizardConfig>) => void
  html: string
  publishing: boolean
  published: boolean
  error: string | null
  onPublish: () => void
  onUnpublish: () => void
  onBack: () => void
}) {
  const ready = !!(cfg.type && cfg.world && cfg.character)
  const title = cfg.title || suggestTitle(cfg)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="spread">
        <div className="row">
          <button className="chip" onClick={onBack} style={{ gap: 5 }}>
            <ArrowLeft size={13} /> Catalog
          </button>
          <div className="h1" style={{ margin: 0 }}>Build a Game</div>
        </div>

        <div className="row">
          {published && (
            <button
              className="chip"
              onClick={onUnpublish}
              disabled={publishing}
              style={{ gap: 5, color: 'var(--tx2)' }}
              title="Set back to draft"
            >
              <EyeOff size={13} /> Unpublish
            </button>
          )}
          <button
            className="chip"
            onClick={onPublish}
            disabled={!ready || publishing}
            style={{
              background: published ? 'var(--ok-bg)' : ready ? 'var(--acc)' : 'var(--bg3)',
              color: published ? 'var(--ok)' : ready ? '#fff' : 'var(--tx3)',
              borderColor: published ? 'var(--ok)' : ready ? 'var(--acc)' : 'var(--bd2)',
              gap: 5,
            }}
          >
            {published ? <Eye size={13} /> : <Send size={13} />}
            {publishing ? 'Publishing…' : published ? 'Live — update' : 'Publish to ArgantaLab'}
          </button>
        </div>
      </div>

      {published && (
        <div className="insight ok" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>✓</span>
          <div><b>"{title}"</b> is live in ArgantaLab's Discover tab. Kids can play it right now.</div>
        </div>
      )}

      {error && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Two-panel: config | preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>

        {/* Config panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <ConfigCard label="Game Type" required>
            <OptionRow opts={GAME_TYPES} value={cfg.type} onPick={k => onChange({ type: k })} showNote />
          </ConfigCard>

          <ConfigCard label="World" required>
            <OptionGrid opts={WORLDS} value={cfg.world} onPick={k => onChange({ world: k })} />
          </ConfigCard>

          <ConfigCard label="Character" required>
            <OptionGrid opts={CHARACTERS} value={cfg.character} onPick={k => onChange({ character: k })} />
          </ConfigCard>

          <ConfigCard label="Visual Style">
            <OptionRow opts={STYLES} value={cfg.style} onPick={k => onChange({ style: k })} />
          </ConfigCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <ConfigCard label="Speed">
              <OptionGrid opts={SPEEDS} value={cfg.speed} onPick={k => onChange({ speed: k })} compact />
            </ConfigCard>
            <ConfigCard label="Difficulty">
              <OptionGrid opts={DIFFICULTIES} value={cfg.difficulty} onPick={k => onChange({ difficulty: k })} compact />
            </ConfigCard>
          </div>

          <ConfigCard label="Power-ups">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {POWERUPS.map(o => {
                const on = cfg.powerups.includes(o.key)
                return (
                  <button
                    key={o.key}
                    onClick={() => {
                      const next = on
                        ? cfg.powerups.filter(p => p !== o.key)
                        : [...cfg.powerups, o.key]
                      onChange({ powerups: next })
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                      border: `1.5px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
                      borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: on ? 'var(--acc-soft)' : 'var(--bg)',
                      color: on ? 'var(--acc-text)' : 'var(--tx2)',
                    }}
                    title={o.note}
                  >
                    <span style={{ fontSize: 16 }}>{o.emoji}</span> {o.label}
                  </button>
                )
              })}
            </div>
          </ConfigCard>

          <ConfigCard label="Game Title">
            <input
              value={cfg.title}
              onChange={e => onChange({ title: e.target.value })}
              placeholder={suggestTitle(cfg) || 'Name your game…'}
              style={{
                width: '100%', padding: '8px 11px', borderRadius: 8,
                border: '1px solid var(--bd2)', background: 'var(--bg)',
                fontSize: 13, color: 'var(--tx)', outline: 'none',
              }}
            />
            {suggestTitle(cfg) && !cfg.title && (
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 5 }}>
                Auto-name: <b style={{ color: 'var(--tx2)' }}>{suggestTitle(cfg)}</b>
              </div>
            )}
          </ConfigCard>
        </div>

        {/* Preview panel */}
        <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--bd)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Gamepad2 size={14} color="var(--acc)" />
              <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title || 'Live Preview'}
              </span>
              <span className={`pill ${ready ? 'pill-ok' : 'pill-mut'}`}>
                {ready ? 'Ready' : 'Configure'}
              </span>
            </div>

            <div style={{ height: 400, background: '#05070f', position: 'relative' }}>
              {html ? (
                <iframe
                  key={html.slice(0, 60)}
                  srcDoc={html}
                  sandbox="allow-scripts allow-pointer-lock"
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title="Game Preview"
                />
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: '100%', gap: 10, color: 'rgba(255,255,255,0.35)', fontSize: 13,
                }}>
                  <Gamepad2 size={28} />
                  <span>Pick type, world &amp; character to preview</span>
                </div>
              )}
            </div>
          </div>

          {ready && (
            <div style={{ fontSize: 11.5, color: 'var(--tx3)', textAlign: 'center' }}>
              Preview reloads as you change options · Arrow keys or click to play
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function ConfigCard({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 13 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
        color: 'var(--tx3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {label}
        {required && <span style={{ color: 'var(--bad)', fontSize: 12, fontWeight: 400 }}>*</span>}
      </div>
      {children}
    </div>
  )
}

function OptionRow({ opts, value, onPick, showNote }: {
  opts: Opt[]; value: string; onPick: (k: string) => void; showNote?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {opts.map(o => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            title={o.note}
            style={{
              flex: 1, padding: '9px 6px', borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
              background: on ? 'var(--acc-soft)' : 'var(--bg)',
              color: on ? 'var(--acc-text)' : 'var(--tx2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 22 }}>{o.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: on ? 600 : 400 }}>{o.label}</span>
            {showNote && o.note && <span style={{ fontSize: 10, color: on ? 'var(--acc-text)' : 'var(--tx3)', lineHeight: 1.3, textAlign: 'center' }}>{o.note}</span>}
          </button>
        )
      })}
    </div>
  )
}

function OptionGrid({ opts, value, onPick, compact }: {
  opts: Opt[]; value: string; onPick: (k: string) => void; compact?: boolean
}) {
  const minW = compact ? 58 : 70
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`, gap: 6 }}>
      {opts.map(o => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            title={o.rarity ? `${o.rarity} · 💎${o.price}` : undefined}
            style={{
              padding: compact ? '5px 3px' : '7px 4px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
              background: on ? 'var(--acc-soft)' : 'var(--bg)',
              color: on ? 'var(--acc-text)' : 'var(--tx2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: compact ? 18 : 20 }}>{o.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: on ? 600 : 400, lineHeight: 1.25, textAlign: 'center' }}>{o.label}</span>
            {o.rarity && <span style={{ fontSize: 8.5, color: on ? 'var(--acc)' : 'var(--tx3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{o.rarity}</span>}
          </button>
        )
      })}
    </div>
  )
}

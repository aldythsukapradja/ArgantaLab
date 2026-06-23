import { useState, useCallback, useEffect } from 'react'
import {
  Gamepad2, Plus, ArrowLeft, RefreshCw, Send,
  EyeOff, Copy, Check, Play, AlertTriangle,
  ChevronDown, Smartphone, Tablet, Monitor,
} from 'lucide-react'
import { STARTER_PROMPT, PROMPT_CATEGORIES } from '../data/starterPrompt'
import { live, type PublishedGame, type Circle } from '../data/live'
import { generateCircleAppSDKMock } from '../data/circleAppSDK'
import { supabase, cloudEnabled } from '../lib/supabase'
import { Empty, Loading } from '../components/Empty'

type View = 'catalog' | 'build'
interface Meta {
  title: string
  category: string
  html: string
  description: string
  tags: string
  ageMin: string
  ageMax: string
}

const emptyMeta = (): Meta => ({
  title: '', category: 'platformer', html: '',
  description: '', tags: '', ageMin: '', ageMax: '',
})

function validate(html: string) {
  return {
    size:     Math.round(html.length / 1024 * 10) / 10,
    hasSDK:   /CircleGame/.test(html),
    hasInit:  /\.init\s*\(\s*\)/.test(html),
    hasScore: /submitScore/.test(html),
    three:    /three\.min\.js|three@|THREE\./.test(html),
    gsap:     /gsap\.min\.js|gsap@|TweenMax|gsap\.to/.test(html),
    pixi:     /pixi\.min\.js|pixi@|PIXI\./.test(html),
    howler:   /howler\.min\.js|howler@|Howl\(/.test(html),
  }
}

export function GameBuilder() {
  const [view, setView]           = useState<View>('catalog')
  const [games, setGames]         = useState<PublishedGame[] | undefined>(undefined)
  const [editingId, setEditId]    = useState<string | null>(null)
  const [meta, setMeta]           = useState<Meta>(emptyMeta())
  const [publishing, setPub]      = useState(false)
  const [published, setLive]      = useState(false)
  const [error, setErr]           = useState<string | null>(null)
  const [circles, setCircles]     = useState<Circle[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)

  const load = useCallback(() => {
    setGames(undefined)
    live.listGames().then(g => setGames(g))
  }, [])

  const loadCircles = useCallback(() => {
    live.listUserCircles().then(c => {
      setCircles(c)
      if (c.length > 0 && !selectedCircleId) {
        setSelectedCircleId(c[0].id)
      }
    })
  }, [selectedCircleId])

  useEffect(() => {
    load()
    loadCircles()
  }, [load, loadCircles])

  const openNew = () => {
    setMeta(emptyMeta())
    setEditId(null); setLive(false); setErr(null); setView('build')
  }

  const openEdit = (g: PublishedGame) => {
    setMeta({
      title:       g.title || '',
      category:    g.category ?? (g.config?.category as string | undefined) ?? 'platformer',
      html:        g.html || '',
      description: g.description ?? '',
      tags:        (g.tags ?? []).join(', '),
      ageMin:      g.age_min != null ? String(g.age_min) : '',
      ageMax:      g.age_max != null ? String(g.age_max) : '',
    })
    setEditId(g.id); setLive(g.visibility === 'public'); setErr(null); setView('build')
  }

  const publish = async () => {
    if (!meta.html.trim()) { setErr('Paste your game HTML first.'); return }
    if (!meta.title.trim()) { setErr('Give your game a title.'); return }
    setPub(true); setErr(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Sign in to publish games.'); setPub(false); return }
    const id = editingId ?? crypto.randomUUID()
    const ok = await live.publishGame({
      id, title: meta.title,
      html: meta.html,
      userId: session.user.id,
      category: meta.category,
      description: meta.description.trim() || undefined,
      tags: meta.tags.split(',').map(t => t.trim()).filter(Boolean),
      ageMin: meta.ageMin ? parseInt(meta.ageMin, 10) : null,
      ageMax: meta.ageMax ? parseInt(meta.ageMax, 10) : null,
      visibility: selectedCircleId ? 'circle' : 'public',
      circle_ids: selectedCircleId ? [selectedCircleId] : undefined,
    })
    if (ok) { setEditId(id); setLive(true); load() }
    else setErr('Publish failed — check Supabase connection.')
    setPub(false)
  }

  const unpublish = async () => {
    if (!editingId) return
    setPub(true)
    if (await live.unpublishGame(editingId)) { setLive(false); load() }
    setPub(false)
  }

  if (view === 'catalog') {
    return <CatalogView games={games} onNew={openNew} onEdit={openEdit} onRefresh={load} />
  }

  return (
    <BuildView
      meta={meta}
      onChange={p => setMeta(m => ({ ...m, ...p }))}
      publishing={publishing}
      published={published}
      error={error}
      onPublish={publish}
      onUnpublish={unpublish}
      onBack={() => setView('catalog')}
      circles={circles}
      selectedCircleId={selectedCircleId}
      onSelectCircle={setSelectedCircleId}
    />
  )
}

// ── Catalog ────────────────────────────────────────────────────────────

function CatalogView({ games, onNew, onEdit, onRefresh }: {
  games: PublishedGame[] | undefined
  onNew: () => void
  onEdit: (g: PublishedGame) => void
  onRefresh: () => void
}) {
  const pub  = games?.filter(g => g.visibility === 'public') ?? []
  const priv = games?.filter(g => g.visibility !== 'public') ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="spread">
        <div>
          <div className="h1">Game Builder</div>
          <div className="sub">Pro-code games powered by the Circle SDK — LLM-generate → paste → publish</div>
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
          Hit <b>New Game</b>, copy the starter prompt into Claude or ChatGPT, then paste the generated HTML back here.
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

function Section({ label, badge = 'pill-mut', children }: {
  label: string; badge?: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row"><span className={`pill ${badge}`}>{label}</span></div>
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
  const catKey = game.config?.category as string | undefined
  const cat    = PROMPT_CATEGORIES.find(c => c.key === catKey)

  return (
    <button
      className="card"
      onClick={onClick}
      style={{ padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', width: '100%' }}
    >
      <div style={{
        height: 76,
        background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4c1d95 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
      }}>
        {cat?.emoji ?? '🎮'}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {game.title || 'Untitled'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
          {cat ? `${cat.emoji} ${cat.label}` : 'Game'}
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

// ── Build View ─────────────────────────────────────────────────────────

type DeviceMode = 'iphone' | 'tablet' | 'desktop'

function BuildView({ meta, onChange, publishing, published, error, onPublish, onUnpublish, onBack, circles, selectedCircleId, onSelectCircle }: {
  meta: Meta
  onChange: (p: Partial<Meta>) => void
  publishing: boolean
  published: boolean
  error: string | null
  onPublish: () => void
  onUnpublish: () => void
  onBack: () => void
  circles: Circle[]
  selectedCircleId: string | null
  onSelectCircle: (id: string | null) => void
}) {
  const [copied, setCopied]   = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [device, setDevice]   = useState<DeviceMode>('desktop')
  const [circleData, setCircleData] = useState<Circle | null>(null)
  const v = validate(meta.html)
  const canPublish = !publishing && meta.title.trim().length > 0 && meta.html.trim().length > 0
  const activeCat  = PROMPT_CATEGORIES.find(c => c.key === meta.category)

  const copyPrompt = async () => {
    const suffix = activeCat
      ? `\n\nGame type to build: ${activeCat.label}\nKey elements: ${activeCat.hint}\n`
      : ''
    await navigator.clipboard.writeText(STARTER_PROMPT + suffix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  useEffect(() => {
    if (selectedCircleId) {
      live.getCircle(selectedCircleId).then(c => setCircleData(c))
    } else {
      setCircleData(null)
    }
  }, [selectedCircleId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div className="spread">
        <div className="row">
          <button className="chip" onClick={onBack} style={{ gap: 5 }}>
            <ArrowLeft size={13} /> Catalog
          </button>
          <div className="h1" style={{ margin: 0 }}>{meta.title || 'New Game'}</div>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          {circles.length > 0 && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--bd2)',
                  background: 'var(--bg)',
                  color: 'var(--tx)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={(e) => {
                  const menu = e.currentTarget.nextElementSibling as HTMLDivElement
                  menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
                }}
              >
                Circle: {selectedCircleId ? circles.find(c => c.id === selectedCircleId)?.name : 'Public'}
                <ChevronDown size={13} />
              </button>
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: 'var(--bg)',
                  border: '1px solid var(--bd)',
                  borderRadius: 8,
                  display: 'none',
                  zIndex: 10,
                  minWidth: 200,
                }}
              >
                <button
                  onClick={() => { onSelectCircle(null); (document.querySelector('[style*="position: absolute"]') as HTMLDivElement)?.setAttribute('style', 'display: none') }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    background: selectedCircleId === null ? 'var(--acc-soft)' : 'transparent',
                    color: selectedCircleId === null ? 'var(--acc-text)' : 'var(--tx)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Public (Global)
                </button>
                {circles.map(circle => (
                  <button
                    key={circle.id}
                    onClick={() => { onSelectCircle(circle.id); (document.querySelector('[style*="position: absolute"]') as HTMLDivElement)?.setAttribute('style', 'display: none') }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      background: selectedCircleId === circle.id ? 'var(--acc-soft)' : 'transparent',
                      color: selectedCircleId === circle.id ? 'var(--acc-text)' : 'var(--tx)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      borderTop: '1px solid var(--bd2)',
                    }}
                  >
                    {circle.emoji} {circle.name} ({circle.members?.length || 0})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="row">
          {published && (
            <button className="chip" onClick={onUnpublish} disabled={publishing} style={{ gap: 5, color: 'var(--tx2)' }}>
              <EyeOff size={13} /> Unpublish
            </button>
          )}
          <button
            className="chip"
            onClick={onPublish}
            disabled={!canPublish}
            style={{
              background:  published ? 'var(--ok-bg)' : canPublish ? 'var(--acc)' : 'var(--bg3)',
              color:       published ? 'var(--ok)'    : canPublish ? '#fff'        : 'var(--tx3)',
              borderColor: published ? 'var(--ok)'    : canPublish ? 'var(--acc)'  : 'var(--bd2)',
              gap: 5,
            }}
          >
            <Send size={13} />
            {publishing ? 'Publishing…' : published ? 'Live — update' : 'Publish to ArgantaLab'}
          </button>
        </div>
      </div>

      {published && (
        <div className="insight ok" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>✓</span>
          <div>
            <b>"{meta.title}"</b> is live{selectedCircleId && circleData ? ` in ${circleData.name}` : " in ArgantaLab's Discover tab"}. Kids can play it right now.
          </div>
        </div>
      )}

      {error && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>

        {/* ── Left: workflow ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Step 1: Category + Copy Prompt */}
          <div className="card" style={{ padding: 13 }}>
            <Label>Step 1 — Pick a category, then copy the starter prompt</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PROMPT_CATEGORIES.map(c => {
                const active = meta.category === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => onChange({ category: c.key })}
                    style={{
                      padding: '5px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--acc)' : 'var(--bd2)'}`,
                      background: active ? 'var(--acc-soft)' : 'var(--bg)',
                      color: active ? 'var(--acc-text)' : 'var(--tx2)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <span>{c.emoji}</span> {c.label}
                  </button>
                )
              })}
            </div>

            {activeCat && (
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 10, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 7 }}>
                {activeCat.hint}
              </div>
            )}

            <button
              onClick={copyPrompt}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                border: `1.5px solid ${copied ? '#22c55e' : 'var(--acc)'}`,
                background: copied ? 'rgba(34,197,94,0.1)' : 'var(--acc-soft)',
                color: copied ? '#22c55e' : 'var(--acc-text)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'border-color 0.2s, background 0.2s, color 0.2s',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied! Paste into Claude / ChatGPT →' : 'Copy Starter Prompt to Clipboard'}
            </button>
          </div>

          {/* Step 2: HTML Paste Zone */}
          <div className="card" style={{ padding: 13 }}>
            <Label>Step 2 — Paste the generated HTML</Label>
            <textarea
              value={meta.html}
              onChange={e => { onChange({ html: e.target.value }); setPreview(null) }}
              placeholder={`Paste your LLM-generated game HTML here...\n\nWorkflow:\n1. Copy the starter prompt above\n2. Open Claude or ChatGPT\n3. Paste the prompt + describe your game idea\n4. Copy the entire HTML output\n5. Paste here · click Run to test · then Publish`}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 240, padding: '10px 12px', borderRadius: 9,
                border: `1.5px solid ${
                  !meta.html      ? 'var(--bd2)'
                  : v.hasSDK      ? '#22c55e'
                  : '#f59e0b'
                }`,
                background: 'var(--bg)',
                fontFamily: '"Fira Code","Cascadia Code","JetBrains Mono",monospace',
                fontSize: 11.5, color: 'var(--tx)',
                resize: 'vertical', outline: 'none', lineHeight: 1.55,
                boxSizing: 'border-box',
              }}
            />
            {meta.html && !v.hasSDK && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={11} />
                No CircleGame SDK found — use the starter prompt so the game links to Circle.
              </div>
            )}
          </div>

          {/* Step 3: Metadata */}
          <div className="card" style={{ padding: 13 }}>
            <Label>Step 3 — Game details</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Field label="Title">
                <input
                  value={meta.title}
                  onChange={e => onChange({ title: e.target.value })}
                  placeholder="e.g. Neon Rivals Arena, Pixel Farm Quest…"
                  style={inputStyle}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={meta.description}
                  onChange={e => onChange({ description: e.target.value })}
                  placeholder="One line kids see in Discover — what's the game about?"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </Field>

              <Field label="Tags (comma-separated)">
                <input
                  value={meta.tags}
                  onChange={e => onChange({ tags: e.target.value })}
                  placeholder="space, shooter, multiplayer"
                  style={inputStyle}
                />
              </Field>

              <Field label="Age range">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={meta.ageMin}
                    onChange={e => onChange({ ageMin: e.target.value.replace(/\D/g, '') })}
                    placeholder="6"
                    inputMode="numeric"
                    style={{ ...inputStyle, width: 70, textAlign: 'center' }}
                  />
                  <span style={{ color: 'var(--tx3)', fontSize: 12 }}>to</span>
                  <input
                    value={meta.ageMax}
                    onChange={e => onChange({ ageMax: e.target.value.replace(/\D/g, '') })}
                    placeholder="12"
                    inputMode="numeric"
                    style={{ ...inputStyle, width: 70, textAlign: 'center' }}
                  />
                  <span style={{ color: 'var(--tx3)', fontSize: 12 }}>years</span>
                </div>
              </Field>
            </div>
          </div>
        </div>

        {/* ── Right: validate + preview ── */}
        <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* SDK validation */}
          {meta.html && (
            <div className="card" style={{ padding: 13 }}>
              <Label>SDK Check</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <VRow ok={v.hasSDK}   req label="Circle SDK"    note={v.hasSDK   ? 'window.CircleGame detected'         : 'Missing — use the starter prompt'} />
                <VRow ok={v.hasInit}  req={false} label="init() called"  note={v.hasInit  ? 'CircleGame.init() found'          : 'Add: await CircleGame.init() on boot'} />
                <VRow ok={v.hasScore} req={false} warn label="submitScore()" note={v.hasScore ? 'Leaderboard wired'                : 'Recommended — connects to Circle leaderboard'} />
              </div>
              {(v.three || v.gsap || v.pixi || v.howler) && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
                  {v.three  && <Lib label="Three.js" />}
                  {v.gsap   && <Lib label="GSAP" />}
                  {v.pixi   && <Lib label="PixiJS" />}
                  {v.howler && <Lib label="Howler" />}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--tx3)' }}>
                Size: <b style={{ color: v.size > 1000 ? '#f59e0b' : 'var(--tx2)' }}>{v.size} KB</b>
                {v.size > 1500 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>⚠ very large</span>}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--bd)',
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Gamepad2 size={14} color="var(--acc)" />
                <span style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.title || 'Live Preview'}
                </span>
              </div>
              <button
                onClick={() => setPreview(meta.html || null)}
                disabled={!meta.html}
                className="chip"
                style={{
                  gap: 4, padding: '4px 10px', fontSize: 11.5,
                  background:  meta.html ? 'var(--acc)' : 'var(--bg3)',
                  color:       meta.html ? '#fff'        : 'var(--tx3)',
                  borderColor: meta.html ? 'var(--acc)'  : 'var(--bd2)',
                }}
              >
                <Play size={11} fill={meta.html ? '#fff' : 'var(--tx3)'} /> Run
              </button>
            </div>

            {preview && (
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--bd)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {['iphone', 'tablet', 'desktop'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDevice(mode as DeviceMode)}
                    className="chip"
                    style={{
                      padding: '4px 8px', fontSize: 11, gap: 3,
                      background: device === mode ? 'var(--acc)' : 'transparent',
                      color: device === mode ? '#fff' : 'var(--tx2)',
                      borderColor: device === mode ? 'var(--acc)' : 'var(--bd2)',
                    }}
                  >
                    {mode === 'iphone' && <Smartphone size={11} />}
                    {mode === 'tablet' && <Tablet size={11} />}
                    {mode === 'desktop' && <Monitor size={11} />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            )}

            <div style={{
              flex: 1, background: '#05070f', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: preview ? 480 : 420, padding: preview ? 16 : 0,
            }}>
              {preview ? (
                <div style={{ display: 'flex', gap: 12, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Device Frame */}
                  <div style={{
                    position: 'relative',
                    height: '100%',
                    ...getDeviceFrameStyle(device),
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: '#fff',
                      borderRadius: device === 'iphone' ? '40px' : device === 'tablet' ? '24px' : '12px',
                      overflow: 'hidden',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    }}>
                      <iframe
                        key={preview.slice(0, 120)}
                        srcDoc={generatePreviewHTML(meta.html, circleData)}
                        sandbox="allow-scripts allow-pointer-lock"
                        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                        title="Game Preview"
                      />
                    </div>
                  </div>

                  {/* Audience Panel */}
                  {circleData && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
                      maxWidth: 200, overflowY: 'auto', paddingRight: 4,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)', marginBottom: 8 }}>AUDIENCE</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>
                          {circleData.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                          {circleData.members.length} {circleData.members.length === 1 ? 'member' : 'members'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {circleData.members.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: m.avatar ? `url(${m.avatar})` : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                              backgroundSize: 'cover', backgroundPosition: 'center',
                              border: '2px solid var(--bd)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 600, fontSize: 12,
                            }}>
                              {!m.avatar && m.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.name}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--tx3)' }}>
                                {m.kind === 'parent' ? '👨‍👩‍👧‍👦 Parent' : '👶 Child'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, color: 'rgba(255,255,255,0.3)', fontSize: 13,
                }}>
                  <Gamepad2 size={28} strokeWidth={1.5} />
                  <span style={{ textAlign: 'center' }}>
                    {meta.html ? 'Click Run to launch preview' : 'Paste HTML above, then click Run'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {preview && (
            <div style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center' }}>
              Preview with {circleData ? `${circleData.name} audience` : 'mock SDK'} · {device} frame · re-paste + Run to reload
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Device frames & SDK injection ──────────────────────────────────────

function getDeviceFrameStyle(device: DeviceMode): React.CSSProperties {
  switch (device) {
    case 'iphone':
      return { width: 280, aspectRatio: '9/19.5' }
    case 'tablet':
      return { width: 360, aspectRatio: '3/4' }
    case 'desktop':
      return { width: 480, aspectRatio: '16/9' }
  }
}

function generatePreviewHTML(gameHTML: string, circle: Circle | null): string {
  const mockUser = circle ? {
    id: 'user_demo',
    name: 'Demo Player',
    avatar: undefined,
    role: 'member' as const,
    circle_id: circle.id,
  } : {
    id: 'user_demo',
    name: 'Demo Player',
    avatar: undefined,
    role: 'member' as const,
    circle_id: 'circle_demo',
  }

  const mockCircle = circle ? {
    id: circle.id,
    name: circle.name,
    type: circle.kind as 'family' | 'kids' | 'class' | 'friends',
    members: circle.members.map(m => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar || undefined,
      kind: m.kind,
      role: m.role,
    })),
  } : {
    id: 'circle_demo',
    name: 'Demo Circle',
    type: 'family' as const,
    members: [{
      id: 'user_demo',
      name: 'Demo Player',
      avatar: undefined,
      kind: 'child' as const,
      role: 'member' as const,
    }],
  }

  const sdkCode = generateCircleAppSDKMock(mockUser, mockCircle)

  // Extract the closing body tag and inject SDK before it
  const hasBodyClose = gameHTML.includes('</body>')
  const htmlWithSDK = hasBodyClose
    ? gameHTML.replace('</body>', `<script>${sdkCode}</script></body>`)
    : `${gameHTML}<script>${sdkCode}</script>`

  return htmlWithSDK
}

// ── Micro-components ────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--tx3)', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--bd2)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}

function VRow({ ok, label, note, req, warn }: {
  ok: boolean; label: string; note: string; req: boolean; warn?: boolean
}) {
  const color = ok ? '#22c55e' : req ? '#ef4444' : warn ? '#f59e0b' : 'var(--tx3)'
  const bg    = ok ? 'rgba(34,197,94,0.12)' : req ? 'rgba(239,68,68,0.12)' : 'var(--bg3)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        minWidth: 18, height: 18, borderRadius: '50%', background: bg, color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
      }}>
        {ok ? '✓' : req ? '✗' : '○'}
      </span>
      <div style={{ fontSize: 12, lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, color: 'var(--tx)' }}>{label}</span>
        <span style={{ color: 'var(--tx3)', marginLeft: 6 }}>{note}</span>
      </div>
    </div>
  )
}

function Lib({ label }: { label: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 600,
      background: 'var(--acc-soft)', color: 'var(--acc-text)', border: '1px solid var(--acc)',
    }}>
      {label}
    </span>
  )
}

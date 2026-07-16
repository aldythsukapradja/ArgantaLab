// GB-5 + GB-6 · The Inspector — everything about the open artifact that isn't
// the conversation or the canvas. Five tabs, each one pane of a fixed-height
// column that scrolls internally.
//
// Versions · Blocks · Code · Ship
import { useState } from 'react'
import { History, Blocks as BlocksIcon, Code2, Rocket, Check, AlertTriangle, RotateCcw, Save, ExternalLink, Loader2, Info } from 'lucide-react'
import { restoreVersion, publishArtifact, publicArtifactUrl, type StoredVersion } from '../../builder-core/persist'
import { validateHtml } from '@arganta/builder'
import { live } from '../../data/live'
import { supabase } from '../../lib/supabase'
import { STAGES } from '../../data/curriculum'
import { blocksFor, insertBlock, hasBlock, type PortableBlock } from './blocks'
import type { ForgeState } from './useForge'
import type { Circle } from '../../data/live'

type Tab = 'versions' | 'blocks' | 'code' | 'ship'

const AGE_BANDS = [
  { key: 'everyone', label: 'Everyone', min: 0, max: 99 },
  ...STAGES.map((s) => ({ key: s.key, label: `${s.label} ${s.minAge}–${s.maxAge}`, min: s.minAge, max: s.maxAge })),
]

interface Props {
  state: ForgeState
  versions: StoredVersion[]
  circles: Circle[]
  onHtml: (html: string) => void
  onApplyVersion: (v: StoredVersion) => void
  onCheckpoint: () => Promise<boolean>
  onRefreshVersions: (id: string | null) => Promise<void>
}

export function Inspector({ state, versions, circles, onHtml, onApplyVersion, onCheckpoint, onRefreshVersions }: Props) {
  const [tab, setTab] = useState<Tab>('versions')
  const isGame = state.kind === 'game'

  const TABS: { id: Tab; label: string; Icon: typeof History }[] = [
    { id: 'versions', label: 'Versions', Icon: History },
    ...(isGame ? [] : [{ id: 'blocks' as Tab, label: 'Blocks', Icon: BlocksIcon }]),
    { id: 'code', label: 'Code', Icon: Code2 },
    { id: 'ship', label: 'Ship', Icon: Rocket },
  ]

  return (
    <div className="forge-inspector">
      <div className="forge-insp-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {label}
          </button>
        ))}
      </div>
      <div className="forge-insp-body">
        {tab === 'versions' && <VersionsPane state={state} versions={versions} onApplyVersion={onApplyVersion} onRefreshVersions={onRefreshVersions} />}
        {tab === 'blocks' && <BlocksPane state={state} onHtml={onHtml} />}
        {tab === 'code' && <CodePane state={state} onHtml={onHtml} onCheckpoint={onCheckpoint} />}
        {tab === 'ship' && <ShipPane state={state} circles={circles} />}
      </div>
    </div>
  )
}

// ── Versions ──────────────────────────────────────────────────────────────
function VersionsPane({ state, versions, onApplyVersion, onRefreshVersions }: {
  state: ForgeState; versions: StoredVersion[]
  onApplyVersion: (v: StoredVersion) => void
  onRefreshVersions: (id: string | null) => Promise<void>
}) {
  const [restoring, setRestoring] = useState<number | null>(null)

  const restore = async (v: StoredVersion) => {
    setRestoring(v.versionNumber)
    // Flip the server-side pointer first; only reflect it locally if it took.
    const ok = await restoreVersion(v.artifactId, v.versionNumber)
    if (ok) { onApplyVersion(v); await onRefreshVersions(v.artifactId) }
    setRestoring(null)
  }

  if (!state.persisted) {
    return (
      <div className="forge-check warn">
        <AlertTriangle size={13} />
        <span>Version history needs a Supabase connection. This artifact is real and usable, but it isn't saved — it lives only in this tab.</span>
      </div>
    )
  }
  if (!versions.length) {
    return <div className="forge-check"><Info size={13} /><span>No versions yet. Every build and revision saves one automatically.</span></div>
  }

  return (
    <>
      <h4>History · {versions.length} version{versions.length === 1 ? '' : 's'}</h4>
      {versions.map((v) => {
        const current = v.versionNumber === state.version
        const failed = (v.validation as any)?.ok === false
        return (
          <div key={v.id} className={'forge-row' + (current ? ' on' : '')}>
            <span style={{ minWidth: 0 }}>
              <span className="row" style={{ gap: 5 }}>
                <b>v{v.versionNumber}</b>
                {current && <span className="forge-pill on">Current</span>}
                {failed && <span className="forge-pill bad">Invalid</span>}
              </span>
              <span className="sub" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.instruction || (v.versionNumber === 1 ? 'First build' : 'Saved')}
              </span>
              <span className="sub">
                {v.provider ?? 'unknown'}{v.costUsd ? ` · $${v.costUsd.toFixed(4)}` : ''}
              </span>
            </span>
            {!current && (
              <button className="forge-btn" onClick={() => restore(v)} disabled={restoring != null} style={{ padding: '5px 9px', flexShrink: 0 }}>
                {restoring === v.versionNumber ? <Loader2 size={12} className="spin" /> : <RotateCcw size={12} />}
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}

// ── Blocks ────────────────────────────────────────────────────────────────
function BlocksPane({ state, onHtml }: { state: ForgeState; onHtml: (html: string) => void }) {
  const available = blocksFor(state.kind)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const add = (b: PortableBlock) => {
    onHtml(insertBlock(state.html, b))
    setJustAdded(b.id)
    setTimeout(() => setJustAdded(null), 1600)
  }

  if (!state.html) return <div className="forge-check"><Info size={13} /><span>Build something first — then drop blocks into it.</span></div>
  if (!available.length) {
    return (
      <div className="forge-check">
        <Info size={13} />
        <span>The block library is page furniture — navs, heroes, tables, charts. None of it belongs in a game, so there's nothing to offer here. Ask the chat for game features instead.</span>
      </div>
    )
  }

  const byCategory = available.reduce<Record<string, PortableBlock[]>>((acc, b) => {
    ;(acc[b.category] ||= []).push(b)
    return acc
  }, {})

  return (
    <>
      <div className="forge-check">
        <Info size={13} />
        <span>Blocks append to the end of the document with their styles. Move them where you want in the Code tab, or just ask the chat.</span>
      </div>
      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h4>{cat}</h4>
          {list.map((b) => {
            const already = hasBlock(state.html, b.id)
            return (
              <button key={b.id} className="forge-row" onClick={() => add(b)} title={b.description}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{b.name}</span>
                  <span className="sub" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.description}</span>
                </span>
                <span className="forge-pill" style={{ flexShrink: 0 }}>
                  {justAdded === b.id ? <><Check size={11} /> Added</> : already ? 'Add again' : 'Add'}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}

// ── Code ──────────────────────────────────────────────────────────────────
function CodePane({ state, onHtml, onCheckpoint }: {
  state: ForgeState; onHtml: (html: string) => void; onCheckpoint: () => Promise<boolean>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    const ok = await onCheckpoint()
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  if (!state.html) return <div className="forge-check"><Info size={13} /><span>Build something first — its source lands here, fully editable.</span></div>

  return (
    <>
      <div className="spread">
        <h4>Source · {Math.round(state.html.length / 1024)} KB</h4>
        <button className="forge-btn" onClick={save} disabled={saving || !state.persisted} style={{ padding: '4px 9px', fontSize: 11 }}
          title={state.persisted ? 'Save the current source as a new version' : 'Needs a Supabase connection'}>
          {saving ? <Loader2 size={11} className="spin" /> : saved ? <Check size={11} /> : <Save size={11} />}
          {saved ? 'Saved' : 'Checkpoint'}
        </button>
      </div>
      <textarea
        className="forge-code"
        value={state.html}
        onChange={(e) => onHtml(e.target.value)}
        spellCheck={false}
        aria-label="Artifact source"
      />
      <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
        Edits show on the canvas as you type. Checkpoint saves them as a version — otherwise the next chat revision builds on them anyway.
      </span>
    </>
  )
}

// ── Ship (GB-6) ───────────────────────────────────────────────────────────
function ShipPane({ state, circles }: { state: ForgeState; circles: Circle[] }) {
  const [circleId, setCircleId] = useState<string | null>(null)
  const [featured, setFeatured] = useState(false)
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [busy, setBusy] = useState<'catalogue' | 'web' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalogued, setCatalogued] = useState(false)
  const [webUrl, setWebUrl] = useState<string | null>(null)

  const v = state.html ? validateHtml(state.html, { kind: state.kind }) : null
  const isGame = state.kind === 'game'

  if (!state.html) return <div className="forge-check"><Info size={13} /><span>Nothing to ship yet.</span></div>

  const publishCatalogue = async () => {
    setError(null)
    if (!state.title.trim()) { setError('Give it a name in the header first.'); return }
    if (isGame && (!ageMin || !ageMax)) { setError('Pick an age group — it drives age-appropriate analytics and content design.'); return }
    setBusy('catalogue')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sign in to publish.'); setBusy(null); return }

    const id = state.artifactId ?? crypto.randomUUID()
    const visibility = circleId ? 'circle' : 'public'
    let ok = false
    if (isGame) {
      ok = await live.publishGame({
        id, title: state.title, html: state.html, userId: session.user.id,
        category: state.genre ?? undefined,
        description: description.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        ageMin: ageMin ? parseInt(ageMin, 10) : null,
        ageMax: ageMax ? parseInt(ageMax, 10) : null,
        visibility, circle_ids: circleId ? [circleId] : undefined, featured,
      })
    } else {
      ok = await live.saveApp({
        id, name: state.title, product: 'kinetik',
        category: state.kind === 'website' ? 'website' : null, status: 'live',
        html: state.html, description: description.trim() || null,
        visibility, circle_ids: circleId ? [circleId] : undefined, featured,
      })
    }
    if (ok) setCatalogued(true)
    else setError('Publish failed — check the Supabase connection.')
    setBusy(null)
  }

  // The ONE outside-world action (ADR-0005). Never fired from the chat rail —
  // it is a deliberate human click, behind an explicit confirm, and the HTML is
  // re-validated here even though the RPC and the public Worker both check again.
  const publishWeb = async () => {
    setError(null)
    if (!state.artifactId) { setError('This artifact is not saved, so it cannot be published to the web.'); return }
    if (!v?.ok) { setError('Publishing is blocked — the artifact fails validation. See the checks above.'); return }
    if (!confirm(`Publish "${state.title}" to the public internet at build.arganta.app? Anyone with the link will be able to open it.`)) return
    setBusy('web')
    const slug = await publishArtifact(state.artifactId, state.version)
    if (slug) setWebUrl(publicArtifactUrl(state.kind, slug))
    else setError('Publish failed — check the Supabase connection.')
    setBusy(null)
  }

  return (
    <>
      <h4>Validation</h4>
      {v?.errors.length ? v.errors.map((e: any) => (
        <div key={e.id} className="forge-check err"><AlertTriangle size={13} /><span>{e.message}</span></div>
      )) : (
        <div className="forge-check ok"><Check size={13} /><span>Passes every safety and structure check.</span></div>
      )}
      {v?.warnings.map((w: any) => (
        <div key={w.id} className="forge-check warn"><AlertTriangle size={13} /><span>{w.message}</span></div>
      ))}

      <h4 style={{ marginTop: 4 }}>Details</h4>
      <div className="forge-field">
        <label htmlFor="forge-desc">Description</label>
        <textarea id="forge-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line for the catalogue" />
      </div>
      {isGame && (
        <>
          <div className="forge-field">
            <label htmlFor="forge-tags">Tags</label>
            <input id="forge-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="space, shooter, fast" />
          </div>
          <div className="forge-field">
            <label>Age group <span style={{ color: 'var(--bad)' }}>required</span></label>
            <div className="forge-chips">
              {AGE_BANDS.map((b) => {
                const on = ageMin === String(b.min) && ageMax === String(b.max)
                return (
                  <button key={b.key} className={'forge-chip' + (on ? ' on' : '')} onClick={() => { setAgeMin(String(b.min)); setAgeMax(String(b.max)) }}>
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
      <div className="forge-field">
        <label htmlFor="forge-circle">Circle scope</label>
        <select id="forge-circle" value={circleId ?? ''} onChange={(e) => setCircleId(e.target.value || null)}>
          <option value="">Public (all of ArgantaLab)</option>
          {circles.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <button className={'forge-chip' + (featured ? ' on' : '')} onClick={() => setFeatured(!featured)} style={{ alignSelf: 'flex-start' }}>
        {featured ? '★ Featured candidate' : '☆ Mark as featured candidate'}
      </button>

      {error && <div className="forge-check err"><AlertTriangle size={13} /><span>{error}</span></div>}

      <h4 style={{ marginTop: 4 }}>Publish</h4>
      <button className="forge-btn primary" onClick={publishCatalogue} disabled={busy != null} style={{ justifyContent: 'center' }}>
        {busy === 'catalogue' ? <Loader2 size={13} className="spin" /> : catalogued ? <Check size={13} /> : <Rocket size={13} />}
        {catalogued ? 'Live in the catalogue — update' : `Publish to ${isGame ? 'ArgantaLab' : 'Kinetik'}`}
      </button>
      <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
        Puts it in the {isGame ? 'games' : 'apps'} catalogue for {circleId ? 'that circle' : 'everyone on ArgantaLab'}.
      </span>

      <button className="forge-btn" onClick={publishWeb} disabled={busy != null || !state.artifactId} style={{ justifyContent: 'center' }}>
        {busy === 'web' ? <Loader2 size={13} className="spin" /> : <ExternalLink size={13} />}
        Publish to the web
      </button>
      <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
        Serves v{state.version} at a public build.arganta.app link. Asks you to confirm first.
      </span>
      {webUrl && (
        <div className="forge-check ok">
          <Check size={13} />
          <span>Live at <a href={webUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{webUrl.replace('https://', '')}</a></span>
        </div>
      )}
    </>
  )
}

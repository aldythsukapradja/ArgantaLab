import { useState, useMemo, useEffect } from 'react'
import { ArrowLeft, Copy, Check, Send, AlertTriangle, Star } from 'lucide-react'
import { useHQ } from '../../../shell/store'
import { supabase } from '../../../lib/supabase'
import { live } from '../../../data/live'
import { builderConfig } from '../config'
import type { Kind } from '../artifact'
import type { BuilderData } from '../useBuilderData'
import { Stepper, type Step } from '../shared/Stepper'
import { DeviceCanvas, type DeviceMode } from '../shared/DeviceCanvas'
import { Field, inputStyle } from '../shared/ui'

interface Meta {
  title: string
  description: string
  tags: string
  ageMin: string
  ageMax: string
  source: string
  html: string
  circleId: string | null
  featured: boolean
}

const empty = (): Meta => ({
  title: '', description: '', tags: '', ageMin: '', ageMax: '',
  source: '', html: '', circleId: null, featured: false,
})

export function StudioPage({ kind, data }: { kind: Kind; data: BuilderData }) {
  const cfg = builderConfig(kind)
  const { studioId, setBuilderSub } = useHQ()
  const { byId, circles, user, reload } = data

  const [meta, setMeta] = useState<Meta>(empty())
  const [active, setActive] = useState('source')
  const [running, setRunning] = useState(false)
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate from existing artifact (edit), default circle to first.
  useEffect(() => {
    const a = studioId ? byId.get(studioId) : null
    if (a) {
      setMeta({
        title: a.title, description: a.description, tags: '', ageMin: '', ageMax: '',
        source: a.category ?? '', html: a.html, circleId: null, featured: a.featured,
      })
      setPublished(a.visibility === 'public')
      if (a.html) { setActive('code'); setRunning(true) }
    } else {
      setMeta(m => ({ ...m, circleId: circles[0]?.id ?? null }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId, byId, circles.length])

  const set = (p: Partial<Meta>) => { setMeta(m => ({ ...m, ...p })); setPublished(false) }
  const selectedCircle = useMemo(() => circles.find(c => c.id === meta.circleId) ?? null, [circles, meta.circleId])
  const hasSDK = new RegExp(cfg.sdkGlobal).test(meta.html)
  const sourceOpt = cfg.sources.find(s => s.key === meta.source)

  const copyPrompt = async () => {
    const text = sourceOpt?.prompt ?? cfg.sources[0]?.prompt ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2400)
  }

  const publish = async () => {
    if (!meta.html.trim()) { setError('Paste the generated HTML first.'); setActive('code'); return }
    if (!meta.title.trim()) { setError(`Give your ${cfg.noun.toLowerCase()} a title.`); setActive('details'); return }
    setPublishing(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sign in to publish.'); setPublishing(false); return }
    const id = studioId ?? crypto.randomUUID()
    const visibility = meta.circleId ? 'circle' : 'public'

    let ok = false
    if (kind === 'game') {
      ok = await live.publishGame({
        id, title: meta.title, html: meta.html, userId: session.user.id,
        category: meta.source || undefined,
        description: meta.description.trim() || undefined,
        tags: meta.tags.split(',').map(t => t.trim()).filter(Boolean),
        ageMin: meta.ageMin ? parseInt(meta.ageMin, 10) : null,
        ageMax: meta.ageMax ? parseInt(meta.ageMax, 10) : null,
        visibility, circle_ids: meta.circleId ? [meta.circleId] : undefined,
        featured: meta.featured,
      })
    } else {
      ok = await live.saveApp({
        id, name: meta.title, product: 'kinetik',
        category: meta.source || null, status: 'live',
        html: meta.html, description: meta.description.trim() || null,
        visibility, circle_ids: meta.circleId ? [meta.circleId] : undefined,
        featured: meta.featured,
      })
    }
    if (ok) { setPublished(true); reload() }
    else setError('Publish failed — check Supabase connection.')
    setPublishing(false)
  }

  const steps: Step[] = [
    {
      id: 'source', title: `Pick a ${cfg.sourceLabel.toLowerCase()}`,
      hint: `Choose a starting point, then copy its prompt`,
      done: !!meta.source,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cfg.sources.map(s => (
              <button
                key={s.key} onClick={() => set({ source: s.key })}
                style={{
                  padding: '5px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                  border: `1.5px solid ${meta.source === s.key ? 'var(--acc)' : 'var(--bd2)'}`,
                  background: meta.source === s.key ? 'var(--acc-soft)' : 'var(--bg)',
                  color: meta.source === s.key ? 'var(--acc-text)' : 'var(--tx2)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span>{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>
          {sourceOpt && (
            <div style={{ fontSize: 11, color: 'var(--tx3)', padding: '6px 10px', background: 'var(--bg2)', borderRadius: 7 }}>
              {sourceOpt.hint}
            </div>
          )}
          <button
            onClick={copyPrompt}
            style={{
              padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${copied ? '#22c55e' : 'var(--acc)'}`,
              background: copied ? 'rgba(34,197,94,.1)' : 'var(--acc-soft)',
              color: copied ? '#22c55e' : 'var(--acc-text)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied! Paste into Claude / ChatGPT →' : `Copy ${cfg.noun} Prompt`}
          </button>
        </div>
      ),
    },
    {
      id: 'code', title: 'Paste the generated HTML',
      hint: meta.html ? `${Math.round(meta.html.length / 1024)} KB` : 'Paste the single-file HTML output',
      done: meta.html.trim().length > 0,
      status: meta.html ? (hasSDK ? 'ok' : 'warn') : undefined,
      render: () => (
        <div>
          <textarea
            value={meta.html}
            onChange={e => { set({ html: e.target.value }); setRunning(false) }}
            placeholder={`Paste the complete HTML here.\n\n1. Copy the prompt above\n2. Generate in Claude / ChatGPT\n3. Paste the full output here\n4. Press Run on the canvas →`}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 220, padding: '10px 12px', borderRadius: 9,
              border: `1.5px solid ${!meta.html ? 'var(--bd2)' : hasSDK ? '#22c55e' : '#f59e0b'}`,
              background: 'var(--bg)', fontFamily: 'var(--mono)', fontSize: 11.5,
              color: 'var(--tx)', resize: 'vertical', outline: 'none', lineHeight: 1.55, boxSizing: 'border-box',
            }}
          />
          {meta.html && !hasSDK && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} /> No {cfg.sdkGlobal} SDK detected — use the prompt so it links to the circle.
            </div>
          )}
          {meta.html && (
            <button className="chip" style={{ marginTop: 8, gap: 5 }} onClick={() => setRunning(true)}>
              ▶ Run in canvas
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'details', title: `${cfg.noun} details`,
      hint: 'Title, description, discovery metadata',
      done: meta.title.trim().length > 0,
      status: meta.title ? 'ok' : undefined,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Title">
            <input value={meta.title} onChange={e => set({ title: e.target.value })}
              placeholder={kind === 'game' ? 'e.g. Neon Rivals Arena' : 'e.g. Family Grocery'} style={inputStyle} />
          </Field>
          <Field label="Description">
            <textarea value={meta.description} onChange={e => set({ description: e.target.value })}
              placeholder="One line shown in the catalogue" rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
          {kind === 'game' && (
            <>
              <Field label="Tags (comma-separated)">
                <input value={meta.tags} onChange={e => set({ tags: e.target.value })}
                  placeholder="space, shooter, multiplayer" style={inputStyle} />
              </Field>
              <Field label="Age range">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input value={meta.ageMin} onChange={e => set({ ageMin: e.target.value.replace(/\D/g, '') })}
                    placeholder="6" inputMode="numeric" style={{ ...inputStyle, width: 70, textAlign: 'center' }} />
                  <span style={{ color: 'var(--tx3)', fontSize: 12 }}>to</span>
                  <input value={meta.ageMax} onChange={e => set({ ageMax: e.target.value.replace(/\D/g, '') })}
                    placeholder="12" inputMode="numeric" style={{ ...inputStyle, width: 70, textAlign: 'center' }} />
                  <span style={{ color: 'var(--tx3)', fontSize: 12 }}>years</span>
                </div>
              </Field>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'publish', title: 'Scope & publish',
      hint: 'Choose audience, feature, go live',
      done: published,
      status: published ? 'ok' : undefined,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Circle scope">
            <select
              value={meta.circleId ?? ''} onChange={e => set({ circleId: e.target.value || null })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Public (Global — all of ArgantaLab)</option>
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name} ({c.members.length})</option>
              ))}
            </select>
          </Field>

          <button
            onClick={() => set({ featured: !meta.featured })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${meta.featured ? 'var(--acc)' : 'var(--bd2)'}`,
              background: meta.featured ? 'var(--acc-soft)' : 'var(--bg)',
              color: meta.featured ? 'var(--acc-text)' : 'var(--tx2)', fontSize: 12.5, textAlign: 'left',
            }}
          >
            <Star size={15} fill={meta.featured ? 'currentColor' : 'none'} />
            <div>
              <div style={{ fontWeight: 600 }}>{meta.featured ? 'Marked as featured candidate' : 'Mark as featured candidate'}</div>
              <div style={{ fontSize: 11, opacity: .8 }}>Final featured slate is ranked by Analytics</div>
            </div>
          </button>

          {error && (
            <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
              <AlertTriangle size={14} /> <div>{error}</div>
            </div>
          )}
          {published && (
            <div className="insight ok" style={{ borderRadius: 'var(--r-md)' }}>
              <Check size={14} />
              <div><b>"{meta.title}"</b> is live{selectedCircle ? ` in ${selectedCircle.name}` : ' across ArgantaLab'}. HTML saved to Supabase.</div>
            </div>
          )}

          <button
            onClick={publish} disabled={publishing}
            className="chip"
            style={{
              justifyContent: 'center', padding: '11px', fontSize: 13, fontWeight: 600, gap: 6,
              background: published ? 'var(--ok-bg)' : 'var(--acc)',
              color: published ? 'var(--ok)' : '#fff',
              borderColor: published ? 'var(--ok)' : 'var(--acc)',
            }}
          >
            <Send size={14} />
            {publishing ? 'Publishing…' : published ? 'Live — update' : cfg.publishVerb}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread">
        <div className="row">
          <button className="chip" onClick={() => setBuilderSub('catalogue')} style={{ gap: 5 }}>
            <ArrowLeft size={13} /> Catalogue
          </button>
          <div className="h1" style={{ margin: 0 }}>{meta.title || `New ${cfg.noun}`}</div>
          {published && <span className="pill pill-ok">Live</span>}
        </div>
      </div>

      {/* Drawer + Canvas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 16 }}>
          <Stepper steps={steps} active={active} onActivate={setActive} />
        </div>

        <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Circle quick-switch above the canvas (mirrors publish scope) */}
          {circles.length > 0 && (
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Preview as</span>
              <select
                value={meta.circleId ?? ''} onChange={e => set({ circleId: e.target.value || null })}
                style={{ ...inputStyle, width: 'auto', padding: '6px 10px', cursor: 'pointer' }}
              >
                <option value="">Public (mock)</option>
                {circles.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
          )}
          <DeviceCanvas
            kind={kind} title={meta.title || `New ${cfg.noun}`} html={meta.html}
            running={running && !!meta.html} device={device} circle={selectedCircle} user={user}
            onRun={() => setRunning(true)} onDevice={setDevice}
          />
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Copy, Check, Send, Play, Archive, Pencil, AlertTriangle, Star } from 'lucide-react'
import { useHQ } from '../../../shell/store'
import { supabase } from '../../../lib/supabase'
import { live } from '../../../data/live'
import { builderConfig } from '../config'
import type { Kind } from '../artifact'
import type { BuilderData } from '../useBuilderData'
import { Stepper, type Step } from '../shared/Stepper'
import { DeviceCanvas, type DeviceMode } from '../shared/DeviceCanvas'
import { Field, ReqBadge, inputStyle } from '../shared/ui'
import { STAGES } from '../../../data/curriculum'

// Age classification pills: Everyone + the ArgantaLab stage age groups.
const AGE_BANDS = [
  { key: 'everyone', label: 'Everyone', min: 0, max: 99 },
  ...STAGES.map(s => ({ key: s.key, label: `${s.label} ${s.minAge}–${s.maxAge}`, min: s.minAge, max: s.maxAge })),
]
const ageLabelOf = (min: string, max: string) =>
  AGE_BANDS.find(b => String(b.min) === min && String(b.max) === max)?.label ?? (min && max ? `${min}–${max}` : '—')

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
      // Public view first — the operator opts into a circle scope explicitly.
      setMeta(m => ({ ...m, circleId: null }))
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
    if (!meta.source) { setError('Pick a category — it classifies the game for Analytics & Discover.'); setActive('source'); return }
    if (!meta.html.trim()) { setError('Paste the generated HTML first.'); setActive('code'); return }
    if (!meta.title.trim()) { setError(`Give your ${cfg.noun.toLowerCase()} a title.`); setActive('details'); return }
    if (kind === 'game' && (!meta.ageMin || !meta.ageMax)) { setError('Pick an age group — it drives age-appropriate analytics & content design.'); setActive('details'); return }
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

  const archive = async () => {
    if (!studioId) return
    if (!confirm(`Archive "${meta.title || `this ${cfg.noun.toLowerCase()}`}"? It's hidden from the catalogue but stays recoverable in Drafts.`)) return
    const ok = await live.archiveArtifact(kind, studioId)
    if (ok) { reload(); setBuilderSub('catalogue') }
    else setError('Archive failed — check Supabase connection.')
  }

  const steps: Step[] = [
    {
      id: 'source', title: `Pick a ${cfg.sourceLabel.toLowerCase()}`,
      hint: `Choose a starting point, then copy its prompt`,
      done: !!meta.source,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <ReqBadge />
            <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Classifies the {cfg.noun.toLowerCase()} for Analytics, Discover &amp; content design</span>
          </div>
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
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
            Use <b style={{ color: 'var(--acc-text)' }}>Copy {cfg.noun.toLowerCase()} prompt</b> above, generate in Claude / ChatGPT, then paste the HTML in step 2.
          </div>
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
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--tx3)' }}>
              Press <b style={{ color: 'var(--acc-text)' }}>Run preview</b> above to launch it on the canvas →
            </div>
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
          <Field label="Title" required hint="shown everywhere">
            <input value={meta.title} onChange={e => set({ title: e.target.value })}
              placeholder={kind === 'game' ? 'e.g. Neon Rivals Arena' : 'e.g. Family Grocery'} style={inputStyle} />
          </Field>
          <Field label="Description" hint="recommended — catalogue blurb">
            <textarea value={meta.description} onChange={e => set({ description: e.target.value })}
              placeholder="One line shown in the catalogue" rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
          {kind === 'game' && (
            <>
              <Field label="Tags" hint="recommended — powers Discover & similarity">
                <input value={meta.tags} onChange={e => set({ tags: e.target.value })}
                  placeholder="space, shooter, multiplayer" style={inputStyle} />
              </Field>
              <Field label="Age group" required hint="age-appropriate analytics & content">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {AGE_BANDS.map(b => {
                    const on = meta.ageMin === String(b.min) && meta.ageMax === String(b.max)
                    return (
                      <button key={b.key} type="button"
                        onClick={() => set({ ageMin: String(b.min), ageMax: String(b.max) })}
                        style={{
                          padding: '5px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                          border: `1.5px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
                          background: on ? 'var(--acc-soft)' : 'var(--bg)',
                          color: on ? 'var(--acc-text)' : 'var(--tx2)',
                        }}>
                        {b.label}
                      </button>
                    )
                  })}
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
          {(() => {
            const rows = [
              { label: 'Category', req: true, ok: !!meta.source, val: sourceOpt?.label ?? '—' },
              { label: 'Title', req: true, ok: !!meta.title.trim(), val: meta.title || '—' },
              ...(kind === 'game' ? [{ label: 'Age group', req: true, ok: !!(meta.ageMin && meta.ageMax), val: ageLabelOf(meta.ageMin, meta.ageMax) }] : []),
              { label: 'Tags', req: false, ok: !!meta.tags.trim(), val: meta.tags || '—' },
              { label: 'Description', req: false, ok: !!meta.description.trim(), val: meta.description || '—' },
            ]
            return (
              <div style={{ border: '1px solid var(--bd2)', borderRadius: 'var(--r-md)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'var(--tx3)' }}>CLASSIFICATION · powers Analytics, Discover &amp; content design</div>
                {rows.map(r => (
                  <div key={r.label} className="spread" style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.ok ? <Check size={12} style={{ color: 'var(--ok)' }} /> : <span style={{ color: r.req ? 'var(--bad)' : 'var(--tx3)' }}>○</span>}
                      {r.label}
                      {!r.ok && <span style={{ fontSize: 10, color: r.req ? 'var(--bad)' : 'var(--tx3)' }}>{r.req ? 'required' : 'optional'}</span>}
                    </span>
                    <span style={{ color: 'var(--tx)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.val}</span>
                  </div>
                ))}
              </div>
            )
          })()}
          <Field label="Circle scope">
            <select
              value={meta.circleId ?? ''} onChange={e => set({ circleId: e.target.value || null })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Public (Global — all of ArgantaLab)</option>
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name} · {c.members.length} {c.members.length === 1 ? 'member' : 'members'}</option>
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
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
            Review the scope, then <b style={{ color: 'var(--acc-text)' }}>{cfg.publishVerb}</b> from the bar above or below.
          </div>
        </div>
      ),
    },
  ]

  // Linear step navigation + the single contextual primary action per step.
  const order = steps.map(s => s.id)
  const idx = order.indexOf(active)
  const goNext = () => { if (idx < order.length - 1) setActive(order[idx + 1]) }
  const goPrev = () => { if (idx > 0) setActive(order[idx - 1]) }

  const primary =
    active === 'source' ? { label: copied ? 'Copied — paste into Claude' : `Copy ${cfg.noun.toLowerCase()} prompt`, Icon: copied ? Check : Copy, on: copyPrompt, disabled: false } :
    active === 'code'   ? { label: running ? 'Reload preview' : 'Run preview', Icon: Play, on: () => setRunning(true), disabled: !meta.html } :
    active === 'details'? { label: 'Continue', Icon: ArrowRight, on: goNext, disabled: false } :
                          { label: publishing ? 'Publishing…' : published ? 'Live — update' : cfg.publishVerb, Icon: Send, on: publish, disabled: publishing }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
      {/* Header strip — title · progress · contextual primary action */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="row" style={{ gap: 7 }}>
            <input
              className="title-edit"
              value={meta.title}
              onChange={e => set({ title: e.target.value })}
              placeholder={`Name this ${cfg.noun.toLowerCase()}…`}
              aria-label={`${cfg.noun} name`}
              style={{ width: `${Math.max(10, (meta.title || `Name this ${cfg.noun.toLowerCase()}…`).length + 1)}ch` }}
            />
            <Pencil size={12} style={{ color: 'var(--tx3)', flexShrink: 0 }} />
            <span className="pill pill-mut">{cfg.noun}</span>
            {published && <span className="pill pill-ok">Live</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
            Step {idx + 1} of {order.length} · {steps[idx].title}
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          {studioId && (
            <button className="chip" onClick={archive} title={`Archive ${cfg.noun.toLowerCase()}`} style={{ gap: 5, color: 'var(--amb)' }}>
              <Archive size={13} /> Archive
            </button>
          )}
          <div className="row" style={{ gap: 4 }}>
            {order.map((id, i) => (
              <span key={id} style={{ width: 24, height: 5, borderRadius: 3, background: i <= idx ? 'var(--acc)' : 'var(--bd2)', transition: 'background .16s' }} />
            ))}
          </div>
          <button
            onClick={primary.on} disabled={primary.disabled} className="chip"
            style={{
              gap: 6, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
              background: primary.disabled ? 'var(--bg3)' : 'var(--acc)',
              color: primary.disabled ? 'var(--tx3)' : '#fff',
              borderColor: primary.disabled ? 'var(--bd2)' : 'var(--acc)',
            }}
          >
            <primary.Icon size={14} /> {primary.label}
          </button>
        </div>
      </div>

      {/* Wizard + Canvas — equal-height panes fill the workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: 14, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        {/* Left: glass wizard with pinned step nav */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <Stepper steps={steps} active={active} onActivate={setActive} />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '11px 14px', borderTop: '1px solid var(--glass-bd)' }}>
            <button className="chip" onClick={goPrev} disabled={idx === 0} style={{ gap: 5, opacity: idx === 0 ? 0.45 : 1 }}>
              <ArrowLeft size={13} /> Back
            </button>
            {idx < order.length - 1 ? (
              <button className="chip" onClick={goNext} style={{ gap: 5, fontWeight: 600, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}>
                Continue <ArrowRight size={13} />
              </button>
            ) : (
              <button className="chip" onClick={publish} disabled={publishing}
                style={{ gap: 5, fontWeight: 600, background: published ? 'var(--ok-bg)' : 'var(--acc)', color: published ? 'var(--ok)' : '#fff', borderColor: published ? 'var(--ok)' : 'var(--acc)' }}>
                <Send size={13} /> {publishing ? 'Publishing…' : published ? 'Update' : cfg.publishVerb}
              </button>
            )}
          </div>
        </div>

        {/* Right: floating device preview */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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

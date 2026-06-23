import { useState, useEffect, useCallback } from 'react'
import { Plus, ArrowLeft, RefreshCw, Save, Boxes } from 'lucide-react'
import { live, type AppManifest } from '../data/live'
import { cloudEnabled } from '../lib/supabase'
import { Empty, Loading } from '../components/Empty'

type View = 'catalog' | 'build'

const PRODUCTS = [
  { key: 'arganta', label: 'ArgantaLab', emoji: '🎓' },
  { key: 'kinetik', label: 'KinetikCircle', emoji: '🔗' },
  { key: 'circle',  label: 'Circle HQ', emoji: '🛰️' },
]
const STATUSES = ['planned', 'beta', 'live']
const AUDIENCES = ['kids', 'teens', 'parents', 'educators', 'operators']
const CIRCLE_TYPES = ['family', 'kids', 'class', 'friends']

interface Form {
  id: string
  name: string
  product: string
  category: string
  status: string
  owner: string
  audience: string[]
  circle_types: string[]
  metrics: string
  agent_surfaces: string
}

const emptyForm = (): Form => ({
  id: '', name: '', product: 'kinetik', category: '', status: 'planned',
  owner: '', audience: [], circle_types: [], metrics: '', agent_surfaces: '',
})

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function AppBuilder() {
  const [view, setView]    = useState<View>('catalog')
  const [apps, setApps]    = useState<AppManifest[] | undefined>(undefined)
  const [form, setForm]    = useState<Form>(emptyForm())
  const [editing, setEdit] = useState(false)
  const [saving, setSave]  = useState(false)
  const [saved, setSaved]  = useState(false)
  const [error, setErr]    = useState<string | null>(null)

  const load = useCallback(() => {
    setApps(undefined)
    live.listApps().then(a => setApps(a))
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setForm(emptyForm()); setEdit(false); setSaved(false); setErr(null); setView('build')
  }

  const openEdit = (a: AppManifest) => {
    setForm({
      id: a.id, name: a.name, product: a.product,
      category: a.category ?? '', status: a.status ?? 'planned', owner: a.owner ?? '',
      audience: a.audience ?? [], circle_types: a.circle_types ?? [],
      metrics: (a.metrics ?? []).join(', '),
      agent_surfaces: (a.agent_surfaces ?? []).join(', '),
    })
    setEdit(true); setSaved(false); setErr(null); setView('build')
  }

  const save = async () => {
    if (!form.name.trim()) { setErr('Give the app a name.'); return }
    setSave(true); setErr(null)
    const id = form.id || slugify(form.name)
    const ok = await live.saveApp({
      id, name: form.name.trim(), product: form.product,
      category: form.category.trim() || null, status: form.status,
      owner: form.owner.trim() || null,
      audience: form.audience, circle_types: form.circle_types,
      metrics: form.metrics.split(',').map(s => s.trim()).filter(Boolean),
      agent_surfaces: form.agent_surfaces.split(',').map(s => s.trim()).filter(Boolean),
    })
    if (ok) { setForm(f => ({ ...f, id })); setEdit(true); setSaved(true); load() }
    else setErr('Save failed — check Supabase connection and operator role.')
    setSave(false)
  }

  if (view === 'catalog') {
    return <Catalog apps={apps} onNew={openNew} onEdit={openEdit} onRefresh={load} />
  }
  return (
    <BuildForm
      form={form} editing={editing} saving={saving} saved={saved} error={error}
      onChange={p => { setForm(f => ({ ...f, ...p })); setSaved(false) }}
      onSave={save} onBack={() => setView('catalog')}
    />
  )
}

// ── Catalog ─────────────────────────────────────────────────────────────

function Catalog({ apps, onNew, onEdit, onRefresh }: {
  apps: AppManifest[] | undefined
  onNew: () => void
  onEdit: (a: AppManifest) => void
  onRefresh: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="spread">
        <div>
          <div className="h1">App Builder</div>
          <div className="sub">Register KinetikCircle-native apps — they auto-appear in Portfolio</div>
        </div>
        <div className="row">
          <button className="chip" onClick={onRefresh} title="Refresh"><RefreshCw size={13} /></button>
          <button
            className="chip"
            style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)', gap: 6 }}
            onClick={onNew}
          >
            <Plus size={13} /> New App
          </button>
        </div>
      </div>

      {!cloudEnabled && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>Connect Supabase to register app manifests. They populate the Portfolio surface.</div>
        </div>
      )}

      {apps === undefined && <Loading label="Loading app registry…" />}

      {apps !== undefined && apps.length === 0 && (
        <Empty icon={<Boxes />} title="No apps registered yet">
          Hit <b>New App</b> to define an AppManifest — name, product, audience, and the metrics it reports.
        </Empty>
      )}

      {apps && apps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {apps.map(a => <AppCard key={a.id} app={a} onClick={() => onEdit(a)} />)}
        </div>
      )}
    </div>
  )
}

function AppCard({ app, onClick }: { app: AppManifest; onClick: () => void }) {
  const prod = PRODUCTS.find(p => p.key === app.product)
  const statusColor = app.status === 'live' ? 'var(--ok)' : app.status === 'beta' ? 'var(--acc)' : 'var(--tx3)'
  return (
    <button
      className="card"
      onClick={onClick}
      style={{ padding: 14, cursor: 'pointer', textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 22 }}>{prod?.emoji ?? '📦'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{prod?.label ?? app.product}{app.category ? ` · ${app.category}` : ''}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, fontSize: 11 }}>
        <span style={{ color: statusColor }}>● {app.status ?? 'planned'}</span>
        {(app.metrics?.length ?? 0) > 0 && <span style={{ color: 'var(--tx3)' }}>· {app.metrics!.length} metrics</span>}
      </div>
    </button>
  )
}

// ── Build form ──────────────────────────────────────────────────────────

function BuildForm({ form, editing, saving, saved, error, onChange, onSave, onBack }: {
  form: Form
  editing: boolean
  saving: boolean
  saved: boolean
  error: string | null
  onChange: (p: Partial<Form>) => void
  onSave: () => void
  onBack: () => void
}) {
  const toggle = (field: 'audience' | 'circle_types', val: string) => {
    const cur = form[field]
    onChange({ [field]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] } as Partial<Form>)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread">
        <div className="row">
          <button className="chip" onClick={onBack} style={{ gap: 5 }}><ArrowLeft size={13} /> Apps</button>
          <div className="h1" style={{ margin: 0 }}>{form.name || 'New App'}</div>
        </div>
        <button
          className="chip"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          style={{
            background: saved ? 'var(--ok-bg)' : form.name.trim() ? 'var(--acc)' : 'var(--bg3)',
            color: saved ? 'var(--ok)' : form.name.trim() ? '#fff' : 'var(--tx3)',
            borderColor: saved ? 'var(--ok)' : form.name.trim() ? 'var(--acc)' : 'var(--bd2)',
            gap: 5,
          }}
        >
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved — update' : editing ? 'Update App' : 'Register App'}
        </button>
      </div>

      {saved && (
        <div className="insight ok" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>✓</span>
          <div><b>{form.name}</b> is registered. It appears in the Portfolio surface.</div>
        </div>
      )}
      {error && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>⚠️</span><div>{error}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>

        {/* Identity */}
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Identity</SectionLabel>
          <Field label="App name">
            <input value={form.name} onChange={e => onChange({ name: e.target.value })}
              placeholder="e.g. Plan Studio, Memory Wall" style={inputStyle} />
          </Field>
          <Field label="Product">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {PRODUCTS.map(p => (
                <Pill key={p.key} on={form.product === p.key} onClick={() => onChange({ product: p.key })}>
                  {p.emoji} {p.label}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label="Category">
            <input value={form.category} onChange={e => onChange({ category: e.target.value })}
              placeholder="e.g. planning, social, memory" style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Status">
              <div className="row" style={{ gap: 6 }}>
                {STATUSES.map(s => (
                  <Pill key={s} on={form.status === s} onClick={() => onChange({ status: s })}>{s}</Pill>
                ))}
              </div>
            </Field>
            <Field label="Owner">
              <input value={form.owner} onChange={e => onChange({ owner: e.target.value })}
                placeholder="team or person" style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Reach + contracts */}
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Reach &amp; contracts</SectionLabel>
          <Field label="Audience">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {AUDIENCES.map(a => (
                <Pill key={a} on={form.audience.includes(a)} onClick={() => toggle('audience', a)}>{a}</Pill>
              ))}
            </div>
          </Field>
          <Field label="Circle types">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {CIRCLE_TYPES.map(c => (
                <Pill key={c} on={form.circle_types.includes(c)} onClick={() => toggle('circle_types', c)}>{c}</Pill>
              ))}
            </div>
          </Field>
          <Field label="Metrics it reports (comma-separated)">
            <input value={form.metrics} onChange={e => onChange({ metrics: e.target.value })}
              placeholder="plans_created, moments, members_active" style={inputStyle} />
          </Field>
          <Field label="Agent surfaces (comma-separated)">
            <input value={form.agent_surfaces} onChange={e => onChange({ agent_surfaces: e.target.value })}
              placeholder="planner, reminder, summarizer" style={inputStyle} />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ── Micro-components ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--bd2)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--tx3)',
    }}>{children}</div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
        border: `1.5px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
        background: on ? 'var(--acc-soft)' : 'var(--bg)',
        color: on ? 'var(--acc-text)' : 'var(--tx2)',
        textTransform: 'capitalize',
      }}
    >
      {children}
    </button>
  )
}

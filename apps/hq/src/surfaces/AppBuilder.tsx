import { useState, useEffect, useCallback } from 'react'
import {
  Plus, ArrowLeft, RefreshCw, Save, Boxes,
  ChevronDown, Copy, Check, Play, AlertTriangle,
  Smartphone, Tablet, Monitor,
} from 'lucide-react'
import { live, type Circle } from '../data/live'
import { APP_TEMPLATES, type AppTemplate } from '../data/appTemplates'
import { generateCircleAppSDKMock } from '../data/circleAppSDK'
import { cloudEnabled } from '../lib/supabase'
import { Empty, Loading } from '../components/Empty'

type View = 'catalog' | 'build'
type BuildStep = 'template' | 'code' | 'manifest'
type DeviceMode = 'iphone' | 'tablet' | 'desktop'

interface AppForm {
  id: string
  name: string
  product: string
  category: string
  html: string
  audience: string[]
  circle_types: string[]
  metrics: string[]
  agent_surfaces: string[]
  status: string
  owner: string
}

const emptyForm = (): AppForm => ({
  id: '', name: '', product: 'kinetik', category: '', html: '',
  audience: [], circle_types: [], metrics: [], agent_surfaces: [],
  status: 'live', owner: '',
})

const PRODUCTS = [
  { key: 'arganta', label: 'ArgantaLab', emoji: '🎓' },
  { key: 'kinetik', label: 'KinetikCircle', emoji: '🔗' },
]
const STATUSES = ['planned', 'beta', 'live']
const AUDIENCES = ['kids', 'teens', 'parents', 'educators']
const CIRCLE_TYPES = ['family', 'kids', 'class', 'friends']

export function AppBuilder() {
  const [view, setView] = useState<View>('catalog')
  const [apps, setApps] = useState<AppForm[] | undefined>(undefined)
  const [step, setStep] = useState<BuildStep>('template')
  const [form, setForm] = useState<AppForm>(emptyForm())
  const [selectedTemplate, setTemplate] = useState<AppTemplate | null>(null)
  const [saving, setSave] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setErr] = useState<string | null>(null)
  const [circles, setCircles] = useState<Circle[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [circleData, setCircleData] = useState<Circle | null>(null)

  const load = useCallback(() => {
    setApps(undefined)
    live.listApps().then(a => setApps(a as AppForm[]))
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

  useEffect(() => {
    if (selectedCircleId) {
      live.getCircle(selectedCircleId).then(c => setCircleData(c))
    } else {
      setCircleData(null)
    }
  }, [selectedCircleId])

  const openNew = () => {
    setForm(emptyForm())
    setTemplate(null)
    setStep('template')
    setSaved(false)
    setErr(null)
    setView('build')
  }

  const selectTemplate = (t: AppTemplate) => {
    setTemplate(t)
    const newForm = emptyForm()
    newForm.name = t.name
    newForm.product = 'kinetik'
    newForm.category = t.defaultManifest.category
    newForm.audience = t.defaultManifest.audience
    newForm.circle_types = t.defaultManifest.circle_types
    newForm.metrics = t.defaultManifest.suggested_metrics
    newForm.agent_surfaces = t.defaultManifest.suggested_agents
    setForm(newForm)
    setStep('code')
  }

  const copyPrompt = async () => {
    if (!selectedTemplate) return
    await navigator.clipboard.writeText(selectedTemplate.prompt)
  }

  const inferMetrics = (html: string): string[] => {
    const metrics = new Set<string>()
    const emitPattern = /CircleApp\.emit\(['"]([^'"]+)['"]/g
    let match
    while ((match = emitPattern.exec(html)) !== null) {
      metrics.add(match[1])
    }
    return Array.from(metrics)
  }

  const inferAgents = (html: string): string[] => {
    const agents = new Set<string>()
    const agentPattern = /CircleApp\.agent\(['"]([^'"]+)['"]/g
    let match
    while ((match = agentPattern.exec(html)) !== null) {
      agents.add(match[1])
    }
    return Array.from(agents)
  }

  const proceedToManifest = () => {
    if (!form.html.trim()) {
      setErr('Paste the app HTML first.')
      return
    }
    const inferred = {
      metrics: inferMetrics(form.html),
      agent_surfaces: inferAgents(form.html),
    }
    setForm(f => ({
      ...f,
      metrics: inferred.metrics.length > 0 ? inferred.metrics : f.metrics,
      agent_surfaces: inferred.agent_surfaces.length > 0 ? inferred.agent_surfaces : f.agent_surfaces,
    }))
    setStep('manifest')
  }

  const save = async () => {
    if (!form.name.trim()) {
      setErr('Give the app a name.')
      return
    }
    if (!form.html.trim()) {
      setErr('Paste app HTML.')
      return
    }
    setSave(true)
    setErr(null)
    const id = form.id || form.name.toLowerCase().replace(/\s+/g, '-')
    const ok = await live.saveApp({
      id,
      name: form.name.trim(),
      product: form.product,
      category: form.category || null,
      status: form.status,
      owner: form.owner || null,
      audience: form.audience,
      circle_types: form.circle_types,
      metrics: form.metrics,
      agent_surfaces: form.agent_surfaces,
    })
    if (ok) {
      setForm(f => ({ ...f, id }))
      setSaved(true)
      load()
    } else {
      setErr('Save failed — check Supabase connection.')
    }
    setSave(false)
  }

  if (view === 'catalog') {
    return <CatalogView apps={apps} onNew={openNew} onRefresh={load} />
  }

  return (
    <BuildView
      step={step}
      form={form}
      selectedTemplate={selectedTemplate}
      saving={saving}
      saved={saved}
      error={error}
      circles={circles}
      selectedCircleId={selectedCircleId}
      preview={preview}
      device={device}
      circleData={circleData}
      onChange={p => { setForm(f => ({ ...f, ...p })); setSaved(false) }}
      onSelectTemplate={selectTemplate}
      onCopyPrompt={copyPrompt}
      onProceedToManifest={proceedToManifest}
      onSelectCircle={setSelectedCircleId}
      onSetPreview={setPreview}
      onSetDevice={setDevice}
      onSave={save}
      onBack={() => setView('catalog')}
      onBackToStep={(s: BuildStep) => setStep(s)}
    />
  )
}

// ── Catalog ─────────────────────────────────────────────────────────────

function CatalogView({ apps, onNew, onRefresh }: {
  apps: AppForm[] | undefined
  onNew: () => void
  onRefresh: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="spread">
        <div>
          <div className="h1">App Builder</div>
          <div className="sub">Create KinetikCircle-native apps from templates — they auto-appear in Portfolio</div>
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
          Hit <b>New App</b> to pick a template, paste your code, then register the app.
        </Empty>
      )}

      {apps && apps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {apps.map(a => <AppCard key={a.id} app={a} />)}
        </div>
      )}
    </div>
  )
}

function AppCard({ app }: { app: AppForm }) {
  const prod = PRODUCTS.find(p => p.key === app.product)
  const statusColor = app.status === 'live' ? 'var(--ok)' : app.status === 'beta' ? 'var(--acc)' : 'var(--tx3)'
  return (
    <div
      className="card"
      style={{ padding: 14, textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 22 }}>{prod?.emoji ?? '📦'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {app.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
            {prod?.label ?? app.product}{app.category ? ` · ${app.category}` : ''}
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, fontSize: 11 }}>
        <span style={{ color: statusColor }}>● {app.status ?? 'live'}</span>
        {(app.metrics?.length ?? 0) > 0 && <span style={{ color: 'var(--tx3)' }}>· {app.metrics!.length} metrics</span>}
      </div>
    </div>
  )
}

// ── Build View ──────────────────────────────────────────────────────────

type BuildViewProps = {
  step: BuildStep
  form: AppForm
  selectedTemplate: AppTemplate | null
  saving: boolean
  saved: boolean
  error: string | null
  circles: Circle[]
  selectedCircleId: string | null
  preview: string | null
  device: DeviceMode
  circleData: Circle | null
  onChange: (p: Partial<AppForm>) => void
  onSelectTemplate: (t: AppTemplate) => void
  onCopyPrompt: () => void
  onProceedToManifest: () => void
  onSelectCircle: (id: string | null) => void
  onSetPreview: (html: string | null) => void
  onSetDevice: (mode: DeviceMode) => void
  onSave: () => void
  onBack: () => void
  onBackToStep: (s: BuildStep) => void
}

function BuildView(props: BuildViewProps) {
  const {
    step, form, selectedTemplate, saving, saved, error, circles, selectedCircleId,
    preview, device, circleData, onChange, onSelectTemplate, onCopyPrompt, onProceedToManifest,
    onSelectCircle, onSetPreview, onSetDevice, onSave, onBack, onBackToStep,
  } = props

  if (step === 'template') {
    return <TemplateStep onSelect={onSelectTemplate} onBack={onBack} />
  }

  if (step === 'code') {
    return (
      <CodeStep
        form={form}
        selectedTemplate={selectedTemplate}
        preview={preview}
        device={device}
        circleData={circleData}
        onChange={onChange}
        onCopyPrompt={onCopyPrompt}
        onSetPreview={onSetPreview}
        onSetDevice={onSetDevice}
        onProceed={onProceedToManifest}
        onBack={onBack}
      />
    )
  }

  return (
    <ManifestStep
      form={form}
      saving={saving}
      saved={saved}
      error={error}
      circles={circles}
      selectedCircleId={selectedCircleId}
      onChange={onChange}
      onSelectCircle={onSelectCircle}
      onSave={onSave}
      onBack={() => onBackToStep('code')}
    />
  )
}

// ── Step 1: Template Selection ──────────────────────────────────────────

function TemplateStep({ onSelect, onBack }: {
  onSelect: (t: AppTemplate) => void
  onBack: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="chip" onClick={onBack} style={{ gap: 5 }}>
          <ArrowLeft size={13} /> Apps
        </button>
        <div className="h1" style={{ margin: 0 }}>Pick a Template</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {APP_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="card"
            style={{
              padding: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
              display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 24 }}>{t.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{t.name}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.5 }}>
              {t.description}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 4 }}>
              {t.defaultManifest.suggested_metrics.length} metrics · {t.defaultManifest.suggested_agents.length} agents
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Step 2: Code ────────────────────────────────────────────────────────

type CodeStepProps = {
  form: AppForm
  selectedTemplate: AppTemplate | null
  preview: string | null
  device: DeviceMode
  circleData: Circle | null
  onChange: (p: Partial<AppForm>) => void
  onCopyPrompt: () => void
  onSetPreview: (html: string | null) => void
  onSetDevice: (mode: DeviceMode) => void
  onProceed: () => void
  onBack: () => void
}

function CodeStep(props: CodeStepProps) {
  const { form, selectedTemplate, preview, device, circleData, onChange, onCopyPrompt, onSetPreview, onSetDevice, onProceed, onBack } = props
  const [copied, setCopied] = useState(false)
  const [errors, setErrs] = useState<string | null>(null)

  useEffect(() => {
    if (copied) {
      setTimeout(() => setCopied(false), 2500)
    }
  }, [copied])

  const hasSDK = /CircleApp/.test(form.html)

  const handleCopyPrompt = async () => {
    await onCopyPrompt()
    setCopied(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread">
        <div className="row">
          <button className="chip" onClick={onBack} style={{ gap: 5 }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div className="h1" style={{ margin: 0 }}>{selectedTemplate?.name || 'New App'}</div>
        </div>
        <button
          className="chip"
          onClick={onProceed}
          disabled={!form.html.trim() || !hasSDK}
          style={{
            background: form.html && hasSDK ? 'var(--acc)' : 'var(--bg3)',
            color: form.html && hasSDK ? '#fff' : 'var(--tx3)',
            borderColor: form.html && hasSDK ? 'var(--acc)' : 'var(--bd2)',
            gap: 5,
          }}
        >
          <ChevronDown size={13} /> Next — Review
        </button>
      </div>

      {errors && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <div>{errors}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* Left: Code Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ padding: 13 }}>
            <Label>Step 1 — Copy the template prompt</Label>
            <button
              onClick={handleCopyPrompt}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                border: `1.5px solid ${copied ? '#22c55e' : 'var(--acc)'}`,
                background: copied ? 'rgba(34,197,94,0.1)' : 'var(--acc-soft)',
                color: copied ? '#22c55e' : 'var(--acc-text)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied! Paste into Claude / ChatGPT →' : 'Copy Template Prompt'}
            </button>
          </div>

          <div className="card" style={{ padding: 13 }}>
            <Label>Step 2 — Paste the generated HTML</Label>
            <textarea
              value={form.html}
              onChange={e => { onChange({ html: e.target.value }); setErrs(null) }}
              placeholder={`Paste your app HTML here...\n\n1. Copy prompt above\n2. Open Claude\n3. Paste + describe your idea\n4. Copy generated HTML\n5. Paste here · click Run to preview`}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 300, padding: '10px 12px', borderRadius: 9,
                border: `1.5px solid ${
                  !form.html ? 'var(--bd2)'
                  : hasSDK ? '#22c55e'
                  : '#f59e0b'
                }`,
                background: 'var(--bg)',
                fontFamily: '"Fira Code","Cascadia Code","JetBrains Mono",monospace',
                fontSize: 11.5, color: 'var(--tx)',
                resize: 'vertical', outline: 'none', lineHeight: 1.55,
                boxSizing: 'border-box',
              }}
            />
            {form.html && !hasSDK && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={11} />
                No CircleApp SDK found — use the template prompt.
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--bd)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>Live Preview</span>
              <button
                onClick={() => onSetPreview(form.html || null)}
                disabled={!form.html}
                className="chip"
                style={{
                  gap: 4, padding: '4px 10px', fontSize: 11.5,
                  background: form.html ? 'var(--acc)' : 'var(--bg3)',
                  color: form.html ? '#fff' : 'var(--tx3)',
                  borderColor: form.html ? 'var(--acc)' : 'var(--bd2)',
                }}
              >
                <Play size={11} fill={form.html ? '#fff' : 'var(--tx3)'} /> Run
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
                    onClick={() => onSetDevice(mode as DeviceMode)}
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
                        key={form.html.slice(0, 120)}
                        srcDoc={generatePreviewHTML(form.html, circleData)}
                        sandbox="allow-scripts allow-pointer-lock"
                        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                        title="App Preview"
                      />
                    </div>
                  </div>

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
                  <Boxes size={28} strokeWidth={1.5} />
                  <span style={{ textAlign: 'center' }}>
                    {form.html ? 'Click Run to launch preview' : 'Paste HTML above, then click Run'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {preview && (
            <div style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center' }}>
              Preview with {circleData ? `${circleData.name} audience` : 'mock SDK'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Manifest ────────────────────────────────────────────────────

type ManifestStepProps = {
  form: AppForm
  saving: boolean
  saved: boolean
  error: string | null
  circles: Circle[]
  selectedCircleId: string | null
  onChange: (p: Partial<AppForm>) => void
  onSelectCircle: (id: string | null) => void
  onSave: () => void
  onBack: () => void
}

function ManifestStep(props: ManifestStepProps) {
  const { form, saving, saved, error, circles, selectedCircleId, onChange, onSelectCircle, onSave, onBack } = props

  const toggle = (field: 'audience' | 'circle_types', val: string) => {
    const cur = form[field]
    onChange({ [field]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] })
  }

  const toggleMetric = (metric: string) => {
    const cur = form.metrics
    onChange({ metrics: cur.includes(metric) ? cur.filter(m => m !== metric) : [...cur, metric] })
  }

  const toggleAgent = (agent: string) => {
    const cur = form.agent_surfaces
    onChange({ agent_surfaces: cur.includes(agent) ? cur.filter(a => a !== agent) : [...cur, agent] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread">
        <div className="row">
          <button className="chip" onClick={onBack} style={{ gap: 5 }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div className="h1" style={{ margin: 0 }}>{form.name}</div>
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
          {saving ? 'Saving…' : saved ? 'Saved — update' : 'Register App'}
        </button>
      </div>

      {saved && (
        <div className="insight ok" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>✓</span>
          <div><b>{form.name}</b> is registered. It appears in the Portfolio surface{selectedCircleId ? ' for this circle' : ''}.</div>
        </div>
      )}

      {error && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
        {/* Identity + Scope */}
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Identity</SectionLabel>
          <Field label="App name">
            <input
              value={form.name}
              onChange={e => onChange({ name: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Category">
            <input
              value={form.category}
              onChange={e => onChange({ category: e.target.value })}
              placeholder="e.g. planning, social, memory"
              style={inputStyle}
            />
          </Field>
          <Field label="Product">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {PRODUCTS.map(p => (
                <Pill
                  key={p.key}
                  on={form.product === p.key}
                  onClick={() => onChange({ product: p.key })}
                >
                  {p.emoji} {p.label}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label="Status">
            <div className="row" style={{ gap: 6 }}>
              {STATUSES.map(s => (
                <Pill key={s} on={form.status === s} onClick={() => onChange({ status: s })}>
                  {s}
                </Pill>
              ))}
            </div>
          </Field>

          {circles.length > 0 && (
            <Field label="Scope">
              <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                <button
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--bd2)', background: 'var(--bg)',
                    color: 'var(--tx)', fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between',
                  }}
                  onClick={(e) => {
                    const menu = e.currentTarget.nextElementSibling as HTMLDivElement
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
                  }}
                >
                  {selectedCircleId ? circles.find(c => c.id === selectedCircleId)?.name : 'Public'}
                  <ChevronDown size={13} />
                </button>
                <div
                  style={{
                    position: 'absolute',
                    top: '100%', right: 0, marginTop: 4,
                    background: 'var(--bg)', border: '1px solid var(--bd)',
                    borderRadius: 8, display: 'none', zIndex: 10, minWidth: '100%',
                  }}
                >
                  <button
                    onClick={() => { onSelectCircle(null); (document.activeElement as HTMLElement)?.blur() }}
                    style={{
                      width: '100%', padding: '10px 12px', border: 'none',
                      background: selectedCircleId === null ? 'var(--acc-soft)' : 'transparent',
                      color: selectedCircleId === null ? 'var(--acc-text)' : 'var(--tx)',
                      textAlign: 'left', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    Public (Global)
                  </button>
                  {circles.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onSelectCircle(c.id); (document.activeElement as HTMLElement)?.blur() }}
                      style={{
                        width: '100%', padding: '10px 12px', border: 'none',
                        background: selectedCircleId === c.id ? 'var(--acc-soft)' : 'transparent',
                        color: selectedCircleId === c.id ? 'var(--acc-text)' : 'var(--tx)',
                        textAlign: 'left', cursor: 'pointer', fontSize: 13,
                        borderTop: '1px solid var(--bd2)',
                      }}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          )}
        </div>

        {/* Audience + Contracts */}
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Audience &amp; Reach</SectionLabel>
          <Field label="Audience">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {AUDIENCES.map(a => (
                <Pill key={a} on={form.audience.includes(a)} onClick={() => toggle('audience', a)}>
                  {a}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label="Circle types">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {CIRCLE_TYPES.map(c => (
                <Pill key={c} on={form.circle_types.includes(c)} onClick={() => toggle('circle_types', c)}>
                  {c}
                </Pill>
              ))}
            </div>
          </Field>
        </div>

        {/* Metrics & Agents */}
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Metrics &amp; Agents</SectionLabel>
          {form.metrics.length > 0 && (
            <Field label={`Metrics (${form.metrics.length})`}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {form.metrics.map(m => (
                  <Pill key={m} on onClick={() => toggleMetric(m)}>
                    {m}
                  </Pill>
                ))}
              </div>
            </Field>
          )}
          {form.agent_surfaces.length > 0 && (
            <Field label={`Agents (${form.agent_surfaces.length})`}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {form.agent_surfaces.map(a => (
                  <Pill key={a} on onClick={() => toggleAgent(a)}>
                    {a}
                  </Pill>
                ))}
              </div>
            </Field>
          )}
          {form.metrics.length === 0 && form.agent_surfaces.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
              No metrics or agents detected in the HTML. Add CircleApp.emit() and CircleApp.agent() calls to your code.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

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

function generatePreviewHTML(appHTML: string, circle: Circle | null): string {
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

  const hasBodyClose = appHTML.includes('</body>')
  return hasBodyClose
    ? appHTML.replace('</body>', `<script>${sdkCode}</script></body>`)
    : `${appHTML}<script>${sdkCode}</script>`
}

// ── Micro-components ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--bd2)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: 'var(--tx3)', marginBottom: 8,
    }}>
      {children}
    </div>
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

function Pill({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
        border: `1px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
        background: on ? 'var(--acc-soft)' : 'transparent',
        color: on ? 'var(--acc-text)' : 'var(--tx2)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

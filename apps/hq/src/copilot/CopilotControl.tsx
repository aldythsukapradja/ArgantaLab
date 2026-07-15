import { useEffect, useMemo, useState } from 'react'
import { Check, Hand, Mic2, Play, Plus, RefreshCw, RotateCcw, Trash2, Volume2 } from 'lucide-react'
import { supabase, cloudEnabled } from '../lib/supabase'
import { surfaceLabel, type SurfaceId } from '../shell/store'
import { SEED_ROWS, type CommandCategory, type ActionKind } from './intents'
import { speakBrowser } from '../lib/tts/tts'
import { regenerateReplyAudio, generateReplyAudio } from './generateReplies'
import { useCopilotStore } from './store'
import { DEFAULT_GESTURE_SETTINGS } from './useGesture'
import './copilot.css'

// ─────────────────────────────────────────────────────────────────────────
// CopilotControl — the "copilot" surface. A CRUD console over
// hq_voice_command: edit phrases/label/category/action/reply/voice per
// command, preview + regenerate replies, add/remove commands, and a live
// coverage map of which surfaces voice can actually reach.
//
// Requires operator auth to WRITE (RLS on hq_voice_command); read works for
// anyone. Offline (cloudEnabled=false) shows the seed set read-only.
// ─────────────────────────────────────────────────────────────────────────

interface DbRow {
  id: string
  intent_id: string
  category: CommandCategory
  label: string
  phrases: string[]
  reply_text: string
  reply_voice: 'JM' | 'KF'
  action_kind: ActionKind
  action_arg: string | null
  reply_audio_path: string | null
  enabled: boolean
  sort: number
}

const ACTION_KINDS: ActionKind[] = [
  'go', 'openProduct', 'openPalette', 'toggleTheme', 'toggleAgent',
  'playCinema', 'close', 'refresh', 'disarm', 'help',
  'goOffice', 'openDataTab', 'openBuilderSub', 'setProductView',
]
const CATEGORIES: CommandCategory[] = ['navigate', 'product', 'control', 'system']
const ALL_SURFACES: SurfaceId[] = [
  'home', 'portfolio', 'data', 'growth', 'content', 'game', 'app', 'agents',
  'broadcast', 'command', 'pixel', 'vault', 'architecture', 'battle', 'character',
  'world', 'music', 'video', 'media', 'knowledge', 'cinema', 'reactor', 'rack', 'core',
]

function blankRow(sort: number): DbRow {
  return {
    id: `new-${Date.now()}`, intent_id: '', category: 'navigate', label: '',
    phrases: [], reply_text: '', reply_voice: 'JM', action_kind: 'go', action_arg: null,
    reply_audio_path: null, enabled: true, sort,
  }
}

export function CopilotControl() {
  const [rows, setRows] = useState<DbRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [genBusy, setGenBusy] = useState(false)
  const [genNote, setGenNote] = useState('')
  const reloadRegistry = useCopilotStore(s => s.reloadRegistry)

  const load = async () => {
    if (!cloudEnabled) {
      // No DB — show the built-in seed set read-only, so the coverage map and
      // command list stay honest about what's actually working right now.
      setRows(SEED_ROWS.map((r, i) => ({
        id: `seed-${r.id}`, intent_id: r.id, category: r.category, label: r.label,
        phrases: r.phrases, reply_text: r.reply, reply_voice: 'JM', action_kind: r.actionKind,
        action_arg: r.actionArg ?? null, reply_audio_path: null, enabled: true, sort: i,
      })))
      return
    }
    const { data, error } = await supabase
      .from('hq_voice_command')
      .select('id, intent_id, category, label, phrases, reply_text, reply_voice, action_kind, action_arg, reply_audio_path, enabled, sort')
      .order('sort', { ascending: true })
    if (error) { setError(error.message); setRows([]); return }
    setRows((data ?? []) as DbRow[])
  }
  useEffect(() => { void load() }, [])

  const updateLocal = (id: string, patch: Partial<DbRow>) => {
    setRows(prev => prev?.map(r => (r.id === id ? { ...r, ...patch } : r)) ?? prev)
  }

  const save = async (row: DbRow) => {
    if (!row.intent_id.trim() || !row.label.trim()) { setError('Command needs an id and a label.'); return }
    setSavingId(row.id); setError(null)
    const payload = {
      intent_id: row.intent_id.trim(), category: row.category, label: row.label,
      phrases: row.phrases, reply_text: row.reply_text, reply_voice: row.reply_voice,
      action_kind: row.action_kind, action_arg: row.action_arg || null,
      enabled: row.enabled, sort: row.sort,
    }
    const isNew = row.id.startsWith('new-')
    const { error } = isNew
      ? await supabase.from('hq_voice_command').insert(payload)
      : await supabase.from('hq_voice_command').update(payload).eq('id', row.id)
    setSavingId(null)
    if (error) { setError(error.message); return }
    reloadRegistry()
    await load()
  }

  const remove = async (row: DbRow) => {
    if (row.id.startsWith('new-')) { setRows(prev => prev?.filter(r => r.id !== row.id) ?? prev); return }
    if (!confirm(`Delete "${row.label}"? This can't be undone.`)) return
    const { error } = await supabase.from('hq_voice_command').delete().eq('id', row.id)
    if (error) { setError(error.message); return }
    reloadRegistry()
    await load()
  }

  const preview = (row: DbRow) => { void speakBrowser(row.reply_text || row.label, row.reply_voice) }

  const regenerate = async (row: DbRow) => {
    setSavingId(row.id)
    const result = await regenerateReplyAudio(row.intent_id)
    setSavingId(null)
    if (!result.ok) { setError(`Regenerate failed: ${result.error}`); return }
    reloadRegistry()
    await load()
  }

  const generateAll = async () => {
    setGenBusy(true); setGenNote('Starting…')
    const result = await generateReplyAudio((done, total, label) => setGenNote(`${done}/${total} · ${label}`))
    setGenBusy(false)
    setGenNote(`${result.generated} generated · ${result.skipped} skipped · ${result.failed} failed`)
    reloadRegistry()
    await load()
  }

  const addRow = () => {
    const nextSort = Math.max(0, ...(rows ?? []).map(r => r.sort)) + 10
    setRows(prev => [...(prev ?? []), blankRow(nextSort)])
  }

  const coverage = useMemo(() => {
    const reachable = new Set(
      (rows ?? []).filter(r => r.action_kind === 'go' && r.action_arg).map(r => r.action_arg as SurfaceId),
    )
    return ALL_SURFACES.map(id => ({ id, label: surfaceLabel(id), reachable: reachable.has(id) }))
  }, [rows])

  if (rows === null) return <div className="sub">Loading command registry…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread">
        <div>
          <div className="h1"><Mic2 size={18} style={{ verticalAlign: -3, marginRight: 8 }} />Copilot control</div>
          <div className="sub">
            Voice &amp; gesture commands — {rows.length} command{rows.length === 1 ? '' : 's'}
            {!cloudEnabled && ' · offline: read-only seed set'}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {cloudEnabled && (
            <button className="cp-ctrl-btn" onClick={generateAll} disabled={genBusy}>
              <Volume2 size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
              {genBusy ? genNote : 'Generate all replies'}
            </button>
          )}
          <button className="cp-ctrl-btn" onClick={addRow} disabled={!cloudEnabled}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Add command
          </button>
        </div>
      </div>

      {error && <div className="pill pill-warn" style={{ alignSelf: 'flex-start' }}>{error}</div>}

      <GestureTuningPanel />
      <CoverageMap items={coverage} />

      <div className="cp-ctrl-table">
        <div className="cp-ctrl-head">
          <span>On</span><span>Category</span><span>Label</span><span>Phrases</span>
          <span>Action</span><span>Arg</span><span>Reply</span><span>Voice</span><span /><span />
        </div>
        {rows.map(row => (
          <CommandRowEditor
            key={row.id} row={row} saving={savingId === row.id}
            onChange={patch => updateLocal(row.id, patch)}
            onSave={() => save(row)} onDelete={() => remove(row)}
            onPreview={() => preview(row)} onRegenerate={() => regenerate(row)} />
        ))}
      </div>
    </div>
  )
}

// Honest subset: there are only two real gestures (swipe, pinch), so this
// tunes their sensitivity/timing rather than pretending gestures can be
// remapped to arbitrary commands like voice phrases can.
function GestureTuningPanel() {
  const settings = useCopilotStore(s => s.gestureSettings)
  const setSettings = useCopilotStore(s => s.setGestureSettings)

  return (
    <div className="cp-coverage">
      <div className="cp-coverage-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span><Hand size={12} style={{ verticalAlign: -2, marginRight: 6 }} />Gesture tuning</span>
        <button className="cp-ctrl-icon" onClick={() => setSettings(DEFAULT_GESTURE_SETTINGS)} title="Reset to defaults" aria-label="Reset gesture settings">
          <RotateCcw size={12} />
        </button>
      </div>
      <div className="cp-tune-grid">
        <label className="cp-tune-toggle">
          <input type="checkbox" checked={settings.swipeEnabled} onChange={e => setSettings({ swipeEnabled: e.target.checked })} />
          Swipe (cycle products / views)
        </label>
        <label className="cp-tune-toggle">
          <input type="checkbox" checked={settings.pinchEnabled} onChange={e => setSettings({ pinchEnabled: e.target.checked })} />
          Pinch (close)
        </label>
        <label className="cp-tune-toggle">
          <input type="checkbox" checked={settings.invertSwipe} onChange={e => setSettings({ invertSwipe: e.target.checked })} />
          Invert swipe direction
        </label>

        <TuneSlider label="Swipe sensitivity" hint="lower = easier to trigger"
          value={settings.swipeThreshold} min={0.08} max={0.30} step={0.01}
          onChange={v => setSettings({ swipeThreshold: v })} />
        <TuneSlider label="Swipe cooldown" hint="ms between swipes"
          value={settings.swipeCooldownMs} min={400} max={1500} step={50}
          onChange={v => setSettings({ swipeCooldownMs: v })} />
        <TuneSlider label="Pinch sensitivity" hint="higher = easier to trigger"
          value={settings.pinchRatio} min={0.20} max={0.50} step={0.01}
          onChange={v => setSettings({ pinchRatio: v })} />
        <TuneSlider label="Pinch cooldown" hint="ms between pinches"
          value={settings.pinchCooldownMs} min={500} max={1500} step={50}
          onChange={v => setSettings({ pinchCooldownMs: v })} />
      </div>
    </div>
  )
}

function TuneSlider({ label, hint, value, min, max, step, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <label className="cp-tune-slider">
      <span>{label} <small>({hint})</small></span>
      <div className="row" style={{ gap: 8 }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
        <b>{value}</b>
      </div>
    </label>
  )
}

function CoverageMap({ items }: { items: { id: SurfaceId; label: string; reachable: boolean }[] }) {
  const reached = items.filter(i => i.reachable).length
  return (
    <div className="cp-coverage">
      <div className="cp-coverage-head">Surface coverage — {reached}/{items.length} reachable by voice</div>
      <div className="cp-coverage-grid">
        {items.map(item => (
          <span key={item.id} className={item.reachable ? 'is-on' : ''}>
            {item.reachable && <Check size={10} />}{item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function CommandRowEditor({ row, saving, onChange, onSave, onDelete, onPreview, onRegenerate }: {
  row: DbRow
  saving: boolean
  onChange: (patch: Partial<DbRow>) => void
  onSave: () => void
  onDelete: () => void
  onPreview: () => void
  onRegenerate: () => void
}) {
  const [phrasesText, setPhrasesText] = useState(row.phrases.join(', '))
  useEffect(() => { setPhrasesText(row.phrases.join(', ')) }, [row.phrases])

  const commitPhrases = () => {
    const list = phrasesText.split(',').map(p => p.trim()).filter(Boolean)
    onChange({ phrases: list })
  }

  return (
    <div className={`cp-ctrl-row ${row.enabled ? '' : 'is-disabled'}`}>
      <input type="checkbox" checked={row.enabled} onChange={e => onChange({ enabled: e.target.checked })} disabled={!cloudEnabled} />
      <select value={row.category} onChange={e => onChange({ category: e.target.value as CommandCategory })} disabled={!cloudEnabled}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={row.label} placeholder="Label" onChange={e => onChange({ label: e.target.value })} disabled={!cloudEnabled} />
      <input value={phrasesText} placeholder="phrase one, phrase two"
        onChange={e => setPhrasesText(e.target.value)} onBlur={commitPhrases} disabled={!cloudEnabled} />
      <select value={row.action_kind} onChange={e => onChange({ action_kind: e.target.value as ActionKind })} disabled={!cloudEnabled}>
        {ACTION_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <input value={row.action_arg ?? ''} placeholder="arg" onChange={e => onChange({ action_arg: e.target.value })} disabled={!cloudEnabled} />
      <input value={row.reply_text} placeholder="Spoken reply" onChange={e => onChange({ reply_text: e.target.value })} disabled={!cloudEnabled} />
      <select value={row.reply_voice} onChange={e => onChange({ reply_voice: e.target.value as 'JM' | 'KF' })} disabled={!cloudEnabled}>
        <option value="JM">JM</option>
        <option value="KF">KF</option>
      </select>
      <div className="cp-ctrl-actions">
        <button className="cp-ctrl-icon" onClick={onPreview} title="Preview (browser voice)" aria-label="Preview reply"><Play size={13} /></button>
        {cloudEnabled && (
          <button className="cp-ctrl-icon" onClick={onRegenerate} title={row.reply_audio_path ? 'Regenerate cached Aura reply' : 'Generate Aura reply'} aria-label="Regenerate reply audio">
            <RefreshCw size={13} className={saving ? 'spin' : ''} />
          </button>
        )}
        <span className={`cp-cache-dot ${row.reply_audio_path ? 'is-cached' : ''}`} title={row.reply_audio_path ? 'Aura audio cached' : 'No cached audio — falls back to browser voice'} />
      </div>
      <div className="cp-ctrl-actions">
        {cloudEnabled && <button className="cp-ctrl-icon" onClick={onSave} title="Save" aria-label="Save command"><Check size={13} /></button>}
        {cloudEnabled && <button className="cp-ctrl-icon cp-ctrl-danger" onClick={onDelete} title="Delete" aria-label="Delete command"><Trash2 size={13} /></button>}
      </div>
    </div>
  )
}

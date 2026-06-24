import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Plus, Pencil, Trash2, Upload, Sparkles, Copy, Check, Eye, EyeOff } from 'lucide-react'
import {
  WORLDS, STAGES, INTERACTIONS, interactionsFor, payloadTemplate, buildAuthorPrompt,
  type InteractionKey,
} from '../../data/curriculum'
import {
  studioListItems, studioUpsertItem, studioDeleteItem, studioSetStatus, studioBulkInsert,
  type StudioItem, type ItemDraft,
} from '../../data/studio'
import { Empty, Loading } from '../../components/Empty'
import { ago } from '../../lib/format'

type View = 'list' | 'edit' | 'bulk' | 'prompt'

const inp: CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--tx)', border: '1px solid var(--bd2)', borderRadius: 8,
}
const lbl: CSSProperties = { fontSize: 11.5, color: 'var(--tx2)', fontWeight: 500, marginBottom: 4, display: 'block' }
const mono: CSSProperties = { ...inp, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.5 }

const blankDraft = (world = 'NUM', stage = 'explorer'): ItemDraft => ({
  world_key: world, skill_key: WORLDS.find((w) => w.key === world)!.skills[0].key,
  interaction_type: 'mcq', stage_key: stage, difficulty: 2,
  prompt: '', payload: { choices: ['', '', '', ''], answer: 0 },
  hint: '', explanation: '', xp: 10, diamonds: 0, status: 'live',
})

export function ContentStudio() {
  const [view, setView] = useState<View>('list')
  const [world, setWorld] = useState('NUM')
  const [items, setItems] = useState<StudioItem[] | null | undefined>(undefined)
  const [cloudOk, setCloudOk] = useState<boolean | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(blankDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bulk, setBulk] = useState('')
  const [msg, setMsg] = useState('')

  const refresh = () => {
    setItems(undefined)
    studioListItems(world).then((rows) => {
      if (rows === null) { setCloudOk(false); setItems([]) }
      else { setCloudOk(true); setItems(rows) }
    })
  }
  useEffect(refresh, [world]) // eslint-disable-line react-hooks/exhaustive-deps

  const startNew = () => { setDraft(blankDraft(world)); setEditingId(null); setView('edit') }
  const startEdit = (it: StudioItem) => {
    setDraft({
      id: it.id, world_key: it.world, skill_key: it.skill, interaction_type: it.type,
      stage_key: it.stage, difficulty: it.difficulty, prompt: it.prompt, payload: it.payload,
      hint: it.hint, explanation: it.explanation, xp: it.xp, diamonds: it.diamonds, status: it.status,
    })
    setEditingId(it.id); setView('edit')
  }

  const tabs: { id: View; label: string; Icon: typeof Plus }[] = [
    { id: 'list', label: 'Items', Icon: Pencil },
    { id: 'edit', label: editingId ? 'Edit' : 'New', Icon: Plus },
    { id: 'bulk', label: 'Bulk import', Icon: Upload },
    { id: 'prompt', label: 'LLM prompt', Icon: Sparkles },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { if (id === 'edit' && !editingId) startNew(); else setView(id) }}
              className={'pill ' + (view === id ? 'pill-tl' : 'pill-mut')}
              style={{ cursor: 'pointer', border: 'none', padding: '6px 11px', gap: 5 }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <button onClick={startNew} className="pill pill-tl" style={{ cursor: 'pointer', border: 'none', padding: '6px 11px', gap: 5 }}>
          <Plus size={12} /> New item
        </button>
      </div>

      {cloudOk === false && (
        <div className="insight warn">
          <span style={{ fontWeight: 600 }}>Items table unreachable.</span>
          Run <span className="src">schema.sql</span> and ensure your profile <span className="src">role</span> is operator or admin, then reload.
        </div>
      )}
      {msg && <div className="insight tl" style={{ alignItems: 'center' }}><Check size={14} />{msg}</div>}

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {WORLDS.map((w) => (
          <button key={w.key} onClick={() => setWorld(w.key)}
            className={'pill ' + (world === w.key ? '' : 'pill-mut')}
            style={world === w.key
              ? { cursor: 'pointer', border: `1px solid ${w.color}`, color: w.color, background: 'transparent', padding: '5px 11px' }
              : { cursor: 'pointer', border: 'none', padding: '5px 11px' }}>
            {w.name}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <ListView items={items} world={world} onEdit={startEdit}
          onDelete={async (id) => {
            if (!confirm('Delete this item permanently?')) return
            const ok = await studioDeleteItem(id); setMsg(ok ? 'Item deleted.' : 'Delete failed.'); refresh()
          }}
          onToggleStatus={async (it) => {
            const next = it.status === 'live' ? 'draft' : 'live'
            const ok = await studioSetStatus(it.id, next)
            setMsg(ok ? `Set to ${next}.` : 'Update failed.'); refresh()
          }} />
      )}

      {view === 'edit' && (
        <EditView draft={draft} setDraft={setDraft} editing={!!editingId}
          onSave={async () => {
            if (!draft.prompt.trim()) { setMsg('Add a prompt first.'); return }
            const res = await studioUpsertItem(draft)
            setMsg(res.ok ? 'Saved to cloud — players will auto-refresh.' : `Save failed: ${res.error}`)
            if (res.ok) { setView('list'); refresh() }
          }} />
      )}

      {view === 'bulk' && (
        <BulkView bulk={bulk} setBulk={setBulk} onImport={async () => {
          let parsed: ItemDraft[]
          try { parsed = JSON.parse(bulk); if (!Array.isArray(parsed)) throw new Error('not an array') }
          catch (e) { setMsg(`Invalid JSON: ${e}`); return }
          const res = await studioBulkInsert(parsed)
          setMsg(res.ok ? `Imported ${res.count} items.` : `Import failed: ${res.error}`)
          if (res.ok) { setBulk(''); setView('list'); refresh() }
        }} />
      )}

      {view === 'prompt' && <PromptView world={world} />}
    </div>
  )
}

function ListView({ items, world, onEdit, onDelete, onToggleStatus }: {
  items: StudioItem[] | null | undefined
  world: string
  onEdit: (i: StudioItem) => void
  onDelete: (id: string) => void
  onToggleStatus: (i: StudioItem) => void
}) {
  if (items === undefined) return <Loading label="Loading items…" />
  if (!items || items.length === 0)
    return <Empty title={`No items in ${WORLDS.find((w) => w.key === world)?.name ?? world} yet`}>
      Create one with <span className="src">New item</span>, or generate a batch via the LLM prompt and Bulk import.
    </Empty>
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {items.map((it, idx) => (
        <div key={it.id} className="row" style={{
          gap: 10, padding: '10px 14px', borderTop: idx ? '1px solid var(--bd3)' : 'none', alignItems: 'center',
        }}>
          <span className="src" style={{ minWidth: 52, textAlign: 'center' }}>{it.type}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {it.prompt || <em style={{ color: 'var(--tx3)' }}>(no prompt)</em>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{it.skill} · {it.stage} · d{it.difficulty}{it.updatedAt ? ' · ' + ago(it.updatedAt) : ''}</div>
          </div>
          <span className={'pill ' + (it.status === 'live' ? 'pill-ok' : 'pill-mut')}>{it.status}</span>
          <button title={it.status === 'live' ? 'Unpublish' : 'Publish'} onClick={() => onToggleStatus(it)}
            style={iconBtn}>{it.status === 'live' ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button title="Edit" onClick={() => onEdit(it)} style={iconBtn}><Pencil size={15} /></button>
          <button title="Delete" onClick={() => onDelete(it.id)} style={{ ...iconBtn, color: 'var(--bad)' }}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  )
}

const iconBtn: CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--tx2)', cursor: 'pointer',
  padding: 5, borderRadius: 7, display: 'grid', placeItems: 'center',
}

function EditView({ draft, setDraft, editing, onSave }: {
  draft: ItemDraft; setDraft: (d: ItemDraft) => void; editing: boolean; onSave: () => void
}) {
  const world = WORLDS.find((w) => w.key === draft.world_key)!
  const meta = INTERACTIONS.find((i) => i.key === draft.interaction_type)
  const types = interactionsFor(draft.world_key)
  const [payloadText, setPayloadText] = useState(JSON.stringify(draft.payload, null, 2))
  const [payloadErr, setPayloadErr] = useState('')

  const applyTemplate = (type: InteractionKey) => {
    const tpl = payloadTemplate(type)
    setPayloadText(JSON.stringify(tpl, null, 2))
    setPayloadErr('')
    setDraft({ ...draft, interaction_type: type, payload: tpl })
  }
  const onPayload = (txt: string) => {
    setPayloadText(txt)
    try { const p = JSON.parse(txt); setDraft({ ...draft, payload: p }); setPayloadErr('') }
    catch (e) { setPayloadErr(String(e)) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>World</label>
            <select style={inp} value={draft.world_key}
              onChange={(e) => { const w = WORLDS.find((x) => x.key === e.target.value)!; setDraft({ ...draft, world_key: w.key, skill_key: w.skills[0].key }) }}>
              {WORLDS.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Skill</label>
            <select style={inp} value={draft.skill_key} onChange={(e) => setDraft({ ...draft, skill_key: e.target.value })}>
              {world.skills.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>Interaction</label>
            <select style={inp} value={draft.interaction_type} onChange={(e) => applyTemplate(e.target.value as InteractionKey)}>
              {types.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Stage</label>
            <select style={inp} value={draft.stage_key} onChange={(e) => setDraft({ ...draft, stage_key: e.target.value })}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.minAge}–{s.maxAge})</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>Difficulty</label>
            <input style={inp} type="number" min={1} max={5} value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: +e.target.value })} />
          </div>
          <div><label style={lbl}>XP</label>
            <input style={inp} type="number" value={draft.xp ?? 10} onChange={(e) => setDraft({ ...draft, xp: +e.target.value })} />
          </div>
          <div><label style={lbl}>Status</label>
            <select style={inp} value={draft.status ?? 'live'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="live">live</option><option value="draft">draft</option>
            </select>
          </div>
        </div>
        <div><label style={lbl}>Prompt (shown to the child)</label>
          <input style={inp} value={draft.prompt} placeholder="What is 7 × 8?" onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
        </div>
        <div><label style={lbl}>Payload JSON · {meta?.name}</label>
          <textarea style={{ ...mono, minHeight: 130, resize: 'vertical' }} value={payloadText} onChange={(e) => onPayload(e.target.value)} />
          <div className="src" style={{ marginTop: 5, display: 'block', whiteSpace: 'normal' }}>{meta?.payloadHint}</div>
          {payloadErr && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>{payloadErr}</div>}
        </div>
        <div><label style={lbl}>Explanation (after answering)</label>
          <input style={inp} value={draft.explanation ?? ''} placeholder="7 × 8 = 56." onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
        </div>
        <button onClick={onSave} className="pill pill-tl"
          style={{ cursor: 'pointer', border: 'none', justifyContent: 'center', padding: '10px', fontSize: 13 }}>
          {editing ? 'Save changes' : 'Create item'}
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 6, marginBottom: 12, color: 'var(--tx2)', fontSize: 12, fontWeight: 500 }}>
          <Eye size={14} /> Structured preview
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          {draft.prompt || <em style={{ color: 'var(--tx3)', fontWeight: 400 }}>Your prompt…</em>}
        </div>
        {payloadErr ? <div style={{ fontSize: 12, color: 'var(--bad)' }}>Fix the JSON to preview.</div>
          : <PayloadPreview type={draft.interaction_type as InteractionKey} payload={draft.payload} />}
        {draft.explanation && <div className="insight ok" style={{ marginTop: 12 }}>{draft.explanation}</div>}
      </div>
    </div>
  )
}

// Readable, operator-grade rendering of a payload with the correct answer marked.
// (The cartoon kid-facing renderer lives in the player app; this is for authoring.)
function PayloadPreview({ type, payload }: { type: InteractionKey; payload: Record<string, unknown> }) {
  const p = payload as Record<string, any>
  const ok: CSSProperties = { border: '1px solid var(--ok)', color: 'var(--ok)', background: 'var(--ok-bg)' }
  const chip: CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd2)', fontSize: 13 }
  const wrap: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 }

  if ((type === 'mcq' || type === 'map' || type === 'listen') && Array.isArray(p.choices))
    return <div style={wrap}>{p.choices.map((c: string, i: number) =>
      <span key={i} style={{ ...chip, ...(i === p.answer ? ok : {}) }}>{c || '—'}</span>)}</div>
  if (type === 'multi' && Array.isArray(p.choices))
    return <div style={wrap}>{p.choices.map((c: string, i: number) =>
      <span key={i} style={{ ...chip, ...((p.answers || []).includes(i) ? ok : {}) }}>{c || '—'}</span>)}</div>
  if (type === 'type')
    return <span style={{ ...chip, ...ok }}>{String(p.answer ?? '—')}{p.numeric ? '  (numeric)' : ''}</span>
  if (type === 'cloze')
    return <div style={{ fontSize: 14 }}>{p.before}<b style={{ color: 'var(--ok)' }}>{p.answer}</b>{p.after}</div>
  if (type === 'speed' && Array.isArray(p.questions))
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{p.questions.map((q: any, i: number) =>
      <div key={i} style={{ fontSize: 13 }}>{q.q} = <b style={{ color: 'var(--ok)' }}>{q.a}</b></div>)}<div className="src">{p.seconds}s</div></div>
  if ((type === 'bank' || type === 'code' || type === 'seq') && Array.isArray(p.answer || p.items))
    return <div style={wrap}>{(p.answer || p.items).map((t: string, i: number) =>
      <span key={i} style={chip}>{i + 1}. {t}</span>)}</div>
  if (type === 'match' && Array.isArray(p.pairs))
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{p.pairs.map((pr: string[], i: number) =>
      <div key={i} style={{ fontSize: 13 }}>{pr[0]} <span style={{ color: 'var(--tx3)' }}>↔</span> {pr[1]}</div>)}</div>
  if (type === 'sort' && Array.isArray(p.buckets))
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{p.buckets.map((b: string, bi: number) =>
      <div key={bi} style={{ fontSize: 13 }}><b>{b}:</b> {(p.items || []).filter((it: any) => it.bucket === bi).map((it: any) => it.text).join(', ') || '—'}</div>)}</div>
  if (type === 'fix' && Array.isArray(p.tokens))
    return <div style={{ fontSize: 14 }}>{p.tokens.map((t: string, i: number) =>
      <span key={i} style={{ textDecoration: i === p.wrong ? 'line-through' : 'none', color: i === p.wrong ? 'var(--bad)' : 'inherit' }}>{t} </span>)}
      → <b style={{ color: 'var(--ok)' }}>{p.fix}</b></div>
  if (type === 'numline' || type === 'slider')
    return <div style={{ fontSize: 13 }}>{p.min} … <b style={{ color: 'var(--ok)' }}>{p.answer}{p.unit || ''}</b> ({p.label || `±${p.tol}`}) … {p.max}</div>
  if (type === 'label' && Array.isArray(p.pairs))
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{p.scene && <div style={{ fontSize: 26 }}>{p.scene}</div>}{p.pairs.map((pr: string[], i: number) =>
      <div key={i} style={{ fontSize: 13 }}>{pr[0]} → <b>{pr[1]}</b></div>)}</div>
  if (type === 'party')
    return <div style={{ fontSize: 13 }}>{p.task || p.prompt || 'Quest'} {p.reveal ? <b>→ {p.reveal}</b> : null}</div>

  return <pre style={{ ...mono, whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(payload, null, 2)}</pre>
}

function BulkView({ bulk, setBulk, onImport }: { bulk: string; setBulk: (s: string) => void; onImport: () => void }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>
        Paste a JSON array of items (from the LLM prompt). Each object: <span className="src">world_key, skill_key, interaction_type, stage_key, difficulty, prompt, payload, explanation</span>.
      </div>
      <textarea style={{ ...mono, minHeight: 240, resize: 'vertical' }} value={bulk} onChange={(e) => setBulk(e.target.value)}
        placeholder='[ { "world_key": "NUM", "skill_key": "times", "interaction_type": "mcq", "stage_key": "explorer", "difficulty": 2, "prompt": "7 × 8 = ?", "payload": { "choices": ["54","56","64","49"], "answer": 1 }, "explanation": "7 × 8 = 56." } ]' />
      <button onClick={onImport} className="pill pill-tl" style={{ cursor: 'pointer', border: 'none', justifyContent: 'center', padding: '10px', gap: 6 }}>
        <Upload size={13} /> Import to cloud
      </button>
    </div>
  )
}

function PromptView({ world }: { world: string }) {
  const [count, setCount] = useState(20)
  const [stage, setStage] = useState('explorer')
  const [copied, setCopied] = useState(false)
  const w = WORLDS.find((x) => x.key === world)!
  const prompt = useMemo(() => buildAuthorPrompt(world, stage, count), [world, stage, count])
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>
        A ready-to-paste prompt for Claude / ChatGPT. It returns a JSON array you paste into <b>Bulk import</b>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, maxWidth: 440 }}>
        <div><label style={lbl}>World</label><input style={inp} value={w.name} disabled /></div>
        <div><label style={lbl}>Stage</label>
          <select style={inp} value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Count</label><input style={inp} type="number" min={5} max={60} value={count} onChange={(e) => setCount(+e.target.value)} /></div>
      </div>
      <button onClick={() => navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })}
        className="pill pill-tl" style={{ cursor: 'pointer', border: 'none', alignSelf: 'flex-start', padding: '8px 13px', gap: 6 }}>
        {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy LLM prompt</>}
      </button>
      <pre style={{ ...mono, whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', margin: 0 }}>{prompt}</pre>
    </div>
  )
}

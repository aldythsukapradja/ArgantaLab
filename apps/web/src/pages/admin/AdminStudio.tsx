import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS, INTERACTIONS, STAGES, type Item, type InteractionKey } from '@/data/learn'
import { adminListItems, adminUpsertItem, adminDeleteItem, adminBulkInsert, type ItemDraft } from '@lib/content'
import { renderItem } from '@components/learn2/interactions'
import { buildAuthorPrompt, payloadTemplate } from './authorPrompt'

type View = 'list' | 'edit' | 'bulk' | 'prompt'

const blankDraft = (world = 'NUM'): ItemDraft => ({
  world_key: world, skill_key: WORLDS.find(w => w.key === world)!.skills[0].key,
  interaction_type: 'mcq', stage_key: 'explorer', difficulty: 2,
  prompt: '', payload: { choices: ['', '', '', ''], answer: 0 },
  hint: '', explanation: '', xp: 10, diamonds: 0, status: 'live',
})

export default function AdminStudio() {
  const { isAdmin } = useAppStore()
  const [view, setView] = useState<View>('list')
  const [world, setWorld] = useState('NUM')
  const [items, setItems] = useState<Item[] | null>(null)
  const [cloudOk, setCloudOk] = useState<boolean | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(blankDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bulk, setBulk] = useState('')
  const [msg, setMsg] = useState('')

  const refresh = () => {
    adminListItems(world).then(rows => {
      if (rows === null) { setCloudOk(false); setItems([]) }
      else { setCloudOk(true); setItems(rows) }
    })
  }
  useEffect(() => { refresh() }, [world]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin()) return <div className="le-empty"><p>Admins only.</p></div>

  const startNew = () => { setDraft(blankDraft(world)); setEditingId(null); setView('edit') }
  const startEdit = (it: Item) => {
    setDraft({ id: it.id, world_key: it.world, skill_key: it.skill, interaction_type: it.type, stage_key: it.stage, difficulty: it.difficulty, prompt: it.prompt, payload: it.payload, hint: it.hint, explanation: it.explanation, xp: it.xp, diamonds: it.diamonds, status: 'live' })
    setEditingId(it.id); setView('edit')
  }

  return (
    <div className="screen admin" style={{ justifyContent: 'flex-start', gap: 14, paddingTop: 4 }}>
      <div className="adm-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Content Studio</div>
          <h1 className="h-title" style={{ fontSize: 'clamp(26px,4vw,44px)', marginTop: 8 }}>Author <span className="g">learning</span></h1>
        </div>
        <div className="adm-tabs">
          {(['list', 'edit', 'bulk', 'prompt'] as View[]).map(v => (
            <button key={v} className={`adm-tab${view === v ? ' on' : ''}`} onClick={() => { if (v === 'edit' && !editingId) startNew(); else setView(v) }}>
              {v === 'list' ? '📋 Items' : v === 'edit' ? '✏️ Edit' : v === 'bulk' ? '📥 Bulk import' : '🤖 LLM prompt'}
            </button>
          ))}
        </div>
      </div>

      {cloudOk === false && (
        <div className="adm-warn">⚠️ Supabase content tables aren't reachable (run <code>schema.sql</code> + set your profile <code>role='admin'</code>). You can still build the LLM prompt and preview locally.</div>
      )}
      {msg && <div className="adm-msg">{msg}</div>}

      <div className="adm-worldbar">
        {WORLDS.map(w => (
          <button key={w.key} className={`adm-wchip${world === w.key ? ' on' : ''}`}
            style={world === w.key ? { borderColor: w.color, color: w.color } : undefined}
            onClick={() => setWorld(w.key)}>{w.icon} {w.name}</button>
        ))}
      </div>

      {view === 'list' && (
        <ListView items={items} onNew={startNew} onEdit={startEdit} onDelete={async (id) => {
          if (!confirm('Delete this item?')) return
          const ok = await adminDeleteItem(id); setMsg(ok ? 'Deleted.' : 'Delete failed.'); refresh()
        }} />
      )}

      {view === 'edit' && (
        <EditView draft={draft} setDraft={setDraft} editing={!!editingId}
          onSave={async () => {
            if (!draft.prompt.trim()) { setMsg('Add a prompt first.'); return }
            const res = await adminUpsertItem(draft)
            setMsg(res.ok ? '✅ Saved to cloud.' : `Save failed: ${res.error}`)
            if (res.ok) { setView('list'); refresh() }
          }} />
      )}

      {view === 'bulk' && (
        <BulkView bulk={bulk} setBulk={setBulk} onImport={async () => {
          let parsed: ItemDraft[]
          try { parsed = JSON.parse(bulk); if (!Array.isArray(parsed)) throw new Error('not an array') }
          catch (e) { setMsg(`Invalid JSON: ${e}`); return }
          const res = await adminBulkInsert(parsed)
          setMsg(res.ok ? `✅ Imported ${res.count} items.` : `Import failed: ${res.error}`)
          if (res.ok) { setBulk(''); setView('list'); refresh() }
        }} />
      )}

      {view === 'prompt' && <PromptView world={world} />}
    </div>
  )
}

/* ── List ──────────────────────────────────────────────────── */
function ListView({ items, onNew, onEdit, onDelete }: { items: Item[] | null; onNew: () => void; onEdit: (i: Item) => void; onDelete: (id: string) => void }) {
  return (
    <div className="adm-list">
      <button className="adm-new" onClick={onNew}>＋ New item</button>
      {items === null && <p className="adm-dim">Loading…</p>}
      {items && items.length === 0 && <p className="adm-dim">No cloud items for this world yet. Create one, or use Bulk import.</p>}
      {items && items.map(it => (
        <div key={it.id} className="adm-row">
          <span className="adm-type">{INTERACTIONS.find(x => x.key === it.type)?.emoji} {it.type}</span>
          <span className="adm-prompt">{it.prompt || <em>(no prompt)</em>}</span>
          <span className="adm-skill">{it.skill}</span>
          <span className="adm-actions">
            <button onClick={() => onEdit(it)}>Edit</button>
            <button onClick={() => onDelete(it.id)}>🗑</button>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Edit + live preview ───────────────────────────────────── */
function EditView({ draft, setDraft, editing, onSave }: { draft: ItemDraft; setDraft: (d: ItemDraft) => void; editing: boolean; onSave: () => void }) {
  const world = WORLDS.find(w => w.key === draft.world_key)!
  const meta = INTERACTIONS.find(i => i.key === draft.interaction_type)
  const [payloadText, setPayloadText] = useState(JSON.stringify(draft.payload, null, 2))
  const [payloadErr, setPayloadErr] = useState('')

  // keep textarea in sync when type changes via template
  const applyTemplate = (type: InteractionKey) => {
    const tpl = payloadTemplate(type)
    setPayloadText(JSON.stringify(tpl, null, 2))
    setDraft({ ...draft, interaction_type: type, payload: tpl })
  }
  const onPayload = (txt: string) => {
    setPayloadText(txt)
    try { const p = JSON.parse(txt); setDraft({ ...draft, payload: p }); setPayloadErr('') }
    catch (e) { setPayloadErr(String(e)) }
  }

  const previewItem: Item = useMemo(() => ({
    id: 'preview', world: draft.world_key, skill: draft.skill_key, type: draft.interaction_type as InteractionKey,
    stage: draft.stage_key, difficulty: draft.difficulty, prompt: draft.prompt, payload: draft.payload,
    hint: draft.hint, explanation: draft.explanation, xp: draft.xp, diamonds: draft.diamonds,
  }), [draft])

  return (
    <div className="adm-edit">
      <div className="adm-form">
        <div className="adm-grid2">
          <label>World
            <select value={draft.world_key} onChange={e => { const w = WORLDS.find(x => x.key === e.target.value)!; setDraft({ ...draft, world_key: w.key, skill_key: w.skills[0].key }) }}>
              {WORLDS.map(w => <option key={w.key} value={w.key}>{w.name}</option>)}
            </select>
          </label>
          <label>Skill
            <select value={draft.skill_key} onChange={e => setDraft({ ...draft, skill_key: e.target.value })}>
              {world.skills.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="adm-grid2">
          <label>Interaction
            <select value={draft.interaction_type} onChange={e => applyTemplate(e.target.value as InteractionKey)}>
              {INTERACTIONS.map(i => <option key={i.key} value={i.key}>{i.emoji} {i.name}</option>)}
            </select>
          </label>
          <label>Stage
            <select value={draft.stage_key} onChange={e => setDraft({ ...draft, stage_key: e.target.value })}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="adm-grid2">
          <label>Difficulty (1-5)
            <input type="number" min={1} max={5} value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: +e.target.value })} />
          </label>
          <label>XP
            <input type="number" value={draft.xp ?? 10} onChange={e => setDraft({ ...draft, xp: +e.target.value })} />
          </label>
        </div>
        <label>Prompt (the question shown to the kid)
          <input value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} placeholder="What is 7 × 8?" />
        </label>
        <label>Payload (JSON · {meta?.name})
          <textarea className="adm-json" rows={7} value={payloadText} onChange={e => onPayload(e.target.value)} />
          <small className="adm-hint">Shape: <code>{meta?.payloadHint}</code></small>
          {payloadErr && <small className="adm-err">{payloadErr}</small>}
        </label>
        <label>Explanation (shown after answering)
          <input value={draft.explanation ?? ''} onChange={e => setDraft({ ...draft, explanation: e.target.value })} placeholder="7 × 8 = 56." />
        </label>
        <button className="le-check" style={{ background: world.color }} onClick={onSave}>{editing ? 'Save changes' : 'Create item'}</button>
      </div>

      <div className="adm-preview">
        <div className="adm-preview-label">👁 Live preview (what the kid sees)</div>
        <div className="le-player" style={{ minHeight: 'auto' }}>
          <div className="le-prompt">{draft.prompt || <em style={{ color: 'var(--t3)' }}>Your prompt…</em>}</div>
          {payloadErr ? <p className="adm-err">Fix the JSON to preview.</p>
            : <div key={JSON.stringify(draft.payload) + draft.interaction_type} className="le-render">{renderItem(previewItem, () => { })}</div>}
        </div>
      </div>
    </div>
  )
}

/* ── Bulk import ───────────────────────────────────────────── */
function BulkView({ bulk, setBulk, onImport }: { bulk: string; setBulk: (s: string) => void; onImport: () => void }) {
  return (
    <div className="adm-bulk">
      <p className="adm-dim">Paste a JSON array of items (from the LLM prompt). Each object: <code>world_key, skill_key, interaction_type, stage_key, difficulty, prompt, payload, explanation</code>.</p>
      <textarea className="adm-json" rows={14} value={bulk} onChange={e => setBulk(e.target.value)} placeholder='[ { "world_key": "NUM", "skill_key": "times", "interaction_type": "mcq", "stage_key": "explorer", "difficulty": 2, "prompt": "7 × 8 = ?", "payload": { "choices": ["54","56","64","49"], "answer": 1 }, "explanation": "7 × 8 = 56." } ]' />
      <button className="le-check" onClick={onImport}>📥 Import to cloud</button>
    </div>
  )
}

/* ── LLM authoring prompt ──────────────────────────────────── */
function PromptView({ world }: { world: string }) {
  const [count, setCount] = useState(20)
  const [copied, setCopied] = useState(false)
  const w = WORLDS.find(x => x.key === world)!
  const prompt = buildAuthorPrompt(world, count)
  return (
    <div className="adm-prompt">
      <p className="adm-dim">A ready-to-paste prompt for ChatGPT / Claude. It returns a JSON array you paste into <b>Bulk import</b>. Edit any question afterwards in <b>Items</b>.</p>
      <div className="adm-grid2" style={{ maxWidth: 320 }}>
        <label>World<input value={w.name} disabled /></label>
        <label>How many items<input type="number" min={5} max={60} value={count} onChange={e => setCount(+e.target.value)} /></label>
      </div>
      <button className="le-check" onClick={() => { navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }) }}>
        {copied ? '✅ Copied!' : '📋 Copy LLM prompt'}
      </button>
      <pre className="adm-promptbox">{prompt}</pre>
    </div>
  )
}

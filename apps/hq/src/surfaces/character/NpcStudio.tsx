import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PartBrowser } from './PartBrowser'
import { DyePicker } from './DyePicker'
import { useComposer, DIRWORD } from './composer'
import { ComposerPanel } from './ComposerPanel'
import { loadNpcRoster, getNpc, saveNpc, deleteNpc, type NpcEntry } from './npcData'

const ROLES = ['villager', 'shop', 'quest', 'guard', 'healer', 'smith']

export function NpcStudio() {
  const composer = useComposer()
  const [roster, setRoster] = useState<NpcEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('villager')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [base, setBase] = useState('NormalStandBy')
  const [emote, setEmote] = useState('')
  const [dir, setDir] = useState('S')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [scale, setScale] = useState(3)
  const [frame, setFrame] = useState('')
  const [browse, setBrowse] = useState<any>(null)
  const [dyeFor, setDyeFor] = useState<string | null>(null)
  const [dyeAnchor, setDyeAnchor] = useState<DOMRect | null>(null)

  async function refresh() {
    setLoading(true)
    const { entries } = await loadNpcRoster()
    setRoster(entries)
    setLoading(false)
    return entries
  }
  useEffect(() => { refresh().then(entries => { if (entries.length) selectNpc(entries[0].id) }) }, [])

  async function selectNpc(id: string) {
    setSelectedId(id); setMsg(null)
    const n = await getNpc(id)
    if (n) { setName(n.name); setRole(n.role); setNotes(n.notes || ''); composer.applySpec(n.spec) }
  }
  function newNpc() {
    setSelectedId(null); setName('New NPC'); setRole('villager'); setNotes(''); composer.applySpec(null); setMsg(null)
  }
  async function save() {
    setSaving(true); setMsg(null)
    const r = await saveNpc(selectedId, name, role, notes, composer.spec)
    if (r.ok) {
      setMsg({ ok: true, text: 'Saved — both games can place this NPC.' })
      const entries = await refresh()
      if (r.id) setSelectedId(r.id)
      else if (!selectedId) { const found = entries.find(e => e.name.toLowerCase() === name.trim().toLowerCase()); if (found) setSelectedId(found.id) }
    } else setMsg({ ok: false, text: r.message || 'Save failed.' })
    setSaving(false)
  }
  async function remove() {
    if (!selectedId) return
    setSaving(true)
    const r = await deleteNpc(selectedId)
    if (r.ok) { const entries = await refresh(); newNpc(); if (entries.length) selectNpc(entries[0].id) }
    else setMsg({ ok: false, text: r.message || 'Delete failed.' })
    setSaving(false)
  }

  const hasWeapon = !!composer.sel.weapon
  let effAction = base
  if (hasWeapon && base === 'NormalStandBy') effAction = 'WeaponStandBy'
  if (hasWeapon && base === 'NormalWalk') effAction = 'WeaponWalk'
  const motionName = emote || effAction + DIRWORD[dir]
  const dyeTarget = dyeFor ? composer.dyeTargetKey(dyeFor) : null
  const dyeCur = dyeTarget ? composer.sel[dyeTarget] : null

  return (
    <div className="forge-work">
      <div className="fcol users">
        <h4>NPCs · {loading ? 'loading…' : `${roster.length} in the cast`}</h4>
        <div className="f-userlist">
          {roster.length === 0 && !loading && <div className="f-empty">No NPCs yet — create the first one below.</div>}
          {roster.map(n => (
            <button key={n.id} className={'f-user' + (n.id === selectedId ? ' on' : '')} onClick={() => selectNpc(n.id)}>
              <span className="f-ava" style={{ background: '#22c55e' }}>{n.name[0]?.toUpperCase()}</span>
              <span><span className="nm">{n.name}</span><span className="uid">{n.role}</span></span>
              <span className={'f-badge ' + (n.hasSpec ? 'hero' : 'none')}>{n.hasSpec ? 'dressed' : 'blank'}</span>
            </button>
          ))}
        </div>
        <button className="f-gbtn" onClick={newNpc} style={{ marginTop: 8 }}><Plus size={12} style={{ verticalAlign: -2 }} /> New NPC</button>
        <div className="f-npc-fields">
          <input className="f-search" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <select className="f-gbtn" value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%' }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea className="f-npc-notes" placeholder="Notes (quest hook, shop stock, flavor…)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>
        <div className="f-note"><b>Shared cast.</b> Every NPC dressed here is placeable by both LashiraBloom and Kingdom Heroes — read is public, editing stays operator-only.</div>
      </div>

      <ComposerPanel
        composer={composer}
        motion={{ base, setBase, emote, setEmote, dir, setDir, playing, setPlaying, speed, setSpeed, scale, setScale, motionName, frame, onStep: (i, n) => setFrame(`step ${i + 1}/${n}`) }}
        headerLeft={<div className="f-who">{name || 'New NPC'} <small>{role}</small></div>}
        headerRight={
          <div className="row" style={{ display: 'flex', gap: 8 }}>
            {selectedId && <button className="f-gbtn danger" onClick={remove} disabled={saving}><Trash2 size={12} style={{ verticalAlign: -2 }} /></button>}
            <button className="f-gbtn" onClick={save} disabled={saving} style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}>
              {saving ? 'Saving…' : 'Save NPC'}
            </button>
          </div>
        }
        onReset={() => selectedId ? selectNpc(selectedId) : newNpc()}
        setBrowse={setBrowse}
        setDyeFor={setDyeFor} setDyeAnchor={setDyeAnchor}
      />

      {msg && <div className="f-npc-msg" style={{ color: msg.ok ? 'var(--ok, #16a34a)' : '#e0603a' }}>{msg.text}</div>}

      {browse && (
        <PartBrowser title={`${browse.slot.label} collection`} entries={composer.entriesFor(browse.slot)}
          value={composer.currentKeyFor(browse.slot)} onPick={composer.pickFor(browse.slot)} onClose={() => setBrowse(null)} />
      )}
      {dyeFor && dyeCur && dyeTarget && (
        <DyePicker cat={dyeCur.cat} part={composer.meta[dyeCur.cat]?.byId[dyeCur.id]} value={dyeCur.palette} anchorRect={dyeAnchor}
          onPick={(pal: number | null) => composer.setSel((prev: any) => ({ ...prev, [dyeTarget]: { ...prev[dyeTarget], palette: pal } }))}
          onClose={() => setDyeFor(null)} />
      )}
    </div>
  )
}

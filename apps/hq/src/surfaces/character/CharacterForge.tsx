import { useEffect, useMemo, useState } from 'react'
import { CompositeStage, data } from '@arganta/heroes-engine'
import { PartBrowser } from './PartBrowser'
import { DyePicker } from './DyePicker'
import { loadOperatorCharacter, saveOperatorCharacter, type HeroState } from './heroData'
import './forge.css'

// Character Forge — full-bleed pixel-perfect composer, a faithful clone of Kingdom's
// Character Lab. STEP 3 (this file): the pickers are LIVE — ◀/▶ steps, a browse-grid
// pop-up, and dye all mutate the spec that drives the real animated character. The
// spec loads from + saves to the SAME canonical character the games read
// (kingdom_get_player_state / kingdom_sync_character_build), so HQ is the single
// source of truth for LashiraBloom & Kingdom Heroes.

type TabId = 'lab' | 'select' | 'npc'
const TABS: { id: TabId; icon: string; label: string; sub: string; tnum: string }[] = [
  { id: 'lab', icon: '🧬', label: 'Character Lab', sub: 'compose · animate', tnum: 'per user' },
  { id: 'select', icon: '🎴', label: 'Character Select', sub: 'welcome · picker', tnum: '→ Lashira' },
  { id: 'npc', icon: '🧑‍🌾', label: 'NPC Studio', sub: 'roster · cast', tnum: 'shared' },
]

const SKIN_IDS = [0, 1]
const DEFAULT_SEL: any = {
  body: { cat: 'body', id: 0, palette: null },
  face: { cat: 'face', id: 0, palette: null },
  hair: { cat: 'hair', id: 0, palette: null },
  coat: { cat: 'coat', id: 2, palette: null },
}
const SLOT_DEFS: any[] = [
  { key: 'face', cat: 'face', label: 'Face', group: 'Head' },
  { key: 'hair', cat: 'hair', label: 'Hair', group: 'Head', optional: true },
  { key: 'helmet', cat: 'helmet', label: 'Helmet', group: 'Head', optional: true },
  { key: 'facedec', cat: 'facedec', label: 'Face deco', group: 'Head', optional: true },
  { key: 'hairdec', cat: 'hairdec', label: 'Hair deco', group: 'Head', optional: true },
  { key: 'skin', special: 'skin', label: 'Skin', group: 'Body & Armor' },
  { key: 'armor', special: 'armor', label: 'Armor', group: 'Body & Armor' },
  { key: 'shoes', cat: 'shoes', label: 'Shoes', group: 'Body & Armor', optional: true },
  { key: 'mantle', cat: 'mantle', label: 'Mantle', group: 'Body & Armor', optional: true },
  { key: 'neck', cat: 'neck', label: 'Necklace', group: 'Body & Armor', optional: true },
  { key: 'weapon', cat: 'sword', label: 'Weapon', group: 'Weapon', optional: true, cats: ['sword', 'spear', 'bow', 'fan'] },
  { key: 'shield', cat: 'shield', label: 'Shield', group: 'Weapon', optional: true },
]
const GROUPS = ['Head', 'Body & Armor', 'Weapon']
const ACTIONS: [string, string][] = [
  ['Stand', 'NormalStandBy'], ['Walk', 'NormalWalk'], ['Swing', 'Swing'], ['Pierce', 'Pierce'],
  ['Shoot', 'Shoot'], ['Take', 'Get'], ['Spell', 'Spell'], ['Ride', 'Riding'], ['Bow', 'Bow'],
]
const EMOTES = ['Victory', 'Smile', 'Cry', 'Blush', 'Wink', 'Yawn', 'Sleep', 'Dance', 'Angry']
const DIRWORD: Record<string, string> = { S: 'South', E: 'East', N: 'North', W: 'West' }
const PATHS = ['Warrior', 'Mage', 'Poet', 'Rogue']

function useCategoryData(cats: string[]) {
  const [meta, setMeta] = useState<Record<string, any>>({})
  useEffect(() => {
    let live = true
    ;(async () => {
      const out: Record<string, any> = {}
      await Promise.all(cats.map(async c => {
        try {
          const [parts, palettes] = await Promise.all([data.charParts(c), data.charPalettes(c)])
          out[c] = { parts, byId: Object.fromEntries(parts.map((p: any) => [p.id, p])), palettes: palettes.length }
        } catch { out[c] = { parts: [], byId: {}, palettes: 0 } }
      }))
      if (live) setMeta(out)
    })()
    return () => { live = false }
  }, [cats.join(',')])
  return meta
}

export function CharacterForge() {
  const [tab, setTab] = useState<TabId>('lab')
  const [sel, setSel] = useState<any>(DEFAULT_SEL)
  const [mountOn, setMountOn] = useState(false)
  const [mountId, setMountId] = useState(0)
  const [mountCount, setMountCount] = useState(0)
  const [base, setBase] = useState('NormalStandBy')
  const [emote, setEmote] = useState('')
  const [dir, setDir] = useState('S')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [scale, setScale] = useState(3)
  const [path, setPath] = useState('Warrior')
  const [frame, setFrame] = useState('')
  const [browse, setBrowse] = useState<any>(null)
  const [dyeFor, setDyeFor] = useState<string | null>(null)
  const [dyeAnchor, setDyeAnchor] = useState<DOMRect | null>(null)
  const [hero, setHero] = useState<HeroState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const allCats = useMemo(() => [...new Set(['body', 'coat', ...SLOT_DEFS.flatMap(s => s.cats || (s.cat ? [s.cat] : []))])], [])
  const meta = useCategoryData(allCats)

  useEffect(() => { data.mounts().then((m: any[]) => setMountCount(m.length)).catch(() => {}) }, [])

  // Load the operator's REAL character (the same spec the games render).
  useEffect(() => {
    let live = true
    ;(async () => {
      const h = await loadOperatorCharacter()
      if (!live) return
      setHero(h)
      if (h?.spec) applySpec(h.spec)
      if (h?.character?.path_id || h?.character?.pathId) {
        const p = String(h.character.path_id || h.character.pathId)
        setPath(p.charAt(0).toUpperCase() + p.slice(1))
      }
      setLoading(false)
    })()
    return () => { live = false }
  }, [])

  function applySpec(spec: any) {
    if (!spec || typeof spec !== 'object') return
    const { mount, skills, ...parts } = spec
    if (parts.body) setSel(parts)
    setMountOn(!!mount)
    setMountId(mount?.id ?? 0)
  }

  // ---- picker logic (ported from Kingdom's Character Lab) ----
  const bodyParts = meta.body?.parts || []
  const skinParts = useMemo(() => bodyParts.filter((p: any) => SKIN_IDS.includes(p.id)), [bodyParts])
  const armorBodies = useMemo(() => bodyParts.filter((p: any) => !SKIN_IDS.includes(p.id)), [bodyParts])
  const bodyIsArmor = !SKIN_IDS.includes(sel.body?.id ?? 0)
  const armorEntries = useMemo(() => {
    const out: any[] = []
    for (const p of meta.coat?.parts || []) out.push({ key: `coat:${p.id}`, cat: 'coat', part: p, label: `armor c${p.id}`, group: `coat · set ${Math.floor(p.frame_index / 2600)}` })
    for (const p of armorBodies) out.push({ key: `body:${p.id}`, cat: 'body', part: p, label: `armor b${p.id}`, group: `body · set ${Math.floor(p.frame_index / 2600)}` })
    return out
  }, [meta.coat, armorBodies])
  const armorValue = bodyIsArmor ? `body:${sel.body?.id}` : sel.coat ? `coat:${sel.coat.id}` : null

  function pickArmor(entry: any) {
    setSel((prev: any) => {
      const next = { ...prev }
      if (entry.cat === 'coat') {
        if (!SKIN_IDS.includes(next.body?.id)) next.body = { cat: 'body', id: 0, palette: null }
        next.coat = { cat: 'coat', id: entry.part.id, palette: next.coat?.palette ?? null }
      } else { next.body = { cat: 'body', id: entry.part.id, palette: null }; delete next.coat }
      return next
    })
  }
  function pickSkin(entry: any) {
    setSel((prev: any) => {
      const next = { ...prev, body: { cat: 'body', id: entry.part.id, palette: prev.body?.palette ?? null } }
      if (!next.coat) next.coat = { cat: 'coat', id: 2, palette: null }
      return next
    })
  }
  const pickSlot = (slotKey: string, entry: any) =>
    setSel((prev: any) => ({ ...prev, [slotKey]: { cat: entry.cat, id: entry.part.id, palette: prev[slotKey]?.palette ?? null } }))
  function toggle(slot: any) {
    setSel((prev: any) => {
      const nxt = { ...prev }
      if (nxt[slot.key]) delete nxt[slot.key]
      else nxt[slot.key] = { cat: slot.cat, id: meta[slot.cat]?.parts[0]?.id ?? 0, palette: null }
      return nxt
    })
  }
  function entriesFor(slot: any): any[] {
    if (slot.special === 'skin') return skinParts.map((p: any) => ({ key: `body:${p.id}`, cat: 'body', part: p, label: `skin ${p.id === 0 ? 'A' : 'B'}`, group: 'skins' }))
    if (slot.special === 'armor') return armorEntries
    const cats = slot.cats || [slot.cat]
    const out: any[] = []
    for (const c of cats) for (const p of meta[c]?.parts || []) {
      const bank = ['face', 'hair', 'helmet', 'facedec', 'hairdec'].includes(c) ? 1000 : 2600
      out.push({ key: `${c}:${p.id}`, cat: c, part: p, label: `${c} #${p.id}`, group: `${c} · set ${Math.floor(p.frame_index / bank)}` })
    }
    return out
  }
  function currentKeyFor(slot: any): string | null {
    if (slot.special === 'skin') return !bodyIsArmor && sel.body ? `body:${sel.body.id}` : null
    if (slot.special === 'armor') return armorValue
    const cur = sel[slot.key]
    return cur ? `${cur.cat}:${cur.id}` : null
  }
  function labelFor(slot: any): string {
    if (slot.special === 'skin') return bodyIsArmor ? '(armor body)' : `skin ${sel.body?.id === 0 ? 'A' : 'B'}`
    if (slot.special === 'armor') return bodyIsArmor ? `armor b${sel.body.id}` : sel.coat ? `armor c${sel.coat.id}` : '— none —'
    const cur = sel[slot.key]
    return cur ? `${cur.cat} #${cur.id}` : '— none —'
  }
  const pickFor = (slot: any) => slot.special === 'skin' ? pickSkin : slot.special === 'armor' ? pickArmor : (e: any) => pickSlot(slot.key, e)
  function stepEntry(entries: any[], curKey: string | null, delta: number, pick: (e: any) => void) {
    if (!entries.length) return
    const i = entries.findIndex(e => e.key === curKey)
    pick(entries[(i + delta + entries.length) % entries.length])
  }
  const dyeTargetKey = (slotKey: string) => slotKey === 'skin' ? 'body' : slotKey === 'armor' ? (bodyIsArmor ? 'body' : 'coat') : slotKey

  const hasWeapon = !!sel.weapon
  let effAction = base
  if (hasWeapon && base === 'NormalStandBy') effAction = 'WeaponStandBy'
  if (hasWeapon && base === 'NormalWalk') effAction = 'WeaponWalk'
  const motionName = emote || effAction + DIRWORD[dir]
  const spec = useMemo(() => (mountOn ? { ...sel, mount: { id: mountId } } : sel), [sel, mountOn, mountId])

  useEffect(() => { if (mountOn && base !== 'Riding') setBase('Riding') }, [mountOn])

  function reset() {
    if (hero?.spec) applySpec(hero.spec)
    else { setSel(DEFAULT_SEL); setMountOn(false); setMountId(0) }
    setBase('NormalStandBy'); setEmote(''); setDir('S'); setSaveMsg(null)
  }
  async function save() {
    setSaving(true); setSaveMsg(null)
    const r = await saveOperatorCharacter(spec)
    setSaveMsg({ ok: r.ok, text: r.message })
    if (r.ok) setHero(h => h ? { ...h, spec, synced: true } : h)
    setSaving(false)
  }

  const who = hero?.profile?.display_name || hero?.profile?.displayName || hero?.character?.name || 'You'
  const dyeSlot = dyeFor
  const dyeTarget = dyeSlot ? dyeTargetKey(dyeSlot) : null
  const dyeCur = dyeTarget ? sel[dyeTarget] : null

  return (
    <div className="forge">
      <div className="forge-top">
        <div className="forge-mark">◆</div>
        <div className="forge-title"><b>Character Forge</b><span>Circle HQ · Game Command</span></div>
        <div className="forge-inv"><b>2,895</b> parts · <b>17</b> cats · <b>68</b> motions · <b>53</b> mounts · <b>648</b> fx</div>
      </div>

      <div className="forge-tabs">
        {TABS.map(t => (
          <button key={t.id} className={'forge-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <span className="tn">{t.icon}</span>
            <span><span className="lbl">{t.label}</span><span className="sub">{t.sub}</span></span>
            <span className="tnum">{t.tnum}</span>
          </button>
        ))}
      </div>

      <div className="forge-body">
        {tab === 'lab' && (
          <div className="forge-work">
            {/* LEFT — identity + path */}
            <div className="fcol users">
              <h4>Editing character</h4>
              <div className="f-userlist">
                <div className="f-user on">
                  <span className="f-ava" style={{ background: '#6366f1' }}>{who[0]?.toUpperCase()}</span>
                  <span><span className="nm">{loading ? 'Loading…' : who}</span><span className="uid">{hero?.character ? (hero.synced ? 'synced hero' : 'draft') : hero ? 'no hero yet' : 'offline / guest'}</span></span>
                  <span className={'f-badge ' + (hero?.character ? 'hero' : 'none')}>{hero?.character ? 'live' : '—'}</span>
                </div>
                <div className="f-userpath">
                  <span className="f-path-label">Path</span>
                  <div className="f-pathpills">
                    {PATHS.map(p => <button key={p} className={'f-pp' + (path === p ? ' on' : '')} onClick={() => setPath(p)}>{p}</button>)}
                  </div>
                </div>
              </div>
              <div className="f-note"><b>Single source of truth.</b> This edits the same character the games render — press <b>Save to games</b> and LashiraBloom &amp; Kingdom Heroes pick it up. <em>(Editing other user IDs needs an admin fetch RPC — next step.)</em></div>
            </div>

            {/* CENTER — wide stage (real compositor) */}
            <div className="fcol stage">
              <div className="f-stage-head">
                <div className="f-who">{who} <small>{path} · {motionName}</small></div>
                <div style={{ flex: 1 }} />
                <span className="f-pill live">● live spec</span>
                <button className="f-gbtn" onClick={save} disabled={saving} style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}>
                  {saving ? 'Saving…' : 'Save to games'}
                </button>
              </div>
              <div className="f-canvas-hold">
                <CompositeStage
                  spec={spec} motionName={motionName} playing={playing}
                  scale={scale} speed={speed} width={600} height={440}
                  onStep={(i: number, n: number) => setFrame(`step ${i + 1}/${n}`)}
                />
                <div className="f-mtag">{motionName} · {frame || '…'}</div>
                {saveMsg && <div className="f-savemsg" style={{ color: saveMsg.ok ? 'var(--ok, #16a34a)' : '#e0603a' }}>{saveMsg.text}</div>}
              </div>
              <div className="f-controls">
                <div className="f-btnrow">
                  {ACTIONS.map(([label, b]) => (
                    <button key={b} className={'f-gbtn' + (base === b && !emote ? ' on' : '')} onClick={() => { setEmote(''); setBase(b) }}>{label}</button>
                  ))}
                  <span style={{ flex: 1 }} />
                  <select className="f-gbtn" value={emote} onChange={e => setEmote(e.target.value)}>
                    <option value="">Emote…</option>
                    {EMOTES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="f-btnrow">
                  {['S', 'E', 'N', 'W'].map(d => (
                    <button key={d} className={'f-gbtn sq' + (dir === d ? ' on' : '')} onClick={() => setDir(d)}>{d}</button>
                  ))}
                  <button className="f-gbtn sq" onClick={() => setPlaying(p => !p)}>{playing ? '⏸' : '▶'}</button>
                  <span className="f-cap">speed</span>
                  <input className="f-rng" type="range" min={0.25} max={2} step={0.25} value={speed} onChange={e => setSpeed(Number(e.target.value))} />
                  <span className="f-cap">zoom</span>
                  <input className="f-rng" type="range" min={1} max={6} step={1} value={scale} onChange={e => setScale(Number(e.target.value))} />
                  <span style={{ flex: 1 }} />
                  <button className="f-gbtn danger" onClick={reset}>Reset</button>
                </div>
              </div>
            </div>

            {/* RIGHT — LIVE pickers */}
            <div className="fcol pickers">
              {GROUPS.map(group => (
                <div key={group} className="f-grp">
                  <h4>{group}</h4>
                  {SLOT_DEFS.filter(s => s.group === group).map(slot => {
                    const curKey = currentKeyFor(slot)
                    const on = slot.special ? true : !!sel[slot.key]
                    const dtKey = dyeTargetKey(slot.key)
                    const dtCat = sel[dtKey]?.cat || (dtKey === 'body' ? 'body' : slot.cat)
                    const dyeable = on && !!sel[dtKey] && (meta[dtCat]?.palettes ?? 0) > 1
                    const pick = pickFor(slot)
                    return (
                      <div key={slot.key} className="f-slot">
                        {slot.optional
                          ? <span className={'f-chk' + (on ? ' on' : '')} onClick={() => toggle(slot)} />
                          : <span className="f-dot" />}
                        <span className="f-sl">{slot.label}</span>
                        <button className="f-arw" onClick={() => stepEntry(entriesFor(slot), curKey, -1, pick)}>◀</button>
                        <span className="f-val" onClick={() => setBrowse({ slot })}><b>{labelFor(slot)}</b><span>▦</span></span>
                        <button className="f-arw" onClick={() => stepEntry(entriesFor(slot), curKey, +1, pick)}>▶</button>
                        {dyeable && <button className="f-dye" title="pick color" onClick={e => { setDyeFor(slot.key); setDyeAnchor(e.currentTarget.getBoundingClientRect()) }} />}
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="f-grp">
                <h4>Mount</h4>
                <div className="f-slot">
                  <span className={'f-chk' + (mountOn ? ' on' : '')} onClick={() => setMountOn(m => !m)} />
                  <span className="f-sl">Ride</span>
                  <button className="f-arw" onClick={() => setMountId(m => (m - 1 + Math.max(1, mountCount)) % Math.max(1, mountCount))}>◀</button>
                  <span className="f-val"><b>{mountId === 0 ? 'Horse' : `mount #${mountId}`}</b><span>/{mountCount || '…'}</span></span>
                  <button className="f-arw" onClick={() => setMountId(m => (m + 1) % Math.max(1, mountCount))}>▶</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'select' && (
          <div className="f-soon"><div className="card">
            <span className="f-step">Step 6</span>
            <h3>Character Select — the welcome page</h3>
            <p>The sign-in / pick-your-hero screen, built here as the design source, then mirrored 1:1 by LashiraBloom as its own welcome.</p>
          </div></div>
        )}
        {tab === 'npc' && (
          <div className="f-soon"><div className="card">
            <span className="f-step">Step 6</span>
            <h3>NPC Studio — the shared cast</h3>
            <p>The same composer aimed at named townsfolk, dressed from the same 2,895 parts and placed by both games.</p>
          </div></div>
        )}
      </div>

      {browse && (
        <PartBrowser
          title={`${browse.slot.label} collection`}
          entries={entriesFor(browse.slot)}
          value={currentKeyFor(browse.slot)}
          onPick={pickFor(browse.slot)}
          onClose={() => setBrowse(null)}
        />
      )}
      {dyeFor && dyeCur && dyeTarget && (
        <DyePicker
          cat={dyeCur.cat} part={meta[dyeCur.cat]?.byId[dyeCur.id]} value={dyeCur.palette}
          anchorRect={dyeAnchor}
          onPick={(pal: number | null) => setSel((prev: any) => ({ ...prev, [dyeTarget]: { ...prev[dyeTarget], palette: pal } }))}
          onClose={() => setDyeFor(null)}
        />
      )}
    </div>
  )
}

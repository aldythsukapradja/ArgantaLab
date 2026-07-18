import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PartBrowser } from './PartBrowser'
import { DyePicker } from './DyePicker'
import { ComposerPanel } from './ComposerPanel'
import { CharacterSelect } from './CharacterSelect'
import { NpcStudio } from './NpcStudio'
import { SkillForge } from './SkillForge'
import { Shop } from './Shop'
import { loadRoster, getCharacter, saveCharacter, loadShopCatalog, loadOwnedCosmetics, type RosterEntry, type RosterKind } from './heroData'
import { useComposer, DEFAULT_SEL, DIRWORD, PATHS, PATH_LABEL } from './composer'
import './forge.css'

const PAGE_SIZE = 10
const KIND_TABS: { id: RosterKind; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'adult', label: 'Adults' }, { id: 'kid', label: 'Kids' }]
const avatarColor = (name?: string) => ['#e0603a', '#6366f1', '#22c55e', '#d6409f', '#e0a83a'][((name || '?').charCodeAt(0) || 0) % 5]

// Character Forge — full-bleed pixel-perfect composer, a faithful clone of Kingdom's
// Character Lab, now with all 3 tabs live:
//  - Lab: real users, live pickers, save-to-games (single source of truth).
//  - Select: the welcome/pick-your-hero screen, mirrored 1:1 by LashiraBloom later.
//  - NPC Studio: the same composer aimed at a shared, publicly-readable cast.

type TabId = 'lab' | 'select' | 'npc' | 'skills' | 'shop'
const TABS: { id: TabId; icon: string; label: string; sub: string; tnum: string }[] = [
  { id: 'lab', icon: '🧬', label: 'Character Lab', sub: 'compose · animate', tnum: 'per user' },
  { id: 'select', icon: '🎴', label: 'Character Select', sub: 'welcome · picker', tnum: '→ Lashira' },
  { id: 'npc', icon: '🧑‍🌾', label: 'NPC Studio', sub: 'roster · cast', tnum: 'shared' },
  { id: 'skills', icon: '⚡', label: 'Skill Forge', sub: 'path · tier · balance', tnum: '4×3×6' },
  { id: 'shop', icon: '🛍️', label: 'Shop', sub: 'diamonds · gear', tnum: '2k–10k 💎' },
]

function CharacterLab() {
  const composer = useComposer()
  const [base, setBase] = useState('NormalStandBy')
  const [emote, setEmote] = useState('')
  const [dir, setDir] = useState('S')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [scale, setScale] = useState(3)
  const [path, setPath] = useState('warrior') // canonical id; label via PATH_LABEL
  const [browsing, setBrowsing] = useState(false) // roster list is collapsed until requested
  const [frame, setFrame] = useState('')
  const [browse, setBrowse] = useState<any>(null)
  const [dyeFor, setDyeFor] = useState<string | null>(null)
  const [dyeAnchor, setDyeAnchor] = useState<DOMRect | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [rosterSource, setRosterSource] = useState<'admin' | 'self' | 'offline'>('offline')
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({ all: 0, adult: 0, kid: 0 })
  const [kind, setKind] = useState<RosterKind>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const selected = roster.find(r => r.profileId === selectedId) || null
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 🔒 Shop-gated cosmetics: the catalog's item_keys minus whatever the SELECTED
  // roster user already owns. Everything outside the shop catalog stays exactly as
  // free as before — this only ever touches the curated 40 shop items.
  const [shopKeys, setShopKeys] = useState<Set<string>>(new Set())
  const [ownedKeys, setOwnedKeys] = useState<Set<string>>(new Set())
  const [lockMsg, setLockMsg] = useState<string | null>(null)
  useEffect(() => { loadShopCatalog().then(items => setShopKeys(new Set(items.map(i => i.itemKey)))) }, [])
  useEffect(() => {
    let live = true
    loadOwnedCosmetics(selectedId ?? undefined).then(o => { if (live) setOwnedKeys(o) })
    return () => { live = false }
  }, [selectedId])
  const lockedKeys = useMemo(() => new Set([...shopKeys].filter(k => !ownedKeys.has(k))), [shopKeys, ownedKeys])
  function flashLocked(label: string) {
    setLockMsg(`🔒 ${label} — unlock it in the 🛍️ Shop tab first.`)
    clearTimeout((flashLocked as any)._t)
    ;(flashLocked as any)._t = setTimeout(() => setLockMsg(null), 2600)
  }

  useEffect(() => {
    let live = true
    setLoading(true)
    ;(async () => {
      const r = await loadRoster({ search, kind, page, pageSize: PAGE_SIZE })
      if (!live) return
      setRoster(r.entries); setRosterSource(r.source); setTotal(r.total); setCounts(r.counts)
      setLoading(false)
      // Auto-select the first row only on first-ever load (not on every page/filter change).
      if (r.entries.length && selectedId == null) await selectUser(r.entries[0].profileId)
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, search, page])

  function runSearch() { setPage(1); setSearch(searchInput.trim()) }
  function switchKind(k: RosterKind) { setKind(k); setPage(1) }

  async function selectUser(profileId: string) {
    setSelectedId(profileId); setSaveMsg(null); setBrowsing(false)
    const c = await getCharacter(profileId)
    composer.applySpec(c?.spec ?? null)
    setPath(c?.pathId || 'warrior')
  }

  const hasWeapon = !!composer.sel.weapon
  let effAction = base
  if (hasWeapon && base === 'NormalStandBy') effAction = 'WeaponStandBy'
  if (hasWeapon && base === 'NormalWalk') effAction = 'WeaponWalk'
  const motionName = emote || effAction + DIRWORD[dir]

  useEffect(() => { if (composer.mountOn && base !== 'Riding') setBase('Riding') }, [composer.mountOn])

  async function reset() {
    if (selectedId) await selectUser(selectedId)
    else composer.applySpec(DEFAULT_SEL)
    setBase('NormalStandBy'); setEmote(''); setDir('S'); setSaveMsg(null)
  }
  async function save() {
    if (!selectedId) { setSaveMsg({ ok: false, text: 'No character selected.' }); return }
    setSaving(true); setSaveMsg(null)
    const r = await saveCharacter(selectedId, composer.spec, path)
    setSaveMsg({ ok: r.ok, text: r.message })
    if (r.ok) setRoster(rs => rs.map(x => x.profileId === selectedId ? { ...x, hasHero: true, pathId: path } : x))
    setSaving(false)
  }

  const who = selected?.displayName || selected?.name || 'Character'
  const dyeTarget = dyeFor ? composer.dyeTargetKey(dyeFor) : null
  const dyeCur = dyeTarget ? composer.sel[dyeTarget] : null

  return (
    <div className="forge-work">
      {/* LEFT — collapsed by default: the SELECTED user + their path pills.
          "Browse" reveals the full roster on demand (was a permanent scrolling
          list of everyone, which crowded the drawer). */}
      <div className="fcol users">
        <h4>Users · {loading ? 'loading…' : `${total} platform-wide`}</h4>

        {selected && (
          <div className="f-usercard">
            <div className="f-usercard-top">
              <span className="f-ava lg" style={{ background: avatarColor(selected.displayName || selected.name) }}>{(selected.displayName || selected.name || '?')[0]?.toUpperCase()}</span>
              <span className="f-usercard-id">
                <span className="nm">{selected.displayName || selected.name}</span>
                <span className="uid">{selected.accountType || 'user'}{selected.level ? ` · L${selected.level}` : ''}{selected.guardianName ? ` · ${selected.guardianName}` : ''}</span>
              </span>
              <span className={'f-badge ' + (selected.hasHero ? 'hero' : 'none')}>{selected.hasHero ? 'hero' : 'none'}</span>
            </div>
            <div className="f-userpath">
              <span className="f-path-label">Path</span>
              <div className="f-pathpills">
                {PATHS.map(p => <button key={p} className={'f-pp' + (path === p ? ' on' : '')} onClick={() => setPath(p)}>{PATH_LABEL[p]}</button>)}
              </div>
            </div>
          </div>
        )}

        <button className="f-browse-toggle" onClick={() => setBrowsing(b => !b)}>
          {browsing ? '▲ Hide list' : `▾ Browse ${total || ''} users`.replace('  ', ' ')}
        </button>

        {browsing && (
          <div className="f-browse">
            <div className="f-kind-toggle">
              {KIND_TABS.map(t => (
                <button key={t.id} className={kind === t.id ? 'on' : ''} onClick={() => switchKind(t.id)}>
                  {t.label} <span className="n">{counts[t.id]}</span>
                </button>
              ))}
            </div>
            <div className="f-search-row">
              <input className="f-search" placeholder="Search name or email…" value={searchInput}
                onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runSearch() }} />
              <button className="f-arw" title="Search" onClick={runSearch}><Search size={13} /></button>
            </div>
            <div className="f-userlist">
              {roster.length === 0 && !loading && (
                <div className="f-empty">{rosterSource === 'offline' ? 'Sign in to load characters.' : search ? 'No matches.' : 'No characters found.'}</div>
              )}
              {roster.map(u => {
                const on = u.profileId === selectedId
                return (
                  <button key={u.profileId} className={'f-user' + (on ? ' on' : '')} onClick={() => selectUser(u.profileId)}>
                    <span className="f-ava" style={{ background: avatarColor(u.displayName || u.name) }}>{(u.displayName || u.name || '?')[0]?.toUpperCase()}</span>
                    <span>
                      <span className="nm">{u.displayName || u.name}</span>
                      <span className="uid">{u.accountType || 'user'} · {u.pathId ? PATH_LABEL[u.pathId] || u.pathId : '—'}{u.level ? ` · L${u.level}` : ''}</span>
                    </span>
                    <span className={'f-badge ' + (u.hasHero ? 'hero' : 'none')}>{u.hasHero ? 'hero' : 'none'}</span>
                  </button>
                )
              })}
            </div>
            {total > PAGE_SIZE && (
              <div className="f-pagination">
                <button className="f-arw" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>◀</button>
                <span className="f-page-label">Page {page} / {pageCount}</span>
                <button className="f-arw" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>▶</button>
              </div>
            )}
          </div>
        )}

        <div className="f-note"><b>Single source of truth.</b> Pick any user, forge their look, and press <b>Save to games</b> — LashiraBloom &amp; Kingdom Heroes render exactly this. {rosterSource === 'self' && <em>(Admin RPC not deployed — showing your own character only.)</em>}</div>
      </div>

      <ComposerPanel
        composer={composer}
        motion={{ base, setBase, emote, setEmote, dir, setDir, playing, setPlaying, speed, setSpeed, scale, setScale, motionName, frame, onStep: (i, n) => setFrame(`step ${i + 1}/${n}`) }}
        headerLeft={<div className="f-who">{who} <small>{PATH_LABEL[path] || path} · {motionName}</small></div>}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="f-pill live">● live spec</span>
            <button className="f-gbtn" onClick={save} disabled={saving} style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}>
              {saving ? 'Saving…' : 'Save to games'}
            </button>
          </div>
        }
        onReset={reset}
        setBrowse={setBrowse}
        setDyeFor={setDyeFor} setDyeAnchor={setDyeAnchor}
      />

      {saveMsg && <div className="f-npc-msg" style={{ color: saveMsg.ok ? 'var(--ok, #16a34a)' : '#e0603a' }}>{saveMsg.text}</div>}
      {lockMsg && <div className="f-npc-msg" style={{ color: '#d9a12f' }}>{lockMsg}</div>}

      {browse && (
        <PartBrowser title={`${browse.slot.label} collection`} entries={composer.entriesFor(browse.slot)}
          value={composer.currentKeyFor(browse.slot)} onPick={composer.pickFor(browse.slot)} onClose={() => setBrowse(null)}
          lockedKeys={lockedKeys} onLocked={e => flashLocked(e.label)} />
      )}
      {dyeFor && dyeCur && dyeTarget && (
        <DyePicker cat={dyeCur.cat} part={composer.meta[dyeCur.cat]?.byId[dyeCur.id]} value={dyeCur.palette} anchorRect={dyeAnchor}
          onPick={(pal: number | null) => composer.setSel((prev: any) => ({ ...prev, [dyeTarget]: { ...prev[dyeTarget], palette: pal } }))}
          onClose={() => setDyeFor(null)} />
      )}
    </div>
  )
}

export function CharacterForge() {
  const [tab, setTab] = useState<TabId>('lab')

  return (
    <div className="charforge">
      <div className="cf-top">
        <div className="cf-mark">◆</div>
        <div className="cf-title"><b>Character Forge</b><span>Circle HQ · Game Command</span></div>
        <div className="cf-inv"><b>2,895</b> parts · <b>17</b> cats · <b>68</b> motions · <b>53</b> mounts · <b>648</b> fx</div>
      </div>

      <div className="cf-tabs">
        {TABS.map(t => (
          <button key={t.id} className={'cf-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <span className="tn">{t.icon}</span>
            <span><span className="lbl">{t.label}</span><span className="sub">{t.sub}</span></span>
            <span className="tnum">{t.tnum}</span>
          </button>
        ))}
      </div>

      <div className="cf-body" style={{ overflow: tab === 'lab' || tab === 'npc' || tab === 'skills' ? 'hidden' : 'auto' }}>
        {tab === 'lab' && <CharacterLab />}
        {tab === 'select' && <CharacterSelect />}
        {tab === 'npc' && <NpcStudio />}
        {tab === 'skills' && <SkillForge />}
        {tab === 'shop' && <Shop />}
      </div>
    </div>
  )
}

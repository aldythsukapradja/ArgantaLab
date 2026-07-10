import { useEffect, useMemo, useState } from 'react'
import { COMBAT_DEFAULTS, mergeTuning, fairnessSummary, validateTuning, publishTuning } from '@arganta/combat'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { MonsterStage, MonsterThumb, frameCountFor } from './MonsterStage'
import './battle.css'

// Battle Builder v2 — rebuilt from scratch per an entity-based IA: PVP is about
// PLAYERS (path balance/fairness), Bestiary is about MONSTERS (roster, per-monster
// stats, AND the global PvE world dials that used to float in "Combat"), Rewards
// is the economy (today: a teaser for the two systems that don't exist yet — boss
// rewards, PvP rewards — see docs/lashirabloom/battle-command-center-v2.md).
//
// Everything here edits a small OVERRIDE over @arganta/combat's package defaults —
// the SAME pipeline the game boots from (hq_combat_publish → combat_tuning_active).

const PATHS = ['warrior', 'rogue', 'poet', 'mage'] as const
const META: Record<string, { name: string; emoji: string; color: string; role: string }> = {
  warrior: { name: 'Guardian', emoji: '⚔️', color: '#f59e0b', role: 'Tank · big slow hits' },
  rogue: { name: 'Shadow', emoji: '🗡️', color: '#14b8a6', role: 'Skirmisher · fast flurry' },
  poet: { name: 'Mystic', emoji: '✨', color: '#8b5cf6', role: 'Attrition · sustain caster' },
  mage: { name: 'Arcanist', emoji: '🔮', color: '#ec4899', role: 'Glass cannon · range burst' },
}
const PATH_KNOBS: [string, string, number, number, number][] = [
  ['mag', 'Magic ×', 0.3, 1.9, 0.01], ['phy', 'Physical ×', 0.3, 1.9, 0.01],
  ['atkInt', 'Atk speed', 0.5, 1.3, 0.01], ['moveRel', 'Move', 1.4, 3.8, 0.05],
  ['pvpHpMul', 'PvP HP ×', 0.6, 1.4, 0.01], ['healMul', 'Heal ×', 0.4, 2.0, 0.05],
]
const ZONE_LIST = Object.keys(COMBAT_DEFAULTS.zones)
const ZONE_LABEL: Record<string, string> = { meadow: 'Meadow', grove: 'Grove', cavern: 'Cavern' }
const ZONE_COLOR: Record<string, string> = { meadow: '#5aa9e6', grove: '#67b26f', cavern: '#b98a5a' }
const MATERIALS = ['wood', 'stone', 'ore', 'gem', 'fish', 'hide', 'essence', 'token', 'shard']
const TABS: { id: TabId; icon: string; label: string; sub: string; tnum: string }[] = [
  { id: 'overview', icon: '📊', label: 'Overview', sub: 'pulse', tnum: 'dashboard' },
  { id: 'pvp', icon: '⚔️', label: 'PVP', sub: 'path balance · fairness', tnum: 'balance' },
  { id: 'bestiary', icon: '🐾', label: 'Bestiary', sub: 'roster · pve · scale', tnum: 'database' },
  { id: 'rewards', icon: '🎁', label: 'Rewards', sub: 'loot · boss · pvp', tnum: 'economy' },
]
type TabId = 'overview' | 'pvp' | 'bestiary' | 'rewards'
type Draft = Record<string, any>

const scoreTone = (s: number) => (s >= 82 ? 'var(--ok)' : s >= 68 ? 'var(--warn)' : 'var(--bad)')
const winTone = (v: number) => (Math.abs(v - 50) < 9 ? 'var(--ok)' : Math.abs(v - 50) < 17 ? 'var(--warn)' : 'var(--bad)')
const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const cellCol = (v: number) => { const t = Math.min(1, Math.abs(v - 50) / 45); const a = hx('#0d9488'), b = hx('#ec4899'); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})` }
// A tier badge is DERIVED from HP (display only — the config has no explicit tier
// field yet). Boss = today's one real boss-tier threshold (the Tiger).
const tierOf = (hp: number): [string, string, string] =>
  hp >= 15000 ? ['Boss', 'var(--bad)', 'var(--bad-bg)'] : hp >= 1500 ? ['Elite', 'var(--warn)', 'var(--warn-bg)'] : hp >= 250 ? ['Tough', 'var(--tl)', 'var(--tl-bg)'] : ['Mob', 'var(--tx3)', 'var(--bg3)']

// Owner-locked ordering rules (mirrors validateTuning's two checks) reduced to a
// per-"path.stat" bad-set so a single slider row can flag red WITHOUT a separate
// warning card that would push the layout around it.
function brokenPathStats(effective: any) {
  const bad: Record<string, 1> = {}
  const mark = (stat: string, order: string[]) => {
    for (let i = 0; i < order.length - 1; i++) {
      if (effective.paths[order[i]][stat] < effective.paths[order[i + 1]][stat]) { bad[order[i] + '.' + stat] = 1; bad[order[i + 1] + '.' + stat] = 1 }
    }
  }
  mark('mag', ['mage', 'poet', 'rogue', 'warrior'])
  mark('phy', ['warrior', 'rogue', 'poet', 'mage'])
  return bad
}

function Ring({ score, size = 130 }: { score: number; size?: number }) {
  const R = size * 0.43, C = 2 * Math.PI * R, off = C * (1 - score / 100), sw = size * 0.1
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--bg3)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={scoreTone(score)} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .5s var(--ease), stroke .3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
        <b className="bf-num" style={{ fontSize: size * 0.27, fontWeight: 800, color: scoreTone(score), lineHeight: 1 }}>{score}</b>
        <span style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 4 }}>balance</span>
      </div>
    </div>
  )
}
function WinBars({ per }: { per: Record<string, number> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 200 }}>
      {PATHS.map(p => (
        <div key={p} className="row" style={{ gap: 11 }}>
          <div style={{ width: 96, fontSize: 12.5, color: 'var(--tx2)' }}>{META[p].emoji} {META[p].name}</div>
          <div style={{ flex: 1, height: 22, background: 'var(--bg3)', borderRadius: 7, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--bd3)' }} />
            <div style={{ width: `${Math.max(2, Math.min(100, per[p]))}%`, height: '100%', background: META[p].color, borderRadius: 7, transition: 'width .5s var(--ease)' }} />
          </div>
          <div className="bf-num" style={{ width: 42, textAlign: 'right', fontSize: 13, fontWeight: 700, color: winTone(per[p]) }}>{per[p].toFixed(0)}%</div>
        </div>
      ))}
    </div>
  )
}
function Heatmap({ matrix }: { matrix: any }) {
  return (
    <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
        <tbody>
          <tr><td />{PATHS.map(p => <th key={p} style={{ fontSize: 15, padding: 2 }}>{META[p].emoji}</th>)}</tr>
          {PATHS.map((a, i) => (
            <tr key={a}>
              <td style={{ fontSize: 16, textAlign: 'right', paddingRight: 4 }}>{META[a].emoji}</td>
              {PATHS.map((b, j) => {
                const v = matrix[a][b]
                return i === j
                  ? <td key={b} style={{ width: 50, height: 40, borderRadius: 9, background: 'var(--bg3)', color: 'var(--tx3)', textAlign: 'center' }}>–</td>
                  : <td key={b} className="bf-num" style={{ width: 50, height: 40, borderRadius: 9, background: cellCol(v), color: '#fff', textAlign: 'center', fontSize: 12.5, fontWeight: 700 }}>{v.toFixed(0)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function RadarSvg({ stats, color }: { stats: any; color: string }) {
  const size = 124, cx = 62, cy = 62, R = 44
  const axes: [string, number][] = [
    ['MAG', stats.mag / 1.6], ['PHY', stats.phy / 1.6], ['SPD', (1.15 - stats.atkInt) / 0.55],
    ['TANK', (stats.pvpHpMul - 0.6) / 0.8], ['HEAL', (stats.healMul - 0.4) / 1.4],
  ]
  const pt = (val: number, k: number) => { const an = -Math.PI / 2 + k * 2 * Math.PI / 5; return [cx + R * val * Math.cos(an), cy + R * val * Math.sin(an)] }
  const poly = axes.map(([, v], k) => pt(Math.max(0.05, Math.min(1, v)), k).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}>
      {[1, 2, 3].map(g => <polygon key={g} points={axes.map((_, k) => pt(g / 3, k).join(',')).join(' ')} fill="none" stroke="var(--grid)" />)}
      <polygon points={poly} fill={color} fillOpacity={0.24} stroke={color} strokeWidth={2} style={{ transition: 'all .3s var(--ease)' }} />
      {axes.map(([label], k) => { const an = -Math.PI / 2 + k * 2 * Math.PI / 5; const lx = cx + (R + 10) * Math.cos(an), ly = cy + (R + 10) * Math.sin(an); return <text key={label} x={lx} y={ly} fontSize={7.5} fill="var(--tx3)" textAnchor="middle" dominantBaseline="middle">{label}</text> })}
    </svg>
  )
}
// The signature move: the value rides the slider fill/thumb instead of floating
// in a separate column, so there's no dead track space. `bad` turns the whole
// row red INLINE — no reflowing warning card anywhere else on the page.
function VSlider({ label, val, lo, hi, step, color, bad, fmt, labelWidth = 64, onChange }:
  { label: string; val: number; lo: number; hi: number; step: number; color: string; bad?: boolean; fmt?: (v: number) => string | number; labelWidth?: number; onChange: (v: number) => void }) {
  const pct = Math.max(0, Math.min(100, ((val - lo) / (hi - lo)) * 100))
  return (
    <div className={'bf-vrow' + (bad ? ' bad' : '')} style={{ ['--pc' as any]: color }}>
      <div className="bf-vl" style={{ width: labelWidth }}>{label}{bad && <span className="warn" title="breaks class ordering"> ⚠</span>}</div>
      <div className="bf-vs">
        <div className="bf-vtrack" /><div className="bf-vfill" style={{ width: pct + '%' }} />
        <div className="bf-vthumb bf-num" style={{ left: pct + '%' }}>{fmt ? fmt(val) : Number(val).toFixed(2)}</div>
        <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => onChange(parseFloat(e.target.value))} />
      </div>
    </div>
  )
}

export function BattleBuilder() {
  const [tab, setTab] = useState<TabId>('overview')
  const [draft, setDraft] = useState<Draft>({})
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Monster Lab (now inside Bestiary) local UI state — stage playback only, not part of the tuning draft.
  const [sel, setSel] = useState('squirrel')
  const [dir, setDir] = useState('S')
  const [playing, setPlaying] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [frameTag, setFrameTag] = useState('')
  const [addNote, setAddNote] = useState(false)

  const effective = useMemo(() => mergeTuning(draft), [draft])
  const fair = useMemo(() => fairnessSummary(effective, { level: 10, samples: 200 }), [effective])
  const valid = useMemo(() => validateTuning(draft), [draft])
  const badMap = useMemo(() => brokenPathStats(effective), [effective])
  const orderWarnings = useMemo(() => valid.warnings.filter((w: string) => w.startsWith('Magic order') || w.startsWith('Physical order')), [valid])
  const enemyIds: string[] = Object.keys(COMBAT_DEFAULTS.enemies)
  const stagedGroups = Object.keys(draft.paths || {}).length + Object.keys(draft.enemies || {}).length
    + Object.keys(draft.zones || {}).length + (draft.spawn ? 1 : 0) + (draft.rewards ? 1 : 0)
  const dirty = stagedGroups > 0

  const editPath = (p: string, k: string, v: number) => setDraft(d => ({ ...d, paths: { ...(d.paths || {}), [p]: { ...((d.paths || {})[p] || {}), [k]: v } } }))
  const editEnemy = (id: string, f: string, v: number) => setDraft(d => ({ ...d, enemies: { ...(d.enemies || {}), [id]: { ...((d.enemies || {})[id] || {}), [f]: v } } }))
  const editSpawn = (f: string, v: any) => setDraft(d => ({ ...d, spawn: { ...(d.spawn || {}), [f]: v } }))
  const editRewards = (f: string, v: any) => setDraft(d => ({ ...d, rewards: { ...(d.rewards || {}), [f]: v } }))
  const zonesOf = (id: string) => ZONE_LIST.filter(z => (effective.zones as any)[z]?.includes(id))
  const toggleZone = (zone: string, id: string) => {
    const cur: string[] = (effective.zones as any)[zone] || []
    const next = cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id]
    setDraft(d => ({ ...d, zones: { ...(d.zones || {}), [zone]: next } }))
  }
  const currentDrops = (id: string): any[] => (effective.enemies as any)[id]?.drops || []
  const setDrops = (id: string, drops: any[]) => setDraft(d => ({ ...d, enemies: { ...(d.enemies || {}), [id]: { ...((d.enemies || {})[id] || {}), drops } } }))
  const addDrop = (id: string) => setDrops(id, [...currentDrops(id), { k: 'wood', min: 1, max: 1, p: 0.2 }])
  const updateDrop = (id: string, idx: number, patch: any) => { const l = currentDrops(id).slice(); l[idx] = { ...l[idx], ...patch }; setDrops(id, l) }
  const removeDrop = (id: string, idx: number) => { const l = currentDrops(id).slice(); l.splice(idx, 1); setDrops(id, l) }
  const reset = () => { setDraft({}); setPubMsg(null) }

  async function publish() {
    setPublishing(true); setPubMsg(null)
    try {
      const r = await publishTuning(supabase, draft, { note: 'HQ Battle Builder' })
      setPubMsg({ ok: true, text: `Published to LashiraBloom · fairness ${r.fairness.score}. Applies on next game boot.` }); setDraft({})
    } catch (e: any) { setPubMsg({ ok: false, text: `Publish failed: ${e?.message || e}` }) } finally { setPublishing(false) }
  }

  const hot = useMemo(() => {
    let w: any = { pct: 50 }
    for (const a of PATHS) for (const b of PATHS) if (a !== b) { const v = fair.matrix[a][b]; if (Math.abs(v - 50) > Math.abs(w.pct - 50)) w = { a, b, pct: v } }
    return w
  }, [fair])

  // Arrow keys or WASD rotate the Monster Lab stage — only while Bestiary is the
  // open tab, and never while a text/number field elsewhere on the tab has focus
  // (loot-table qty inputs, etc.) so typing "s" or "d" doesn't spin the monster.
  useEffect(() => {
    if (tab !== 'bestiary') return
    const KEY_DIR: Record<string, 'S' | 'E' | 'N' | 'W'> = {
      arrowup: 'N', arrowdown: 'S', arrowleft: 'W', arrowright: 'E',
      w: 'N', s: 'S', a: 'W', d: 'E',
    }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const d = KEY_DIR[e.key.toLowerCase()]
      if (!d) return
      e.preventDefault()
      setDir(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab])

  // Boss-tier monsters (Tiger today) spawn via a dungeon gate, not a zone list —
  // excluded from "unplaced" everywhere so the roster health read stays honest.
  const nonBossIds = enemyIds.filter(id => tierOf((effective.enemies as any)[id].hp)[0] !== 'Boss')
  const unplaced = nonBossIds.filter(id => zonesOf(id).length === 0)
  const zoneCounts = ZONE_LIST.map(z => ({ z, label: ZONE_LABEL[z], color: ZONE_COLOR[z], n: ((effective.zones as any)[z] || []).length }))
  const covered = zoneCounts.filter(z => z.n > 0)
  const attentionGroups = (unplaced.length > 0 ? 1 : 0) + (orderWarnings.length > 0 ? 1 : 0)

  const selE: any = effective.enemies[sel]
  const [selTier] = tierOf(selE.hp)
  const selZones = zonesOf(sel)
  const selBossGate = selTier === 'Boss' && selZones.length === 0

  const pubBar = (
    <div className="bf-pubbar">
      <span className="mono bf-num" style={{ fontSize: 11.5, color: 'var(--tx2)' }}>▲ <b style={{ color: 'var(--tx)' }}>{stagedGroups}</b> group{stagedGroups === 1 ? '' : 's'} staged</span>
      <span className="pill pill-mut bf-num" style={{ color: scoreTone(fair.score) }}>fairness {fair.score}</span>
      {orderWarnings.length > 0 && <span className="pill" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>⚠ {orderWarnings.length} rule{orderWarnings.length === 1 ? '' : 's'} broken</span>}
      {!cloudEnabled && <span className="pill pill-mut" style={{ color: 'var(--warn)' }}>offline preview — run migration_combat_tuning.sql to publish live</span>}
      {pubMsg && <span className="sub" style={{ color: pubMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{pubMsg.text}</span>}
      <button className="bf-pubbtn" style={{ marginLeft: 'auto' }} onClick={publish} disabled={publishing || !cloudEnabled}>{publishing ? 'Publishing…' : '⚡ Publish to LashiraBloom'}</button>
    </div>
  )

  return (
    <div className="battleforge">
      <div className="bf-top">
        <div className="bf-mark">⚔</div>
        <div className="bf-title"><b>Battle Builder</b><span>Circle HQ · Game Command</span></div>
        <div className="bf-inv"><b>{PATHS.length}</b> paths · <b>{enemyIds.length}</b> monsters · <b>{ZONE_LIST.length}</b> zones</div>
        <button className="kbd" onClick={reset} disabled={!dirty} title="Discard every staged edit and go back to the published/default config" style={{ opacity: dirty ? 1 : 0.5 }}>↺ Reset to defaults</button>
      </div>

      <div className="bf-tabs">
        {TABS.map(t => (
          <button key={t.id} className={'bf-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <span className="tn">{t.icon}</span>
            <span><span className="lbl">{t.label}</span><span className="sub">{t.sub}</span></span>
            <span className="tnum">{t.tnum}</span>
          </button>
        ))}
      </div>

      <div className="bf-body" style={{ overflow: tab === 'bestiary' ? 'hidden' : 'auto' }}>
        {tab === 'overview' && (
          <div className="bf-pad">
            <div className="grid bf-kpis">
              <div className="card bf-kpi"><div className="k">Fairness</div><div className="v bf-num" style={{ color: scoreTone(fair.score) }}>{fair.score}</div><div className="s">RMS {fair.rms.toFixed(1)}pts</div></div>
              <div className="card bf-kpi"><div className="k">Roster</div><div className="v bf-num">{enemyIds.length}</div><div className="s">{ZONE_LIST.length} zones defined</div></div>
              <div className="card bf-kpi"><div className="k">Zone coverage</div><div className="v bf-num">{covered.length}/{ZONE_LIST.length}</div><div className="s">{covered.length ? covered.map(z => z.label).join(' · ') : 'none placed'}</div></div>
              <div className="card bf-kpi"><div className="k">Needs attention</div><div className="v bf-num" style={{ color: attentionGroups ? 'var(--warn)' : 'var(--ok)' }}>{attentionGroups}</div><div className="s">{attentionGroups ? 'see below' : 'all clear'}</div></div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="card">
                <div className="chead"><h3>⚖️ Fairness</h3><span className="pill pill-mut bf-num" style={{ marginLeft: 'auto', color: scoreTone(fair.score) }}>RMS {fair.rms.toFixed(1)}pts</span></div>
                <div className="row" style={{ gap: 18, alignItems: 'center' }}>
                  <Ring score={fair.score} />
                  <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>
                    Every path near 50% = fair. Same seeded simulator the game ships, so this number matches in-game.
                    <div style={{ marginTop: 11, padding: '9px 12px', borderLeft: '3px solid var(--warn)', background: 'var(--bg2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--warn)' }}>Hottest matchup</div>
                      <div style={{ marginTop: 2 }}>{META[hot.a]?.emoji} <b>{META[hot.a]?.name}</b> beats {META[hot.b]?.emoji} {META[hot.b]?.name} <b className="bf-num">{hot.pct?.toFixed(0)}%</b></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="chead"><h3>Win matrix</h3><span className="sub" style={{ marginLeft: 'auto' }}>row vs column · L10</span></div>
                <Heatmap matrix={fair.matrix} />
                <div className="row" style={{ gap: 14, justifyContent: 'center', marginTop: 10, fontSize: 11, color: 'var(--tx2)' }}>
                  <span><span style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 3, background: '#0d9488', marginRight: 5, verticalAlign: 'middle' }} />fair ~50%</span>
                  <span><span style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 3, background: '#ec4899', marginRight: 5, verticalAlign: 'middle' }} />lopsided</span>
                </div>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="card">
                <div className="chead"><h3>Win rate by path</h3><span className="sub" style={{ marginLeft: 'auto' }}>vs the field</span></div>
                <WinBars per={fair.perPath} />
              </div>
              <div className="card">
                <div className="chead"><h3>🔔 Needs attention</h3><span className="sub" style={{ marginLeft: 'auto' }}>{attentionGroups} item{attentionGroups === 1 ? '' : 's'}</span></div>
                {unplaced.length > 0 && (
                  <div className="bf-att"><span className="dot" style={{ background: 'var(--warn)' }} /><span className="tx">🐾 <b>{unplaced.join(', ')}</b> not placed in a zone — won't spawn</span><button className="go" onClick={() => setTab('bestiary')}>Bestiary →</button></div>
                )}
                {orderWarnings.length > 0 && (
                  <div className="bf-att"><span className="dot" style={{ background: 'var(--bad)' }} /><span className="tx">⚠ <b>{orderWarnings.length}</b> path stat rule{orderWarnings.length === 1 ? '' : 's'} broken</span><button className="go" onClick={() => setTab('pvp')}>PVP →</button></div>
                )}
                {dirty && (
                  <div className="bf-att"><span className="dot" style={{ background: 'var(--acc)' }} /><span className="tx">▲ <b className="bf-num">{stagedGroups}</b> change{stagedGroups === 1 ? '' : 's'} staged, not published</span></div>
                )}
                {!unplaced.length && !orderWarnings.length && !dirty && <div className="sub" style={{ textAlign: 'center', padding: 14 }}>✓ Nothing needs attention.</div>}
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div className="chead"><h3>🐾 Zone coverage</h3><span className="sub" style={{ marginLeft: 'auto' }}>{enemyIds.length} monsters</span></div>
              <div className="bf-zbar">
                {covered.map(z => <div key={z.z} className="bf-zseg bf-num" style={{ flex: z.n, background: z.color }}>{z.n}</div>)}
                {unplaced.length > 0 && <div className="bf-zseg bf-num" style={{ flex: unplaced.length, background: 'var(--bad)' }}>{unplaced.length}</div>}
              </div>
              <div className="bf-zleg">
                {zoneCounts.map(z => <span key={z.z}><i style={{ background: z.color }} />{z.label} ({z.n})</span>)}
                {unplaced.length > 0 && <span><i style={{ background: 'var(--bad)' }} />Unplaced ({unplaced.length})</span>}
              </div>
              <div className="bf-note" style={{ marginTop: 12 }}><b>Author the roster</b> in Bestiary — animate, place in a zone, set stats &amp; drops. Highest tier live: <b>{tierOf(Math.max(...enemyIds.map(id => (effective.enemies as any)[id].hp)))[0]}</b>.</div>
            </div>
          </div>
        )}

        {tab === 'pvp' && (
          <div className="bf-pad">
            <div className="bf-sec"><span className="ic" style={{ background: 'var(--acc-soft)' }}>⚔️</span><span className="tt">PVP</span><span className="sb">path balance · four classes fight ~50/50</span><span className="ln" /></div>

            <div className="card bf-rail" style={{ marginBottom: 14 }}>
              <Ring score={fair.score} size={88} />
              <Heatmap matrix={fair.matrix} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="hot"><div className="e">Hottest matchup</div>{META[hot.a]?.emoji} <b>{META[hot.a]?.name}</b> beats {META[hot.b]?.emoji} {META[hot.b]?.name} <b className="bf-num">{hot.pct?.toFixed(0)}%</b></div>
                <p className="sub" style={{ marginTop: 8 }}>Same seeded simulator the game ships — this number matches in-game. Drag any stat below; win% and this rail update live.</p>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {PATHS.map(p => (
                <div key={p} className="card" style={{ padding: 0, borderTop: `3px solid ${META[p].color}` }}>
                  <div className="chead" style={{ padding: '13px 15px 8px', margin: 0 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: META[p].color + '22', fontSize: 16 }}>{META[p].emoji}</span>
                    <div><div style={{ fontSize: 14, fontWeight: 700 }}>{META[p].name}</div><div style={{ fontSize: 10, color: 'var(--tx3)' }}>{META[p].role}</div></div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}><b className="bf-num" style={{ fontSize: 20, fontWeight: 800, color: winTone(fair.perPath[p]) }}>{fair.perPath[p].toFixed(0)}%</b><div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>win</div></div>
                  </div>
                  <div className="row" style={{ gap: 10, padding: '4px 15px 14px', alignItems: 'center' }}>
                    <RadarSvg stats={effective.paths[p]} color={META[p].color} />
                    <div style={{ flex: 1 }}>
                      {PATH_KNOBS.map(([k, label, lo, hi, step]) => (
                        <VSlider key={k} label={label} val={effective.paths[p][k]} lo={lo} hi={hi} step={step}
                          color={META[p].color} bad={!!badMap[p + '.' + k]} onChange={v => editPath(p, k, v)} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pubBar}
          </div>
        )}

        {tab === 'bestiary' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="bf-wbar">
              <div className="bf-sec" style={{ margin: 0 }}><span className="ic" style={{ background: 'var(--warn-bg)' }}>🐗</span><span className="tt">PVE world dials</span><span className="sb">spawn pace &amp; global reward multipliers — every monster below inherits these</span><span className="ln" /></div>
              <div className="row" style={{ gap: 26, flexWrap: 'wrap', marginTop: 10 }}>
                <div style={{ minWidth: 210 }}><VSlider label="Max mobs" labelWidth={78} val={effective.spawn.maxConcurrent} lo={1} hi={12} step={1} color="var(--acc)" fmt={v => String(Math.round(v))} onChange={v => editSpawn('maxConcurrent', Math.round(v))} /></div>
                <div style={{ minWidth: 210 }}><VSlider label="Respawn" labelWidth={78} val={effective.spawn.intervalMs} lo={300} hi={3000} step={100} color="var(--acc)" fmt={v => Math.round(v) + 'ms'} onChange={v => editSpawn('intervalMs', Math.round(v))} /></div>
                <div style={{ minWidth: 210 }}><VSlider label="XP ×" labelWidth={78} val={effective.rewards.xpMul} lo={0.5} hi={4} step={0.1} color="var(--acc)" fmt={v => v.toFixed(1) + '×'} onChange={v => editRewards('xpMul', v)} /></div>
                <div style={{ minWidth: 210 }}><VSlider label="Bloom ×" labelWidth={78} val={effective.rewards.bloomMul} lo={0.5} hi={4} step={0.1} color="var(--acc)" fmt={v => v.toFixed(1) + '×'} onChange={v => editRewards('bloomMul', v)} /></div>
              </div>
            </div>

            <div className="bf-work" style={{ flex: 1, minHeight: 0 }}>
              {/* LEFT — roster */}
              <div className="bf-col roster">
                <h4>Monster roster</h4>
                {enemyIds.map(id => {
                  const e: any = effective.enemies[id]; const [tl, tc] = tierOf(e.hp); const zs = zonesOf(id)
                  return (
                    <button key={id} className={'bf-mrow' + (id === sel ? ' on' : '')} onClick={() => { setSel(id); setDir('S'); setPlaying(true) }}>
                      <MonsterThumb id={id} />
                      <div><div className="nm">{id}</div><div className="zn">{zs.length ? zs.map(z => ZONE_LABEL[z]).join(', ') : (tl === 'Boss' ? 'boss gate' : 'unplaced')}</div></div>
                      <span className="bf-mtier" style={{ color: tc, background: tc === 'var(--tx3)' ? 'var(--bg3)' : undefined }}>{tl}</span>
                    </button>
                  )
                })}
                <button className="bf-addm" onClick={() => setAddNote(a => !a)}>＋ New monster</button>
                {addNote && (
                  <div className="bf-note">
                    <b>Coming next.</b> Adding brand-new roster entries needs the registry-as-data upgrade (roadmap) — today the Bestiary tunes these {enemyIds.length} existing monsters.
                    <button className="bf-gbtn" style={{ marginTop: 8 }} onClick={() => setAddNote(false)}>Got it</button>
                  </div>
                )}
                <div className="bf-note"><b>Built to grow.</b> Each row here becomes searchable, groupable &amp; bulk-editable as the roster scales past 6.</div>
              </div>

              {/* CENTER — animated stage */}
              <div className="bf-col stage">
                <div className="bf-stage-head">
                  <div className="bf-stage-who">{sel} <small>{selZones.length ? selZones.map(z => ZONE_LABEL[z]).join(' · ') : selTier} · {selTier}</small></div>
                  <div style={{ flex: 1 }} />
                  <span className="bf-pill live">● live</span>
                  <span className="bf-pill clone">1:1 · LashiraBloom</span>
                </div>
                <div className="bf-canvas-hold">
                  <MonsterStage id={sel} dir={dir} playing={playing} zoom={zoom} onFrame={(i, n) => setFrameTag(n > 0 ? `walk · ${{ S: 'south', E: 'east', N: 'north', W: 'west' }[dir]} · step ${i + 1}/${n}` : `still · ${{ S: 'south', E: 'east', N: 'north', W: 'west' }[dir]}`)} />
                  <div className="bf-khint">↑↓←→ / WASD to rotate{frameCountFor(sel) === 0 ? ' · no walk cycle yet' : ''}</div>
                  <div className="bf-mtag">{frameTag || '…'}</div>
                  <div className="bf-cctrl">
                    <button className="bf-gbtn sq" onClick={() => setPlaying(p => !p)} title="Play / pause">{playing ? '⏸' : '▶'}</button>
                    <span className="bf-cap">zoom</span>
                    <input className="bf-rng" type="range" min={0.6} max={1.8} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* RIGHT — settings */}
              <div className="bf-col settings">
                <div className="bf-setgrp">
                  <h4>Placement</h4>
                  <div className="bf-slot">
                    <span className="sl">Area / Zone</span>
                    {selBossGate ? <span className="pill pill-mut" style={{ marginLeft: 'auto' }}>🔒 boss gate</span> : (
                      <div className="bf-pills">{ZONE_LIST.map(z => <button key={z} className={'bf-pp' + (selZones.includes(z) ? ' on' : '')} onClick={() => toggleZone(z, sel)}>{ZONE_LABEL[z]}</button>)}</div>
                    )}
                  </div>
                  {selBossGate
                    ? <p className="sub" style={{ fontSize: 10.5, marginTop: 4 }}>Spawns via the dungeon boss encounter, not a zone list.</p>
                    : selZones.length === 0 && <p className="sub" style={{ fontSize: 10.5, marginTop: 4, color: 'var(--warn)' }}>⚠ Not placed anywhere — won't spawn until assigned.</p>}
                </div>

                <div className="bf-setgrp">
                  <h4>Combat stats</h4>
                  <VSlider label="❤ Health" labelWidth={76} val={selE.hp} lo={1} hi={20000} step={10} color="var(--acc)" fmt={v => Math.round(v)} onChange={v => editEnemy(sel, 'hp', Math.round(v))} />
                  <VSlider label="⚔ Attack" labelWidth={76} val={selE.atk} lo={1} hi={500} step={1} color="var(--acc)" fmt={v => Math.round(v)} onChange={v => editEnemy(sel, 'atk', Math.round(v))} />
                  <VSlider label="⭐ XP" labelWidth={76} val={selE.xp} lo={1} hi={500} step={1} color="var(--acc)" fmt={v => Math.round(v)} onChange={v => editEnemy(sel, 'xp', Math.round(v))} />
                  <VSlider label="🌸 Bloom" labelWidth={76} val={selE.bloom} lo={1} hi={500} step={1} color="var(--acc)" fmt={v => Math.round(v)} onChange={v => editEnemy(sel, 'bloom', Math.round(v))} />
                  <VSlider label="🏃 Move ms" labelWidth={76} val={selE.speedMs} lo={80} hi={2000} step={10} color="var(--acc)" fmt={v => Math.round(v) + 'ms'} onChange={v => editEnemy(sel, 'speedMs', Math.round(v))} />
                </div>

                <div className="bf-setgrp">
                  <h4>Loot table</h4>
                  {currentDrops(sel).map((d: any, i: number) => (
                    <div key={i} className="bf-droprow">
                      <select value={d.k} onChange={e => updateDrop(sel, i, { k: e.target.value })}>{MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                      <input type="number" min={0} value={d.min} onChange={e => updateDrop(sel, i, { min: Math.max(0, parseInt(e.target.value) || 0) })} title="min" />
                      <span className="sub" style={{ fontSize: 9 }}>–</span>
                      <input type="number" min={0} value={d.max} onChange={e => updateDrop(sel, i, { max: Math.max(0, parseInt(e.target.value) || 0) })} title="max" />
                      <input type="number" min={0} max={100} value={Math.round(d.p * 100)} onChange={e => updateDrop(sel, i, { p: Math.min(1, Math.max(0, (parseInt(e.target.value) || 0) / 100)) })} title="probability %" style={{ width: 40 }} />
                      <span className="sub" style={{ fontSize: 9 }}>%</span>
                      <button className="bf-dropx" onClick={() => removeDrop(sel, i)}>✕</button>
                    </div>
                  ))}
                  <button className="bf-adddrop" onClick={() => addDrop(sel)}>＋ add drop</button>
                </div>

                {selTier === 'Boss' && (
                  <div className="bf-setgrp">
                    <h4>Boss mechanics <span style={{ color: 'var(--warn)', textTransform: 'none', letterSpacing: 0 }}>· design seam</span></h4>
                    <div className="bf-slot"><span className="sl">Telegraph</span><div className="bf-val">not built yet</div></div>
                    <div className="bf-slot"><span className="sl">Phases</span><div className="bf-val">not built yet</div></div>
                    <div className="bf-slot"><span className="sl">Enrage</span><div className="bf-val">not built yet</div></div>
                    <p className="sub" style={{ fontSize: 10.5, marginTop: 4 }}>Placeholders for when the boss-phase system lands — see the Rewards tab for the first-clear/lockout schema sketch.</p>
                  </div>
                )}

                <div className="bf-note"><b>1:1 with LashiraBloom.</b> Pixel mirrors from the game's own creature sheets; a future shared art package keeps an identical <span className="mono">id/dir/frame</span> tree so a drop-in PNG reskins both sides. Stats, zone &amp; drops here write the same config the publish bar ships.</div>
              </div>
            </div>
            {pubBar}
          </div>
        )}

        {tab === 'rewards' && (
          <div className="bf-pad">
            <div className="bf-teaser">
              <div className="big">🎁</div>
              <h2>Rewards — the economy</h2>
              <p className="sub">Every reward the game grants, reasoned about as one economy — the PvE loot pipeline (now tunable in Bestiary) plus two systems that don't exist yet.</p>
              <div className="cols">
                <div className="col"><b>🌸 PvE loot economy</b><p>Global XP× / Bloom× live in Bestiary's world dials now. This tab would add a mint-vs-sink read and drop-table templates on top.</p></div>
                <div className="col"><b>🐯 Boss rewards <span style={{ color: 'var(--warn)' }}>NEW</span></b><p>First-clear bundle · repeat lockout (daily/weekly) · party-split rule — beyond today's flat drop table.</p></div>
                <div className="col"><b>🗡️ PvP rewards <span style={{ color: 'var(--warn)' }}>NEW</span></b><p>Per-win Bloom + a daily cap + rank-tier bundles. No Diamonds field in the schema — the no-mint rule is enforced by the shape, not a policy note.</p></div>
              </div>
              <p className="sub" style={{ marginTop: 16 }}>Spec'd in <span className="mono">docs/lashirabloom/battle-command-center-v2.md</span> — needs sign-off before build, since PvP rewards change the shipped "mints nothing" rule.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

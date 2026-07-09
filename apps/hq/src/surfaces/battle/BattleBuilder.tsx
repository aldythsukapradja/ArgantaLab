import { useMemo, useState } from 'react'
import { COMBAT_DEFAULTS, mergeTuning, fairnessSummary, validateTuning, publishTuning } from '@arganta/combat'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { MonsterStage, MonsterThumb, frameCountFor } from './MonsterStage'
import './battle.css'

// Battle Builder — rebuilt in the Character-Forge atelier feel (full-bleed top bar
// + chunky tabs), restructured per spec: PVP + PVE + Publish live on ONE "Combat"
// page; Overview is the only separate dashboard; a new "Monster Lab" authors the
// roster (Character-Lab pattern: an animated pixel stage + a settings column),
// mirroring the game's real creature sprites 1:1.
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
const MATERIALS = ['wood', 'stone', 'ore', 'gem', 'fish', 'hide', 'essence', 'token', 'shard']
const DIRS: ['S', 'E', 'N', 'W'] = ['S', 'E', 'N', 'W']
const TABS: { id: TabId; icon: string; label: string; sub: string; tnum: string }[] = [
  { id: 'overview', icon: '📊', label: 'Overview', sub: 'pulse', tnum: 'dashboard' },
  { id: 'combat', icon: '⚔️', label: 'Combat', sub: 'pvp · pve · publish', tnum: 'one page' },
  { id: 'lab', icon: '🐾', label: 'Monster Lab', sub: 'roster · animate', tnum: 'catalogue' },
]
type TabId = 'overview' | 'combat' | 'lab'
type Draft = Record<string, any>

const scoreTone = (s: number) => (s >= 82 ? 'var(--ok)' : s >= 68 ? 'var(--warn)' : 'var(--bad)')
const winTone = (v: number) => (Math.abs(v - 50) < 9 ? 'var(--ok)' : Math.abs(v - 50) < 17 ? 'var(--warn)' : 'var(--bad)')
const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const cellCol = (v: number) => { const t = Math.min(1, Math.abs(v - 50) / 45); const a = hx('#0d9488'), b = hx('#ec4899'); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})` }
// A tier badge is DERIVED from HP (display only — the config has no explicit tier
// field yet). Boss = today's one real boss-tier threshold (the Tiger).
const tierOf = (hp: number): [string, string, string] =>
  hp >= 15000 ? ['Boss', 'var(--bad)', 'var(--bad-bg)'] : hp >= 1500 ? ['Elite', 'var(--warn)', 'var(--warn-bg)'] : hp >= 250 ? ['Tough', 'var(--tl)', 'var(--tl-bg)'] : ['Mob', 'var(--tx3)', 'var(--bg3)']

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
        <b style={{ fontSize: size * 0.27, fontWeight: 800, color: scoreTone(score), lineHeight: 1 }}>{score}</b>
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
          <div className="num" style={{ width: 42, textAlign: 'right', fontSize: 13, fontWeight: 700, color: winTone(per[p]) }}>{per[p].toFixed(0)}%</div>
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
                  : <td key={b} style={{ width: 50, height: 40, borderRadius: 9, background: cellCol(v), color: '#fff', textAlign: 'center', fontSize: 12.5, fontWeight: 700 }}>{v.toFixed(0)}</td>
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

export function BattleBuilder() {
  const [tab, setTab] = useState<TabId>('overview')
  const [draft, setDraft] = useState<Draft>({})
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Monster Lab local UI state (not part of the tuning draft — stage playback only).
  const [sel, setSel] = useState('squirrel')
  const [dir, setDir] = useState('S')
  const [playing, setPlaying] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [frameTag, setFrameTag] = useState('')
  const [addNote, setAddNote] = useState(false)

  const effective = useMemo(() => mergeTuning(draft), [draft])
  const fair = useMemo(() => fairnessSummary(effective, { level: 10, samples: 200 }), [effective])
  const valid = useMemo(() => validateTuning(draft), [draft])
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

  const selE: any = effective.enemies[sel]
  const [selTier] = tierOf(selE.hp)
  const selZones = zonesOf(sel)
  const selBossGate = selTier === 'Boss' && selZones.length === 0

  return (
    <div className="battleforge">
      <div className="bf-top">
        <div className="bf-mark">⚔</div>
        <div className="bf-title"><b>Battle Builder</b><span>Circle HQ · Game Command</span></div>
        <div className="bf-inv"><b>{PATHS.length}</b> paths · <b>{enemyIds.length}</b> monsters · <b>{ZONE_LIST.length}</b> zones</div>
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

      <div className="bf-body">
        {tab === 'overview' && (
          <div className="bf-pad">
            <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
              <div className="card">
                <div className="chead"><h3>⚖️ Fairness</h3><span className="pill pill-mut" style={{ marginLeft: 'auto', color: scoreTone(fair.score) }}>RMS {fair.rms.toFixed(1)}pts</span></div>
                <div className="row" style={{ gap: 18, alignItems: 'center' }}>
                  <Ring score={fair.score} />
                  <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>
                    Every path near 50% = fair. Same seeded simulator the game ships, so this number matches in-game.
                    <div style={{ marginTop: 11, padding: '9px 12px', borderLeft: '3px solid var(--warn)', background: 'var(--bg2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--warn)' }}>Hottest matchup</div>
                      <div style={{ marginTop: 2 }}>{META[hot.a]?.emoji} <b>{META[hot.a]?.name}</b> beats {META[hot.b]?.emoji} {META[hot.b]?.name} <b>{hot.pct?.toFixed(0)}%</b></div>
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
                <div className="chead"><h3>🐾 Roster health</h3><span className="sub" style={{ marginLeft: 'auto' }}>{enemyIds.length} monsters</span></div>
                {(() => {
                  const covered = ZONE_LIST.filter(z => ((effective.zones as any)[z] || []).length > 0)
                  const unplaced = enemyIds.filter(id => zonesOf(id).length === 0)
                  return (
                    <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 2 }}>
                      Zones covered: <b style={{ color: 'var(--tx)' }}>{covered.length ? covered.map(z => ZONE_LABEL[z]).join(' · ') : '—'}</b><br />
                      {unplaced.length > 0 && <>Not placed in a zone: <b style={{ color: 'var(--warn)' }}>{unplaced.join(', ')}</b><br /></>}
                      Highest tier: <b style={{ color: 'var(--tx)' }}>{tierOf(Math.max(...enemyIds.map(id => (effective.enemies as any)[id].hp)))[0]}</b>
                    </div>
                  )
                })()}
                <div className="bf-note"><b>Author the roster</b> in the Monster Lab → animate, place in a zone, set stats &amp; drops.</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'combat' && (
          <div className="bf-pad">
            <h4 className="lbl" style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 }}>⚔️ PVP — path balance</h4>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {PATHS.map(p => (
                <div key={p} className="card" style={{ padding: 0, borderTop: `3px solid ${META[p].color}` }}>
                  <div className="chead" style={{ padding: '13px 15px 8px', margin: 0 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: META[p].color + '22', fontSize: 16 }}>{META[p].emoji}</span>
                    <div><div style={{ fontSize: 14, fontWeight: 700 }}>{META[p].name}</div><div style={{ fontSize: 10, color: 'var(--tx3)' }}>{META[p].role}</div></div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}><b style={{ fontSize: 20, fontWeight: 800, color: winTone(fair.perPath[p]) }}>{fair.perPath[p].toFixed(0)}%</b><div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>win</div></div>
                  </div>
                  <div className="row" style={{ gap: 10, padding: '4px 15px 14px', alignItems: 'center' }}>
                    <RadarSvg stats={effective.paths[p]} color={META[p].color} />
                    <div style={{ flex: 1 }}>
                      {PATH_KNOBS.map(([k, label, lo, hi, step]) => {
                        const val = effective.paths[p][k]; const pct = ((val - lo) / (hi - lo)) * 100
                        return (
                          <div key={k} className="row" style={{ gap: 8, margin: '5px 0' }}>
                            <div style={{ width: 60, fontSize: 10.5, color: 'var(--tx2)' }}>{label}</div>
                            <div className="bf-sl" style={{ ['--pc' as any]: META[p].color }}>
                              <div className="bf-sl-track" /><div className="bf-sl-fill" style={{ width: pct + '%' }} />
                              <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => editPath(p, k, parseFloat(e.target.value))} />
                            </div>
                            <div className="num" style={{ width: 36, textAlign: 'right', fontSize: 11.5, fontWeight: 700 }}>{Number(val).toFixed(2)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {valid.warnings.length > 0 && (
              <div className="card" style={{ marginTop: 14, borderColor: 'var(--warn)' }}>
                <div className="chead"><h3 style={{ color: 'var(--warn)' }}>⚠ Ordering / range warnings</h3></div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--tx2)' }}>{valid.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            <h4 className="lbl" style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '22px 0 10px' }}>🐗 PVE — enemies &amp; global settings</h4>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
              <div className="card">
                <div className="chead"><h3>Global PvE</h3></div>
                {([
                  ['Max mobs', effective.spawn.maxConcurrent, 1, 12, 1, (v: number) => editSpawn('maxConcurrent', Math.round(v)), (v: number) => String(v)],
                  ['Respawn', effective.spawn.intervalMs, 300, 3000, 100, (v: number) => editSpawn('intervalMs', Math.round(v)), (v: number) => v + 'ms'],
                  ['XP ×', effective.rewards.xpMul, 0.5, 4, 0.1, (v: number) => editRewards('xpMul', v), (v: number) => v.toFixed(1) + '×'],
                  ['Bloom ×', effective.rewards.bloomMul, 0.5, 4, 0.1, (v: number) => editRewards('bloomMul', v), (v: number) => v.toFixed(1) + '×'],
                ] as const).map(([label, val, lo, hi, step, on, fmt]) => (
                  <div key={label} className="row" style={{ gap: 10, margin: '7px 0' }}>
                    <div style={{ width: 66, fontSize: 11, color: 'var(--tx2)' }}>{label}</div>
                    <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => on(parseFloat(e.target.value))} style={{ flex: 1, accentColor: 'var(--acc)' }} />
                    <div className="num" style={{ width: 48, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{fmt(val)}</div>
                  </div>
                ))}
                <p className="sub" style={{ marginTop: 10, fontSize: 11 }}>Per-monster authoring (zone, drops, boss seams) lives in the <b style={{ color: 'var(--tx)' }}>Monster Lab</b>.</p>
              </div>
              <div className="card">
                <div className="chead"><h3>Enemy quick-grid</h3><span className="sub" style={{ marginLeft: 'auto' }}>fast balance pass</span></div>
                {enemyIds.map(id => {
                  const e: any = effective.enemies[id]
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: '1px solid var(--bd)', borderRadius: 9, marginBottom: 6 }}>
                      <MonsterThumb id={id} size={28} />
                      <div style={{ minWidth: 62 }}><div style={{ fontSize: 11.5, fontWeight: 650, textTransform: 'capitalize' }}>{id}</div></div>
                      {(['hp', 'atk', 'xp', 'bloom'] as const).map(f => {
                        const ic = { hp: '❤', atk: '⚔', xp: '⭐', bloom: '🌸' }[f]
                        const stepv = f === 'hp' ? (e.hp >= 1000 ? 100 : 10) : (f === 'xp' || f === 'bloom') ? 1 : 2
                        return (
                          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '3px 6px', fontSize: 11 }}>
                            {ic} <b className="num">{e[f]}</b>
                            <button className="bf-step" onClick={() => editEnemy(id, f, Math.max(0, e[f] - stepv))}>−</button>
                            <button className="bf-step" onClick={() => editEnemy(id, f, e[f] + stepv)}>＋</button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bf-pubbar">
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx2)' }}>▲ <b className="num" style={{ color: 'var(--tx)' }}>{stagedGroups}</b> group{stagedGroups === 1 ? '' : 's'} staged</span>
              <span className="pill pill-mut" style={{ color: scoreTone(fair.score) }}>fairness {fair.score}</span>
              {!cloudEnabled && <span className="pill pill-mut" style={{ color: 'var(--warn)' }}>offline preview — run migration_combat_tuning.sql to publish live</span>}
              {pubMsg && <span className="sub" style={{ color: pubMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{pubMsg.text}</span>}
              <button className="kbd" onClick={reset} disabled={!dirty} style={{ opacity: dirty ? 1 : 0.5, marginLeft: dirty ? 0 : 'auto' }}>Reset</button>
              <button className="bf-pubbtn" onClick={publish} disabled={publishing || !cloudEnabled}>{publishing ? 'Publishing…' : '⚡ Publish to LashiraBloom'}</button>
            </div>
          </div>
        )}

        {tab === 'lab' && (
          <div className="bf-work">
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
                  <b>Coming next.</b> Adding brand-new roster entries needs the registry-as-data upgrade (roadmap) — today the Lab tunes these {enemyIds.length} existing monsters.
                  <button className="bf-gbtn" style={{ marginTop: 8 }} onClick={() => setAddNote(false)}>Got it</button>
                </div>
              )}
              <div className="bf-note"><b>Future roster.</b> Each row here becomes animatable, placeable &amp; tunable — the roster is built to grow.</div>
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
                <div className="bf-mtag">{frameTag || '…'}</div>
              </div>
              <div className="bf-mctrl">
                {DIRS.map(d => <button key={d} className={'bf-gbtn sq' + (dir === d ? ' on' : '')} onClick={() => setDir(d)}>{d}</button>)}
                <button className="bf-gbtn sq" onClick={() => setPlaying(p => !p)}>{playing ? '⏸' : '▶'}</button>
                <span className="bf-cap">zoom</span>
                <input className="bf-rng" type="range" min={0.6} max={1.8} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
                <span style={{ flex: 1 }} />
                {frameCountFor(sel) === 0 && <span className="sub" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>no walk cycle yet — showing directional still</span>}
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
                {([['❤ Health', 'hp'], ['⚔ Attack', 'atk'], ['⭐ XP reward', 'xp'], ['🌸 Bloom', 'bloom'], ['🏃 Move (ms)', 'speedMs']] as const).map(([label, f]) => {
                  const step = f === 'hp' ? (selE.hp >= 1000 ? 100 : 10) : f === 'speedMs' ? 20 : f === 'atk' ? 2 : 1
                  return (
                    <div key={f} className="bf-slot">
                      <span className="sl">{label}</span>
                      <button className="bf-arw" onClick={() => editEnemy(sel, f, Math.max(0, selE[f] - step))}>◀</button>
                      <div className="bf-val">{selE[f]}</div>
                      <button className="bf-arw" onClick={() => editEnemy(sel, f, selE[f] + step)}>▶</button>
                    </div>
                  )
                })}
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
                  <p className="sub" style={{ fontSize: 10.5, marginTop: 4 }}>Placeholders for when the boss-phase system lands — not wired to the game yet.</p>
                </div>
              )}

              <div className="bf-note"><b>1:1 with LashiraBloom.</b> Pixel mirrors from the game's own creature sheets; a future shared art package keeps an identical <span className="mono">id/dir/frame</span> tree so a drop-in PNG reskins both sides. Stats, zone &amp; drops here write the same config Combat publishes.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

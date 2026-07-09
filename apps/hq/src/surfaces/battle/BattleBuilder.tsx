import { useEffect, useMemo, useState } from 'react'
import { Swords, Sword, Rocket, PawPrint } from 'lucide-react'
import { COMBAT_DEFAULTS, mergeTuning, fairnessSummary, validateTuning, publishTuning } from '@arganta/combat'
import { supabase, cloudEnabled } from '../../lib/supabase'

// Battle Builder — the operator console for LashiraBloom combat. Edits a small
// OVERRIDE over the package defaults, previews fairness with the SAME simulator the
// game ships, and publishes one config the game reads on boot (hq_combat_publish).

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
const TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'paths', label: 'Paths' },
  { id: 'enemies', label: 'Enemies & rewards' }, { id: 'publish', label: 'Publish' },
]
// The game's real animated walk cycles (south-facing). Frame counts vary; tiger has none → still/emoji.
const FRAMES: Record<string, number> = { squirrel: 9, fox: 4, badger: 9, boar: 9, deer: 4, tiger: 0 }
const EMOJI: Record<string, string> = { squirrel: '🐿️', fox: '🦊', badger: '🦡', boar: '🐗', deer: '🦌', tiger: '🐯' }
// Creature sprites are copied into HQ's own public/ (apps/hq/public/farm-art/creatures)
// so they load locally, offline, no external dependency. Env can override.
const ART_BASE = ((import.meta as any).env?.VITE_LASHIRA_ART_BASE || '/farm-art/creatures').replace(/\/$/, '')

type Draft = Record<string, any>
const scoreTone = (s: number) => (s >= 82 ? 'var(--ok)' : s >= 68 ? 'var(--warn)' : 'var(--bad)')
const winTone = (v: number) => (Math.abs(v - 50) < 9 ? 'var(--ok)' : Math.abs(v - 50) < 17 ? 'var(--warn)' : 'var(--bad)')
const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const cellCol = (v: number) => { const t = Math.min(1, Math.abs(v - 50) / 45); const a = hx('#0d9488'), b = hx('#ec4899'); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})` }

// The game's actual pixel sprite, animated (walk cycle → still → emoji fallback).
function CreatureSprite({ id }: { id: string }) {
  const n = FRAMES[id] ?? 0
  const [frame, setFrame] = useState(0)
  const [broken, setBroken] = useState(false)
  useEffect(() => { if (!n || broken) return; const t = setInterval(() => setFrame(f => (f + 1) % n), 120); return () => clearInterval(t) }, [n, broken])
  if (broken) return <div style={{ fontSize: 42 }}>{EMOJI[id] || '❓'}</div>
  const src = n > 0 ? `${ART_BASE}/${id}/walk/south/${frame}.png` : `${ART_BASE}/${id}/south.png`
  return <img className="bb-spr" src={src} onError={() => setBroken(true)} alt={id} width={60} height={60} />
}

function Ring({ score }: { score: number }) {
  const R = 56, C = 2 * Math.PI * R, off = C * (1 - score / 100)
  return (
    <div style={{ position: 'relative', width: 136, height: 136, flex: 'none' }}>
      <svg width={136} height={136}>
        <circle cx={68} cy={68} r={R} fill="none" stroke="var(--bg3)" strokeWidth={13} />
        <circle cx={68} cy={68} r={R} fill="none" stroke={scoreTone(score)} strokeWidth={13} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 68 68)" style={{ transition: 'stroke-dashoffset .5s var(--ease), stroke .3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
        <b style={{ fontSize: 36, fontWeight: 800, color: scoreTone(score), lineHeight: 1 }}>{score}</b>
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
                  ? <td key={b} style={{ width: 52, height: 42, borderRadius: 9, background: 'var(--bg3)', color: 'var(--tx3)', textAlign: 'center' }}>–</td>
                  : <td key={b} style={{ width: 52, height: 42, borderRadius: 9, background: cellCol(v), color: '#fff', textAlign: 'center', fontSize: 12.5, fontWeight: 700 }}>{v.toFixed(0)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function RadarSvg({ stats, color }: { stats: any; color: string }) {
  const size = 132, cx = 66, cy = 66, R = 46
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
      {axes.map(([label], k) => { const an = -Math.PI / 2 + k * 2 * Math.PI / 5; const lx = cx + (R + 11) * Math.cos(an), ly = cy + (R + 11) * Math.sin(an); return <text key={label} x={lx} y={ly} fontSize={8} fill="var(--tx3)" textAnchor="middle" dominantBaseline="middle">{label}</text> })}
    </svg>
  )
}

const STYLE = `
.bb-spr{image-rendering:pixelated;position:relative;z-index:1;filter:drop-shadow(0 2px 1px rgba(0,0,0,.15))}
.bb-ecard{transition:transform .2s var(--ease), box-shadow .2s var(--ease)}
.bb-ecard:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.bb-sl{position:relative;flex:1;height:20px;display:flex;align-items:center}
.bb-sl-track{position:absolute;left:0;right:0;height:5px;border-radius:99px;background:var(--bg3)}
.bb-sl-fill{position:absolute;left:0;height:5px;border-radius:99px;background:var(--pc);pointer-events:none}
.bb-sl input{position:absolute;left:0;width:100%;height:20px;margin:0;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer}
.bb-sl input::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:var(--bg);border:2.5px solid var(--pc);box-shadow:var(--shadow-sm);transition:transform .12s}
.bb-sl input::-webkit-slider-thumb:hover{transform:scale(1.18)}
.bb-sl input::-moz-range-thumb{width:15px;height:15px;border:2.5px solid var(--pc);border-radius:50%;background:var(--bg)}
.bb-step{width:18px;height:18px;border-radius:6px;background:var(--bg3);color:var(--tx2);display:grid;place-items:center;font-size:13px;line-height:1;border:none;cursor:pointer}
.bb-step:hover{background:var(--acc);color:#fff}
`

const threatOf = (hp: number): [string, string, string] =>
  hp >= 15000 ? ['BOSS', 'var(--bad)', 'var(--bad-bg)'] : hp >= 1500 ? ['Elite', 'var(--warn)', 'var(--warn-bg)'] : hp >= 250 ? ['Tough', 'var(--tl)', 'var(--tl-bg)'] : ['Mob', 'var(--tx3)', 'var(--bg3)']

export function BattleBuilder() {
  const [sub, setSub] = useState('overview')
  const [draft, setDraft] = useState<Draft>({})
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const effective = useMemo(() => mergeTuning(draft), [draft])
  const fair = useMemo(() => fairnessSummary(effective, { level: 10, samples: 200 }), [effective])
  const valid = useMemo(() => validateTuning(draft), [draft])
  const dirty = Object.keys(draft).length > 0
  const enemyIds: string[] = Object.keys(COMBAT_DEFAULTS.enemies)

  const editPath = (p: string, k: string, v: number) => setDraft(d => ({ ...d, paths: { ...(d.paths || {}), [p]: { ...((d.paths || {})[p] || {}), [k]: v } } }))
  const editEnemy = (id: string, f: string, v: number) => setDraft(d => ({ ...d, enemies: { ...(d.enemies || {}), [id]: { ...((d.enemies || {})[id] || {}), [f]: v } } }))
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

  return (
    <div>
      <style>{STYLE}</style>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <div className="h1"><Swords size={18} style={{ verticalAlign: -3, marginRight: 7, color: 'var(--acc)' }} />Battle Builder</div>
          <div className="sub">Tune LashiraBloom combat — paths, enemies, rewards — preview fairness, publish to the live game.</div>
        </div>
        <span className="pill pill-mut">LashiraBloom · combat</span>
      </div>

      <div className="seg" style={{ alignSelf: 'flex-start', marginBottom: 18 }}>
        {TABS.map(t => <button key={t.id} className={sub === t.id ? 'on' : ''} onClick={() => setSub(t.id)}>{t.label}</button>)}
      </div>

      {sub === 'overview' && (
        <>
          <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
            <div className="card">
              <div className="chead"><h3>Fairness</h3><span className="pill pill-mut" style={{ marginLeft: 'auto', color: scoreTone(fair.score) }}>RMS {fair.rms.toFixed(1)}pts</span></div>
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
          <div className="card" style={{ marginTop: 14 }}>
            <div className="chead"><h3>Win rate by path</h3><span className="sub" style={{ marginLeft: 'auto' }}>vs the field</span></div>
            <WinBars per={fair.perPath} />
          </div>
        </>
      )}

      {sub === 'paths' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {PATHS.map(p => (
            <div key={p} className="card" style={{ padding: 0, borderTop: `3px solid ${META[p].color}` }}>
              <div className="chead" style={{ padding: '14px 16px 8px', margin: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: META[p].color + '22', fontSize: 17 }}>{META[p].emoji}</span>
                <div><div style={{ fontSize: 14.5, fontWeight: 700 }}>{META[p].name}</div><div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{META[p].role}</div></div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}><b style={{ fontSize: 22, fontWeight: 800, color: winTone(fair.perPath[p]) }}>{fair.perPath[p].toFixed(0)}%</b><div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>win vs field</div></div>
              </div>
              <div className="row" style={{ gap: 12, padding: '4px 16px 16px', alignItems: 'center' }}>
                <RadarSvg stats={effective.paths[p]} color={META[p].color} />
                <div style={{ flex: 1 }}>
                  {PATH_KNOBS.map(([k, label, lo, hi, step]) => {
                    const val = effective.paths[p][k]; const pct = ((val - lo) / (hi - lo)) * 100
                    return (
                      <div key={k} className="row" style={{ gap: 10, margin: '6px 0' }}>
                        <div style={{ width: 64, fontSize: 11, color: 'var(--tx2)' }}>{label}</div>
                        <div className="bb-sl" style={{ ['--pc' as any]: META[p].color }}>
                          <div className="bb-sl-track" /><div className="bb-sl-fill" style={{ width: pct + '%' }} />
                          <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => editPath(p, k, parseFloat(e.target.value))} />
                        </div>
                        <div className="num" style={{ width: 38, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{Number(val).toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
          {valid.warnings.length > 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', borderColor: 'var(--warn)' }}>
              <div className="chead"><h3 style={{ color: 'var(--warn)' }}>⚠ Ordering / range warnings</h3></div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--tx2)' }}>{valid.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {sub === 'enemies' && (
        <div>
          <div className="chead"><h3><PawPrint size={15} style={{ verticalAlign: -3, marginRight: 5 }} />Bestiary — stats & rewards</h3><span className="sub" style={{ marginLeft: 'auto' }}>live sprites from the game · writes the shared BESTIARY</span></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
            {enemyIds.map(id => {
              const e: any = effective.enemies[id]; const [tl, tc, tb] = threatOf(e.hp); const boss = e.atk >= 200
              return (
                <div key={id} className="card bb-ecard" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ position: 'relative', height: 96, display: 'grid', placeItems: 'center', background: 'radial-gradient(120px 60px at 50% 78%, color-mix(in srgb, var(--tl) 22%, transparent), transparent 70%), linear-gradient(180deg, var(--bg2), var(--bg3))' }}>
                    {boss && <div style={{ position: 'absolute', top: 9, right: -30, transform: 'rotate(38deg)', background: 'var(--bad)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '.08em', padding: '2px 34px' }}>BOSS</div>}
                    <CreatureSprite id={id} />
                  </div>
                  <div className="chead" style={{ padding: '11px 13px 6px', margin: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{id}</div>
                    <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.04em', color: tc, background: tb }}>{tl}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, padding: '2px 13px 14px' }}>
                    {([['❤', 'HP', 'hp'], ['⚔', 'ATK', 'atk'], ['⭐', 'XP', 'xp'], ['🌸', 'Bloom', 'bloom']] as const).map(([ic, , f]) => {
                      const stepv = f === 'hp' ? (e.hp >= 1000 ? 100 : 10) : (f === 'xp' || f === 'bloom') ? 1 : 2
                      return (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 9, padding: '5px 7px' }}>
                          <span style={{ fontSize: 11 }}>{ic}</span>
                          <span className="num" style={{ fontSize: 12.5, fontWeight: 700 }}>{e[f]}</span>
                          <button className="bb-step" style={{ marginLeft: 'auto' }} onClick={() => editEnemy(id, f, Math.max(0, e[f] - stepv))}>−</button>
                          <button className="bb-step" onClick={() => editEnemy(id, f, e[f] + stepv)}>＋</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="sub" style={{ marginTop: 12 }}>Each card shows the animal’s <b>real in-game walk cycle</b> (pixel art, animated). Edit HP / attack + kill rewards (⭐ XP for adults, 🌸 Bloom for everyone) on the card. Drop tables, spawn pacing &amp; gear share the same config — surfaced here as they land.</p>
        </div>
      )}

      {sub === 'publish' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 14, maxWidth: 780 }}>
          <div className="card">
            <div className="chead"><h3>Fairness summary</h3><span className="pill pill-mut" style={{ marginLeft: 'auto', color: scoreTone(fair.score) }}>score {fair.score}</span></div>
            <div className="row" style={{ gap: 18 }}><Ring score={fair.score} /><WinBars per={fair.perPath} /></div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(180deg, var(--acc-soft), var(--bg))' }}>
            <div className="chead"><h3><Rocket size={15} style={{ verticalAlign: -3, marginRight: 5 }} />Publish to LashiraBloom</h3><span className="pill pill-mut" style={{ marginLeft: 'auto' }}>{dirty ? Object.keys(draft.paths || {}).length + Object.keys(draft.enemies || {}).length + ' groups changed' : 'no changes'}</span></div>
            <p className="sub" style={{ margin: '0 0 12px' }}>One config sets every player &amp; enemy number in the game. Writes <span className="src">hq_combat_publish</span> (operator only); the game applies it via <span className="src">combat_tuning_active</span> on next boot.</p>
            {!cloudEnabled && <p className="sub" style={{ color: 'var(--warn)' }}>Offline preview — add Supabase keys + run <span className="src">migration_combat_tuning.sql</span> to publish live.</p>}
            {valid.warnings.length > 0 && <p className="sub" style={{ color: 'var(--warn)' }}>⚠ {valid.warnings.length} balance warning(s) — publishing anyway is allowed (operator override).</p>}
            <div className="row" style={{ gap: 8 }}>
              <button className="kbd" onClick={reset} disabled={!dirty} style={{ opacity: dirty ? 1 : 0.5 }}>Reset to defaults</button>
              <button onClick={publish} disabled={publishing || !cloudEnabled} style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13.5, background: 'var(--acc)', color: '#fff', border: '1px solid var(--acc)', opacity: (publishing || !cloudEnabled) ? 0.6 : 1 }}>
                <Sword size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{publishing ? 'Publishing…' : 'Publish to LashiraBloom'}
              </button>
            </div>
            {pubMsg && <p className="sub" style={{ marginTop: 12, color: pubMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{pubMsg.text}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

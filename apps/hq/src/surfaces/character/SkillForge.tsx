import { useEffect, useMemo, useState } from 'react'
import { data, CompositeStage, stepCount } from '@arganta/heroes-engine'
import {
  mergeTuning, fairnessSummary, validateTuning, publishTuning,
  SKILL_TIER_BANDS, pathTitle,
} from '@arganta/combat'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { EffectLivePreview, SkillBrowser } from './SkillBrowser'
import { loadOperatorSelf } from './heroData'
import { MonsterStage } from '../battle/MonsterStage'
import '../battle/battle.css'

// Skill Forge — the 4-path × 3-skill × 6-tier command center. Authors each
// path's skill NAME + effect (fx) + target SHAPE as it evolves across the same
// six level bands the hero's TITLE steps through, plus the numbers that decide
// balance: per-slot base damage, mana cost, per-path magic/physical power, and
// per-path resistance/weakness. A live benchmark (the shipped fairness sim, now
// resist-aware) scores every edit, and Publish pushes the whole set to both games
// through the same @arganta/combat tuning pipeline the game boots from.

const PATHS = ['warrior', 'rogue', 'poet', 'mage'] as const
type PathId = typeof PATHS[number]
const META: Record<string, { name: string; emoji: string; color: string }> = {
  warrior: { name: 'Guardian', emoji: '⚔️', color: '#f59e0b' },
  rogue: { name: 'Shadow', emoji: '🗡️', color: '#14b8a6' },
  poet: { name: 'Mystic', emoji: '✨', color: '#8b5cf6' },
  mage: { name: 'Arcanist', emoji: '🔮', color: '#ec4899' },
}
// slot index → { the shared skill id, the damage-curve key, a human role }
const SLOTS = [
  { i: 0, id: 'bolt', dmgKey: 'bolt', role: 'Single', sub: 'one target · low cost', kind: 'dmg' },
  { i: 1, id: 'storm', dmgKey: 'storm', role: 'Multi', sub: 'hits everything · high cost', kind: 'dmg' },
  { i: 2, id: 'mend', dmgKey: 'mend', role: 'Heal', sub: 'self only', kind: 'heal' },
] as const
// A representative enemy for the "target" viewer — the lead animated monster
// for Single, plus two small stand-ins for Multi to make "hits everything"
// visually read as more-than-one instead of the same single-target shot.
const TARGET_LEAD = 'boar'
const TARGET_FLANK = ['squirrel', 'fox']
const PAN_STEP = 8 // % per D-pad tap, clamped 0-100
const clampPct = (v: number) => Math.max(0, Math.min(100, v))
const SHAPES: { id: string; label: string; hint: string }[] = [
  { id: 'line', label: 'Line', hint: 'straight ahead, reach tiles' },
  { id: 'nova', label: 'Nova', hint: 'self + 4 around (all surrounding)' },
  { id: 'cross', label: 'Cross', hint: 'all 4 directions, reach tiles' },
  { id: 'all', label: 'All', hint: 'every enemy in the zone' },
]
// The real-duel arena: caster faces East, target faces West, one shared
// base-map ground between them. Skill 1 (Single) swings a weapon; Skill 2
// (Multi) and Skill 3 (Heal) cast a spell — same contract as the shipped
// game's attackMotionBase/castMotionBase (RealmRoom.jsx), reimplemented here
// against this hero's own real motion tables so a hero with no Spell frames
// falls back to its weapon swing instead of a broken/blank pose.
const CASTER_FACING = 'East' // CompositeStage motion suffix ('Swing'+East). MonsterStage's target uses its own single-letter dir="W".
function attackMotionBase(tables: any, facing: string): string {
  if (tables) {
    for (const base of ['Swing', 'Attack', 'Pierce', 'Shoot']) {
      if (stepCount(tables, base + facing) > 0) return base
    }
  }
  return 'Get'
}
function castMotionBase(tables: any, facing: string): string {
  if (tables && stepCount(tables, 'Spell' + facing) > 0) return 'Spell'
  return attackMotionBase(tables, facing)
}
function idleMotionBase(tables: any, facing: string): string {
  if (tables && stepCount(tables, 'WeaponStandBy' + facing) > 0) return 'WeaponStandBy' + facing
  return 'NormalStandBy' + facing
}

const scoreTone = (s: number) => (s >= 82 ? 'var(--ok, #16a34a)' : s >= 68 ? 'var(--warn, #d97706)' : 'var(--bad, #dc2626)')
const winTone = (v: number) => (Math.abs(v - 50) < 9 ? 'var(--ok, #16a34a)' : Math.abs(v - 50) < 17 ? 'var(--warn, #d97706)' : 'var(--bad, #dc2626)')

// Value-on-thumb slider (the signature control) — the number rides the fill so
// there's no dead track, and it can't reflow anything around it.
function VSlider({ label, val, lo, hi, step, color = 'var(--acc)', fmt, onChange }:
  { label: string; val: number; lo: number; hi: number; step: number; color?: string; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const pct = Math.max(0, Math.min(100, ((val - lo) / (hi - lo)) * 100))
  return (
    <div className="sf-vrow">
      <div className="sf-vl">{label}</div>
      <div className="sf-vs" style={{ ['--pc' as any]: color }}>
        <div className="sf-vtrack" /><div className="sf-vfill" style={{ width: pct + '%' }} />
        <div className="sf-vthumb" style={{ left: pct + '%' }}>{fmt ? fmt(val) : val}</div>
        <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => onChange(parseFloat(e.target.value))} />
      </div>
    </div>
  )
}

function Ring({ score, size = 96 }: { score: number; size?: number }) {
  const R = size * 0.42, C = 2 * Math.PI * R, off = C * (1 - score / 100), sw = size * 0.1
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--bg3)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={scoreTone(score)} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .5s, stroke .3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
        <b style={{ fontSize: size * 0.28, fontWeight: 800, color: scoreTone(score), lineHeight: 1 }}>{score}</b>
        <span style={{ fontSize: 8.5, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3 }}>balance</span>
      </div>
    </div>
  )
}

export function SkillForge() {
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [selPath, setSelPath] = useState<PathId>('warrior')
  const [selSlot, setSelSlot] = useState(0)
  const [selTier, setSelTier] = useState(0)
  const [effects, setEffects] = useState<any[]>([])
  const [fxBrowse, setFxBrowse] = useState<{ tier: number } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // The caster viewer shows the OPERATOR's own real saved hero (not a generic
  // silhouette) — same character Character Lab composes, loaded once.
  const [hero, setHero] = useState<{ spec: any; name: string } | null | undefined>(undefined) // undefined = loading
  // The real-duel state machine: idle (held pose) -> casting (caster plays the
  // real Swing/Spell motion ONCE, via CompositeStage's oneShot) -> impact (the
  // reaction: target flashes+shakes+damage-number, or caster heal-flashes+
  // heal-number; the bound effect fx mounts here, not always-on) -> idle.
  const [phase, setPhase] = useState<'idle' | 'casting' | 'impact'>('idle')
  const [tables, setTables] = useState<any>(null)
  // Arena background pan — the Emberring Arena art is cover-scaled (no
  // stretch), so this just picks WHICH part of it shows through. % of
  // background-position, nudged by the D-pad in the arena's corner.
  const [panX, setPanX] = useState(50)
  const [panY, setPanY] = useState(42)

  useEffect(() => { data.effects().then(setEffects).catch(() => setEffects([])) }, [])
  useEffect(() => { data.motionTables().then(setTables) }, [])
  useEffect(() => {
    loadOperatorSelf()
      .then(s => setHero(s?.spec ? { spec: s.spec, name: s.displayName || 'You' } : null))
      .catch(() => setHero(null))
  }, [])
  const availableEffects = useMemo(() => effects.filter((e: any) => e?.sheet && e?.animation?.length), [effects])
  const effectById = useMemo(() => Object.fromEntries(availableEffects.map((e: any) => [e.id, e])), [availableEffects])

  const effective = useMemo(() => mergeTuning(draft), [draft])
  const fair = useMemo(() => fairnessSummary(effective, { level: 10, samples: 200 }), [effective])
  const valid = useMemo(() => validateTuning(draft), [draft])

  const slot = SLOTS[selSlot]
  const row: any[] = effective.skillMatrix[selPath][selSlot] || effective.skillMatrix[selPath][String(selSlot)]
  const cell = row[selTier] || {}
  const tierLevel = SKILL_TIER_BANDS[selTier]
  const previewFx = cell.fx ?? 22
  const stagedGroups = (draft.skillMatrix ? Object.keys(draft.skillMatrix).length : 0)
    + (draft.resist ? 1 : 0) + (draft.paths ? 1 : 0) + (draft.damage ? 1 : 0) + (draft.skills ? 1 : 0)
  const dirty = stagedGroups > 0

  // Switching path/skill/tier mid-animation would leave a stuck popup/flash on
  // the wrong context — snap back to idle whenever the selection changes.
  useEffect(() => { setPhase('idle') }, [selPath, selSlot, selTier])

  // Skill 1 (Single) swings a weapon; Skill 2 (Multi) and Skill 3 (Heal) cast a
  // spell — the exact contract the shipped realm controllers use.
  const castKind: 'strike' | 'cast' = slot.i === 0 ? 'strike' : 'cast'
  const casterMotion = phase === 'casting'
    ? (castKind === 'strike' ? attackMotionBase(tables, CASTER_FACING) : castMotionBase(tables, CASTER_FACING)) + CASTER_FACING
    : idleMotionBase(tables, CASTER_FACING)

  function cast() {
    if (phase !== 'idle' || !hero) return
    setPhase('casting')
  }
  function onCastComplete() {
    setPhase('impact')
    window.setTimeout(() => setPhase('idle'), 900)
  }

  // Read the effective 6-tier row for a path+slot, apply a change, write the WHOLE
  // array back to the draft (deep-merge replaces arrays, so a full row is correct).
  const editRow = (path: string, s: number, mut: (arr: any[]) => any[]) => setDraft(d => {
    const base = (mergeTuning(d).skillMatrix as any)[path][s].map((c: any) => ({ ...c }))
    return { ...d, skillMatrix: { ...(d.skillMatrix || {}), [path]: { ...((d.skillMatrix || {})[path] || {}), [s]: mut(base) } } }
  })
  const editName = (tier: number, name: string) => editRow(selPath, selSlot, arr => { arr[tier] = { ...arr[tier], name }; return arr })
  const editFx = (tier: number, fx: number) => editRow(selPath, selSlot, arr => { arr[tier] = { ...arr[tier], fx }; return arr })
  const editShape = (shape: string) => editRow(selPath, selSlot, arr => arr.map(c => ({ ...c, shape })))
  const editResist = (path: string, type: 'phys' | 'mag', v: number) =>
    setDraft(d => ({ ...d, resist: { ...(d.resist || {}), [path]: { ...((d.resist || {})[path] || {}), [type]: v } } }))
  const editPath = (path: string, k: 'mag' | 'phy', v: number) =>
    setDraft(d => ({ ...d, paths: { ...(d.paths || {}), [path]: { ...((d.paths || {})[path] || {}), [k]: v } } }))
  const editDamage = (key: string, f: 'base' | 'perLevel', v: number) =>
    setDraft(d => ({ ...d, damage: { ...(d.damage || {}), [key]: { ...((d.damage || {})[key] || {}), [f]: v } } }))
  const editSkillCost = (id: string, v: number) =>
    setDraft(d => ({ ...d, skills: { ...(d.skills || {}), [id]: { ...((d.skills || {})[id] || {}), manaCost: v } } }))
  const reset = () => { setDraft({}); setPubMsg(null) }

  async function publish() {
    setPublishing(true); setPubMsg(null)
    try {
      const r = await publishTuning(supabase, draft, { note: 'HQ Skill Forge' })
      setPubMsg({ ok: true, text: `Published to both games · fairness ${r.fairness.score}. Applies on next boot.` }); setDraft({})
    } catch (e: any) { setPubMsg({ ok: false, text: `Publish failed: ${e?.message || e}` }) } finally { setPublishing(false) }
  }

  // Damage/heal this exact tier's skill produces at its unlock level (curve × path).
  const dmgCurve = effective.damage[slot.dmgKey]
  const curveAt = (L: number) => dmgCurve.base + dmgCurve.perLevel * (L - 1)
  const pathMul = slot.kind === 'heal' ? effective.paths[selPath].healMul : effective.paths[selPath].mag
  const tierDamage = Math.round(curveAt(tierLevel) * pathMul)
  const shapeNow = cell.shape || (slot.i === 1 ? 'all' : 'line')

  return (
    <div className="skillforge">
      <div className="sf-topactions">
        <button className="sf-reset" onClick={reset} disabled={!dirty} style={{ opacity: dirty ? 1 : 0.5 }}>↺ Reset</button>
        <button className="sf-pub" onClick={publish} disabled={publishing || !cloudEnabled}>{publishing ? 'Publishing…' : '⚡ Publish to both games'}</button>
      </div>
      <div className="sf-grid">
        {/* LEFT — paths, slots, benchmark */}
        <div className="sf-col sf-left">
          <h4>Path</h4>
          <div className="sf-paths">
            {PATHS.map(p => (
              <button key={p} className={'sf-pathcard' + (p === selPath ? ' on' : '')} onClick={() => setSelPath(p)} style={{ ['--pc' as any]: META[p].color }}>
                <span className="em">{META[p].emoji}</span>
                <span className="nm">{META[p].name}</span>
                <span className="win" style={{ color: winTone(fair.perPath[p]) }}>{fair.perPath[p].toFixed(0)}%</span>
              </button>
            ))}
          </div>
          <h4 style={{ marginTop: 16 }}>Skill</h4>
          <div className="sf-slots">
            {SLOTS.map(s => (
              <button key={s.i} className={'sf-slotpill' + (s.i === selSlot ? ' on' : '')} onClick={() => setSelSlot(s.i)}>
                <b>Skill {s.i + 1} · {s.role}</b><small>{s.sub}</small>
              </button>
            ))}
          </div>

          <div className="sf-bench">
            <h4>Benchmark</h4>
            <div className="sf-benchrow">
              <Ring score={fair.score} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {PATHS.map(p => (
                  <div key={p} className="sf-wb">
                    <span className="l">{META[p].emoji}</span>
                    <span className="t"><i style={{ width: `${Math.max(3, Math.min(100, fair.perPath[p]))}%`, background: META[p].color }} /></span>
                    <span className="v" style={{ color: winTone(fair.perPath[p]) }}>{fair.perPath[p].toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="sf-hint">The shipped fairness sim, now resist-aware — every edit rescores live. 50% = fair.</p>
          </div>
        </div>

        {/* CENTER — live viewer + skill values */}
        <div className="sf-col sf-center">
          <div className="sf-stagehead">
            <div className="who" style={{ color: META[selPath].color }}>{cell.name || 'Skill'}</div>
            <span className="pill">L{tierLevel} · {pathTitle(selPath, tierLevel)}</span>
            <div style={{ flex: 1 }} />
            <span className="pill live">bound effect #{String(previewFx).padStart(3, '0')}</span>
          </div>

          {/* THE REAL DUEL — one shared base-map arena. Caster (your real hero,
              facing the target) actually PERFORMS the skill on Cast: Skill 1
              swings a weapon, Skills 2/3 cast a spell (via CompositeStage's
              oneShot), then the impact triggers the reaction — damage skills
              shake+flash the target and float a damage number; Heal green-
              flashes the caster and floats a heal number. The bound effect fx
              mounts only at impact, not always-on. */}
          <div className="sf-arena">
            <div className="sf-arena-bg" aria-hidden="true" style={{ backgroundPosition: `${panX}% ${panY}%` }} />
            <div className="sf-arena-vignette" aria-hidden="true" />

            <div className="sf-duel-side sf-duel-caster">
              <div className="sf-vhead">Caster{hero ? ' · ' + hero.name : ''}</div>
              {hero === undefined && <div className="sf-vempty">loading your hero…</div>}
              {hero === null && <div className="sf-vempty">No saved hero on your operator account yet — compose one in Character Lab.</div>}
              {hero && (
                <div className={'sf-duel-figure' + (phase === 'impact' && slot.kind === 'heal' ? ' healflash' : '')}>
                  <div className="sf-footshadow" aria-hidden="true" />
                  <CompositeStage
                    spec={hero.spec} motionName={casterMotion} playing scale={2.6} width={150} height={150}
                    oneShot={phase === 'casting'} onComplete={onCastComplete}
                  />
                  {phase === 'impact' && slot.kind === 'heal' && <div className="sf-dmgnum heal">+{tierDamage}</div>}
                  {phase === 'impact' && slot.kind === 'heal' && effectById[previewFx] && (
                    <div className="sf-veffect"><EffectLivePreview effect={effectById[previewFx]} size={80} /></div>
                  )}
                </div>
              )}
            </div>

            <button type="button" className="sf-castbtn" onClick={cast} disabled={phase !== 'idle' || !hero}>
              {phase === 'idle' ? '▶ Cast' : phase === 'casting' ? 'Casting…' : 'Impact!'}
            </button>

            <div className="sf-duel-side sf-duel-target">
              <div className="sf-vhead">{slot.i === 1 ? 'Targets · multi' : 'Target'}</div>
              <div className={'sf-duel-figure' + (phase === 'impact' && slot.kind !== 'heal' ? ' hit' : '')}>
                <div className="sf-footshadow" aria-hidden="true" />
                {/* Every target — lead + flank alike — is the same animated
                    MonsterStage at the same size, so "multi" reads as an even
                    group of enemies instead of one big monster next to two
                    shrunken icons. Each gets its OWN impact effect + damage
                    number landing directly on its body, not one shared card
                    floating above the whole row. */}
                {[TARGET_LEAD, ...(slot.i === 1 ? TARGET_FLANK : [])].map((id) => (
                  <div key={id} className="sf-vmonster">
                    <MonsterStage id={id} dir="W" playing zoom={1} />
                    {phase === 'impact' && slot.kind !== 'heal' && <div className="sf-dmgnum dmg">-{tierDamage}</div>}
                    {phase === 'impact' && slot.kind !== 'heal' && effectById[previewFx] && (
                      <div className="sf-veffect"><EffectLivePreview effect={effectById[previewFx]} size={96} /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="sf-pandpad" title="Pan the arena background">
              <button className="up" onClick={() => setPanY(v => clampPct(v - PAN_STEP))}>▲</button>
              <button className="left" onClick={() => setPanX(v => clampPct(v - PAN_STEP))}>◀</button>
              <button className="center" onClick={() => { setPanX(50); setPanY(42) }} title="Recenter" />
              <button className="right" onClick={() => setPanX(v => clampPct(v + PAN_STEP))}>▶</button>
              <button className="down" onClick={() => setPanY(v => clampPct(v + PAN_STEP))}>▼</button>
            </div>
          </div>
          <div className="sf-vcap">
            {slot.kind === 'heal'
              ? <><b>{cell.name}</b> heals <b>{tierDamage}</b> @ L{tierLevel}</>
              : <><b>{cell.name}</b> deals <b>{tierDamage}</b> @ L{tierLevel}{slot.i === 1 ? ' · every monster in the zone' : ''}</>}
          </div>

          <div className="sf-values">
            <div className="sf-vgrp">
              <h4>{slot.role} damage curve <small>shared base × path power</small></h4>
              <VSlider label="Base" val={dmgCurve.base} lo={5} hi={120} step={1} fmt={v => String(Math.round(v))} onChange={v => editDamage(slot.dmgKey, 'base', Math.round(v))} />
              <VSlider label="Per level" val={dmgCurve.perLevel} lo={0} hi={30} step={1} fmt={v => '+' + Math.round(v)} onChange={v => editDamage(slot.dmgKey, 'perLevel', Math.round(v))} />
              {slot.kind !== 'heal' && <VSlider label="Cost" val={effective.skills[slot.id]?.manaCost ?? 1} lo={0} hi={12} step={1} fmt={v => Math.round(v) + ' mp'} onChange={v => editSkillCost(slot.id, Math.round(v))} />}
            </div>
            <div className="sf-vgrp">
              <h4>{META[selPath].name} power <small>the balance lever</small></h4>
              <VSlider label="Magic ×" val={effective.paths[selPath].mag} lo={0.3} hi={1.9} step={0.01} color={META[selPath].color} fmt={v => v.toFixed(2)} onChange={v => editPath(selPath, 'mag', v)} />
              <VSlider label="Physical ×" val={effective.paths[selPath].phy} lo={0.3} hi={1.9} step={0.01} color={META[selPath].color} fmt={v => v.toFixed(2)} onChange={v => editPath(selPath, 'phy', v)} />
              {slot.i !== 2 && (
                <div className="sf-shape">
                  <span className="lbl">Target</span>
                  {SHAPES.map(sh => (
                    <button key={sh.id} className={'sf-shbtn' + (shapeNow === sh.id ? ' on' : '')} title={sh.hint} onClick={() => editShape(sh.id)}>{sh.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — tier ladder + resistance */}
        <div className="sf-col sf-right">
          <h4>{META[selPath].name} · {slot.role} — level ladder</h4>
          <div className="sf-ladder">
            {(SKILL_TIER_BANDS as number[]).map((L: number, i: number) => {
              const c = row[i] || {}
              return (
                <div key={L} className={'sf-tier' + (i === selTier ? ' on' : '')} onClick={() => setSelTier(i)}>
                  <span className="lv">L{L}<small>{pathTitle(selPath, L)}</small></span>
                  <input value={c.name || ''} onChange={e => { setSelTier(i); editName(i, e.target.value) }} onFocus={() => setSelTier(i)} />
                  <button className="fx" title="change effect" onClick={e => { e.stopPropagation(); setSelTier(i); setFxBrowse({ tier: i }) }}>#{String(c.fx ?? 22).padStart(3, '0')}</button>
                </div>
              )
            })}
          </div>

          <h4 style={{ marginTop: 16 }}>Resistance / weakness <small>defender takes ×(1 − r)</small></h4>
          <div className="sf-resist">
            {PATHS.map(p => (
              <div key={p} className="sf-resrow">
                <span className="rp" style={{ color: META[p].color }}>{META[p].emoji} {META[p].name}</span>
                <div className="rs">
                  <VSlider label="Phys" val={effective.resist[p].phys} lo={-0.6} hi={0.6} step={0.05} color={META[p].color} fmt={v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%'} onChange={v => editResist(p, 'phys', v)} />
                  <VSlider label="Mag" val={effective.resist[p].mag} lo={-0.6} hi={0.6} step={0.05} color={META[p].color} fmt={v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%'} onChange={v => editResist(p, 'mag', v)} />
                </div>
              </div>
            ))}
          </div>
          <p className="sf-hint">＋ = resists (takes less), − = weak (takes more). Neutral by default — watch the benchmark move as you dial.</p>
        </div>
      </div>

      <div className="sf-pubbar">
        <span className="mono">▲ <b>{stagedGroups}</b> group{stagedGroups === 1 ? '' : 's'} staged</span>
        <span className="pill" style={{ color: scoreTone(fair.score) }}>fairness {fair.score}</span>
        {valid.warnings.length > 0 && <span className="pill warn">⚠ {valid.warnings.length} warning{valid.warnings.length === 1 ? '' : 's'}</span>}
        {!cloudEnabled && <span className="pill warn">offline preview — run migration_combat_tuning.sql to publish live</span>}
        {pubMsg && <span className="msg" style={{ color: pubMsg.ok ? 'var(--ok, #16a34a)' : 'var(--bad, #dc2626)' }}>{pubMsg.text}</span>}
      </div>

      {fxBrowse && (
        <SkillBrowser title={`${META[selPath].name} · ${slot.role} · L${SKILL_TIER_BANDS[fxBrowse.tier]} effect`}
          effects={availableEffects} value={(row[fxBrowse.tier] || {}).fx ?? 22}
          onPick={(e: any) => editFx(fxBrowse.tier, e.id)} onClose={() => setFxBrowse(null)} />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CompositeStage } from '@arganta/heroes-engine'
import { GROUPS, SLOT_DEFS, ACTIONS } from './composer'
import { EmoteBrowser } from './EmoteBrowser'
import { SkillBrowser } from './SkillBrowser'

// The stage + pickers (center/right columns), shared by the Lab and NPC Studio
// tabs — only WHO is being edited differs; the composing surface is identical.

// The 3 skill slots are fixed by @arganta/combat's SKILL_SLOTS (single-target /
// hits-everything / self-heal, always in that order) — not a choice made here.
// This is display copy only; the ONLY editable thing per slot is the fx.
const SKILL_META = [
  { label: 'Skill 1 · Single', sub: 'one target, low cost' },
  { label: 'Skill 2 · Multi', sub: 'hits every monster, high cost' },
  { label: 'Skill 3 · Heal', sub: 'self only' },
]

export function ComposerPanel({
  composer, motion, headerLeft, headerRight, mountSection = true, onReset,
  setBrowse, setDyeFor, setDyeAnchor,
}: {
  composer: ReturnType<typeof import('./composer').useComposer>
  motion: { base: string; setBase: (b: string) => void; emote: string; setEmote: (e: string) => void
    dir: string; setDir: (d: string) => void; playing: boolean; setPlaying: (p: boolean | ((x: boolean) => boolean)) => void
    speed: number; setSpeed: (n: number) => void; scale: number; setScale: (n: number) => void
    motionName: string; frame: string; onStep: (i: number, n: number) => void }
  headerLeft: ReactNode
  headerRight?: ReactNode
  mountSection?: boolean
  onReset: () => void
  setBrowse: (b: any) => void
  setDyeFor: (s: string | null) => void; setDyeAnchor: (r: DOMRect | null) => void
}) {
  const {
    sel, meta, mountOn, setMountOn, mountId, setMountId, mountCount, entriesFor, currentKeyFor, labelFor, pickFor, stepEntry, toggle, dyeTargetKey,
    skills, availableEffects, skillLabel, setSkillFx, stepSkill,
  } = composer
  const [emoteOpen, setEmoteOpen] = useState(false)
  const [skillBrowse, setSkillBrowse] = useState<{ slot: number } | null>(null)

  // Arrow keys or WASD rotate the stage. Ignored while a text field elsewhere
  // in the composer has focus (search box, dye picker, etc.) so typing "s" or
  // "d" doesn't spin the character.
  useEffect(() => {
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
      motion.setDir(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [motion])

  return (
    <>
      {/* CENTER — wide stage */}
      <div className="fcol stage">
        <div className="f-stage-head">
          {headerLeft}
          <div style={{ flex: 1 }} />
          {headerRight}
        </div>
        <div className="f-canvas-hold">
          <CompositeStage
            spec={composer.spec} motionName={motion.motionName} playing={motion.playing}
            scale={motion.scale} speed={motion.speed} width={600} height={440}
            onStep={motion.onStep}
          />
          <div className="f-khint">↑↓←→ / WASD to rotate</div>
          {mountSection && (
            <button className={'f-ridepill' + (mountOn ? ' on' : '')} onClick={() => setMountOn(m => !m)}>
              🐴 Ride: {mountOn ? 'on' : 'off'}
            </button>
          )}
          <div className="f-cfoot">
            <span className="f-mtag">{motion.motionName} · {motion.frame || '…'}</span>
            <div className="f-btnrow" style={{ flex: '1 1 auto' }}>
              {ACTIONS.map(([label, b]) => (
                <button key={b} className={'f-gbtn' + (motion.base === b && !motion.emote ? ' on' : '')} onClick={() => { motion.setEmote(''); motion.setBase(b) }}>{label}</button>
              ))}
            </div>
            <button className="f-gbtn sq" onClick={() => motion.setPlaying(p => !p)} title="Play / pause">{motion.playing ? '⏸' : '▶'}</button>
            <span className="f-cap">speed</span>
            <input className="f-rng" type="range" min={0.25} max={2} step={0.25} value={motion.speed} onChange={e => motion.setSpeed(Number(e.target.value))} />
            <span className="f-cap">zoom</span>
            <input className="f-rng" type="range" min={1} max={6} step={1} value={motion.scale} onChange={e => motion.setScale(Number(e.target.value))} />
            <button className={'f-gbtn' + (motion.emote ? ' on' : '')} onClick={() => setEmoteOpen(true)}>{motion.emote || 'Emote…'} <span style={{ opacity: .6 }}>▦</span></button>
            <button className="f-gbtn danger" onClick={onReset}>Reset</button>
          </div>
        </div>
      </div>

      {/* RIGHT — live pickers */}
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
        {mountSection && (
          <div className="f-grp">
            <h4>Mount</h4>
            <div className="f-slot">
              <span className="f-dot" />
              <span className="f-sl">Which one</span>
              <button className="f-arw" onClick={() => setMountId(m => (m - 1 + Math.max(1, mountCount)) % Math.max(1, mountCount))}>◀</button>
              <span className="f-val"><b>{mountId === 0 ? 'Horse' : `mount #${mountId}`}</b><span>/{mountCount || '…'}</span></span>
              <button className="f-arw" onClick={() => setMountId(m => (m + 1) % Math.max(1, mountCount))}>▶</button>
            </div>
            <p className="f-cap" style={{ marginTop: 4 }}>On/off toggle lives on the stage — top-right of the canvas.</p>
          </div>
        )}
        <div className="f-grp">
          <h4>Skills</h4>
          {skills.map((skill: any, i: number) => (
            <div key={i} className="f-slot f-skill-slot">
              <span className="f-dot" />
              <span className="f-sl">
                <b>{SKILL_META[i]?.label || `Skill ${i + 1}`}</b>
                <small>{SKILL_META[i]?.sub}</small>
              </span>
              <button className="f-arw" onClick={() => stepSkill(i, -1)}>◀</button>
              <span className="f-val" onClick={() => setSkillBrowse({ slot: i })}><b>{skillLabel(skill.fx)}</b><span>▦</span></span>
              <button className="f-arw" onClick={() => stepSkill(i, +1)}>▶</button>
            </div>
          ))}
          <p className="f-cap" style={{ marginTop: 4 }}>Role is fixed (single / multi / heal) — only the effect is a choice.</p>
        </div>
      </div>

      {emoteOpen && (
        <EmoteBrowser spec={composer.spec} value={motion.emote} onPick={motion.setEmote} onClose={() => setEmoteOpen(false)} />
      )}
      {skillBrowse && (
        <SkillBrowser title={`Skill ${skillBrowse.slot + 1} effect`} effects={availableEffects}
          value={skills[skillBrowse.slot]?.fx} onPick={(e: any) => setSkillFx(skillBrowse.slot, e.id)} onClose={() => setSkillBrowse(null)} />
      )}
    </>
  )
}

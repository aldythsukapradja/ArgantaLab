import { useState } from 'react'
import type { ReactNode } from 'react'
import { CompositeStage } from '@arganta/heroes-engine'
import { GROUPS, SLOT_DEFS, ACTIONS } from './composer'
import { EmoteBrowser } from './EmoteBrowser'
import { SkillBrowser } from './SkillBrowser'

// The stage + pickers (center/right columns), shared by the Lab and NPC Studio
// tabs — only WHO is being edited differs; the composing surface is identical.

export function ComposerPanel({
  composer, motion, headerLeft, headerRight, mountSection = true, onReset,
  setBrowse, setDyeFor, setDyeAnchor, path = '', level = Infinity,
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
  path?: string
  level?: number
}) {
  const {
    sel, meta, mountOn, setMountOn, mountId, setMountId, mountCount, entriesFor, currentKeyFor, labelFor, pickFor, stepEntry, toggle, dyeTargetKey,
    skills, availableEffects, skillLabel, setSkillFx, setSkillScrape, stepSkill, skillsForPath,
  } = composer
  const [emoteOpen, setEmoteOpen] = useState(false)
  const [skillBrowse, setSkillBrowse] = useState<{ slot: number } | null>(null)
  const pathSkills = skillsForPath(path, level)
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
          <div className="f-mtag">{motion.motionName} · {motion.frame || '…'}</div>
        </div>
        <div className="f-controls">
          <div className="f-btnrow">
            {ACTIONS.map(([label, b]) => (
              <button key={b} className={'f-gbtn' + (motion.base === b && !motion.emote ? ' on' : '')} onClick={() => { motion.setEmote(''); motion.setBase(b) }}>{label}</button>
            ))}
            <span style={{ flex: 1 }} />
            <button className={'f-gbtn' + (motion.emote ? ' on' : '')} onClick={() => setEmoteOpen(true)}>{motion.emote || 'Emote…'} <span style={{ opacity: .6 }}>▦</span></button>
          </div>
          <div className="f-btnrow">
            {['S', 'E', 'N', 'W'].map(d => (
              <button key={d} className={'f-gbtn sq' + (motion.dir === d ? ' on' : '')} onClick={() => motion.setDir(d)}>{d}</button>
            ))}
            <button className="f-gbtn sq" onClick={() => motion.setPlaying(p => !p)}>{motion.playing ? '⏸' : '▶'}</button>
            <span className="f-cap">speed</span>
            <input className="f-rng" type="range" min={0.25} max={2} step={0.25} value={motion.speed} onChange={e => motion.setSpeed(Number(e.target.value))} />
            <span className="f-cap">zoom</span>
            <input className="f-rng" type="range" min={1} max={6} step={1} value={motion.scale} onChange={e => motion.setScale(Number(e.target.value))} />
            <span style={{ flex: 1 }} />
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
              <span className={'f-chk' + (mountOn ? ' on' : '')} onClick={() => setMountOn(m => !m)} />
              <span className="f-sl">Ride</span>
              <button className="f-arw" onClick={() => setMountId(m => (m - 1 + Math.max(1, mountCount)) % Math.max(1, mountCount))}>◀</button>
              <span className="f-val"><b>{mountId === 0 ? 'Horse' : `mount #${mountId}`}</b><span>/{mountCount || '…'}</span></span>
              <button className="f-arw" onClick={() => setMountId(m => (m + 1) % Math.max(1, mountCount))}>▶</button>
            </div>
          </div>
        )}
        <div className="f-grp">
          <h4>Skills</h4>
          {skills.map((skill: any, i: number) => (
            <div key={i} className="f-slot f-skill-slot">
              <span className="f-dot" />
              <span className="f-sl">Skill {i + 1}</span>
              <select className="f-skill-select" value={skill.skillId || ''} onChange={e => setSkillScrape(i, e.target.value)}>
                <option value="">Client effect only</option>
                {pathSkills.map((s: any) => (
                  <option key={s.id} value={s.id}>Lv {s.levelNumber || '?'} · {s.name} · {s.spellType || 'spell'}</option>
                ))}
              </select>
              <button className="f-arw" onClick={() => stepSkill(i, -1)}>◀</button>
              <span className="f-val" onClick={() => setSkillBrowse({ slot: i })}><b>{skillLabel(skill.fx)}</b><span>▦</span></span>
              <button className="f-arw" onClick={() => stepSkill(i, +1)}>▶</button>
            </div>
          ))}
          <p className="f-cap" style={{ marginTop: 4 }}>Each slot pairs a real spell (level-gated by path) with a client visual effect.</p>
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

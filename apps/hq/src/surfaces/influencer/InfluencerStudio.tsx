// AI Influencer Studio — one non-scrollable command deck for the five Arganta
// virtual creators. Read/copy cockpit: identity, daily story rituals, Reels/Post
// strategy, wardrobe & spice governance, IG launch kit + reusable prompt capsule.
import { useState } from 'react'
import { CREATORS, type Creator } from './influencerData'
import './influencer.css'

function kitText(c: Creator) {
  return [
    `INSTAGRAM LAUNCH KIT — ${c.name}`,
    `Username: ${c.igKit.username}`,
    `Display name: ${c.igKit.displayName}`,
    `Bio:\n${c.igKit.bio}`,
    `Highlights: ${c.igKit.highlights.join(' · ')}`,
    `Pinned posts:\n${c.igKit.pinned.map(p => `- ${p}`).join('\n')}`,
    `Cadence: ${c.igKit.cadence}`,
  ].join('\n\n')
}

function capsuleText(c: Creator) {
  return [
    `PROMPT CAPSULE — ${c.name} (reusable, guardrail-safe)`,
    `BASE IDENTITY:\n${c.promptCapsule.base}`,
    `SCENE SLOTS (append one):\n${c.promptCapsule.scenes.map(s => `- ${s}`).join('\n')}`,
    `NEGATIVE / GUARDRAILS:\n${c.promptCapsule.negative}`,
  ].join('\n\n')
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className={'inf-copy' + (done ? ' done' : '')}
      onClick={() => { void navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400) }}
    >{done ? '✓ COPIED' : label}</button>
  )
}

function Bars({ items }: { items: { name: string; pct: number }[] }) {
  return (
    <div className="inf-bars">
      {items.map(p => (
        <div className="inf-bar" key={p.name}>
          <div className="inf-barlabel"><b>{p.name}</b><span>{p.pct}%</span></div>
          <div className="inf-track"><div className="inf-fill" style={{ width: `${p.pct}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export function InfluencerStudio() {
  const [id, setId] = useState(CREATORS[0].id)
  const c = CREATORS.find(x => x.id === id) ?? CREATORS[0]

  return (
    <div className="inf-root" style={{ ['--ink' as string]: c.accent, ['--ink-soft' as string]: c.accentSoft }}>
      <div className="inf-top">
        <div className="inf-title">AI INFLUENCER <em>STUDIO</em></div>
        <div className="inf-sub">5 MINDS · 5 WORLDS · 1 MISSION</div>
        <div className="inf-tabs">
          {CREATORS.map(x => (
            <button
              key={x.id}
              className={'inf-tab' + (x.id === id ? ' on' : '')}
              style={{ ['--tc' as string]: x.accent }}
              onClick={() => setId(x.id)}
            >{x.name}</button>
          ))}
        </div>
      </div>

      <div className="inf-body">
        {/* left — identity */}
        <div className="inf-col">
          <div className="inf-card" style={{ flex: 1 }}>
            <div className="inf-idhead">
              <div className="inf-portrait">{c.name[0]}</div>
              <div>
                <div className="inf-name">{c.name}</div>
                <div className="inf-arch">{c.archetype}</div>
                <div className="inf-handle">{c.handle}</div>
              </div>
            </div>
            <dl className="inf-meta">
              <dt>Role</dt><dd>{c.role}</dd>
              <dt>Age</dt><dd>{c.age}</dd>
              <dt>Energy</dt><dd>{c.energy}</dd>
            </dl>
            <div className="inf-h">Emotional promise</div>
            <div className="inf-promise">{c.promise}</div>
            <div className="inf-h">Differentiator</div>
            <div className="inf-diff">{c.differentiator}</div>
            <div className="inf-h">Analog benchmarks</div>
            <div className="inf-bench">
              {c.benchmarks.map(b => <div key={b.name}><b>{b.name}</b><span>{b.takes}</span></div>)}
            </div>
            <div className="inf-h">Signature lines</div>
            <div className="inf-lines">{c.signatureLines.map(l => <div className="inf-line" key={l}>{l}</div>)}</div>
          </div>
        </div>

        {/* center — rituals + strategy */}
        <div className="inf-col">
          <div className="inf-card inf-rituals">
            <div className="inf-h">Daily story ritual <span className="spacer" /><span style={{ color: '#6b7385', letterSpacing: '.04em' }}>5–8 frames / day</span></div>
            <div className="inf-daycols">
              {c.rituals.map(d => (
                <div className="inf-day" key={d.name}>
                  <div className="inf-dayname">{d.name}<small>{d.theme}</small></div>
                  {d.frames.map(f => (
                    <div className="inf-frame" key={f.t}><b>{f.t}</b><span>{f.note}</span></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="inf-strats">
            <div className="inf-card">
              <div className="inf-h">Reels strategy — acquire strangers</div>
              <div className="inf-beats">
                {c.reels.formula.map((b, i) => <div className="inf-beat" key={b}><i>{i + 1}</i>{b}</div>)}
              </div>
              <div className="inf-h">Franchises</div>
              <div className="inf-chips">
                {c.reels.franchises.map(f => <span className="inf-chip" key={f.name} title={f.note}>{f.name}</span>)}
              </div>
              <div className="inf-h">Prototype hooks</div>
              <div className="inf-hooks">{c.reels.hooks.join('  ·  ')}</div>
            </div>
            <div className="inf-card">
              <div className="inf-h">Post strategy — earn authority</div>
              <Bars items={c.posts.pillars} />
              <div className="inf-note">{c.posts.carousel}</div>
              <div className="inf-h">Cadence</div>
              <div className="inf-note">{c.posts.cadence}</div>
            </div>
          </div>
        </div>

        {/* right — look & launch */}
        <div className="inf-col">
          <div className="inf-card">
            <div className="inf-h">Wardrobe mix</div>
            <Bars items={c.wardrobe} />
            <div className="inf-h">Spice distribution</div>
            <div className="inf-spicebar">
              <div style={{ width: `${c.spice.safe}%`, background: c.accent, opacity: .9 }} />
              <div style={{ width: `${c.spice.provocative}%`, background: c.accent, opacity: .45 }} />
              <div style={{ width: `${c.spice.event}%`, background: c.accent, opacity: .2 }} />
            </div>
            <div className="inf-spicelegend">
              <span><i style={{ background: c.accent, opacity: .9 }} />{c.spice.safe}% brand-safe</span>
              <span><i style={{ background: c.accent, opacity: .45 }} />{c.spice.provocative}% provocative</span>
              <span><i style={{ background: c.accent, opacity: .2 }} />{c.spice.event}% event</span>
            </div>
            <div className="inf-note">{c.spice.note}</div>
            <div className="inf-h">Guardrails</div>
            <ul className="inf-guard">{c.guardrails.map(g => <li key={g}>{g}</li>)}</ul>
          </div>
          <div className="inf-card" style={{ flex: 1 }}>
            <div className="inf-h">Instagram kit <span className="spacer" /><CopyBtn text={kitText(c)} label="COPY KIT" /></div>
            <dl className="inf-kv">
              <dt>Username</dt><dd>{c.igKit.username}</dd>
              <dt>Name</dt><dd>{c.igKit.displayName}</dd>
              <dt>Bio</dt><dd>{c.igKit.bio}</dd>
              <dt>Highlights</dt><dd>{c.igKit.highlights.join(' · ')}</dd>
              <dt>Pinned</dt><dd>{c.igKit.pinned.join('\n')}</dd>
              <dt>Cadence</dt><dd>{c.igKit.cadence}</dd>
            </dl>
            <div className="inf-h">Prompt capsule <span className="spacer" /><CopyBtn text={capsuleText(c)} label="COPY PROMPT" /></div>
            <div className="inf-capsule">
              <b>Base:</b> {c.promptCapsule.base}
              <br /><br /><b>Scenes:</b> {c.promptCapsule.scenes.join(' · ')}
              <br /><br /><b>Negative:</b> {c.promptCapsule.negative}
            </div>
          </div>
        </div>
      </div>

      <div className="inf-foot">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => (
          <div className="inf-dow" key={d}><b>{d}</b><span>{c.weekly[i]}</span></div>
        ))}
      </div>
    </div>
  )
}

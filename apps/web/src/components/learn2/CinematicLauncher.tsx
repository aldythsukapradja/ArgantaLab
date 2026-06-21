import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { cinematicForTab } from '@/data/cinematic'
import Learn from '@/pages/Learn'

// LogicLand's CS tab: 3 cards that open the existing Three.js cinematic worlds
// (Code / Data / AI) in a full-screen overlay, reusing the Learn flow.
const SUBS = [
  { tab: 'web', name: 'Code World', emoji: '🏙️', color: '#4D9FFF', desc: 'How the web, HTML, CSS & JavaScript really work' },
  { tab: 'data', name: 'Data World', emoji: '🪐', color: '#34E5FF', desc: 'Stats, charts, dashboards & predictions' },
  { tab: 'ai', name: 'AI World', emoji: '🧠', color: '#8B5CF6', desc: 'Prompts, AI helpers & agents' },
]

export default function CinematicLauncher() {
  const { go, lessonId, completedLessons } = useAppStore()
  const [sub, setSub] = useState<string | null>(null)

  if (sub) {
    return (
      <div className="cs-cine-overlay">
        {!lessonId && <button className="cs-cine-back" onClick={() => setSub(null)}>← LogicLand</button>}
        <Learn tab={sub} />
      </div>
    )
  }

  return (
    <div className="cs-launch">
      <p className="cs-launch-lead">Fly through three cinematic 3D worlds and learn how real software is built.</p>
      <div className="cs-launch-grid">
        {SUBS.map(s => {
          const lessons = cinematicForTab(s.tab)
          const done = lessons.filter(l => completedLessons.includes(l.id)).length
          return (
            <button key={s.tab} className="cs-launch-card" style={{ borderColor: `${s.color}55` }}
              onClick={() => { go({ lessonId: null }); setSub(s.tab) }}>
              <span className="cs-launch-emoji">{s.emoji}</span>
              <b style={{ color: s.color }}>{s.name}</b>
              <small>{s.desc}</small>
              <span className="cs-launch-prog" style={{ color: s.color }}>{done}/{lessons.length} lit</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

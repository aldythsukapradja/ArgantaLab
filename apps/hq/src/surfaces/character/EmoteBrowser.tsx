import { useMemo, useState } from 'react'
import { CompositeStage } from '@arganta/heroes-engine'
import { EMOTES } from './composer'

// EmoteBrowser — replaces the bare <select> with a real picker: a row list plus ONE
// live preview panel showing the character's OWN current spec actually playing the
// highlighted emote (mirrors SkillBrowser's single-live-preview pattern rather than
// animating all 15 rows at once, which would be wasteful).

export function EmoteBrowser({ spec, value, onPick, onClose }: {
  spec: any; value: string; onPick: (emote: string) => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [previewName, setPreviewName] = useState(value || EMOTES[0])
  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = ['', ...EMOTES] // '' = None, clears back to the normal stand/walk motion
    return all.filter(e => !needle || e.toLowerCase().includes(needle) || (e === '' && 'none'.includes(needle)))
  }, [q])

  return (
    <div className="f-browser-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="f-browser f-skill-browser">
        <div className="f-browser-head">
          <b>Emote</b>
          <input placeholder="Search emote…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <button className="f-closex" onClick={onClose}>✕</button>
        </div>
        <div className="f-browser-body f-skill-body">
          <div className="f-skill-list">
            {entries.map(e => (
              <button key={e || '(none)'} className={'f-effect-row' + (e === value ? ' sel' : '') + (e === previewName ? ' previewing' : '')}
                onFocus={() => setPreviewName(e)} onClick={() => setPreviewName(e)}
                onDoubleClick={() => { onPick(e); onClose() }}>
                <span>{e || '— None —'}</span>
              </button>
            ))}
            {!entries.length && <div className="f-browser-empty">no matches</div>}
          </div>
          <aside className="f-skill-live">
            <div className="f-skill-live-title"><b>Preview</b><span>{previewName || 'None'}</span></div>
            <div className="f-skill-live-stage">
              <CompositeStage spec={spec} motionName={previewName || 'NormalStandBySouth'} playing scale={2.4} speed={1} width={220} height={220} />
            </div>
            <button className="f-gbtn" style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}
              onClick={() => { onPick(previewName); onClose() }}>Use this emote</button>
          </aside>
        </div>
      </div>
    </div>
  )
}

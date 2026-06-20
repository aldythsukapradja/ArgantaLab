import { useAppStore } from '@store/appStore'
import { LESSONS } from '@/data'

const XIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>

export function ConceptDrawer() {
  const { showConcept, setShowConcept, lessonId, missions, toggleMission } = useAppStore()
  const lesson = lessonId ? LESSONS[lessonId] : null
  const checkedMissions = lessonId ? (missions[lessonId] ?? []) : []

  return (
    <>
      <div className={`concept-back${showConcept ? ' open' : ''}`} onClick={() => setShowConcept(false)} />
      <aside className={`concept${showConcept ? ' open' : ''}`}>
        <div className="ch">
          <h3>{lesson?.title ?? 'Concept'}</h3>
          <button className="close" onClick={() => setShowConcept(false)}><XIcon /></button>
        </div>
        {lesson ? (
          <>
            <div className="sp-block">
              <div className="sp-h"><span className="d" />Key Idea</div>
              <p className="sp-body">{lesson.key}</p>
            </div>
            {lesson.vocab && lesson.vocab.length > 0 && (
              <div className="sp-block">
                <div className="sp-h"><span className="d" />Vocab</div>
                <div className="vocab">
                  {(lesson.vocab as [string, string][]).map((v) => (
                    <div key={v[0]} className="vrow"><b>{v[0]}</b><span>{v[1]}</span></div>
                  ))}
                </div>
              </div>
            )}
            {lesson.mission && lesson.mission.length > 0 && (
              <>
                <div className="spline" />
                <div className="sp-block">
                  <div className="sp-h"><span className="d" />Mission</div>
                  <div className="mission">
                    {lesson.mission.map((m: string, i: number) => (
                      <div key={i} className={`mrow${checkedMissions.includes(i) ? ' ck' : ''}`} onClick={() => lessonId && toggleMission(lessonId, i)}>
                        <div className="box"><CheckIcon /></div>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="sp-body" style={{ color: 'var(--t2)' }}>Open a lesson to see concepts here.</p>
        )}
      </aside>
    </>
  )
}

export default ConceptDrawer

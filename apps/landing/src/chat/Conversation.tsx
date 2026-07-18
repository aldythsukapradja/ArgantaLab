// The conversation stage (F1 §3.2). Parent capsules right, assistant as a calm
// full-width page, thinking = ember shimmer beside a quickened mark. Local state;
// wiring persistence to arganta_chat_* tables is the O3 Supabase slot.
import { useEffect, useRef } from 'react'
import { Mark } from './Mark'
import { AnswerView } from './Answer'
import type { Answer } from './brain'

export interface Turn { id: string; q: string; a: Answer | null }

const THINKING = ['Thinking…', 'On it…', 'One moment…']

export function Conversation({ turns, thinking, onChip }: {
  turns: Turn[]; thinking: boolean; onChip: (s: string) => void
}) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, thinking])
  const word = THINKING[turns.length % THINKING.length]

  return (
    <div className="ac-convo">
      <div className="ac-stream">
        <div className="ac-col">
          {turns.map(t => (
            <div key={t.id} className="ac-turn">
              <div className="ac-me"><div>{t.q}</div></div>
              {t.a && <div style={{ marginTop: 14 }}><AnswerView a={t.a} onChip={onChip} /></div>}
            </div>
          ))}
          {thinking && (
            <div className="ac-turn ac-thinking">
              <Mark size={22} breathe="fast" />
              <span>{word}</span>
              <span className="ac-shimmer" />
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
    </div>
  )
}

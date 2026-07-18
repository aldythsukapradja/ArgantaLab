// One field, one mic, one send (F1 §5). No model pickers, no tool buttons.
// Mic dictates via the Web Speech API — the same pattern the HQ composer uses,
// pruned to raw dictation (multitasking-parent rule).
import { useEffect, useRef, useState } from 'react'

const PLACEHOLDERS = ['Ask about your week…', 'What’s for dinner?', 'How are the kids doing?', 'Need a bedtime story?']

function recognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

export function Composer({ value, onChange, onSend, sending }: {
  value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const rec = useRef<any>(null)
  const [listening, setListening] = useState(false)
  const [ph] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)])
  const micOk = !!recognitionCtor()

  useEffect(() => {
    const el = ta.current; if (!el) return
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }, [value])
  useEffect(() => () => { rec.current?.abort?.() }, [])

  const toggleMic = () => {
    if (listening) { rec.current?.stop?.(); return }
    const Ctor = recognitionCtor(); if (!Ctor) return
    const r = new Ctor(); r.continuous = false; r.interimResults = false; r.lang = 'en-US'
    r.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript ?? ''; if (t) onChange((value ? value + ' ' : '') + t) }
    r.onerror = () => setListening(false); r.onend = () => setListening(false)
    rec.current = r; r.start(); setListening(true)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sending && value.trim()) onSend() }
  }

  return (
    <div className="ac-composer">
      <div className="ac-col">
        <div className="ac-field">
          {micOk && (
            <button className={'ac-mic' + (listening ? ' ac-mic--on' : '')} onClick={toggleMic} aria-label={listening ? 'Stop' : 'Talk to Arganta'} title={listening ? 'Listening…' : 'Talk'}>
              <svg width="18" height="18" viewBox="0 0 15 15" fill="none"><rect x="5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M2.5 7.5a5 5 0 0 0 10 0M7.5 12.5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
          )}
          <textarea ref={ta} rows={1} placeholder={ph} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKey} aria-label="Ask Arganta" />
          <button className="ac-send" onClick={onSend} disabled={!value.trim() || sending} aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M7.5 13V3M3.5 6.5 7.5 2.5 11.5 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

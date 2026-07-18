// The gated chat app: Hearth → Conversation, one column, drawer for history.
// A circle selector in the top bar grounds every answer in a chosen family circle
// (or spans all of them). The gate is applied one level up (App.tsx).
import { useCallback, useState } from 'react'
import { Mark } from './Mark'
import { Hearth } from './Hearth'
import { Conversation, type Turn } from './Conversation'
import { Composer } from './Composer'
import { Drawer, type ChatSummary } from './Drawer'
import { CircleSelect } from './CircleSelect'
import { useCircles, ALL_CIRCLES } from './circles'
import { answer } from './brain'

export function ChatApp({ name, onAbout, onSignOut }: { name: string; onAbout: () => void; onSignOut: () => void }) {
  const { circles, ctx, select, showAll } = useCircles()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [chats, setChats] = useState<ChatSummary[]>([])

  const ask = useCallback(async (qRaw: string) => {
    const q = qRaw.trim()
    if (!q || thinking) return
    setDraft('')
    const id = crypto.randomUUID()
    setTurns(t => [...t, { id, q, a: null }])
    if (turns.length === 0) setChats(c => [{ id, title: q.slice(0, 40), when: 'Today' }, ...c])
    setThinking(true)
    await new Promise(r => setTimeout(r, 620))
    const a = await answer(q, { scope: ctx.scope, label: ctx.label, spanning: ctx.id === ALL_CIRCLES, name })
    setThinking(false)
    setTurns(t => t.map(x => x.id === id ? { ...x, a } : x))
  }, [thinking, turns.length, ctx.scope, ctx.label, ctx.id])

  const send = () => ask(draft)
  const reset = () => { setTurns([]); setDraft(''); setDrawer(false) }
  const inConvo = turns.length > 0

  return (
    <div className="ac-root">
      {/* Always reachable — the circle selector lives here, so switching family
       * circles mid-conversation never requires scrolling back up. */}
      <div className="ac-navbar">
        <div className="ac-col">
          <div className="ac-top">
            <div className="ac-top-left">
              <Mark size={26} breathe="off" />
              <span className="ac-wordmark">Arganta</span>
              <CircleSelect circles={circles} ctx={ctx} showAll={showAll} name={name} onSelect={select} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {inConvo && <button className="ac-ghost" onClick={reset}>New</button>}
              <button className="ac-ghost" onClick={() => setDrawer(true)}>Chats</button>
            </div>
          </div>
        </div>
      </div>

      {inConvo
        ? <Conversation turns={turns} thinking={thinking} onChip={ask} />
        : <Hearth name={name} scope={ctx.scope} circleLabel={ctx.label} spanning={ctx.id === ALL_CIRCLES} onAsk={ask} />}

      <Composer value={draft} onChange={setDraft} onSend={send} sending={thinking} />

      {drawer && (
        <Drawer chats={chats} onOpen={() => setDrawer(false)} onNew={reset} onClose={() => setDrawer(false)} />
      )}

      {!inConvo && (
        <div className="ac-col" style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <button className="ac-ghost" onClick={onAbout} style={{ marginRight: 8 }}>About Arganta</button>
          <button className="ac-ghost" onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}

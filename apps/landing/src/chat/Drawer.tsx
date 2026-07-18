// History drawer (F1 §3.3). Recency groups, auto-titled, that's all it does.
// Threads are in-memory this session; the Supabase-backed list slots in with O3.
export interface ChatSummary { id: string; title: string; when: 'Today' | 'This week' | 'Earlier' }

export function Drawer({ chats, onOpen, onNew, onClose }: {
  chats: ChatSummary[]; onOpen: (id: string) => void; onNew: () => void; onClose: () => void
}) {
  const groups: ChatSummary['when'][] = ['Today', 'This week', 'Earlier']
  return (
    <>
      <div className="ac-scrim" onClick={onClose} />
      <aside className="ac-drawer" role="dialog" aria-label="Your chats">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Chats</h3>
          <button className="ac-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {chats.length === 0 && <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginTop: 16 }}>Your conversations will live here.</p>}
        {groups.map(g => {
          const rows = chats.filter(c => c.when === g)
          if (!rows.length) return null
          return (
            <div key={g}>
              <div className="ac-drawer-group">{g}</div>
              {rows.map(c => <button key={c.id} className="ac-thread" onClick={() => onOpen(c.id)}>{c.title}</button>)}
            </div>
          )
        })}
        <button className="ac-ghost ac-newchat" onClick={onNew}>New chat</button>
      </aside>
    </>
  )
}

import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'

const SunIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const MoonIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
const BookIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>

export function TopBar() {
  const { learnerName, avatar, xp, level, diamonds, theme, toggleTheme, setShowConcept, showConcept, lessonId,
    isAuthed, session, openAuthWall, setLearnerName } = useAppStore()
  const xpForNext = level * 500
  const pct = Math.min(100, (xp / xpForNext) * 100)
  const authed = isAuthed()
  const photo = (session && session !== 'loading') ? session.user?.user_metadata?.avatar_url as string | undefined : undefined
  const name = learnerName

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  useEffect(() => { setDraft(name) }, [name])
  const saveName = () => {
    const v = draft.trim()
    if (v && v !== name) setLearnerName(v)
    else setDraft(name)
    setEditing(false)
  }

  return (
    <header className="topbar">
      <div className="brand">
        <svg viewBox="0 0 40 40" width="26" height="26" style={{ borderRadius: 8, flexShrink: 0 }}>
          <defs><linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4D9FFF"/><stop offset="100%" stopColor="#8B5CF6"/></linearGradient></defs>
          <rect width="40" height="40" rx="10" fill="url(#tbg)"/>
          <circle cx="20" cy="20" r="10" fill="none" stroke="#fff" strokeWidth="2.5"/>
          <circle cx="20" cy="20" r="4" fill="#fff"/>
        </svg>
        <b>ArgantaLab</b>
      </div>
      <div className="spacer" />
      {lessonId && (
        <button className="icon-btn" onClick={() => setShowConcept(!showConcept)} title="Concept notes">
          <BookIcon />
        </button>
      )}
      {authed && (
        <div className="tb-stats">
          <div className="nm">
            {editing ? (
              <input
                className="tb-name-input"
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setDraft(name); setEditing(false) } }}
              />
            ) : (
              <button className="tb-name" onClick={() => setEditing(true)} title="Edit your name">{name}</button>
            )}
            <small>Lv {level}</small>
          </div>
          <div className="xpbar"><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {authed && <div className="tb-diamonds" title="Diamonds">💎 {diamonds}</div>}
      <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      {authed ? (
        photo
          ? <img className="avatar avatar-img" src={photo} alt={name} referrerPolicy="no-referrer" />
          : <div className="avatar">{(name?.[0] ?? avatar).toUpperCase()}</div>
      ) : (
        <button className="tb-signin" onClick={() => openAuthWall('to save your progress')}>Sign in</button>
      )}
    </header>
  )
}

export default TopBar

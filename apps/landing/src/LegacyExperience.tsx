// Arganta Chat — the shell. Chat is gated to parents; About is the public
// company page. Old landing hash routes redirect into /about pills (F5).
import { useCallback, useEffect, useState } from 'react'
import './styles/globals.css'
import './styles/app.css'
import { useGate, signOut } from './chat/auth'
import { ChatApp } from './chat/ChatApp'
import { Login, KidWall } from './chat/Login'
import { About, type Pill } from './chat/About'
import { Mark } from './chat/Mark'
import './chat/theme.css'

type View = { name: 'chat' } | { name: 'about'; pill: Pill } | { name: 'login' }

// old hash → new view (F5 redirect table)
function parse(): View {
  const h = window.location.hash.replace(/^#\/?/, '').split('/')[0]
  if (h === 'about') return { name: 'about', pill: 'about' }
  if (h === 'home' || h === 'company') return { name: 'about', pill: 'company' }
  if (h === 'products') return { name: 'about', pill: 'products' }
  if (h === 'pitch') return { name: 'about', pill: 'pitch' }
  if (h === 'command' || h === 'login') return { name: 'login' }
  return { name: 'chat' }
}

export default function LegacyExperience() {
  const gate = useGate()
  const [view, setView] = useState<View>(() => parse())

  useEffect(() => {
    const onPop = () => setView(parse())
    window.addEventListener('hashchange', onPop)
    return () => window.removeEventListener('hashchange', onPop)
  }, [])

  const goAbout = useCallback(() => { window.location.hash = '#/about'; setView({ name: 'about', pill: 'about' }) }, [])
  const goChat = useCallback(() => { window.location.hash = '#/'; setView({ name: 'chat' }) }, [])

  // About is public — always reachable.
  if (view.name === 'about') {
    return <About initial={view.pill} onOpenChat={goChat} />
  }

  // Gate for chat.
  if (gate.state === 'loading') {
    return <div className="ac-root"><div className="ac-loading"><Mark size={40} breathe="fast" /></div></div>
  }
  if (gate.state === 'kid') {
    return <div className="ac-root"><KidWall name={gate.kidName} /></div>
  }
  if (gate.state === 'public' || view.name === 'login') {
    return <div className="ac-root"><Login onAbout={goAbout} /></div>
  }

  // Parent, signed in.
  return <ChatApp name={gate.name} onAbout={goAbout} onSignOut={signOut} />
}

import { lazy, Suspense } from 'react'
import { Shell } from './shell/Shell'
import { Login, Denied } from './auth/Login'
import { useAuth } from './lib/auth'

// Founder-only WS2 Jarvis Reactor demo harness, reachable at ?reactor-demo.
// Isolated from the auth gate and the live cockpit so the reactor can be
// developed and reviewed without touching the shell.
const ReactorDemo = lazy(() => import('./reactor/demo/ReactorDemo').then(m => ({ default: m.ReactorDemo })))

export default function App() {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('reactor-demo')) {
    return <Suspense fallback={<div className="auth-wrap"><div className="spin" /></div>}><ReactorDemo /></Suspense>
  }

  const { state, session } = useAuth()

  // Login is the final gate. In offline preview (no Supabase keys) the shell
  // renders directly so the UI is fully developable; live data + the operator
  // gate switch on automatically once keys are present.
  if (state === 'offline') return <Shell who="Operator" authed={false} />
  if (state === 'loading') return <div className="auth-wrap"><div className="spin" /></div>
  if (state === 'anon') return <Login />
  if (state === 'denied') return <Denied />

  const email = session?.user?.email || 'Operator'
  const name = (session?.user?.user_metadata?.name as string) || email.split('@')[0]
  return <Shell who={name} authed />
}

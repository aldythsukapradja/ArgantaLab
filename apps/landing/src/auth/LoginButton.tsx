import { useState } from 'react'
import { useAuth, signInWithGoogle, signOut } from '../lib/auth'
import { cloudEnabled } from '../lib/supabase'

// ── The ◆ operator affordance in the top bar. Public visitors see a subtle diamond;
// clicking opens a small popover to sign in with Google. When the founder is an
// operator it turns solid + live, and the Command tab / live embeds unlock upstream
// (AppShell reads useAuth). OAuth runs on THIS top window, never inside an iframe.
export function LoginButton({ onState }: { onState?: (isOperator: boolean) => void }) {
  const { state, isOperator } = useAuth()
  const [open, setOpen] = useState(false)
  // surface operator status to the shell
  if (onState) onState(isOperator)

  if (!cloudEnabled) return null

  return (
    <div className="lbtn-wrap">
      <button className={`lbtn${isOperator ? ' on' : ''}`} onClick={() => setOpen(o => !o)} title={isOperator ? 'Operator · live' : 'Operator sign-in'} aria-label="Operator sign-in">◆</button>
      {open && (
        <div className="lbtn-pop" onMouseLeave={() => setOpen(false)}>
          {state === 'operator' ? (
            <>
              <div className="lbtn-st"><b>Operator · live</b><span>Command tab + live embeds unlocked.</span></div>
              <button className="lbtn-act" onClick={() => { signOut(); setOpen(false) }}>Sign out</button>
            </>
          ) : state === 'loading' ? (
            <div className="lbtn-st"><span>Checking access…</span></div>
          ) : state === 'denied' ? (
            <>
              <div className="lbtn-st"><b>Not an operator</b><span>This account isn't gated for live data.</span></div>
              <button className="lbtn-act" onClick={() => { signOut(); setOpen(false) }}>Sign out</button>
            </>
          ) : (
            <>
              <div className="lbtn-st"><b>Operator access</b><span>Sign in to present with live data + the HQ cockpit.</span></div>
              <button className="lbtn-act primary" onClick={() => signInWithGoogle()}>Continue with Google</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

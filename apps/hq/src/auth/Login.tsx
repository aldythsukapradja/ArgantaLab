import { CircleDashed, ShieldAlert, LogOut } from 'lucide-react'
import { signInWithGoogle, signOut } from '../lib/auth'

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    </svg>
  )
}

export function Login() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark"><CircleDashed size={20} color="#fff" /></div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Circle HQ</div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', margin: '5px 0 26px', lineHeight: 1.5 }}>
          Founder OS · ArgantaLab &amp; KinetikCircle<br />Operator access only
        </div>
        <button className="gbtn" onClick={signInWithGoogle}><GoogleMark /> Continue with Google</button>
        <div style={{ fontSize: 10.5, color: 'var(--tx3)', paddingTop: 16, borderTop: '1px solid var(--bd)', marginTop: 18, lineHeight: 1.5 }}>
          Google OAuth via Supabase. Access is gated to <span className="src" style={{ fontSize: 10 }}>profiles.role ∈ (operator, admin)</span>.
        </div>
      </div>
    </div>
  )
}

export function Denied() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark" style={{ background: 'var(--warn)' }}><ShieldAlert size={20} color="#fff" /></div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>Not an operator</div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', margin: '6px 0 22px', lineHeight: 1.55 }}>
          You're signed in, but this account isn't an operator. Ask an admin to run<br />
          <span className="src" style={{ fontSize: 10.5 }}>update profiles set role='operator' where email='…'</span>
        </div>
        <button className="gbtn" onClick={signOut}><LogOut size={15} /> Sign out</button>
      </div>
    </div>
  )
}

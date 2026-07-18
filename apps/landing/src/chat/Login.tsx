// The parent gate — Kinetik's auth card, parents-only (no Kids tab), recolored
// to Ember-on-Starpaper. Copy from F4 §7.
import { useState } from 'react'
import { Mark } from './Mark'
import { signInWithGoogle } from './auth'
import { cloudEnabled } from '../lib/supabase'

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function Login({ onAbout }: { onAbout: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = async () => {
    if (!cloudEnabled) { setError('Sign-in isn’t connected in this preview.'); return }
    setLoading(true); setError(null)
    try { await signInWithGoogle() }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t start sign-in.'); setLoading(false) }
  }

  return (
    <div className="ac-auth">
      <div className="ac-auth-glow ac-auth-glow-1" />
      <div className="ac-auth-glow ac-auth-glow-2" />
      <div className="ac-auth-card">
        <Mark size={48} breathe="slow" />
        <h1>Arganta</h1>
        <p className="ac-auth-sub">The family’s second brain</p>
        <button className="ac-google" onClick={go} disabled={loading}>
          <GoogleG />
          <span>{loading ? 'Opening…' : 'Continue with Google'}</span>
        </button>
        {error && <div className="ac-auth-err">{error}</div>}
        <p className="ac-auth-foot">For parents. Kids have their own worlds to play in.</p>
        <p className="ac-auth-foot"><button className="ac-ghost" style={{ marginTop: 8 }} onClick={onAbout}>About Arganta</button></p>
      </div>
    </div>
  )
}

// Shown for ~2.5s when a kid account slips in, before auth.ts signs them out (F4 §7).
export function KidWall({ name }: { name: string }) {
  return (
    <div className="ac-blocked">
      <div className="ac-blocked-inner">
        <Mark size={52} breathe="slow" />
        <h1>Hi {name}! 👋</h1>
        <p>This one’s for Mom and Dad. Your adventures live in KinetikCircle and KinQuest — see you there!</p>
      </div>
    </div>
  )
}

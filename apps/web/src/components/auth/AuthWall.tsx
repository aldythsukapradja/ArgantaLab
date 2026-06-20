import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { supabase, supabaseMisconfigured } from '@lib/supabase'

export default function AuthWall() {
  const { authWallReason, closeAuthWall } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (authWallReason === null) return null

  const signIn = async () => {
    if (supabaseMisconfigured) {
      setError('Login is not configured yet. Add Supabase keys in Vercel, then redeploy.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div className="authwall" onClick={closeAuthWall}>
      <div className="authwall-card" onClick={e => e.stopPropagation()}>
        <button className="authwall-x" onClick={closeAuthWall} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="authwall-logo">
          <svg viewBox="0 0 40 40" width="46" height="46">
            <defs><linearGradient id="awg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4D9FFF" /><stop offset="100%" stopColor="#8B5CF6" /></linearGradient></defs>
            <rect width="40" height="40" rx="11" fill="url(#awg)" />
            <circle cx="20" cy="20" r="10" fill="none" stroke="#fff" strokeWidth="2.5" />
            <circle cx="20" cy="20" r="4" fill="#fff" />
          </svg>
        </div>

        <h2 className="authwall-title">Sign in {authWallReason}</h2>
        <p className="authwall-sub">Save your XP, diamonds, and the games you build. It's free!</p>

        {error && <div className="login-error">{error}</div>}

        <button className="login-google" onClick={signIn} disabled={loading}>
          {loading ? <span className="login-spinner" /> : <GoogleIcon />}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        <button className="authwall-later" onClick={closeAuthWall}>Maybe later</button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.25-.164-1.84H9v3.48h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  )
}

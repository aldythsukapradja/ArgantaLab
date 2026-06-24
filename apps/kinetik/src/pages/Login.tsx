import { useState, useEffect } from 'react'
import { supabase } from '@lib/supabase'

type Tab = 'parent' | 'kid'

/** Official multicolor Google "G". */
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

export default function Login() {
  const [tab, setTab] = useState<Tab>('parent')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kidUsername, setKidUsername] = useState('')
  const [kidPin, setKidPin] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.reload()
    })
  }, [])

  const signInWithGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      })
      if (error) throw error
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to sign in'
      setError(msg)
      setLoading(false)
      setTimeout(() => setLoading(false), 5000)
    }
  }

  const handleKidLogin = async () => {
    if (!kidUsername || !kidPin) { setError('Username and PIN required'); return }
    setLoading(true)
    setError(null)
    try {
      setError('Kids login coming soon')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-gradient" />
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />
        <div className="auth-glow auth-glow-3" />
      </div>

      <div className="auth-container">
        <div className="auth-card-shell">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo-mark"><span>K</span></div>
            <div className="auth-brand"><span className="wm-k">Kinetik</span><span className="wm-c">Circle</span></div>
            <p className="auth-subtitle">Plan together. Track progress. Celebrate moments.</p>
          </div>

          {/* Tabs */}
          <div className="auth-tab-nav">
            <span className="auth-tab-thumb" data-tab={tab} />
            <button className={`auth-tab-btn${tab === 'parent' ? ' active' : ''}`} onClick={() => { setTab('parent'); setError(null) }}>Parent</button>
            <button className={`auth-tab-btn${tab === 'kid' ? ' active' : ''}`} onClick={() => { setTab('kid'); setError(null) }}>Kids</button>
          </div>

          {tab === 'parent' && (
            <div className="auth-card-content">
              <div className="auth-card-header">
                <h2>Welcome back</h2>
                <p>Sign in to manage your family circle</p>
              </div>

              <button className="auth-btn-google" disabled={loading} onClick={signInWithGoogle}>
                <GoogleG />
                <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
              </button>

              <div className="auth-divider"><span>or</span></div>

              <button className="auth-link-btn" onClick={() => alert('Sign up coming soon')}>
                Create a new account
              </button>

              {error && <div className="auth-error-msg">{error}</div>}
            </div>
          )}

          {tab === 'kid' && (
            <div className="auth-card-content">
              <div className="auth-card-header">
                <h2>Kids login</h2>
                <p>Enter your username and PIN</p>
              </div>

              <div className="auth-form">
                <input className="auth-field" placeholder="Username" value={kidUsername} onChange={e => setKidUsername(e.target.value)} disabled={loading} />
                <input className="auth-field" placeholder="PIN" type="password" value={kidPin} onChange={e => setKidPin(e.target.value)} disabled={loading} maxLength={4} />
                <button className="auth-btn-primary" disabled={loading || !kidUsername || !kidPin} onClick={handleKidLogin}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>

              {error && <div className="auth-error-msg">{error}</div>}
            </div>
          )}

          <div className="auth-footer">
            <p className="auth-note"><span className="auth-lock">🔒</span> Your family's data is encrypted and private. Never shared.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

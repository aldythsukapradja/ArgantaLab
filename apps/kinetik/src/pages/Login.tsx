import { useState, useEffect } from 'react'
import { supabase } from '@lib/supabase'

type Tab = 'parent' | 'kid'

export default function Login() {
  // Production version: 2026-06-23 professional design active
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
      // If we reach here, OAuth redirect will happen
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to sign in'
      setError(msg)
      setLoading(false)
      // Auto-reset after 5s if error occurs
      setTimeout(() => setLoading(false), 5000)
    }
  }

  const handleKidLogin = async () => {
    if (!kidUsername || !kidPin) {
      setError('Username and PIN required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      // In a real app, verify PIN against child_profiles
      setError('Kids login coming soon')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Animated gradient background */}
      <div className="auth-bg">
        <div className="auth-gradient" />
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />
      </div>

      <div className="auth-container">
        {/* Header with logo */}
        <div className="auth-header">
          <div className="auth-logo-mark">
            <span>K</span>
          </div>
          <div className="auth-brand">
            <span>Kinetik</span><span>Circle</span>
          </div>
          <p className="auth-subtitle">Family coordination reimagined</p>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--muted)' }}>Plan together. Track progress. Celebrate moments.</p>
        </div>

        {/* Tab navigation */}
        <div className="auth-tab-nav">
          <button
            className={`auth-tab-btn${tab === 'parent' ? ' active' : ''}`}
            onClick={() => { setTab('parent'); setError(null) }}
          >
            Parent Login
          </button>
          <button
            className={`auth-tab-btn${tab === 'kid' ? ' active' : ''}`}
            onClick={() => { setTab('kid'); setError(null) }}
          >
            Kids Login
          </button>
        </div>

        {/* Parent Login */}
        {tab === 'parent' && (
          <div className="auth-card-content">
            <div className="auth-card-header">
              <h2>Welcome Back</h2>
              <p>Sign in to manage your family circle</p>
            </div>

            <button
              className="auth-btn-primary"
              disabled={loading}
              onClick={signInWithGoogle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span style={{ fontSize: '18px' }}>🔗</span>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <div style={{ textAlign: 'center', fontSize: 14 }}>
              New to KinetikCircle?{' '}
              <button
                className="auth-link-btn"
                onClick={() => alert('Sign up coming soon')}
              >
                Create account
              </button>
            </div>

            {error && <div className="auth-error-msg">{error}</div>}
          </div>
        )}

        {/* Kids Login */}
        {tab === 'kid' && (
          <div className="auth-card-content">
            <div className="auth-card-header">
              <h2>Kids Login</h2>
              <p>Enter your username and PIN</p>
            </div>

            <div className="auth-form">
              <input
                className="auth-field"
                placeholder="Username"
                value={kidUsername}
                onChange={e => setKidUsername(e.target.value)}
                disabled={loading}
              />
              <input
                className="auth-field"
                placeholder="PIN"
                type="password"
                value={kidPin}
                onChange={e => setKidPin(e.target.value)}
                disabled={loading}
                maxLength={4}
              />
              <button
                className="auth-btn-primary"
                disabled={loading || !kidUsername || !kidPin}
                onClick={handleKidLogin}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>

            {error && <div className="auth-error-msg">{error}</div>}
          </div>
        )}

        {/* Footer */}
        <div className="auth-footer">
          <p className="auth-note">🔒 Your family's data is encrypted and private. Never shared.</p>
        </div>
      </div>
    </div>
  )
}

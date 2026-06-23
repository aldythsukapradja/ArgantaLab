import { useState, useEffect } from 'react'
import { supabase } from '@lib/supabase'

type Tab = 'parent' | 'kid'

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
      setError(e instanceof Error ? e.message : 'Failed to sign in')
      setLoading(false)
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
    <div id="app" className="auth-bg">
      {/* Gradient blob background */}
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />

      <div className="auth-container">
        {/* Hero section */}
        <div className="auth-hero">
          <div className="auth-logo">
            <span className="al-k">Kinetik</span>
            <span className="al-c">Circle</span>
          </div>
          <p className="auth-tagline">Family coordination reimagined</p>
          <p className="auth-desc">Plan together. Track progress. Celebrate moments.</p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'parent' ? ' on' : ''}`}
            onClick={() => { setTab('parent'); setError(null) }}
          >
            Parent Login
          </button>
          <button
            className={`auth-tab${tab === 'kid' ? ' on' : ''}`}
            onClick={() => { setTab('kid'); setError(null) }}
          >
            Kids Login
          </button>
        </div>

        {/* Parent Login Card */}
        {tab === 'parent' && (
          <div className="auth-card">
            <div className="ac-icon">👨‍👩‍👧‍👦</div>
            <h2 className="ac-title">Welcome Back</h2>
            <p className="ac-subtitle">Sign in to manage your family circle</p>

            <button
              className="btn grad"
              style={{ width: '100%', marginTop: 24 }}
              disabled={loading}
              onClick={signInWithGoogle}
            >
              {loading ? 'Signing in…' : (
                <>
                  <span style={{ fontSize: '18px', marginRight: '8px' }}>🔗</span>
                  Continue with Google
                </>
              )}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <div className="auth-signup-prompt">
              New to KinetikCircle?{' '}
              <button
                className="auth-link"
                onClick={() => {
                  // Open sign up flow
                  alert('Sign up coming soon')
                }}
              >
                Create account
              </button>
            </div>

            {error && <div className="auth-error">{error}</div>}
          </div>
        )}

        {/* Kids Login Card */}
        {tab === 'kid' && (
          <div className="auth-card">
            <div className="ac-icon">👧</div>
            <h2 className="ac-title">Kids Login</h2>
            <p className="ac-subtitle">Enter your username and PIN</p>

            <div className="auth-form" style={{ marginTop: 24 }}>
              <input
                className="field"
                placeholder="Username"
                value={kidUsername}
                onChange={e => setKidUsername(e.target.value)}
                disabled={loading}
              />
              <input
                className="field"
                placeholder="PIN"
                type="password"
                value={kidPin}
                onChange={e => setKidPin(e.target.value)}
                disabled={loading}
                maxLength={4}
              />
              <button
                className="btn grad"
                style={{ width: '100%' }}
                disabled={loading || !kidUsername || !kidPin}
                onClick={handleKidLogin}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>

            {error && <div className="auth-error">{error}</div>}
          </div>
        )}

        {/* Footer */}
        <p className="auth-legal">
          🔒 Your family's data is encrypted and private. Never shared.
        </p>
      </div>
    </div>
  )
}

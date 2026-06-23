import { useState, useEffect } from 'react'
import { supabase } from '@lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.reload()
      }
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

  return (
    <div id="app" className="login-bg">
      <div className="login-container">
        <div className="login-head">
          <h1 className="login-title">
            <span className="lm-k">Kinetik</span><span className="lm-c">Circle</span>
          </h1>
          <p className="login-subtitle">Plans · People · Play</p>
        </div>

        <div className="login-card">
          <div className="login-icon">👨‍👩‍👧‍👦</div>
          <h2 className="login-h2">Family Circle</h2>
          <p className="login-desc">Plan together, stay connected</p>

          <button
            className="btn grad"
            style={{ width: '100%', marginTop: 24, marginBottom: 12 }}
            disabled={loading}
            onClick={signInWithGoogle}
          >
            {loading ? 'Signing in…' : '🔗 Continue with Google'}
          </button>

          {error && (
            <div className="login-error">{error}</div>
          )}

          <p className="login-legal">
            By signing in, you agree to our terms. Family data is private and secure.
          </p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { verifyLogin, addKid } from '@lib/circles'
import { supabase, cloudEnabled } from '@lib/supabase'
import { kidSignup, kidLogin, signOutCloud } from '@lib/cloudAuth'
import KidForm, { type KidFormData } from './KidForm'

type Stage = 'signin' | 'account' | 'signup'

// The single auth surface. Logged out → a polished Sign-in page (grown-ups use
// Google at the top, kids type username + PIN, brand-new kids tap "New player").
// Signed in + tapping the avatar → a simple account menu (Switch / Log out).
export default function PlayerSwitcher() {
  const { showSwitcher, loginAsKid, locked, learnerName, role, resolvedOutfit } = useAppStore()
  const session = useAppStore(s => s.session)
  const activeKidId = useAppStore(s => s.activeKidId)
  const inSession = (!!session && session !== 'loading') || activeKidId !== null || role === 'kid'

  const [stage, setStage] = useState<Stage>('signin')
  const [uName, setUName] = useState('')
  const [uPin, setUPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (showSwitcher) {
      setStage(locked || !inSession ? 'signin' : 'account')
      setUName(''); setUPin(''); setBusy(false); setErr(null)
    }
  }, [showSwitcher, locked, inSession])
  if (!showSwitcher) return null

  const endSession = () => useAppStore.setState({ showSwitcher: false, locked: false })

  const signInGoogle = async () => {
    setErr(null)
    if (!cloudEnabled) { setErr('Cloud isn\'t configured yet.'); return }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) { setErr(error.message); setBusy(false) }
    // success → the page redirects to Google
  }

  const kidLogIn = async () => {
    if (uName.trim().length < 2 || uPin.length !== 4) return
    setErr(null); setBusy(true)
    if (cloudEnabled) {
      const r = await kidLogin(uName.trim(), uPin)
      if (r.ok) { endSession(); return }
      const local = verifyLogin(uName.trim(), uPin)   // fall back to a profile on this device
      setBusy(false)
      if (local) loginAsKid(local)
      else setErr('That username or PIN didn\'t match. Ask a grown-up to check.')
    } else {
      setBusy(false)
      const kid = verifyLogin(uName.trim(), uPin)
      if (kid) loginAsKid(kid); else setErr('That username or PIN didn\'t match.')
    }
  }

  const handleSignup = async (d: KidFormData) => {
    setErr(null)
    if (cloudEnabled) {
      setBusy(true); const r = await kidSignup(d); setBusy(false)
      if (r.ok) endSession()
      else setErr(r.error === 'cloud-disabled' ? 'Cloud is not set up yet.' : (r.error ?? 'Could not create account'))
    } else { const s = addKid(d); loginAsKid(s.kids[s.kids.length - 1]) }
  }

  const logOut = async () => { await signOutCloud(); useAppStore.setState({ role: 'user', activeKidId: null }); useAppStore.getState().lockSession() }

  // ── New player ──
  if (stage === 'signup') {
    return createPortal(
      <div className="psw"><div className="psw-inner" style={{ width: 'min(440px,92vw)' }}>
        <KidForm mode="signup" busy={busy} error={err} onSave={handleSignup} onCancel={() => setStage('signin')} />
      </div></div>, document.body,
    )
  }

  // ── Account menu (signed in) ──
  if (stage === 'account') {
    const outfit = resolvedOutfit()
    const accent = outfit.skin?.color || '#8b5cf6'
    return createPortal(
      <div className="psw"><div className="acct-card">
        <span className="acct-av" style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 50%, #6366f1))` }}>{(learnerName?.[0] ?? 'P').toUpperCase()}</span>
        <b className="acct-name">{learnerName}</b>
        <small className="acct-role">{role === 'kid' ? '🧒 Kid account' : '🧑 Grown-up'}</small>
        <button className="acct-logout" onClick={logOut}>Log out</button>
        <button className="acct-switch" onClick={() => setStage('signin')}>Switch player</button>
        <button className="acct-cancel" onClick={() => useAppStore.setState({ showSwitcher: false })}>Cancel</button>
      </div></div>, document.body,
    )
  }

  // ── Sign-in page ──
  return createPortal(
    <div className="psw">
      <div className="signin">
        <div className="signin-logo" aria-hidden>
          <svg viewBox="0 0 40 40" width="44" height="44">
            <defs><linearGradient id="slg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4D9FFF" /><stop offset="100%" stopColor="#8B5CF6" /></linearGradient></defs>
            <rect width="40" height="40" rx="12" fill="url(#slg)" />
            <circle cx="20" cy="20" r="10" fill="none" stroke="#fff" strokeWidth="2.6" /><circle cx="20" cy="20" r="4" fill="#fff" />
          </svg>
        </div>
        <h1 className="signin-title">Welcome to <span className="g">ArgantaLab</span></h1>
        <p className="signin-sub">Sign in — your progress follows you on every device.</p>

        {err && <div className="signin-err">{err}</div>}

        <button className="signin-google" onClick={signInGoogle} disabled={busy}>
          <GoogleIcon />{busy ? 'Opening…' : 'Continue with Google'}
        </button>
        <span className="signin-cap">For grown-ups</span>

        <div className="signin-divider"><span>or kids sign in</span></div>

        <div className="signin-kid">
          <input className="signin-input" placeholder="username" value={uName} autoCapitalize="none" autoCorrect="off"
            onChange={e => { setErr(null); setUName(e.target.value.toLowerCase().replace(/\s+/g, '')) }} />
          <input className="signin-input" placeholder="4-digit PIN" inputMode="numeric" maxLength={4} value={uPin}
            onChange={e => { setErr(null); setUPin(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
            onKeyDown={e => { if (e.key === 'Enter') kidLogIn() }} />
          <button className="signin-kidbtn" disabled={busy || uName.trim().length < 2 || uPin.length !== 4} onClick={kidLogIn}>
            {busy ? 'Checking…' : 'Log in →'}
          </button>
        </div>

        <button className="signin-new" onClick={() => setStage('signup')}>🎉 New here? Create a kid player</button>
      </div>
    </div>, document.body,
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

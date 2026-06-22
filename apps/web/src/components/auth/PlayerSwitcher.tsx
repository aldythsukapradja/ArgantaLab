import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { loadCircles, verifyLogin, addKid, type KidProfile } from '@lib/circles'
import { hasPasscode, setPasscode, verifyPasscode } from '@lib/parentGate'
import { cloudEnabled } from '@lib/supabase'
import { kidSignup, kidLogin } from '@lib/cloudAuth'
import KidForm, { type KidFormData } from './KidForm'

type Stage = 'pick' | 'signin' | 'kid' | 'pverify' | 'pcreate1' | 'pcreate2' | 'signup'

// The login / switch screen. Two faces:
//  • LOCKED (after Log out) → a real SIGN-IN page: kids type username + PIN,
//    grown-ups use Google / passcode. This is where Log out sends you.
//  • UNLOCKED (tap avatar) → "Who's playing?" quick face-switch on this device.
export default function PlayerSwitcher() {
  const { showSwitcher, closeSwitcher, loginAsKid, switchToOwner, activeKidId, locked, openAuthWall } = useAppStore()
  const [stage, setStage] = useState<Stage>('pick')
  const [picked, setPicked] = useState<KidProfile | null>(null)
  const [pin, setPin] = useState('')
  const [tmp, setTmp] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cloudErr, setCloudErr] = useState<string | null>(null)
  // typed sign-in fields
  const [uName, setUName] = useState('')
  const [uPin, setUPin] = useState('')

  useEffect(() => {
    if (showSwitcher) {
      setStage(locked ? 'signin' : 'pick')
      setPicked(null); setPin(''); setTmp(''); setErr(false); setBusy(false); setCloudErr(null); setUName(''); setUPin('')
    }
  }, [showSwitcher, locked])
  if (!showSwitcher) return null

  const kids = loadCircles().kids
  const endSession = () => useAppStore.setState({ showSwitcher: false, locked: false })

  const pickKid = (k: KidProfile) => { setPicked(k); setPin(''); setErr(false); setStage('kid') }
  const pickGrown = () => { setPin(''); setErr(false); setStage(hasPasscode() ? 'pverify' : 'pcreate1') }
  const fail = () => { setErr(true); setTimeout(() => setPin(''), 450) }

  // typed username + PIN sign-in (works on ANY device via the cloud)
  const typedLogin = async () => {
    if (uName.trim().length < 2 || uPin.length !== 4) return
    setCloudErr(null); setBusy(true)
    if (cloudEnabled) {
      const r = await kidLogin(uName.trim(), uPin)
      setBusy(false)
      if (r.ok) endSession()
      else setCloudErr('That username or PIN didn\'t match. Check with a grown-up.')
    } else {
      setBusy(false)
      const kid = verifyLogin(uName.trim(), uPin)
      if (kid) loginAsKid(kid)
      else setCloudErr('That username or PIN didn\'t match.')
    }
  }

  const press = async (d: string) => {
    setErr(false)
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length < 4) return
    if (stage === 'kid' && picked) {
      if (cloudEnabled) {
        setBusy(true); const r = await kidLogin(picked.username, next); setBusy(false)
        if (r.ok) endSession(); else fail()
      } else {
        const kid = verifyLogin(picked.username, next); if (kid) loginAsKid(kid); else fail()
      }
    } else if (stage === 'pverify') {
      if (verifyPasscode(next)) switchToOwner(); else fail()
    } else if (stage === 'pcreate1') {
      setTmp(next); setPin(''); setStage('pcreate2')
    } else if (stage === 'pcreate2') {
      if (next === tmp) { setPasscode(next); switchToOwner() }
      else { setErr(true); setTimeout(() => { setPin(''); setTmp(''); setStage('pcreate1') }, 600) }
    }
  }

  const handleSignup = async (d: KidFormData) => {
    setCloudErr(null)
    if (cloudEnabled) {
      setBusy(true); const r = await kidSignup(d); setBusy(false)
      if (r.ok) endSession()
      else setCloudErr(r.error === 'cloud-disabled' ? 'Cloud is not set up yet.' : (r.error ?? 'Could not create account'))
    } else {
      const s = addKid(d); loginAsKid(s.kids[s.kids.length - 1])
    }
  }

  // ── signup form ──
  if (stage === 'signup') {
    return createPortal(
      <div className="psw"><div className="psw-inner" style={{ width: 'min(440px,92vw)' }}>
        <KidForm mode="signup" busy={busy} error={cloudErr} onSave={handleSignup} onCancel={() => setStage(locked ? 'signin' : 'pick')} />
      </div></div>, document.body,
    )
  }

  // ── typed sign-in page (logout target) ──
  if (stage === 'signin') {
    return createPortal(
      <div className="psw"><div className="psw-inner">
        <h1 className="psw-title">Sign in</h1>
        <p className="psw-sub">Kids: type your username and PIN. Grown-ups: use Google.</p>
        <div className="psw-form">
          <input className="le-input" placeholder="username" value={uName} autoCapitalize="none" autoCorrect="off"
            onChange={e => { setCloudErr(null); setUName(e.target.value.toLowerCase().replace(/\s+/g, '')) }} />
          <input className="le-input" placeholder="4-digit PIN" inputMode="numeric" maxLength={4} value={uPin}
            onChange={e => { setCloudErr(null); setUPin(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
            onKeyDown={e => { if (e.key === 'Enter') typedLogin() }} />
          {cloudErr && <p className="kid-login-err">{cloudErr}</p>}
          <button className="psw-go" disabled={busy || uName.trim().length < 2 || uPin.length !== 4} onClick={typedLogin}>{busy ? 'Checking…' : 'Log in →'}</button>
        </div>
        <div className="psw-divider"><span>or</span></div>
        <div className="psw-alt">
          <button onClick={() => setStage('signup')}>🎉 I'm new — make a player</button>
          <button onClick={() => openAuthWall('to open grown-up tools')}>🔒 I'm a grown-up (Google)</button>
          {kids.length > 0 && <button onClick={() => setStage('pick')}>👥 Pick a profile on this device</button>}
        </div>
      </div></div>, document.body,
    )
  }

  const heading: Record<Exclude<Stage, 'pick' | 'signup' | 'signin'>, { face: string; bg: string; title: string; sub: string }> = {
    kid: { face: picked?.emoji ?? '🧒', bg: picked?.color ?? '#6366f1', title: `Hi ${picked?.displayName ?? ''}!`, sub: 'Enter your PIN' },
    pverify: { face: '🔒', bg: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)', title: 'Grown-ups', sub: 'Enter the parent passcode' },
    pcreate1: { face: '🔐', bg: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)', title: 'Set a parent passcode', sub: 'Pick 4 digits kids won\'t guess' },
    pcreate2: { face: '🔐', bg: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)', title: 'Confirm passcode', sub: 'Type the 4 digits again' },
  }

  // ── face picker / PIN pad ──
  return createPortal(
    <div className="psw">
      <div className="psw-inner">
        {stage === 'pick' ? (
          <>
            <h1 className="psw-title">Who's playing?</h1>
            <p className="psw-sub">Tap your face, or sign in with a username</p>
            <div className="psw-grid">
              {kids.map(k => (
                <button key={k.id} className={`psw-av${activeKidId === k.id ? ' on' : ''}`} onClick={() => pickKid(k)}>
                  <span style={{ background: k.color }}>{k.emoji}</span><b>{k.displayName}</b>
                </button>
              ))}
              <button className="psw-av new" onClick={() => setStage('signup')}>
                <span style={{ background: 'linear-gradient(135deg,#22c55e,#10b981)' }}>🎉</span><b>New player</b>
              </button>
              <button className="psw-av grown" onClick={pickGrown}>
                <span style={{ background: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)' }}>🔒</span><b>Grown-up</b>
              </button>
            </div>
            <button className="psw-close" onClick={() => setStage('signin')}>⌨️ Sign in with username</button>
            {!locked && activeKidId !== null && <button className="psw-close" onClick={closeSwitcher}>Cancel</button>}
          </>
        ) : (
          <div className={`psw-pad${err ? ' shake' : ''}`}>
            <span className="psw-face" style={{ background: heading[stage].bg }}>{heading[stage].face}</span>
            <h2>{heading[stage].title}</h2>
            <p>{busy ? 'Checking…' : heading[stage].sub}</p>
            <div className="psw-dots">{[0, 1, 2, 3].map(i => <span key={i} className={`kid-dot${i < pin.length ? ' filled' : ''}`} />)}</div>
            <div className="psw-keys">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} className="kid-key" disabled={busy} onClick={() => press(d)}>{d}</button>)}
              <button className="kid-key ghost" onClick={() => { setPin(''); setErr(false); setStage(locked ? 'signin' : 'pick') }}>↩</button>
              <button className="kid-key" disabled={busy} onClick={() => press('0')}>0</button>
              <button className="kid-key ghost" onClick={() => setPin(p => p.slice(0, -1))}>⌫</button>
            </div>
            {err && <p className="kid-login-err">{stage === 'pcreate2' ? 'Didn\'t match — try again' : 'Wrong — try again'}</p>}
          </div>
        )}
      </div>
    </div>, document.body,
  )
}

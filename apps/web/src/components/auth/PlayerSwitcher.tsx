import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { loadCircles, verifyLogin, type KidProfile } from '@lib/circles'
import { hasPasscode, setPasscode, verifyPasscode } from '@lib/parentGate'

type Stage = 'pick' | 'kid' | 'pverify' | 'pcreate1' | 'pcreate2'

// The login / switch-user screen. Kids tap their face + PIN to enter THEIR OWN
// space. The grown-up tile is protected by a Parent passcode kids never know —
// this is what stops a kid from reaching parent reports & controls.
export default function PlayerSwitcher() {
  const { showSwitcher, closeSwitcher, loginAsKid, switchToOwner, activeKidId, locked } = useAppStore()
  const [stage, setStage] = useState<Stage>('pick')
  const [picked, setPicked] = useState<KidProfile | null>(null)
  const [pin, setPin] = useState('')
  const [tmp, setTmp] = useState('')      // first entry while creating a passcode
  const [err, setErr] = useState(false)
  // Always reopen on the picker, never a stale pad.
  useEffect(() => {
    if (showSwitcher) { setStage('pick'); setPicked(null); setPin(''); setTmp(''); setErr(false) }
  }, [showSwitcher])
  if (!showSwitcher) return null

  const kids = loadCircles().kids
  const reset = () => { setStage('pick'); setPicked(null); setPin(''); setTmp(''); setErr(false) }

  const pickKid = (k: KidProfile) => { setPicked(k); setPin(''); setErr(false); setStage('kid') }
  const pickGrown = () => { setPin(''); setErr(false); setStage(hasPasscode() ? 'pverify' : 'pcreate1') }

  // a single digit press, routed by the current stage
  const press = (d: string) => {
    setErr(false)
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length < 4) return

    if (stage === 'kid' && picked) {
      const kid = verifyLogin(picked.username, next)
      if (kid) loginAsKid(kid)
      else fail()
    } else if (stage === 'pverify') {
      if (verifyPasscode(next)) switchToOwner()
      else fail()
    } else if (stage === 'pcreate1') {
      setTmp(next); setPin(''); setStage('pcreate2')
    } else if (stage === 'pcreate2') {
      if (next === tmp) { setPasscode(next); switchToOwner() }
      else { setErr(true); setTimeout(() => { setPin(''); setTmp(''); setStage('pcreate1') }, 600) }
    }
  }
  const fail = () => { setErr(true); setTimeout(() => setPin(''), 450) }
  const back = () => { setPin(''); setErr(false); setStage('pick') }

  const heading: Record<Stage, { face: string; bg: string; title: string; sub: string }> = {
    pick: { face: '', bg: '', title: '', sub: '' },
    kid: { face: picked?.emoji ?? '🧒', bg: picked?.color ?? '#6366f1', title: `Hi ${picked?.displayName ?? ''}!`, sub: 'Enter your PIN' },
    pverify: { face: '🔒', bg: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)', title: 'Grown-ups', sub: 'Enter the parent passcode' },
    pcreate1: { face: '🔐', bg: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)', title: 'Set a parent passcode', sub: 'Pick 4 digits kids won\'t guess' },
    pcreate2: { face: '🔐', bg: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)', title: 'Confirm passcode', sub: 'Type the 4 digits again' },
  }

  return createPortal(
    <div className="psw">
      <div className="psw-inner">
        {stage === 'pick' ? (
          <>
            <h1 className="psw-title">Who's playing?</h1>
            <p className="psw-sub">Tap your face and enter your PIN</p>
            <div className="psw-grid">
              {kids.map(k => (
                <button key={k.id} className={`psw-av${activeKidId === k.id ? ' on' : ''}`} onClick={() => pickKid(k)}>
                  <span style={{ background: k.color }}>{k.emoji}</span>
                  <b>{k.displayName}</b>
                </button>
              ))}
              <button className="psw-av grown" onClick={pickGrown}>
                <span style={{ background: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)' }}>🔒</span>
                <b>Grown-up</b>
              </button>
            </div>
            {kids.length === 0 && <p className="psw-empty">No kid profiles yet. A grown-up can add one in Profile → Add kid.</p>}
            {!locked && activeKidId !== null && <button className="psw-close" onClick={closeSwitcher}>Cancel</button>}
          </>
        ) : (
          <div className={`psw-pad${err ? ' shake' : ''}`}>
            <span className="psw-face" style={{ background: heading[stage].bg }}>{heading[stage].face}</span>
            <h2>{heading[stage].title}</h2>
            <p>{heading[stage].sub}</p>
            <div className="psw-dots">{[0, 1, 2, 3].map(i => <span key={i} className={`kid-dot${i < pin.length ? ' filled' : ''}`} />)}</div>
            <div className="psw-keys">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} className="kid-key" onClick={() => press(d)}>{d}</button>)}
              <button className="kid-key ghost" onClick={back}>↩</button>
              <button className="kid-key" onClick={() => press('0')}>0</button>
              <button className="kid-key ghost" onClick={() => setPin(p => p.slice(0, -1))}>⌫</button>
            </div>
            {err && <p className="kid-login-err">{stage === 'pcreate2' ? 'Didn\'t match — try again' : 'Wrong — try again'}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

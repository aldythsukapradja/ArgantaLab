import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { loadCircles, verifyLogin, type KidProfile } from '@lib/circles'

// The login / switch-user screen. A kid taps their face and enters their PIN to
// sign into THEIR OWN space (no grown-up tools visible). The grown-up tile
// returns to the owner account. Mounted app-wide and shown on demand.
export default function PlayerSwitcher() {
  const { showSwitcher, closeSwitcher, loginAsKid, switchToOwner, activeKidId } = useAppStore()
  const [picked, setPicked] = useState<KidProfile | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  if (!showSwitcher) return null

  const kids = loadCircles().kids

  const press = (d: string) => {
    if (!picked) return
    setErr(false)
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length === 4) {
      const kid = verifyLogin(picked.username, next)
      if (kid) { loginAsKid(kid); reset() }
      else { setErr(true); setTimeout(() => setPin(''), 450) }
    }
  }
  const reset = () => { setPicked(null); setPin(''); setErr(false) }

  return createPortal(
    <div className="psw">
      <div className="psw-inner">
        {!picked ? (
          <>
            <h1 className="psw-title">Who's playing?</h1>
            <p className="psw-sub">Tap your face and enter your PIN</p>
            <div className="psw-grid">
              {kids.map(k => (
                <button key={k.id} className={`psw-av${activeKidId === k.id ? ' on' : ''}`} onClick={() => setPicked(k)}>
                  <span style={{ background: k.color }}>{k.emoji}</span>
                  <b>{k.displayName}</b>
                </button>
              ))}
              <button className="psw-av grown" onClick={() => { switchToOwner() }}>
                <span style={{ background: 'linear-gradient(135deg,#4D9FFF,#8B5CF6)' }}>🧑</span>
                <b>Grown-up</b>
              </button>
            </div>
            {kids.length === 0 && <p className="psw-empty">No kid profiles yet. A grown-up can add one in Profile → Add kid.</p>}
            {activeKidId !== null && <button className="psw-close" onClick={closeSwitcher}>Cancel</button>}
          </>
        ) : (
          <div className={`psw-pad${err ? ' shake' : ''}`}>
            <span className="psw-face" style={{ background: picked.color }}>{picked.emoji}</span>
            <h2>Hi {picked.displayName}!</h2>
            <p>Enter your PIN</p>
            <div className="psw-dots">{[0, 1, 2, 3].map(i => <span key={i} className={`kid-dot${i < pin.length ? ' filled' : ''}`} />)}</div>
            <div className="psw-keys">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} className="kid-key" onClick={() => press(d)}>{d}</button>)}
              <button className="kid-key ghost" onClick={reset}>↩</button>
              <button className="kid-key" onClick={() => press('0')}>0</button>
              <button className="kid-key ghost" onClick={() => setPin(p => p.slice(0, -1))}>⌫</button>
            </div>
            {err && <p className="kid-login-err">Wrong PIN — try again</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

import { useState } from 'react';
import { signInGoogle, signInKid, guestProfile } from '../net/account.js';
import { hasSupabase } from '../net/supabase.js';

// Branded "Welcome to LashiraBloom" gate. Adults use Google, kids use username +
// PIN, and there is always a guaranteed "Play now" guest path so the game runs on
// first launch even before OAuth/RLS are configured for localhost.
export default function Welcome({ onReady }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('user'); // 'user' | 'kid'
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function google() {
    setErr(''); setBusy(true);
    try { await signInGoogle(); } // redirects; App picks up the session on return
    catch (e) { setErr('Google sign-in unavailable here — you can Play now instead.'); setBusy(false); }
  }

  async function kid() {
    setErr(''); setBusy(true);
    try {
      const p = await signInKid(name, pin);
      onReady(p);
    } catch (e) {
      setErr((e?.message || 'Sign-in failed') + ' — try Play now.');
      setBusy(false);
    }
  }

  function playNow() {
    onReady(guestProfile(name || (role === 'kid' ? 'Sprout' : 'Farmer'), role));
  }

  return (
    <div className="welcome-bg">
      <div className="welcome-card">
        <div className="mark"><i /></div>
        <h1>Welcome to <span className="grad-text">LashiraBloom</span></h1>
        <p className="sub">Sign in — your farm follows you on every device.</p>

        {hasSupabase && (
          <>
            <button className="gbtn" onClick={google} disabled={busy}>
              <span className="g">G</span> Continue with Google
            </button>
            <p className="hint">For grown-ups</p>
            <div className="divider">OR KIDS SIGN IN</div>
          </>
        )}

        <div className="role-row">
          <button className={'role-btn' + (role === 'kid' ? ' active' : '')} onClick={() => setRole('kid')}>🧒 Kid</button>
          <button className={'role-btn' + (role === 'user' ? ' active' : '')} onClick={() => setRole('user')}>🧑 Grown-up</button>
        </div>

        <input className="field" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        {hasSupabase && role === 'kid' && (
          <input className="field" placeholder="4-digit PIN" value={pin} maxLength={4}
            inputMode="numeric" onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        )}

        {hasSupabase && role === 'kid'
          ? <button className="cta" onClick={kid} disabled={busy || !name}>Log in →</button>
          : <button className="cta" onClick={playNow} disabled={busy}>Play now →</button>}

        {(hasSupabase && role === 'kid') && (
          <p style={{ marginTop: 12 }}>
            <button className="link" onClick={playNow}>🎉 Just let me play (offline)</button>
          </p>
        )}

        {err && <p className="err">{err}</p>}
        {!hasSupabase && <p className="hint" style={{ marginTop: 14 }}>Offline mode — progress saves on this device.</p>}
      </div>
    </div>
  );
}

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
              <GoogleIcon /> Continue with Google
            </button>
            <p className="hint">For grown-ups</p>
            <div className="divider">OR KIDS SIGN IN</div>
          </>
        )}

        {/* Adults only ever sign in via Google above — no separate "Grown-up" pill
            needed, it never did anything a default state didn't already do. Just
            ONE toggle into (and back out of) the kid username+PIN flow. */}
        {hasSupabase && (
          role === 'kid'
            ? <button className="kid-toggle" onClick={() => setRole('user')}>← Not a kid</button>
            : <button className="kid-toggle" onClick={() => setRole('kid')}>🧒 I'm a kid</button>
        )}

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

// The real Google "G" mark (same paths as apps/web's AuthWall) — was a plain
// bold letter before, not the actual logo.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.25-.164-1.84H9v3.48h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

// AccountBar — lives inside the Composer (no extra pages, per MP-0 scope):
// login (Google for adults, username+PIN for kids — kinetik logic), the
// kid/adult badge, the ArgantaLabs diamond mirror, and nickname claim.
import { useState } from 'react';
import {
  authAvailable, signInWithGoogle, signInKid, signOut, claimCharacter,
} from '../net/account.js';

export default function AccountBar({ account, onClaimed }) {
  const [tab, setTab] = useState('adult');
  const [kidUser, setKidUser] = useState('');
  const [kidPin, setKidPin] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!authAvailable) {
    return <div className="acct card offline">offline mode — no Supabase env configured</div>;
  }

  if (!account.user) {
    return (
      <div className="acct card">
        <div className="acct-tabs">
          <button className={tab === 'adult' ? 'on' : ''} onClick={() => setTab('adult')}>Adult</button>
          <button className={tab === 'kid' ? 'on' : ''} onClick={() => setTab('kid')}>Kids</button>
        </div>
        {tab === 'adult' ? (
          <button className="acct-google" disabled={busy}
            onClick={async () => { setBusy(true); setErr(''); const { error } = await signInWithGoogle(); if (error) { setErr(error.message); setBusy(false); } }}>
            Continue with Google
          </button>
        ) : (
          <div className="acct-kid">
            <input placeholder="username" value={kidUser} onChange={(e) => setKidUser(e.target.value)} />
            <input placeholder="PIN" type="password" inputMode="numeric" maxLength={6}
              value={kidPin} onChange={(e) => setKidPin(e.target.value)} />
            <button disabled={busy || !kidUser.trim() || kidPin.length < 4}
              onClick={async () => {
                setBusy(true); setErr('');
                const { error } = await signInKid(kidUser, kidPin);
                if (error) setErr("That username or PIN didn't match.");
                setBusy(false);
              }}>Play</button>
          </div>
        )}
        {err && <div className="acct-err">{err}</div>}
      </div>
    );
  }

  const badge = account.accountType === 'kid' ? '🧒 kid' : '👑 adult';
  return (
    <div className="acct card">
      <div className="acct-row">
        {account.profile?.photo_url && <img className="acct-avatar" src={account.profile.photo_url} alt="" />}
        <b>{account.profile?.display_name || account.user.email}</b>
        <span className={`chipbadge ${account.accountType}`}>{badge}</span>
        <span className="diamonds" title="ArgantaLabs diamonds (mirror — truth lives in ArgantaLabs)">
          💎 {Number(account.profile?.diamonds ?? 0).toLocaleString()}
        </span>
        <button className="acct-out" onClick={signOut}>sign out</button>
      </div>
      {account.character ? (
        <div className="acct-row">
          <span className="nick">⚔ {account.character.name}</span>
          <small className="cloudmark">{account.saveState}</small>
        </div>
      ) : (
        <div className="acct-row">
          <input placeholder="choose a nickname" value={nick} maxLength={16}
            onChange={(e) => setNick(e.target.value)} />
          <button disabled={busy || nick.trim().length < 3}
            onClick={async () => {
              setBusy(true); setErr('');
              const r = await claimCharacter(account.user.id, nick, account.accountType);
              if (r.error) setErr(r.error);
              else onClaimed(r.character);
              setBusy(false);
            }}>Claim</button>
          {err && <span className="acct-err">{err}</span>}
        </div>
      )}
    </div>
  );
}

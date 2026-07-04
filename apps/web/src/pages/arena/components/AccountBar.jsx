// AccountBar — lives inside the Composer (no extra pages, per MP-0 scope):
// login (Google for adults, username+PIN for kids — kinetik logic), the
// kid/adult badge, the ArgantaLabs diamond mirror, and nickname claim.
import { useEffect, useState } from 'react';
import {
  authAvailable, signInWithGoogle, signInKid, claimCharacter,
} from '../net/account.js';

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function xpProgress(xp) {
  const current = Math.max(0, Number(xp || 0));
  return Math.round(((current % 500) / 500) * 100);
}

function mapLabel(mapId) {
  if (!mapId) return 'Kingdom';
  if (mapId === 'buya_arena') return 'Buya Arena';
  if (mapId === 'character_lab') return 'Character Lab';
  return mapId.replace(/_/g, ' ');
}

function GoogleG() {
  return (
    <svg className="google-g" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.1h5.9c-.3 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.4-4.5 3.4-7.6z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.7H2.1v2.8C3.9 20.5 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.6 14c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7.2H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.8L5.6 14z" />
      <path fill="#EA4335" d="M12 5.3c1.6 0 3 .6 4.2 1.6l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.2L5.6 10c.9-2.7 3.4-4.7 6.4-4.7z" />
    </svg>
  );
}

export default function AccountBar({
  account,
  onClaimed,
  onSignOut,
  onSaveBuild,
  onResetBuild,
  onRenameGuardian,
  forcedLogout,
  onClearNotice,
}) {
  const [kidUser, setKidUser] = useState('');
  const [kidPin, setKidPin] = useState('');
  const [nick, setNick] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (account.guardian?.displayName) setGuardianName(account.guardian.displayName);
  }, [account.guardian?.id, account.guardian?.displayName]);

  const kidReady = kidUser.trim().length > 0 && kidPin.trim().length === 4;

  async function handleKidLogin() {
    if (!kidReady || busy) return;
    setBusy(true);
    setErr('');
    const { error } = await signInKid(kidUser, kidPin);
    if (error) {
      const message = String(error.message || '');
      const needsAuthFix = /confirm|confirmed|verification/i.test(message);
      setErr(needsAuthFix
        ? 'Kid login needs the Supabase auth fix migration: run supabase/migration_auth_fix.sql once.'
        : "That username or PIN didn't match.");
      setBusy(false);
    }
  }

  if (!authAvailable) {
    return <div className="acct card offline">offline mode — no Supabase env configured</div>;
  }

  if (!account.user) {
    return (
      <div className="acct login-card kingdom-auth-card card">
        <div className="kingdom-auth-mark" aria-hidden="true">
          <span />
        </div>
        <h1 className="kingdom-auth-title">Welcome to <span>ArgantaLab</span></h1>
        <p className="kingdom-auth-subtitle">Sign in — your progress follows you on every device.</p>
        {forcedLogout && (
          <div className="session-note">
            <b>Session moved</b>
            <span>{forcedLogout}</span>
            <button onClick={onClearNotice}>ok</button>
          </div>
        )}
        <button className="acct-google kingdom-google" disabled={busy}
          onClick={async () => { setBusy(true); setErr(''); const { error } = await signInWithGoogle(); if (error) { setErr(error.message); setBusy(false); } }}>
          <GoogleG />
          <span>Continue with Google</span>
        </button>
        <div className="kingdom-grown">For grown-ups</div>
        <div className="kingdom-divider"><span>OR KIDS SIGN IN</span></div>
        <div className="acct-kid kingdom-kid-form">
          <input
            className="kingdom-input"
            placeholder="username"
            value={kidUser}
            autoComplete="username"
            autoCapitalize="none"
            onChange={(e) => { setErr(''); setKidUser(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('kingdom-kid-pin')?.focus(); }}
          />
          <input
            id="kingdom-kid-pin"
            className="kingdom-input"
            placeholder="4-digit PIN"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={kidPin}
            onChange={(e) => { setErr(''); setKidPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleKidLogin(); }}
          />
          <button className="kingdom-login-btn" disabled={busy || !kidReady} onClick={handleKidLogin}>Log in →</button>
        </div>
        {err && <div className="acct-err">{err}</div>}
        <button type="button" className="kingdom-new-kid"
          onClick={() => setErr('Create kid players from ArgantaLab first, then come back here to play.')}>
          🎉 New here? Create a kid player
        </button>
      </div>
    );
  }

  const badge = account.accountType === 'kid' ? 'kid' : 'adult';
  const profile = account.profile || {};
  const character = account.character;
  const rank = profile.rank || { glyph: '*', name: 'Spark', color: '#f0a83a' };
  const stats = account.stats || { maxHp: 100, maxMp: 40, attack: 10, magic: 10, defense: 5 };
  const guardian = account.guardian;
  const friends = account.friends || [];
  const displayName = profile.display_name || profile.displayName || account.user.email;
  const characterName = character?.name;
  const nextGuardianName = guardianName || guardian?.displayName || '';

  if (!character) {
    return (
      <div className="acct login-card card claim-card">
        <div className="login-copy">
          <small>FIRST CHARACTER</small>
          <h1>Choose your Kingdom name.</h1>
          <p>This becomes your arena nameplate. Your ArgantaLab display name stays on the account HUD.</p>
        </div>
        <div className="acct-row account-summary">
          {profile.photo_url && <img className="acct-avatar big" src={profile.photo_url} alt="" />}
          <div>
            <b>{displayName}</b>
            <small>{badge} account · Level {profile.level || 1}</small>
          </div>
          <button className="acct-out" onClick={onSignOut}>sign out</button>
        </div>
        <div className="claim-row">
          <input placeholder="choose a nickname" value={nick} maxLength={16}
            onChange={(e) => setNick(e.target.value)} />
          <button disabled={busy || nick.trim().length < 3}
            onClick={async () => {
              setBusy(true); setErr('');
              const r = await claimCharacter(account.user.id, nick, account.accountType);
              if (r.error) setErr(r.error);
              else onClaimed?.(r.character);
              setBusy(false);
            }}>Claim</button>
        </div>
        {err && <div className="acct-err">{err}</div>}
      </div>
    );
  }

  return (
    <div className="acct card">
      <div className="acct-hero">
        {profile.photo_url && <img className="acct-avatar big" src={profile.photo_url} alt="" />}
        <div className="acct-title">
          <div className="acct-name-line">
            <b>{displayName}</b>
            <span className={`chipbadge ${account.accountType}`}>{badge}</span>
          </div>
          <div className="acct-subline">
            <span className="rank-pill" style={{ '--rank': rank.color }}>
              <b>{rank.glyph}</b> {rank.name}
            </span>
            <span>Level {fmt(profile.level || 1)}</span>
            <span>{fmt(profile.xp)} XP</span>
          </div>
          <div className="mini-xp"><span style={{ width: `${xpProgress(profile.xp)}%` }} /></div>
        </div>
        <button className="acct-out" onClick={onSignOut}>sign out</button>
      </div>

      <div className="acct-grid">
        <div className="acct-stat">
          <small>Character</small>
          <b>{characterName}</b>
          <span>{(character.path_id || character.pathId || 'warrior').toUpperCase()}</span>
        </div>
        <div className="acct-stat">
          <small>Wallet</small>
          <b>{fmt(profile.diamonds)}</b>
          <span>diamonds</span>
        </div>
        <div className="acct-stat">
          <small>Combat</small>
          <b>{fmt(stats.maxHp)} HP</b>
          <span>{fmt(stats.maxMp)} MP · ATK {fmt(stats.attack)}</span>
        </div>
      </div>

      <div className="sync-panel">
        <div>
          <small>Sync status</small>
          <b>{account.saveState || 'Synced'}</b>
          <span>Practice uses draft. Buya Arena uses saved build.</span>
        </div>
        <div className="sync-actions">
          <button onClick={onResetBuild}>Reset draft</button>
          <button className="primary" onClick={onSaveBuild}>Save build</button>
        </div>
      </div>

      {guardian && (
        <div className="guardian-panel">
          <div className="guardian-symbol">{guardian.rarity?.[0]?.toUpperCase() || 'G'}</div>
          <div className="guardian-main">
            <small>Equipped guardian</small>
            <b>{guardian.displayName}</b>
            <span>Lv {fmt(guardian.level)} · {guardian.rarity} · {fmt(guardian.maxHp)} HP · ATK {fmt(guardian.attack)}</span>
          </div>
          <div className="guardian-rename">
            <input value={nextGuardianName} maxLength={24}
              onChange={(e) => setGuardianName(e.target.value)} />
            <button disabled={!nextGuardianName.trim() || nextGuardianName.trim() === guardian.displayName}
              onClick={() => onRenameGuardian?.(nextGuardianName.trim())}>rename</button>
          </div>
        </div>
      )}

      <div className="friends-panel">
        <div className="friends-head">
          <b>Friends online</b>
          <span>{friends.filter((f) => f.status === 'online').length}/{friends.length}</span>
        </div>
        {friends.length ? friends.slice(0, 4).map((f) => (
          <div className="friend-row" key={f.character_id || f.profile_id}>
            <span className={`presence-dot ${f.status}`} />
            <b>{f.character_name || f.display_name}</b>
            <small>{mapLabel(f.map_id)}</small>
          </div>
        )) : (
          <small className="friends-empty">No friends online yet.</small>
        )}
      </div>
    </div>
  );
}

// Shown to a signed-in player who has no Kingdom Heroes character yet. Per the
// design rule, the farmer IS your Heroes character, so you must build one first.
const HEROES_URL = 'https://heroes.arganta.app';

export default function CharacterGate({ profile, onPlayAnyway, onSignOut }) {
  return (
    <div className="welcome-bg">
      <div className="welcome-card">
        <div className="mark"><i /></div>
        <h1>Build your <span className="grad-text">hero</span> first</h1>
        <p className="sub">
          In LashiraBloom you farm as your real Kingdom Heroes character
          {profile?.displayName ? `, ${profile.displayName}` : ''}. Create your hero in
          Kingdom Heroes, then come back and it walks your farm.
        </p>
        <a className="cta" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}
          href={HEROES_URL} target="_blank" rel="noreferrer">Open Kingdom Heroes →</a>
        <p style={{ marginTop: 14 }}>
          <button className="link" onClick={onPlayAnyway}>Play with a placeholder farmer for now</button>
        </p>
        <p className="hint" style={{ marginTop: 8 }}>
          <button className="link" style={{ fontWeight: 600, color: 'var(--muted)' }} onClick={onSignOut}>Sign out</button>
        </p>
      </div>
    </div>
  );
}

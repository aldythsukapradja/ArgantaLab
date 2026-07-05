// Heads-up display: top status chips, bottom toolbar + action + sleep + nav.
const TOOLS = [
  { id: 'hoe', icon: '⛏', label: 'Till' },
  { id: 'seed', icon: '🌰', label: 'Plant' },
  { id: 'can', icon: '💧', label: 'Water' },
];

export function Hud({ snap, game, onOpen }) {
  return (
    <>
      <div className="hud-top">
        <span className="chip">🌸 {snap.bloom}</span>
        <span className="chip lock" title="Diamonds come from learning">💎 {snap.diamonds} <span className="k">learn</span></span>
        <span className="chip">⚡ {snap.stamina}/{snap.maxStamina}</span>
        <span className="chip">Lv {snap.level}</span>
        <div className="hud-spacer" />
        <span className="season">☀ {cap(snap.season)} · Day {snap.day}</span>
      </div>

      {snap.toast && <div className="toast">{snap.toast}</div>}

      {snap.nearBuilding && (
        <div className="help">
          Near {snap.nearBuilding} — open it below, or use Space to act
        </div>
      )}

      <div className="hud-bottom">
        <div className="navbtns">
          <button className="navbtn" onClick={() => onOpen('shop')}>🛒 Shop</button>
          <button className="navbtn" onClick={() => onOpen('barn')}>🐄 Barn</button>
          <button className="navbtn" onClick={() => onOpen('kin')}>🍃 Kin</button>
          <button className="navbtn" onClick={() => onOpen('house')}>🏡 Home</button>
        </div>
        <div className="toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={'tool' + (snap.tool === t.id ? ' active' : '')}
              onClick={() => game.setTool(t.id)}
            >
              <span>{t.icon}</span>
              <small>{t.label}</small>
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="abtn primary big" onClick={() => game.action()}>Use ⤵</button>
          <button className="abtn" onClick={() => game.sleep()}>😴 Sleep</button>
        </div>
      </div>
    </>
  );
}

function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }

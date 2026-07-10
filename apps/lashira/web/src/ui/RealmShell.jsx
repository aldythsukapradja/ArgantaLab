import { UnitCard } from './UnitCard.jsx';

// ── RealmShell — the ONE four-corner HUD every realm renders through (IMPL §0).
// No realm builds its own corners; it only supplies data + a controller spec.
//   top-left     CharacterStatusPanel (UnitCard + realm/resource strip)
//   top-right    SettingsButton (return to HQ)
//   bottom-left  LocationInfoPanel (realm · objective · meter)
//   bottom-right ActionController (1 primary + ring of skills, from `controller`)
//
// `controller` = { primary:GameAction, ring:GameAction[] }
// GameAction    = { id, label, icon, cooldownMs?, cooldownUntil?, disabledReason?, kind? }

function cooldownPct(action, now) {
  if (!action?.cooldownUntil || !action?.cooldownMs) return 0;
  const left = action.cooldownUntil - now;
  if (left <= 0) return 0;
  return Math.max(0, Math.min(1, left / action.cooldownMs));
}

export default function RealmShell({
  card, realmName, realmColor, shortName, theme,
  objective, meter, controller, onAction, onExit,
  heroNote, capsNote, now = 0, children,
}) {
  const primary = controller?.primary || null;
  const ring = controller?.ring || [];
  const meterPct = meter && meter.max ? Math.max(0, Math.min(100, (meter.value / meter.max) * 100)) : null;

  const fire = (action) => {
    if (!action || action.disabledReason) return;
    if (cooldownPct(action, now) > 0) return;
    onAction?.(action.id);
  };

  return (
    <div className="room-full">
      <div className="room-canvas realm-room" style={{ '--realm-color': realmColor }}>
        {children /* canvas + module DOM overlay slot */}

        {/* top-left: character + realm strip */}
        <div className="left-stack">
          <UnitCard card={card} />
          <div className="res-strip">
            <span className="res res-wood">Realm</span>
            <span className="res res-bloom">{shortName}</span>
            <span className="res-div" aria-hidden="true" />
            <span className="res res-diamond">{theme}</span>
          </div>
        </div>

        {/* top-center: realm name */}
        <div className="zone-pill">{realmName}</div>

        {/* top-right: settings / exit */}
        <div className="realm-settings">
          <button type="button" className="hud-gear" onClick={onExit} title="Return to HQ">↩</button>
        </div>

        {/* bottom-left: location / objective / meter */}
        <div className="realm-info">
          <div className="realm-info-obj">{objective || realmName}</div>
          {meterPct != null && (
            <div className="realm-meter" title={meter.label || ''}>
              <span style={{ width: meterPct + '%', background: realmColor }} />
              <b>{meter.label || ''}</b>
            </div>
          )}
          {capsNote && <div className="realm-caps">{capsNote}</div>}
        </div>

        {heroNote && <div className="hero-note">{heroNote}</div>}

        {/* bottom-right: action controller (1 primary + ring) */}
        <div className="cluster farm realm-cluster">
          <div className="small-ring">
            {ring.map((a) => {
              const cp = cooldownPct(a, now);
              const disabled = !!a.disabledReason || cp > 0;
              return (
                <button
                  key={a.id}
                  type="button"
                  className={'skill-circle util' + (disabled ? ' cooling' : '') + (a.kind === 'emote' ? ' emote' : '')}
                  onClick={() => fire(a)}
                  title={a.disabledReason || a.label}
                  disabled={disabled && !!a.disabledReason}
                >
                  <span className="ra-ico">{a.icon || '◇'}</span>
                  {cp > 0 && <span className="cd-wipe" style={{ '--cd': cp }} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {primary && (
            <button
              type="button"
              className={'attack-circle' + (primary.disabledReason || cooldownPct(primary, now) > 0 ? ' cooling' : '')}
              onClick={() => fire(primary)}
              title={primary.disabledReason || primary.label}
            >
              <span>{primary.icon ? primary.icon + ' ' : ''}{primary.label}</span>
              {cooldownPct(primary, now) > 0 && (
                <span className="cd-wipe" style={{ '--cd': cooldownPct(primary, now) }} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

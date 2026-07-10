import { useState } from 'react';
import { ActionCluster } from '@arganta/combat/cluster';
import { UnitCard } from './UnitCard.jsx';
import { SettingsSheet } from './SettingsSheet.jsx';

// ── RealmShell — the ONE four-corner HUD every realm renders through (IMPL §0).
// No realm builds its own corners; it only supplies data + a controller spec.
//   top-left     CharacterStatusPanel (UnitCard + realm/resource strip + status)
//   top-right    SettingsButton (return to HQ)
//   bottom-right ActionController (from `controller`)
//
// The controller can be EITHER:
//   { primary:GameAction, ring:GameAction[] }              — simple mode (default)
//   { cluster: {...} }                                     — the real PvP/PvE ActionCluster
// A realm that supplies `cluster` gets the exact bottom-right combat controller
// the farm's battle mode uses (attack + numbered skill orbs + pie-wipe cooldowns).
// GameAction  = { id, label, icon, cooldownMs?, cooldownUntil?, disabledReason?, kind? }
// cluster     = { skills:[{name,fx,manaCost,cooldownMs?,cooldownUntil?}], attack:{cooldownMs?,cooldownUntil?},
//                 mp?, skin?, utils:[{id,icon,title}] }  — onSkill(i)/onAttack/util route through onAction

function cooldownPct(action, now) {
  if (!action?.cooldownUntil || !action?.cooldownMs) return 0;
  const left = action.cooldownUntil - now;
  if (left <= 0) return 0;
  return Math.max(0, Math.min(1, left / action.cooldownMs));
}

export default function RealmShell({
  card, realmName, realmColor, theme,
  objective, meter, controller, onAction, onExit,
  heroNote, capsNote, now = 0, children,
  camZoom, onCamZoom,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const primary = controller?.primary || null;
  const ring = controller?.ring || [];
  const cluster = controller?.cluster || null;
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

        {/* top-left column: character card → live status panel. The realm/theme
            chip row was removed (redundant with the bottom-left realm-name pill);
            the status (objective + meter) used to sit alone in the bottom-left
            corner where it crowded the edge; it now lives here under the card
            so the whole left column reads as one stack (v1.5 §18.2). */}
        <div className="left-stack">
          <UnitCard card={card} />
          <div className="realm-status" style={{ '--realm-color': realmColor }}>
            <div className="rs-obj">{objective || realmName}</div>
            {meterPct != null && (
              <div className="rs-meter" title={meter.label || ''}>
                <span className="rs-fill" style={{ width: meterPct + '%' }} />
                <b>{meter.label || ''}</b>
              </div>
            )}
            {capsNote && <div className="rs-caps">{capsNote}</div>}
          </div>
        </div>

        {/* top-center: realm name */}
        <div className="zone-pill">{realmName}</div>

        {/* top-right: settings gear (opens the shared SettingsSheet, same one
            the farm uses — edit once, changes everywhere). Exit-to-HQ lives
            inside the sheet. */}
        <div className="realm-settings">
          <button type="button" className="hud-gear" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
        </div>
        {showSettings && (
          <SettingsSheet
            world={{ name: realmName || 'Settings', color: realmColor }}
            hero={{ card }}
            circle={{ locationLabel: `${realmName || 'Realm'}${theme ? ' · ' + theme : ''}` }}
            play={camZoom != null ? { zoom: { value: camZoom, min: 0.6, max: 2, step: 0.05, onChange: onCamZoom } } : null}
            sound={{}}
            system={{ help: `You're in ${realmName || 'a realm'} (${theme || ''}). Tap the map to act; use the controller bottom-right. Exit returns you to the Kingdom hub.`, exitLabel: 'Exit to Kingdom' }}
            onExit={onExit}
            onClose={() => setShowSettings(false)}
          />
        )}

        {heroNote && <div className="hero-note">{heroNote}</div>}

        {/* bottom-right: action controller — the real PvP/PvE ActionCluster
            when the realm supplies a `cluster` spec, else the simple primary+ring. */}
        {cluster ? (
          <ActionCluster
            skills={cluster.skills || []}
            cooldowns={(cluster.skills || []).map((sk) => cooldownPct(sk, now))}
            attackCooldown={cooldownPct(cluster.attack, now)}
            mp={cluster.mp ?? null}
            skin={cluster.skin ?? null}
            onSkill={(i) => onAction?.('skill:' + i)}
            onAttack={() => onAction?.('attack')}
            utils={(cluster.utils || []).map((u) => ({ ...u, onClick: () => onAction?.(u.id) }))}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}

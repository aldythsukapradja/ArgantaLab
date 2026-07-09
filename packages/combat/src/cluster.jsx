// The shared bottom-right ACTION CLUSTER — Kingdom Heroes' exact markup is the
// canonical version. Kingdom's TestRoom and the farm's battle mode both render
// THIS component, so the cluster's structure + skill/attack wiring is edited
// once. Class names (.cluster/.small-ring/.skill-circle/.attack-circle/.slot)
// match the shared Heroes glass CSS both apps already ship, so it looks the same
// in both. Icons are inlined (Kingdom's) but overridable per-button via props.
import React from 'react';
import { GameIcon } from './icons/Icon.jsx';
import { skinOf, skinRoleForSkill } from './skins.js';

const IconSwords = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6" /><path d="m16 16 4 4" /><path d="M19 21h2v-2" />
    <path d="M9.5 17.5 21 6V3h-3L6.5 14.5" /><path d="m11 19-6-6" /><path d="m8 16-4 4" /><path d="M5 21H3v-2" />
  </svg>
);
// Emote orb icon — a plain smiley, distinct from the skill/attack glyphs so it
// reads as "social gesture" rather than "combat action" at a glance.
const IconEmote = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconSpark = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
  </svg>
);

export { IconSwords, IconSpark, IconEmote };

// Props:
//   skills      [{ name, fx, manaCost, cdMs, ... }]  — the 3 skill slots
//   onSkill(i)  cast skill i
//   onAttack()  basic attack
//   attackIcon  node (default crossed swords); attackLabel for a11y
//   utils       [{ icon, onClick, title, key }] — extra orbs (take/mount/sleep…)
//   mp          optional current MP; when set, a skill costing more than mp is
//               disabled and shows its cost badge (pure additive — Kingdom skills
//               have manaCost null, so nothing changes there)
//   onButtonPointerDown  optional (Kingdom passes keepCanvasFocus)
//   skin        optional skin id. When set, repaints the orbs (inline CSS vars
//               from the skin registry) and swaps each icon for that skin's
//               vendored game-icons glyph. When null → unchanged (Kingdom).
//   cooldowns   optional array parallel to `skills`: 0 (ready) .. 1 (just cast).
//               Draws a shrinking radial "pie" wipe + disables the button while
//               > 0 — a visible reason a spammed key/click did nothing, not a
//               silent no-op. Omit (default) → unchanged (Kingdom opts in later).
//   attackCooldown  same 0..1 fraction for the attack-circle.
export function ActionCluster({
  skills = [], onSkill, onAttack,
  attackIcon = <IconSwords />, attackLabel = 'attack',
  utils = [], mp = null, onButtonPointerDown, skin = null,
  cooldowns = null, attackCooldown = 0,
}) {
  const sk = skin ? skinOf(skin) : null;
  const attackNode = sk ? <GameIcon name={sk.icons.attack} size={46} /> : attackIcon;
  return (
    <div className="cluster" data-skin={sk ? sk.id : undefined} style={sk ? sk.vars : undefined}>
      <div className="small-ring">
        {skills.map((s, i) => {
          const cost = Number(s?.manaCost || 0);
          const cd = cooldowns ? Math.max(0, Math.min(1, cooldowns[i] || 0)) : 0;
          const disabled = (mp != null && cost > 0 && mp < cost) || cd > 0;
          const icon = sk ? <GameIcon name={sk.icons[skinRoleForSkill(s, i)]} size={26} /> : <IconSpark />;
          return (
            <button
              key={i}
              type="button"
              className={'skill-circle' + (cd > 0 ? ' cooling' : '')}
              title={s?.name || `effect #${s?.fx}`}
              disabled={disabled}
              onPointerDown={onButtonPointerDown}
              onClick={() => onSkill?.(i)}
            >
              {icon}<span className="slot">{i + 1}</span>
              {cd > 0 ? <span className="cd-wipe" style={{ '--cd': cd }} aria-hidden="true" /> : cost > 0 ? <span className="tool-count">{cost}</span> : null}
            </button>
          );
        })}
        {utils.map((u, i) => (
          <button
            key={u.key || `util${i}`}
            type="button"
            className={'skill-circle util' + (u.className ? ' ' + u.className : '')}
            title={u.title}
            onPointerDown={onButtonPointerDown}
            onClick={u.onClick}
          >
            {sk && u.key === 'mount' ? <GameIcon name={sk.icons.mount} size={24} /> : u.icon}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={'attack-circle' + (attackCooldown > 0 ? ' cooling' : '')}
        aria-label={attackLabel}
        disabled={attackCooldown > 0}
        onPointerDown={onButtonPointerDown}
        onClick={onAttack}
      >
        {attackNode}
        {attackCooldown > 0 && <span className="cd-wipe" style={{ '--cd': attackCooldown }} aria-hidden="true" />}
      </button>
    </div>
  );
}

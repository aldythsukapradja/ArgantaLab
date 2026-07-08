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
const IconSpark = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
  </svg>
);

export { IconSwords, IconSpark };

// Props:
//   skills      [{ name, fx, manaCost, ... }]  — the 3 skill slots
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
export function ActionCluster({
  skills = [], onSkill, onAttack,
  attackIcon = <IconSwords />, attackLabel = 'attack',
  utils = [], mp = null, onButtonPointerDown, skin = null,
}) {
  const sk = skin ? skinOf(skin) : null;
  const attackNode = sk ? <GameIcon name={sk.icons.attack} size={46} /> : attackIcon;
  return (
    <div className="cluster" data-skin={sk ? sk.id : undefined} style={sk ? sk.vars : undefined}>
      <div className="small-ring">
        {skills.map((s, i) => {
          const cost = Number(s?.manaCost || 0);
          const disabled = mp != null && cost > 0 && mp < cost;
          const icon = sk ? <GameIcon name={sk.icons[skinRoleForSkill(s, i)]} size={26} /> : <IconSpark />;
          return (
            <button
              key={i}
              type="button"
              className="skill-circle"
              title={s?.name || `effect #${s?.fx}`}
              disabled={disabled}
              onPointerDown={onButtonPointerDown}
              onClick={() => onSkill?.(i)}
            >
              {icon}<span className="slot">{i + 1}</span>
              {cost > 0 ? <span className="tool-count">{cost}</span> : null}
            </button>
          );
        })}
        {utils.map((u, i) => (
          <button
            key={u.key || `util${i}`}
            type="button"
            className="skill-circle util"
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
        className="attack-circle"
        aria-label={attackLabel}
        onPointerDown={onButtonPointerDown}
        onClick={onAttack}
      >
        {attackNode}
      </button>
    </div>
  );
}

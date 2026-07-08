// UnitCard — the ONE profile card (crest · name · path/title · level · EXP · HP/MP).
// Single source of truth for the profile design: the player's own top-left frame
// AND every online player in the live popup render THIS component. Change the
// markup/styles here once and every card updates together.
//
// Purely presentational — the caller normalises its data (self snapshot or a
// peer broadcast) into the same prop shape via cardFromSnap / cardFromPeer below.
import { computeRank } from '../net/hero.js';
import TierIcon from '../components/TierIcon.jsx';
import { IconHeart, IconMana } from '../components/HudIcons.jsx';

const fmt = (n) => Number(n || 0).toLocaleString();
const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

export function UnitCard({ card, className = '' }) {
  if (!card) return null;
  const {
    rank, name, pathIcon, pathName, title, level,
    xpPct, xpCur, xpReq, hp, maxHp, mp, maxMp,
  } = card;
  const hpPct = clampPct((hp / Math.max(1, maxHp)) * 100);
  const mpPct = clampPct((mp / Math.max(1, maxMp)) * 100);
  return (
    <div className={'unit-frame' + (className ? ' ' + className : '')}>
      <div className="unit-rank" title={`ArgantaLab rank: ${rank?.name || ''}`}>
        <TierIcon color={rank?.color} glyph={rank?.glyph} size={38} />
        <span className="rank-name" style={{ background: rank?.color, borderColor: rank?.color }}>{rank?.name}</span>
      </div>
      <div className="unit-main">
        <div className="unit-name">
          <b className="uname" title={name}>{name}</b>
          <span className="utitle">
            <em className="path-chip">{pathIcon} {title || pathName || 'Guardian'}</em>
            <em className="lv-chip">Lv {fmt(level)}</em>
          </span>
        </div>
        <div className="unit-exp-row">
          <div className="unit-exp" title={`${xpPct ?? 0}% to next level`}><span style={{ width: `${clampPct(xpPct)}%` }} /></div>
          <b className="exp-num" title="XP into this level / XP this level needs">
            ✨ {level >= 99 ? 'MAX' : `${fmt(xpCur)}/${fmt(xpReq)}`}
          </b>
        </div>
        <div className="unit-bars">
          <div className="bar hp"><span style={{ width: `${hpPct}%` }} /><b><IconHeart /> {fmt(hp)}/{fmt(maxHp)}</b></div>
          <div className="bar mp"><span style={{ width: `${mpPct}%` }} /><b><IconMana /> {fmt(mp)}/{fmt(maxMp)}</b></div>
        </div>
      </div>
    </div>
  );
}

// Normalise the player's OWN snapshot into a card. `battle` overrides HP with the
// live arena pool when in combat; otherwise HP shows the full level-scaled max.
export function cardFromSnap(snap, battle) {
  const maxHp = Number(snap.maxHp || 100);
  return {
    rank: computeRank(snap.xp),
    name: snap.name,
    pathIcon: snap.pathIcon,
    pathName: snap.pathName,
    title: snap.title,
    level: snap.level,
    xpPct: snap.xpPct,
    xpCur: snap.xpCur,
    xpReq: snap.xpReq,
    hp: battle?.on ? battle.hp : maxHp,
    maxHp: battle?.on ? battle.maxHp : maxHp,
    mp: snap.stamina,
    maxMp: snap.maxStamina,
  };
}

// Normalise a peer's presence broadcast (see presenceCard in FarmRoom) into a
// card. Peers show their full HP pool (we don't stream their live battle HP).
export function cardFromPeer(peer) {
  const c = peer?.card || {};
  const maxHp = Number(c.maxHp || 100);
  return {
    rank: computeRank(c.xp),
    name: peer?.name || 'Farmer',
    pathIcon: c.pathIcon,
    pathName: c.pathName,
    title: c.title,
    level: c.level ?? 1,
    xpPct: c.xpPct,
    xpCur: c.xpCur,
    xpReq: c.xpReq,
    hp: maxHp,
    maxHp,
    mp: c.stamina ?? c.maxStamina ?? 0,
    maxMp: c.maxStamina ?? 0,
  };
}

// Hotspot popups — Castle (home upgrade + skin), Dungeon, Fishing. Rendered by
// FarmRoom next to <Panels>. The MERCHANT shops (seed/general/blacksmith/animal/
// cosmetic) moved into the unified gallery Shop (Shop.jsx) — tapping a shop
// building now opens that Shop at the matching sub-tab, so this file only owns the
// non-shop landmarks.
import { useEffect, useRef, useState } from 'react';
import { MAT_ICON } from '../game/farm-mechanics.js';
import { listPvpRank } from '../game/pvp-rank.js';

const fmt = (n) => Number(n || 0).toLocaleString();

function Head({ title, sub, onClose }) {
  return (
    <div className="phead">
      <div><h2>{title}</h2><p className="psub">{sub}</p></div>
      <button className="xbtn" onClick={onClose}>✕</button>
    </div>
  );
}

function MatBar({ snap, mech }) {
  // wood/stone live in the economy workspace's snapshot; ore/gem/fish in the mech store.
  const amt = (k) => (k === 'wood' || k === 'stone') ? (snap?.[k] ?? 0) : (mech?.[k] ?? 0);
  return (
    <div className="produce-preview" style={{ marginBottom: 8 }}>
      {['wood', 'stone', 'ore', 'gem', 'fish'].map((k) => (
        <span className="produce-chip" key={k}>{MAT_ICON[k]}<b>×{fmt(amt(k))}</b></span>
      ))}
    </div>
  );
}

const CASTLE_SKINS = [
  ['house', 'Old house'], ['shack', 'Shack'], ['cottage', 'Cottage'], ['farmhouse', 'Farmhouse'],
  ['storybook', 'Storybook'], ['fairytale', 'Fairytale'], ['royal', 'Royal'], ['whimsical', 'Whimsical'],
];
// Thumbnails — mirror farm-art-bundled.js lashira.castleskin.* files.
const SKIN_FILE = {
  house: 'house.png', shack: 'lib/house_t1_shack.png', cottage: 'lib/house_t2_cottage.png',
  farmhouse: 'lib/house_t3_farmhouse.png', storybook: 'lib/castle_opt1_storybook.png',
  fairytale: 'lib/castle_opt2_fairytale.png', royal: 'lib/castle_opt3_royal.png',
  whimsical: 'lib/castle_opt4_whimsical.png',
};

export function HotspotPanels({ hotspot, snap, game, mech, mechGame, onClose, onEnterDungeon, castleSkin, onCastleSkin, circleId, selfId, circleMembers }) {
  if (!hotspot) return null;
  return (
    <div className="panel-scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        {hotspot.kind === 'castle' && <CastlePanel snap={snap} mech={mech} mechGame={mechGame} onClose={onClose} castleSkin={castleSkin} onCastleSkin={onCastleSkin} />}
        {hotspot.kind === 'dungeon' && <DungeonPanel snap={snap} onClose={onClose} onEnter={onEnterDungeon} />}
        {hotspot.kind === 'dock' && <FishingPanel mechGame={mechGame} onClose={onClose} />}
        {hotspot.kind === 'pvprank' && <PvpRankPanel circleId={circleId} selfId={selfId} circleMembers={circleMembers} onClose={onClose} />}
      </div>
    </div>
  );
}

function CastlePanel({ snap, mech, mechGame, onClose, castleSkin, onCastleSkin }) {
  const TIERS = ['Shack', 'Cottage', 'Farmhouse', 'Manor', 'Castle'];
  const tier = mech?.house?.tier || 1;
  const name = TIERS[Math.min(tier - 1, 4)];
  const max = tier >= 5;
  const cost = mechGame.houseCost();
  const afford = (snap?.wood || 0) >= cost.wood && (snap?.stone || 0) >= cost.stone;
  return (
    <>
      <Head title={`🏰 Home — ${name}`} sub={`Tier ${tier}/5 · storage ${mech?.house?.storage}`} onClose={onClose} />
      <MatBar snap={snap} mech={mech} />
      <div className="row">
        <div className="ico">🏗</div>
        <div className="grow">
          <div className="name">{max ? 'Castle — fully upgraded ★' : `Upgrade → ${TIERS[tier]}`}</div>
          <div className="meta">{max ? 'The grandest home in the realm.' : `+storage (bigger bag), grander exterior · needs 🪵${cost.wood} 🪨${cost.stone}`}</div>
        </div>
        <button className="rbtn" disabled={max || !afford} onClick={() => mechGame.upgradeHouse()}>{max ? 'Max' : 'Upgrade'}</button>
      </div>
      <div className="row" style={{ borderStyle: 'dashed' }}>
        <div className="ico">🛋</div>
        <div className="grow"><div className="name">Decorate the interior</div><div className="meta">Place furniture inside — coming next</div></div>
      </div>
      {onCastleSkin && (
        <div style={{ marginTop: 10 }}>
          <div className="name" style={{ marginBottom: 6 }}>🎨 Castle skin</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {CASTLE_SKINS.map(([id, label]) => {
              const on = castleSkin === id;
              return (
                <button key={id} onClick={() => onCastleSkin(id)} title={label}
                  style={{
                    padding: '6px 4px', borderRadius: 8, cursor: 'pointer', font: 'inherit',
                    border: on ? '2px solid #ffcf4a' : '1px solid rgba(255,255,255,0.18)',
                    background: on ? 'rgba(255,207,74,0.18)' : 'rgba(255,255,255,0.05)',
                    color: 'inherit', fontSize: 11, lineHeight: 1.2,
                  }}>
                  <img src={new URL('farm-art/' + SKIN_FILE[id], document.baseURI).href} alt={label}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', imageRendering: 'pixelated', display: 'block', marginBottom: 3 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function DungeonPanel({ onClose, onEnter }) {
  return (
    <>
      <Head title="🏰 The Hollow Gate" sub="A 1-floor dungeon — friendly beasts guard the loot" onClose={onClose} />
      <div className="row">
        <div className="ico">🐯</div>
        <div className="grow"><div className="name">Boss: the Tiger</div><div className="meta">Clear the woodland foes, beat the boss → materials + Bloom</div></div>
      </div>
      <div className="row" style={{ borderStyle: 'dashed' }}>
        <div className="ico">⚔</div>
        <div className="grow"><div className="name">Gentle rules</div><div className="meta">Faint = you just leave, keep what you gathered</div></div>
        <button className="rbtn" onClick={onEnter}>Enter ⚔</button>
      </div>
    </>
  );
}

// Simple cast → reel timing minigame.
function FishingPanel({ mechGame, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | casting | bite | done
  const t1 = useRef(null), t2 = useRef(null);
  useEffect(() => () => { clearTimeout(t1.current); clearTimeout(t2.current); }, []);
  const cast = () => {
    setPhase('casting');
    t1.current = setTimeout(() => {
      setPhase('bite');
      t2.current = setTimeout(() => setPhase('idle'), 1200); // miss window
    }, 900 + Math.random() * 1600);
  };
  const reel = () => {
    if (phase !== 'bite') { clearTimeout(t1.current); clearTimeout(t2.current); setPhase('idle'); return; }
    clearTimeout(t2.current); mechGame.catchFish(); setPhase('done');
    t1.current = setTimeout(() => setPhase('idle'), 900);
  };
  return (
    <>
      <Head title="🎣 Fishing dock" sub="Cast, wait for the bite, then reel!" onClose={onClose} />
      <div className="row" style={{ justifyContent: 'center', minHeight: 90, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>{phase === 'bite' ? '❗🐟' : phase === 'done' ? '🎉🐟' : phase === 'casting' ? '🌀' : '🎣'}</div>
          <div className="meta">{phase === 'idle' ? 'Ready to cast' : phase === 'casting' ? 'Waiting for a bite…' : phase === 'bite' ? 'REEL NOW!' : 'Nice catch!'}</div>
        </div>
      </div>
      <div className="row" style={{ borderStyle: 'dashed', justifyContent: 'center', gap: 10 }}>
        {phase === 'idle' || phase === 'done'
          ? <button className="rbtn" onClick={cast}>Cast 🎣</button>
          : <button className={'rbtn' + (phase === 'bite' ? '' : ' ghost')} onClick={reel}>Reel! 🐟</button>}
      </div>
    </>
  );
}

// Circle PvP rank board — the scoreboard prop's popup. Wins-first (tiebreak
// win-rate then streak, matching listPvpRank's ordering); rank is JUST W/L, it
// mints no Gold/Diamonds/XP (see pvp-concept.md §4).
function PvpRankPanel({ circleId, selfId, circleMembers, onClose }) {
  const [rows, setRows] = useState(null); // null = loading
  useEffect(() => {
    let alive = true;
    if (!circleId) { setRows([]); return undefined; }
    listPvpRank(circleId).then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [circleId]);

  const nameOf = (id) => circleMembers?.find((m) => m.member_id === id)?.display_name || 'Farmer';
  // Members with no pvp_rank row yet (0-0) still deserve a spot on the board.
  const known = new Set((rows || []).map((r) => r.profile_id));
  const zeros = (circleMembers || []).filter((m) => !known.has(m.member_id))
    .map((m) => ({ profile_id: m.member_id, wins: 0, losses: 0, streak: 0 }));
  const board = [...(rows || []), ...zeros];

  return (
    <>
      <Head title="🏆 PvP Rank" sub="Every knockout in the arena — climb your circle's board" onClose={onClose} />
      {rows === null && <div className="empty-note">Loading the board…</div>}
      {rows !== null && !board.length && <div className="empty-note">Nobody's fought yet — be the first!</div>}
      {board.map((r, i) => {
        const total = r.wins + r.losses;
        const rate = total ? Math.round((r.wins / total) * 100) : 0;
        return (
          <div className={'row' + (r.profile_id === selfId ? ' selected' : '')} key={r.profile_id}>
            <div className="ico">{i === 0 && r.wins > 0 ? '👑' : i + 1}</div>
            <div className="grow">
              <div className="name">{nameOf(r.profile_id)}{r.profile_id === selfId ? ' (you)' : ''}</div>
              <div className="meta">{r.wins}W – {r.losses}L · {rate}% win rate{r.streak > 1 ? ` · 🔥 ${r.streak} streak` : ''}</div>
            </div>
          </div>
        );
      })}
      <div className="empty-note">Enter the PvP arena (east of the battleground) to duel — a knockout here is recorded, nothing else.</div>
    </>
  );
}

// Hotspot popups — Castle (home upgrade + skin), Dungeon, Fishing. Rendered by
// FarmRoom next to <Panels>. The MERCHANT shops (seed/general/blacksmith/animal/
// cosmetic) moved into the unified gallery Shop (Shop.jsx) — tapping a shop
// building now opens that Shop at the matching sub-tab, so this file only owns the
// non-shop landmarks.
import { useEffect, useRef, useState } from 'react';
import { MAT_ICON, FISH_SPECIES } from '../game/farm-mechanics.js';
import { listPvpRank } from '../game/pvp-rank.js';
import { sfx } from '../audio/sfx.js';

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
        {hotspot.kind === 'dock' && <FishingPanel mech={mech} mechGame={mechGame} onClose={onClose} />}
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

// Cast → bite → REEL-on-the-mark minigame. A marker sweeps a bar during the
// bite; tapping while it's inside the (rod-tier-sized) sweet zone lands a
// catch, and HOW centered the tap was feeds catchFish()'s quality roll — a
// dead-center tap has real odds at the rare species, a grazing hit mostly
// nets a Minnow. Rod tier widens the zone + gives a bit more time (a real,
// felt reason to upgrade — the old version rolled a fixed 1-fish/always-hit
// regardless of gear).
const ZONE_W = { 1: 34, 2: 44, 3: 56 };   // sweet-zone width, % of bar — kid-friendly, not a twitch check
const BITE_MS = { 1: 2400, 2: 2700, 3: 3000 }; // time to react before it gets away
const SWEEP_MS = 1000;                    // one-way sweep duration of the marker (slower = easier to time)

function FishingPanel({ mech, mechGame, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | casting | bite | miss | done
  const [pos, setPos] = useState(50);
  const [zone, setZone] = useState({ center: 50, width: 20 });
  const [caught, setCaught] = useState(null);
  const raf = useRef(null), tCast = useRef(null), tBite = useRef(null), tMsg = useRef(null);
  const rodTier = mech?.tools?.rod || 1;

  useEffect(() => () => {
    clearTimeout(tCast.current); clearTimeout(tBite.current); clearTimeout(tMsg.current);
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  const sweep = () => {
    const start = performance.now();
    const step = (now) => {
      const t = (now - start) % (SWEEP_MS * 2);
      const frac = t < SWEEP_MS ? t / SWEEP_MS : 2 - t / SWEEP_MS; // ping-pong 0..1..0
      setPos(frac * 100);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const miss = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    clearTimeout(tBite.current);
    sfx.play('error');
    setPhase('miss');
    tMsg.current = setTimeout(() => setPhase('idle'), 1000);
  };

  const cast = () => {
    setPhase('casting'); setCaught(null);
    tCast.current = setTimeout(() => {
      const width = ZONE_W[rodTier] || 20;
      const center = width / 2 + Math.random() * (100 - width);
      setZone({ center, width });
      setPhase('bite');
      sfx.play('tap');
      sweep();
      tBite.current = setTimeout(miss, BITE_MS[rodTier] || 1500);
    }, 900 + Math.random() * 1600);
  };

  const reel = () => {
    if (phase !== 'bite') { // cancel mid-cast
      clearTimeout(tCast.current); clearTimeout(tBite.current);
      if (raf.current) cancelAnimationFrame(raf.current);
      setPhase('idle'); return;
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    clearTimeout(tBite.current);
    const dist = Math.abs(pos - zone.center);
    if (dist > zone.width / 2) { miss(); return; }
    const quality = 1 - dist / (zone.width / 2);
    const species = mechGame.catchFish(quality);
    sfx.play(species.rarity === 'common' ? 'collect' : species.rarity === 'uncommon' ? 'harvest' : 'reward');
    setCaught(species); setPhase('done');
    tMsg.current = setTimeout(() => setPhase('idle'), 1200);
  };

  const fishBag = mech?.fishBag || {};
  const fishTotal = mech?.fish || 0;
  const fishValue = FISH_SPECIES_VALUE(fishBag);

  return (
    <>
      <Head title="🎣 Fishing dock" sub={`Rod Tier ${rodTier} · cast, wait for the bite, tap the zone!`} onClose={onClose} />
      <div className="row" style={{ justifyContent: 'center', minHeight: 90, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>
            {phase === 'bite' ? '❗🎣' : phase === 'miss' ? '💦' : phase === 'done' ? caught?.icon + '🎉' : phase === 'casting' ? '🌀' : '🎣'}
          </div>
          <div className="meta">
            {phase === 'idle' ? 'Ready to cast'
              : phase === 'casting' ? 'Waiting for a bite…'
              : phase === 'bite' ? 'Tap when the marker is in the zone!'
              : phase === 'miss' ? 'It got away…'
              : `Caught a ${caught?.name}!${caught?.rarity !== 'common' ? ' ✨' : ''}`}
          </div>
        </div>
      </div>
      {phase === 'bite' && (
        <div className="fish-bar">
          <div className="fish-zone" style={{ left: `${zone.center - zone.width / 2}%`, width: `${zone.width}%` }} />
          <div className="fish-marker" style={{ left: `${pos}%` }} />
        </div>
      )}
      <div className="row" style={{ borderStyle: 'dashed', justifyContent: 'center', gap: 10 }}>
        {phase === 'idle' || phase === 'done' || phase === 'miss'
          ? <button className="rbtn" disabled={phase === 'miss'} onClick={cast}>Cast 🎣</button>
          : <button className={'rbtn' + (phase === 'bite' ? '' : ' ghost')} onClick={reel}>{phase === 'bite' ? 'Reel! 🐟' : 'Cancel'}</button>}
      </div>
      {fishTotal > 0 && (
        <div className="row" style={{ marginTop: 4 }}>
          <div className="ico">🎒</div>
          <div className="grow">
            <div className="name">Your catch: {fishTotal} fish</div>
            <div className="meta">
              {FISH_SPECIES.filter((f) => fishBag[f.id] > 0).map((f) => `${f.icon}×${fishBag[f.id]}`).join(' ') || '—'}
              {' · worth 🌸'}{fishValue}
            </div>
          </div>
          <button className="rbtn" disabled={!fishValue} onClick={() => mechGame.sellFish()}>Sell all</button>
        </div>
      )}
    </>
  );
}
const FISH_SPECIES_VALUE = (bag) => FISH_SPECIES.reduce((a, f) => a + (bag[f.id] || 0) * f.sell, 0);

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

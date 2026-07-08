// Hotspot popups — Shops (what each sells), Castle, Dungeon, Fishing. Rendered by
// FarmRoom next to <Panels>. Kept SEPARATE from Panels.jsx so the parallel economy
// workspace (currency display) and this mechanics work don't collide.
//
// Currency: read defensively as `snap.bloom ?? snap.gold`. Functional buys that need
// currency route through the existing FarmLogic methods (game.buySeed). Currency-only
// wares are shown but marked // ECONOMY-SEAM until bloom is wired.
import { useEffect, useRef, useState } from 'react';
import { CROPS } from '../data/crops.js';
import { SPECIES } from '../data/livestock.js';
import { MAT_ICON } from '../game/farm-mechanics.js';
import { weaponOf, armorOf } from '@arganta/combat';
import { QtyDialog } from './QtyDialog.jsx';

// cost object → "🌸500 · 🪵20 · 🪨15 · 🟨5"
const costLine = (cost) => Object.entries(cost || {}).map(([k, v]) => `${MAT_ICON[k] || k}${v}`).join(' ');

const fmt = (n) => Number(n || 0).toLocaleString();
const cur = (snap) => (snap?.bloom ?? snap?.gold ?? 0);

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

export function HotspotPanels({ hotspot, snap, game, mech, mechGame, onClose, onEnterDungeon, castleSkin, onCastleSkin }) {
  if (!hotspot) return null;
  return (
    <div className="panel-scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        {hotspot.kind === 'shop' && <ShopPanel id={hotspot.id} snap={snap} game={game} mech={mech} mechGame={mechGame} onClose={onClose} />}
        {hotspot.kind === 'castle' && <CastlePanel snap={snap} mech={mech} mechGame={mechGame} onClose={onClose} castleSkin={castleSkin} onCastleSkin={onCastleSkin} />}
        {hotspot.kind === 'dungeon' && <DungeonPanel snap={snap} onClose={onClose} onEnter={onEnterDungeon} />}
        {hotspot.kind === 'dock' && <FishingPanel mechGame={mechGame} onClose={onClose} />}
      </div>
    </div>
  );
}

function ShopPanel({ id, snap, game, mech, mechGame, onClose }) {
  if (id === 'seed') return <SeedShop snap={snap} game={game} onClose={onClose} />;
  if (id === 'smith') return <Blacksmith snap={snap} mech={mech} mechGame={mechGame} onClose={onClose} />;
  if (id === 'general') return <DisplayShop title="🏪 Hazel — General Store" sub="Tools & supplies" onClose={onClose} rows={[
    ['🪣', 'Watering can', 'Bloom 40'], ['🎣', 'Fishing rod', 'Bloom 60'], ['📦', 'Storage chest', 'Bloom 80'],
  ]} />;
  if (id === 'animal') return <DisplayShop title="🐮 Willa — Animal Shop" sub="Livestock & feed" onClose={onClose} rows={
    Object.values(SPECIES).map((s) => [s.emoji, s.name, 'Bloom ' + (s.buy || 200)]).concat([['🌾', 'Feed ×10', 'Bloom 10']])
  } />;
  if (id === 'cosmetic') return <DisplayShop title="💎 Bank & Cosmetics" sub="Diamonds — cosmetics only" onClose={onClose} rows={[
    ['🎩', 'Farmer hat', '💎 5'], ['🌈', 'Rainbow trail', '💎 8'], ['🏦', 'Store items', 'free'],
  ]} />;
  return null;
}

function SeedShop({ snap, game, onClose }) {
  const op = cur(snap) === Infinity;
  const money = op ? Infinity : Number(cur(snap));
  const [buying, setBuying] = useState(null); // the crop whose qty dialog is open
  const maxQty = buying ? (op ? 999 : Math.max(0, Math.floor(money / buying.seedCost))) : 0;
  return (
    <>
      <Head title="🌱 Sprout — Seed Shop" sub={`You have ${op ? '∞' : fmt(money)} 🌸`} onClose={onClose} />
      {Object.values(CROPS).map((c) => {
        const canAfford = op || money >= c.seedCost;
        return (
          <div className="row" key={c.id}>
            <div className="ico">{c.emoji}</div>
            <div className="grow">
              <div className="name">{c.name} seed</div>
              <div className="meta">Owned {fmt(snap.seeds?.[c.id] || 0)} · sells for 🌸{c.sell}</div>
            </div>
            <button className="rbtn" disabled={!canAfford} onClick={() => setBuying(c)}>Buy 🌸{c.seedCost}</button>
          </div>
        );
      })}
      {buying && (
        <QtyDialog
          item={{ name: buying.name + ' seed', emoji: buying.emoji }}
          unitCost={buying.seedCost}
          maxQty={maxQty}
          onBuy={(n) => game.buySeed(buying.id, n)}
          onClose={() => setBuying(null)}
        />
      )}
    </>
  );
}

function Blacksmith({ snap, mech, mechGame, onClose }) {
  const tools = [['pickaxe', '⛏', 'Pickaxe', 'mine gold + gems at Tier 2'], ['axe', '🪓', 'Axe', 'chop hardwood at Tier 2'], ['rod', '🎣', 'Rod', 'better catches']];
  const gearRows = [
    ['weapon', '⚔', 'Weapon', weaponOf(snap?.weaponTier || 1), (t) => `+${weaponOf(t).atk} ATK`],
    ['armor', '🛡', 'Armor', armorOf(snap?.armorTier || 1), (t) => `+${armorOf(t).def} DEF · +${armorOf(t).hp} HP`],
  ];
  return (
    <>
      <Head title="⚒ Forge — Blacksmith" sub="Craft gear + upgrade tools with materials" onClose={onClose} />
      <MatBar snap={snap} mech={mech} />
      {gearRows.map(([slot, ico, label, cur, perkAt]) => {
        const tier = mechGame.gearTier(slot);
        const max = mechGame.gearMax(slot);
        const cost = mechGame.gearCost(slot);
        const afford = mechGame.gearAfford(slot);
        return (
          <div className="row" key={slot}>
            <div className="ico">{ico}</div>
            <div className="grow">
              <div className="name">{label} · {cur.name} (T{tier}){max ? ' ★max' : ''}</div>
              <div className="meta">{perkAt(tier)}{max ? '' : ` → T${tier + 1} · needs ${costLine(cost)}`}</div>
            </div>
            <button className="rbtn" disabled={max || !afford} onClick={() => mechGame.upgradeGear(slot)}>{max ? 'Max' : 'Craft'}</button>
          </div>
        );
      })}
      <div className="phead" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
        <div><p className="psub" style={{ margin: 0 }}>Tools (gathering)</p></div>
      </div>
      {tools.map(([key, ico, name, perk]) => {
        const tier = mech?.tools?.[key] || 1;
        const cost = mechGame.toolCost(key);
        const max = tier >= 3;
        const afford = (snap?.wood || 0) >= cost.wood && (snap?.stone || 0) >= cost.stone;
        return (
          <div className="row" key={key}>
            <div className="ico">{ico}</div>
            <div className="grow">
              <div className="name">{name} · Tier {tier}{max ? ' (max)' : ''}</div>
              <div className="meta">{perk}{max ? '' : ` · needs 🪵${cost.wood} 🪨${cost.stone}`}</div>
            </div>
            <button className="rbtn" disabled={max || !afford} onClick={() => mechGame.upgradeTool(key)}>{max ? 'Max' : 'Upgrade'}</button>
          </div>
        );
      })}
      <div className="phead" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
        <div><p className="psub" style={{ margin: 0 }}>Refine (turn raw mats into craft goods)</p></div>
      </div>
      <div className="row">
        <div className="ico">🧱</div>
        <div className="grow"><div className="name">Smelt Ingot</div><div className="meta">3🟨 → 1🧱 · feeds weapon/armor T3+ · have {fmt(mech?.ingot || 0)}🧱</div></div>
        <button className="rbtn" disabled={!mechGame.canSmelt()} onClick={() => mechGame.smelt()}>Smelt</button>
      </div>
      <div className="row">
        <div className="ico">🧪</div>
        <div className="grow"><div className="name">Cook Potion</div><div className="meta">2🐟 → 1🧪 · restores stamina · have {fmt(mech?.potion || 0)}🧪</div></div>
        <button className="rbtn" disabled={!mechGame.canCook()} onClick={() => mechGame.cook()}>Cook</button>
      </div>
      {(mech?.potion || 0) > 0 && (
        <div className="row" style={{ borderStyle: 'dashed' }}>
          <div className="ico">🧪</div>
          <div className="grow"><div className="name">Drink potion</div><div className="meta">+30 stamina now</div></div>
          <button className="rbtn ghost" onClick={() => mechGame.drinkPotion()}>Drink</button>
        </div>
      )}
    </>
  );
}

function DisplayShop({ title, sub, rows, onClose }) {
  return (
    <>
      <Head title={title} sub={sub} onClose={onClose} />
      {rows.map(([ico, name, price], i) => (
        <div className="row" key={i}>
          <div className="ico">{ico}</div>
          <div className="grow"><div className="name">{name}</div><div className="meta">{price}</div></div>
          <button className="rbtn ghost" disabled title="Enabled with the economy pass">Soon</button>
        </div>
      ))}
      <div className="empty-note">Buying here unlocks with the Bloom economy pass.</div>
    </>
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
          <div className="meta">{max ? 'The grandest home in the realm.' : `+storage, grander exterior · needs 🪵${cost.wood} 🪨${cost.stone}`}</div>
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

function DungeonPanel({ snap, onClose, onEnter }) {
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

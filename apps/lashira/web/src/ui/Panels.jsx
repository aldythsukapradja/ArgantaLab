// Slide-up panels: Shop (unified gallery), Bag (RPG grid), Home (hub with
// House/Animals/Kin sub-tabs), Quests. Data-driven from the catalogs.
import { useState } from 'react';
import { CROPS } from '../data/crops.js';
import { SPECIES, animalGoodReady, animalGoodFrac } from '../data/livestock.js';
import { KIN_TASKS } from '../data/kins.js';
import { QUEST_DEFS } from '../game/farm-logic.js';
import { MAT_ICON, FISH_SPECIES } from '../game/farm-mechanics.js';
import { Shop } from './Shop.jsx';
import { CharacterPage } from './CharacterPage.jsx';
import { CASTLE_SKINS, castleSkinLabel, castleSkinThumbUrl } from '../data/castle-skins.js';

// `mech` = the mechanics SNAPSHOT (material counts); `mechGame` = the store (actions).
// `selfId`/`circleMembers`/`homeCircleId`/`onTravel` feed the Home hub's Travel
// sub-tab (multi-farm: My Farm / Circle Farm / visit a circle-mate's farm).
// `onGearChanged` = live re-composite after an equip (Shop's Wear, Character Page's
// Equipment tab) — no page reload; `battleSkills` feeds the Character Page's Skills tab.
export function Panels({ panel, snap, game, mech, mechGame, shopTab, onClose, selfId, circleMembers, homeCircleId, onTravel, onGearChanged, battleSkills, heroTables, heroResources, heroHasWeapon, castleSkin, onCastleSkin }) {
  if (!panel) return null;
  return (
    <div className="panel-scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        {panel === 'shop' && <Shop snap={snap} game={game} mech={mech} mechGame={mechGame} initialTab={shopTab} onClose={onClose} onGearChanged={onGearChanged} />}
        {panel === 'house' && <Home snap={snap} game={game} mech={mech} onClose={onClose}
          selfId={selfId} circleMembers={circleMembers} homeCircleId={homeCircleId} onTravel={onTravel}
          castleSkin={castleSkin} onCastleSkin={onCastleSkin} />}
        {panel === 'inventory' && <Bag snap={snap} game={game} mech={mech} mechGame={mechGame} onClose={onClose} />}
        {panel === 'quests' && <Quests snap={snap} game={game} mechGame={mechGame} onClose={onClose} />}
        {panel === 'character' && <CharacterPage snap={snap} game={game} battleSkills={battleSkills} onClose={onClose} onGearChanged={onGearChanged}
          heroTables={heroTables} heroResources={heroResources} heroHasWeapon={heroHasWeapon} />}
      </div>
    </div>
  );
}

const fmt = (n) => Number(n || 0).toLocaleString();
const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);

function Head({ title, sub, onClose }) {
  return (
    <div className="phead">
      <div><h2>{title}</h2><p className="psub">{sub}</p></div>
      <button className="xbtn" onClick={onClose}>✕</button>
    </div>
  );
}

function Quests({ snap, game, mechGame, onClose }) {
  const q = snap.quests || {};
  const claim = (id) => {
    const mat = game.claimQuest?.(id);
    if (mat && mechGame?.grantMaterial) { mechGame.grantMaterial(mat.k, mat.n); mechGame._save?.(); mechGame.emit?.(); }
  };
  const streak = snap.streak || 0;
  return (
    <>
      <Head title="📜 Daily Quests" sub={`🔥 ${streak} day streak · resets each day`} onClose={onClose} />
      {QUEST_DEFS.map((d) => {
        const curN = Number(q[d.id] || 0);
        const done = curN >= d.goal;
        const claimed = !!q.claimed?.[d.id];
        return (
          <div className="row" key={d.id}>
            <div className="ico">{d.icon}</div>
            <div className="grow">
              <div className="name">{d.label}</div>
              <div className="meta">{Math.min(curN, d.goal)}/{d.goal} · 🌸{d.bloom}{d.mat ? ` +${d.mat.n} ${d.mat.k}` : ''}</div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(120,120,150,.25)', marginTop: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (curN / d.goal) * 100)}%`, background: claimed ? '#1f9d4d' : '#6a4df5' }} />
              </div>
            </div>
            <button className="rbtn" disabled={!done || claimed} onClick={() => claim(d.id)}>{claimed ? 'Claimed ✓' : done ? 'Claim' : '…'}</button>
          </div>
        );
      })}
      <div className="empty-note">Keep your streak alive — quests refresh every day.</div>
    </>
  );
}

// ─────────────────────────── RPG grid Bag ───────────────────────────
function produceInfo(id) {
  const crop = CROPS[id];
  if (crop) return { id, name: crop.name, icon: crop.emoji, sell: crop.sell };
  for (const sp of Object.values(SPECIES)) {
    if (sp.produce === id) return { id, name: sp.produceName, icon: sp.produceEmoji, sell: sp.sell };
  }
  return { id, name: id, icon: '📦', sell: 10 };
}
// 'fish' is intentionally excluded here — it gets its own per-species rows in
// bagGroups() (see FISH_SPECIES) instead of one flat aggregate row.
const MAT_NAME = { wood: 'Wood', stone: 'Stone', ore: 'Ore', gem: 'Gem', ingot: 'Ingot', token: 'Token', shard: 'Shard', hide: 'Hide', essence: 'Essence', potion: 'Potion' };
const MAT_DESC = { wood: 'Build & upgrade material', stone: 'Build & upgrade material', ore: 'Smelt into ingots at the Forge', gem: 'Rare crafting material', ingot: 'Feeds weapon/armor upgrades', token: 'Quest reward token', shard: 'Rare boss drop', hide: 'Beast drop', essence: 'Magical crafting essence', potion: 'Drink to restore stamina' };

const BAG_CATS = [
  { id: 'all', icon: '🎒', label: 'All' },
  { id: 'seeds', icon: '🌱', label: 'Seeds' },
  { id: 'produce', icon: '🧺', label: 'Produce' },
  { id: 'materials', icon: '⛏', label: 'Materials' },
  { id: 'gear', icon: '⚔', label: 'Gear' },
];

function bagGroups(snap, mech) {
  const seeds = Object.values(CROPS).map((c) => ({
    key: 'seed-' + c.id, type: 'seed', icon: c.emoji, name: c.name + ' seed',
    count: Number(snap.seeds?.[c.id] || 0), cropId: c.id,
    desc: `Plant to grow ${c.name} · harvest sells 🌸${c.sell}`,
  }));
  const produce = Object.entries(snap.produce || {}).filter(([, n]) => Number(n) > 0).map(([id, n]) => {
    const info = produceInfo(id);
    return { key: 'prod-' + id, type: 'produce', icon: info.icon, name: info.name, count: Number(n), sell: info.sell,
      desc: `Sells 🌸${info.sell} each · 🌸${fmt(info.sell * Number(n))} total` };
  });
  const matAmt = (k) => (k === 'wood' || k === 'stone') ? Number(snap[k] || 0) : Number(mech?.[k] || 0);
  const materials = Object.keys(MAT_NAME).map((k) => ({
    key: 'mat-' + k, type: 'material', icon: MAT_ICON[k], name: MAT_NAME[k], count: matAmt(k), desc: MAT_DESC[k],
  }));
  const fish = FISH_SPECIES.map((f) => ({
    key: 'fish-' + f.id, type: 'material', fishId: f.id, icon: f.icon, name: f.name, count: Number(mech?.fishBag?.[f.id] || 0),
    desc: `${cap(f.rarity)} catch · sells 🌸${f.sell} each · cooks into potions at the Forge`,
  }));
  materials.push(...fish);
  const gear = [
    { key: 'gear-weapon', type: 'gear', icon: '⚔', name: snap.weaponName || 'Weapon', tier: snap.weaponTier || 1, desc: `+${snap.atk || 0} ATK · upgrade at the ⚒ Forge` },
    { key: 'gear-armor', type: 'gear', icon: '🛡', name: snap.armorName || 'Armor', tier: snap.armorTier || 1, desc: `+${snap.def || 0} DEF · upgrade at the ⚒ Forge` },
    ...['pickaxe', 'axe', 'rod'].map((k) => ({ key: 'tool-' + k, type: 'gear', icon: { pickaxe: '⛏', axe: '🪓', rod: '🎣' }[k], name: cap(k), tier: mech?.tools?.[k] || 1, desc: `Tier ${mech?.tools?.[k] || 1} · upgrade at the ⚒ Forge` })),
  ];
  return { seeds, produce, materials, gear };
}

function Bag({ snap, game, mech, mechGame, onClose }) {
  const [catId, setCatId] = useState('all');
  const [selKey, setSelKey] = useState(null);
  const groups = bagGroups(snap, mech);

  // used stacks (for the capacity meter) = non-empty seed/produce/material stacks + gear.
  const used = groups.seeds.filter((i) => i.count > 0).length + groups.produce.length
    + groups.materials.filter((i) => i.count > 0).length + groups.gear.length;
  const total = mech?.house?.storage || 60;

  const view = catId === 'all'
    ? [...groups.seeds.filter((i) => i.count > 0), ...groups.produce, ...groups.materials.filter((i) => i.count > 0), ...groups.gear]
    : catId === 'seeds' ? groups.seeds
      : catId === 'produce' ? groups.produce
        : catId === 'materials' ? groups.materials.filter((i) => i.count > 0)
          : groups.gear;

  const sel = view.find((i) => i.key === selKey) || null;
  // pad the grid with faint empty slots for RPG feel (up to the next row).
  const cols = 5;
  const pad = Math.max(0, (Math.ceil(Math.max(view.length + 1, 10) / cols) * cols) - view.length);

  const detailAction = (it) => {
    if (!it) return null;
    if (it.type === 'seed') {
      const on = snap.selectedSeed === it.cropId;
      return <button className={'rbtn' + (on ? ' ghost' : '')} disabled={it.count <= 0} onClick={() => game.setSeed(it.cropId)}>{on ? 'Selected ✓' : 'Select'}</button>;
    }
    if (it.type === 'produce') return <button className="rbtn" onClick={() => game.sellAll()}>Sell all</button>;
    if (it.fishId) return <button className="rbtn" disabled={it.count <= 0} onClick={() => mechGame.sellFish()}>Sell all fish</button>;
    return null;
  };

  return (
    <>
      <Head title="🎒 Bag" sub={`🌸 ${snap.bloom === Infinity ? '∞' : fmt(snap.bloom)} · 💎 ${fmt(snap.diamonds)} · ${used}/${total} slots`} onClose={onClose} />
      <div className="ptabs">
        {BAG_CATS.map((c) => (
          <button key={c.id} className={'ptab' + (catId === c.id ? ' on' : '')} onClick={() => { setCatId(c.id); setSelKey(null); }}>
            <span>{c.icon}</span><small>{c.label}</small>
          </button>
        ))}
      </div>

      {!view.length ? (
        <div className="empty-note">Nothing in this pouch yet.</div>
      ) : (
        <div className="bag-grid">
          {view.map((it) => (
            <button key={it.key} className={'bagcell ' + it.type + (selKey === it.key ? ' sel' : '') + (it.count === 0 ? ' zero' : '')}
              title={it.name} onClick={() => setSelKey(it.key)}>
              <span className="bag-ic">{it.icon}</span>
              {it.type === 'gear' ? <b className="bag-tier">T{it.tier}</b> : (it.count > 1 && <b className="bag-n">×{fmt(it.count)}</b>)}
            </button>
          ))}
          {Array.from({ length: pad }).map((_, i) => <span key={'e' + i} className="bagcell empty" />)}
        </div>
      )}

      {sel && (
        <div className="bag-detail">
          <span className={'bag-detail-ic ' + sel.type}>{sel.icon}</span>
          <div className="grow">
            <div className="name">{sel.name}{sel.type === 'gear' ? ` · T${sel.tier}` : sel.count != null ? ` ×${fmt(sel.count)}` : ''}</div>
            <div className="meta">{sel.desc}</div>
          </div>
          {detailAction(sel)}
        </div>
      )}
    </>
  );
}

// ─────────────────────────── Home hub ───────────────────────────
const HOME_TABS = [
  { id: 'house', icon: '🏡', label: 'House' },
  { id: 'animals', icon: '🐄', label: 'Animals' },
  { id: 'kin', icon: '🍃', label: 'Kin' },
  { id: 'travel', icon: '🚪', label: 'Travel' },
];

function Home({ snap, game, mech, onClose, selfId, circleMembers, homeCircleId, onTravel, castleSkin, onCastleSkin }) {
  const [tab, setTab] = useState('house');
  return (
    <>
      <Head title="🏡 Home" sub={`${snap.name}'s homestead`} onClose={onClose} />
      <div className="ptabs">
        {HOME_TABS.map((t) => (
          <button key={t.id} className={'ptab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span><small>{t.label}</small>
          </button>
        ))}
      </div>
      {tab === 'house' && <HouseBody snap={snap} game={game} mech={mech} castleSkin={castleSkin} onCastleSkin={onCastleSkin} />}
      {tab === 'animals' && <BarnBody snap={snap} game={game} />}
      {tab === 'kin' && <KinBody snap={snap} game={game} />}
      {tab === 'travel' && <TravelBody snap={snap} game={game} selfId={selfId} circleMembers={circleMembers} homeCircleId={homeCircleId} onTravel={onTravel} onClose={onClose} />}
    </>
  );
}

const HOUSE_TIERS = ['Shack', 'Cottage', 'Farmhouse', 'Manor', 'Castle'];

function HouseBody({ snap, game, mech, castleSkin, onCastleSkin }) {
  const tier = mech?.house?.tier || 1;
  const tierName = HOUSE_TIERS[Math.min(tier - 1, 4)];
  return (
    <>
      <div className="row"><div className="ico">🏠</div><div className="grow">
        <div className="name">Stage: {tierName} <small style={{ opacity: 0.6, fontWeight: 400 }}>· tier {tier}/5</small></div>
        <div className="meta">Upgrade your home at the 🏰 Castle with 🪵🪨 materials</div>
      </div></div>
      <div className="row"><div className="ico">⭐</div><div className="grow">
        <div className="name">Level {snap.level}</div>
        <div className="meta">{snap.role === 'kid' ? 'Learn the 6 Worlds to gain XP and level up' : 'Play + battle to gain XP and level up — stronger skills'}</div>
      </div></div>
      <div className="row"><div className="ico">🌸</div><div className="grow">
        <div className="name">{snap.bloom === Infinity ? '∞' : fmt(snap.bloom)} Bloom</div>
        <div className="meta">The play currency · earn by selling produce + battling, spend on seeds{snap.guest ? ' (sign in to sync)' : ''}</div>
      </div></div>
      <div className="row"><div className="ico">💎</div><div className="grow">
        <div className="name">{fmt(snap.diamonds)} Diamonds</div>
        <div className="meta">Learning currency — for cosmetics only (a Diamond shop is coming)</div>
      </div></div>
      <div className="row" style={{ borderStyle: 'dashed' }}><div className="ico">🌙</div><div className="grow">
        <div className="name">End the day</div>
        <div className="meta">Crops grow, animals give produce, energy restores</div>
      </div><button className="rbtn" onClick={() => game.sleep()}>Sleep</button></div>
      {onCastleSkin && (
        <div className="home-skinpick">
          <div className="name" style={{ marginBottom: 6 }}>🎨 Cottage skin <small style={{ opacity: 0.6, fontWeight: 400 }}>· {castleSkinLabel(castleSkin)}</small></div>
          <div className="home-skingrid">
            {CASTLE_SKINS.map(([id, label]) => {
              const on = castleSkin === id;
              return (
                <button type="button" key={id} className={'home-skin' + (on ? ' on' : '')} onClick={() => onCastleSkin(id)} title={label}>
                  <img src={castleSkinThumbUrl(id)} alt={label} />
                  <small>{label}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function BarnBody({ snap, game }) {
  const now = Date.now();
  return (
    <>
      <div className="empty-note">Feed an animal → its good is ready a bit later (tap it on the farm too).</div>
      {snap.livestock.map((a) => {
        const sp = SPECIES[a.species];
        const hearts = '❤'.repeat(Math.max(1, Math.round((a.affection || 0) / 20)));
        const ready = animalGoodReady(a, now);
        const frac = animalGoodFrac(a, now);
        const status = ready ? `${sp.produceName} ready ${sp.produceEmoji}` : a.fedAt ? `${Math.round(frac * 100)}% → ${sp.produceEmoji}` : 'hungry';
        return (
          <div className="row" key={a.id}>
            <div className="ico">{sp.emoji}</div>
            <div className="grow">
              <div className="name">{a.name} <span className="meta">the {sp.name}</span></div>
              <div className="meta"><span className="hearts">{hearts}</span> · {status}</div>
            </div>
            {ready
              ? <button className="rbtn" onClick={() => game.collectAnimal(a.id)}>Collect {sp.produceEmoji}</button>
              : a.fedAt
                ? <button className="rbtn ghost" onClick={() => game.petAnimal(a.id)}>Pet ❤</button>
                : <button className="rbtn" onClick={() => game.feedAnimal(a.id)}>🌾 Feed</button>}
          </div>
        );
      })}
    </>
  );
}

function KinBody({ snap, game }) {
  const roster = snap.kinRoster || snap.kins || [];
  const maxKins = snap.maxKins || 6;
  const deployedCount = roster.filter((k) => k.deployed).length;
  return (
    <>
      <div className="empty-note">Deploy up to {maxKins} Kin onto your farm — deployed {deployedCount}/{maxKins}.</div>
      {roster.map((k) => (
        <div className={'row' + (k.deployed ? '' : ' kin-benched')} key={k.id}>
          <div className="ico" style={{ background: '#eef7e9', opacity: k.deployed ? 1 : 0.5 }}>🍃</div>
          <div className="grow">
            <div className="name">{k.name} <span className="meta">· {k.element}</span></div>
            <div className="meta"><span className="hearts">{'❤'.repeat(Math.max(1, Math.round(k.happiness / 20)))}</span> · best at {k.aptitude}</div>
            {k.deployed && (
              <div className="assign" style={{ marginTop: 6 }}>
                {KIN_TASKS.map((t) => (
                  <button key={String(t.id)} className={'aopt' + (k.task === t.id ? ' on' : '')} onClick={() => game.assignKin(k.id, t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={'rbtn' + (k.deployed ? '' : ' ghost')} disabled={!k.deployed && deployedCount >= maxKins}
            onClick={() => game.setKinDeployed(k.id, !k.deployed)}>
            {k.deployed ? 'Deployed ✓' : 'Deploy'}
          </button>
        </div>
      ))}
    </>
  );
}

// Multi-farm picker: My Farm (personal, always yours) · Circle Farm (shared,
// co-op, unchanged) · a tile per circle-mate to VISIT (read-only — only the
// owner can act on their own farm; see FarmLogic's VISITOR_LOCKED_ACTIONS).
// `onTravel(scope)` bubbles up to App.jsx, which swaps + remounts the room.
function TravelBody({ game, selfId, circleMembers, homeCircleId, onTravel, onClose }) {
  if (!onTravel) return <div className="empty-note">Travel isn't available here.</div>;
  const viewerRole = game?.viewerRole || 'owner';
  const herePersonal = viewerRole === 'owner' && !game?.circleId;
  const hereCircle = viewerRole === 'owner' && !!game?.circleId;
  const hereVisitId = viewerRole === 'visitor' ? game?.visitOwnerId : null;
  const others = (circleMembers || []).filter((m) => m.member_id !== selfId);

  const go = (scope) => { onTravel(scope); onClose(); };

  return (
    <>
      <div className="empty-note">Travel to your own farm, the shared circle farm, or visit a circle-mate's — visiting is look-only, only they can work their farm.</div>
      <div className="farmtile-grid">
        <button type="button" className={'farmtile mine' + (herePersonal ? ' here' : '')} onClick={() => go({ kind: 'personal' })}>
          <span className="ft-ic">🏡</span>
          <span className="ft-name">My Farm</span>
          {herePersonal ? <span className="ft-here">Here now</span> : <span className="ft-badge">Play</span>}
        </button>
        {homeCircleId && (
          <button type="button" className={'farmtile circle' + (hereCircle ? ' here' : '')} onClick={() => go({ kind: 'circle' })}>
            <span className="ft-ic">🌾</span>
            <span className="ft-name">Circle Farm</span>
            {hereCircle ? <span className="ft-here">Here now</span> : <span className="ft-badge">Play</span>}
          </button>
        )}
      </div>
      {others.length > 0 && (
        <>
          <div className="bag-title" style={{ marginTop: 14 }}>Visit a circle-mate</div>
          <div className="farmtile-grid">
            {others.map((m) => (
              <button type="button" key={m.member_id}
                className={'farmtile visit' + (hereVisitId === m.member_id ? ' here' : '')}
                onClick={() => go({ kind: 'visit', ownerId: m.member_id, ownerName: m.display_name })}>
                <span className="ft-ic">👁</span>
                <span className="ft-name">{m.display_name || 'Farmer'}</span>
                {hereVisitId === m.member_id ? <span className="ft-here">Here now</span> : <span className="ft-badge">Visit</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {!homeCircleId && !others.length && (
        <div className="empty-note" style={{ marginTop: 10 }}>Join a circle to visit a circle-mate's farm.</div>
      )}
    </>
  );
}

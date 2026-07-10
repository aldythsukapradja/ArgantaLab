// Unified gallery Shop — ONE shop with a sub-tab per merchant (Seeds · Animals ·
// Forge · General · Cosmetics · Sell). Body is a gallery: a big featured ware you
// swap ◀ ▶, with a thumbnail strip below. The featured card's action adapts
// (Buy / Craft / Upgrade / Sell). Merges the old quicknav Shop + the on-map
// merchant popups; tapping a shop building deep-links here via `initialTab`.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CROPS } from '../data/crops.js';
import { SPECIES } from '../data/livestock.js';
import { MAT_ICON } from '../game/farm-mechanics.js';
import { weaponOf, armorOf } from '@arganta/combat';
import { QtyDialog } from './QtyDialog.jsx';
import { loadShopCatalog, loadOwnedCosmetics, buyCosmeticItem, equipCosmeticItem, enhanceCosmeticItem, enhanceCost, ENHANCE_MAX } from '../net/cosmetics.js';
import { charParts, sheetUrl, loadImage } from '../engine/data.js';

const COSMETIC_ICON = { helmet: '⛑', coat: '🧥', sword: '⚔', shield: '🛡' };
const COSMETIC_CATS = ['helmet', 'coat', 'sword', 'shield'];
const COSMETIC_SUBTABS = [
  { id: 'helmet', icon: '⛑', label: 'Helmet' },
  { id: 'coat', icon: '🧥', label: 'Coat' },
  { id: 'sword', icon: '⚔', label: 'Weapon' },
  { id: 'shield', icon: '🛡', label: 'Shield' },
];

// Real per-part sprite thumbnail — every helmet/coat/sword/shield in the shop
// otherwise looks identical (one emoji per CATEGORY, 10 items indistinguishable).
// Same sheet/frame data LashiraBloom already renders the player's own hero from
// (engine/data.js — same extracted asset set HQ's Character Forge uses), just
// drawn small. Sized entirely by CSS (.gal-ic / .gal-thumb ancestor rules) so one
// component serves both the big feature slot and the small thumbnail strip.
function CosmeticThumb({ cat, part }) {
  const ref = useRef(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sheet = await loadImage(sheetUrl(cat, part));
        if (!live || !ref.current) return;
        const anim = part.animations?.NormalStandBySouth || part.animations?.WeaponStandBySouth
          || Object.values(part.animations || {}).find((a) => a?.length);
        const fi = anim?.[0]?.frame ?? 0;
        const fm = part.frames?.[fi] || part.frames?.find(Boolean);
        if (!fm) return;
        const ctx = ref.current.getContext('2d');
        const size = 96;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        const s = Math.min(2.5, Math.min(size / Math.max(1, fm.w), size / Math.max(1, fm.h)));
        ctx.drawImage(sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h,
          (size - fm.w * s) / 2, (size - fm.h * s) / 2, fm.w * s, fm.h * s);
      } catch { /* sheet missing — leave the canvas blank, no crash */ }
    })();
    return () => { live = false; };
  }, [cat, part?.id]);
  return <canvas ref={ref} width={96} height={96} className="cosmetic-thumb" />;
}

// +10% of the item's OWN base stat per enhance level (cumulative) — see
// migration_character_shop_enhance.sql. level=0 (unenhanced) = just the base stat.
const cosmeticStatLine = (it, level = 0) => {
  const mult = 1 + level * 0.1;
  return [
    it.atk ? `⚔+${Math.round(it.atk * mult)} ATK` : null,
    it.def ? `🛡+${Math.round(it.def * mult)} DEF` : null,
    it.hp ? `❤+${Math.round(it.hp * mult)} HP` : null,
  ].filter(Boolean).join(' · ');
};

const fmt = (n) => Number(n || 0).toLocaleString();
const cur = (snap) => (snap?.bloom ?? snap?.gold ?? 0);
const costLine = (cost) => Object.entries(cost || {}).map(([k, v]) => `${MAT_ICON[k] || k}${v}`).join(' ');

const TABS = [
  { id: 'seeds', icon: '🌱', label: 'Seeds' },
  { id: 'animals', icon: '🐮', label: 'Animals' },
  { id: 'forge', icon: '⚒', label: 'Forge' },
  { id: 'general', icon: '🏪', label: 'General' },
  { id: 'cosmetics', icon: '💎', label: 'Cosmetics' },
  { id: 'sell', icon: '🧺', label: 'Sell' },
];

export function Shop({ snap, game, mech, mechGame, initialTab = 'seeds', onClose }) {
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'seeds');
  const [idx, setIdx] = useState(0);
  const [buying, setBuying] = useState(null); // crop with an open qty dialog
  const [cosmeticCat, setCosmeticCat] = useState('helmet'); // Cosmetics sub-tab

  // 🛍️ Cosmetics — shared with HQ's Character Forge Shop (same catalog + ownership
  // tables, same Supabase project: migration_character_shop.sql). Loaded once per
  // Shop open (this panel mounts fresh each time). diamondOverride keeps the header
  // in sync right after a buy without needing to touch FarmLogic's own diamonds field.
  const [shopCatalog, setShopCatalog] = useState([]);
  const [ownedCosmetics, setOwnedCosmetics] = useState(new Set());
  const [cosmeticLevels, setCosmeticLevels] = useState({}); // item_key -> enhance level (0-5)
  const [cosmeticBusy, setCosmeticBusy] = useState(null);
  const [cosmeticMsg, setCosmeticMsg] = useState(null);
  const [diamondOverride, setDiamondOverride] = useState(null);
  const [partMeta, setPartMeta] = useState({}); // cat -> { byId: {id -> real part, for thumbnails} }
  useEffect(() => {
    let live = true;
    Promise.all([loadShopCatalog(), loadOwnedCosmetics()]).then(([cat, own]) => {
      if (!live) return;
      setShopCatalog(cat); setOwnedCosmetics(own.owned); setCosmeticLevels(own.levels);
    });
    Promise.all(COSMETIC_CATS.map((c) => charParts(c).then((parts) => [c, parts]).catch(() => [c, []])))
      .then((entries) => {
        if (!live) return;
        const out = {};
        for (const [c, parts] of entries) out[c] = { byId: Object.fromEntries((parts || []).map((p) => [p.id, p])) };
        setPartMeta(out);
      });
    return () => { live = false; };
  }, []);
  async function buyCosmetic(item) {
    if (ownedCosmetics.has(item.itemKey) || cosmeticBusy) return;
    setCosmeticBusy(item.itemKey); setCosmeticMsg(null);
    const r = await buyCosmeticItem(item.itemKey);
    setCosmeticMsg(r.message);
    if (r.ok) { setOwnedCosmetics((o) => new Set(o).add(item.itemKey)); if (r.balance != null) setDiamondOverride(r.balance); }
    setCosmeticBusy(null);
  }
  // Materials are spent CLIENT-side (same trust model as mine()/chop()/toolCost() —
  // wood/stone aren't a real synced column yet, see the migration header) only AFTER
  // the RPC confirms the level actually went up, so a failed enhance never costs you.
  async function enhanceItem(item, level) {
    if (cosmeticBusy) return;
    const cost = enhanceCost(level + 1);
    if ((snap.wood || 0) < cost.wood || (snap.stone || 0) < cost.stone || (snap.bloom || 0) < cost.bloom) {
      setCosmeticMsg(`Need 🪵${cost.wood} 🪨${cost.stone} 🌸${cost.bloom}`); return;
    }
    setCosmeticBusy(item.itemKey); setCosmeticMsg(null);
    const r = await enhanceCosmeticItem(item.itemKey);
    if (r.ok) {
      game.state.wood = Math.max(0, (game.state.wood || 0) - cost.wood);
      game.state.stone = Math.max(0, (game.state.stone || 0) - cost.stone);
      game.state.bloom = Math.max(0, (game.state.bloom || 0) - cost.bloom);
      game.save?.(); game.emit?.();
      setCosmeticLevels((lv) => ({ ...lv, [item.itemKey]: r.level }));
    }
    setCosmeticMsg(r.message);
    setCosmeticBusy(null);
  }
  async function wearCosmetic(item) {
    if (cosmeticBusy) return;
    setCosmeticBusy(item.itemKey); setCosmeticMsg(null);
    const r = await equipCosmeticItem(item.itemKey);
    if (r.ok) {
      setCosmeticMsg('Equipped! Reloading to show your new look…');
      setTimeout(() => window.location.reload(), 900);
    } else {
      setCosmeticMsg(r.message); setCosmeticBusy(null);
    }
  }

  const op = cur(snap) === Infinity;
  const money = op ? Infinity : Number(cur(snap));
  const diamonds = diamondOverride ?? snap.diamonds;

  // Build the ware list for the active tab. Each ware: { icon, title, sub, badge?,
  // action: { label, disabled, tone?, onClick } | null }.
  const wares = useMemo(() => buildWares(tab, {
    snap, game, mech, mechGame, op, money, setBuying,
    shopCatalog, ownedCosmetics, cosmeticLevels, cosmeticBusy, diamonds, buyCosmetic, wearCosmetic, enhanceItem, partMeta, cosmeticCat,
  }), [tab, snap, mech, op, money, shopCatalog, ownedCosmetics, cosmeticLevels, cosmeticBusy, diamonds, partMeta, cosmeticCat]); // eslint-disable-line react-hooks/exhaustive-deps

  const safeIdx = wares.length ? Math.min(idx, wares.length - 1) : 0;
  const feat = wares[safeIdx] || null;
  const go = (d) => { if (wares.length) setIdx((safeIdx + d + wares.length) % wares.length); };
  const pickTab = (id) => { setTab(id); setIdx(0); };
  const pickCosmeticCat = (id) => { setCosmeticCat(id); setIdx(0); };

  return (
    <>
      <div className="phead">
        <div><h2>🛒 Market Row</h2><p className="psub">You have 🌸 {op ? '∞' : fmt(money)} · 💎 {fmt(diamonds)}</p></div>
        <button className="xbtn" onClick={onClose}>✕</button>
      </div>

      <div className="ptabs">
        {TABS.map((t) => (
          <button key={t.id} className={'ptab' + (tab === t.id ? ' on' : '')} onClick={() => pickTab(t.id)}>
            <span>{t.icon}</span><small>{t.label}</small>
          </button>
        ))}
      </div>

      {tab === 'cosmetics' && (
        <div className="ptabs ptabs-sub">
          {COSMETIC_SUBTABS.map((t) => (
            <button key={t.id} className={'ptab sub' + (cosmeticCat === t.id ? ' on' : '')} onClick={() => pickCosmeticCat(t.id)}>
              <span>{t.icon}</span><small>{t.label}</small>
            </button>
          ))}
        </div>
      )}

      {cosmeticMsg && tab === 'cosmetics' && <div className="empty-note shop-msg">{cosmeticMsg}</div>}

      {!wares.length ? (
        <div className="empty-note">{tab === 'sell' ? 'Your bag has nothing to sell yet — harvest some crops.' : 'Nothing here yet.'}</div>
      ) : (
        <div className="gallery">
          <div className="gallery-stage">
            {wares.length > 1 && <button className="gal-arrow left" onClick={() => go(-1)} aria-label="previous">‹</button>}
            <div className={'gal-feature' + (feat.soon ? ' soon' : '')}>
              <div className="gal-ic">{feat.icon}</div>
              <div className="gal-title">{feat.title}{feat.badge ? <em className="gal-badge">{feat.badge}</em> : null}</div>
              <div className="gal-sub">{feat.sub}</div>
              {feat.action && (
                <button className={'rbtn gal-buy' + (feat.action.tone === 'ghost' ? ' ghost' : '')}
                  disabled={feat.action.disabled} onClick={feat.action.onClick}>
                  {feat.action.label}
                </button>
              )}
            </div>
            {wares.length > 1 && <button className="gal-arrow right" onClick={() => go(1)} aria-label="next">›</button>}
          </div>
          <div className="gal-thumbs">
            {wares.map((w, i) => (
              <button key={w.key || i} className={'gal-thumb' + (i === safeIdx ? ' on' : '')}
                title={w.title} onClick={() => setIdx(i)}>
                <span>{w.icon}</span>
                {w.count != null && <b>{w.count}</b>}
              </button>
            ))}
          </div>
        </div>
      )}

      {buying && (
        <QtyDialog
          item={{ name: buying.name + ' seed', emoji: buying.emoji }}
          unitCost={buying.seedCost}
          maxQty={op ? 999 : Math.max(0, Math.floor(money / buying.seedCost))}
          onBuy={(n) => game.buySeed(buying.id, n)}
          onClose={() => setBuying(null)}
        />
      )}
    </>
  );
}

function buildWares(tab, ctx) {
  const { snap, game, mech, mechGame, op, money, setBuying } = ctx;
  const { shopCatalog, ownedCosmetics, cosmeticLevels, cosmeticBusy, diamonds, buyCosmetic, wearCosmetic, partMeta, cosmeticCat } = ctx;

  if (tab === 'seeds') {
    return Object.values(CROPS).map((c) => {
      const owned = Number(snap.seeds?.[c.id] || 0);
      const afford = op || money >= c.seedCost;
      return {
        key: c.id, icon: c.emoji, count: owned || null,
        title: c.name + ' seed',
        sub: `Owned ${fmt(owned)} · harvest sells 🌸${c.sell}${c.ring ? ' · learning-gated' : ''}`,
        action: { label: `Buy 🌸${c.seedCost}`, disabled: !afford, onClick: () => setBuying(c) },
      };
    });
  }

  if (tab === 'animals') {
    const animals = Object.values(SPECIES).map((s) => ({
      key: 'a-' + s.id, icon: s.emoji, title: s.name,
      sub: `Gives ${s.produceEmoji} ${s.produceName} · sells 🌸${s.sell}`,
      soon: true, action: { label: `Buy 🌸${s.buy || 200}`, disabled: true, tone: 'ghost', onClick: () => {} },
    }));
    animals.push({ key: 'feed', icon: '🌾', title: 'Feed ×10', sub: 'Keep your animals happy', soon: true, action: { label: 'Buy 🌸10', disabled: true, tone: 'ghost', onClick: () => {} } });
    return animals;
  }

  if (tab === 'forge') return forgeWares(ctx);

  if (tab === 'general') {
    return [
      ['🪣', 'Watering can', 'Speeds crop growth', 'Bloom 40'],
      ['🎣', 'Fishing rod', 'Catch fish at the dock', 'Bloom 60'],
      ['📦', 'Storage chest', 'Expand your bag', 'Bloom 80'],
    ].map(([icon, title, sub, price], i) => ({ key: 'g' + i, icon, title, sub, soon: true, action: { label: price, disabled: true, tone: 'ghost', onClick: () => {} } }));
  }

  if (tab === 'cosmetics') {
    // Shared with HQ's Character Forge Shop — same catalog + ownership, same
    // Supabase project. Buy spends diamonds; Wear equips it onto YOUR character
    // (patches one composer-spec slot, reloads to show it — see net/cosmetics.js).
    // Sub-tabbed by category (Helmet/Coat/Weapon/Shield) so 40 items don't blur
    // into one indistinguishable swipe.
    const gear = shopCatalog.filter((it) => it.cat === cosmeticCat).map((it) => {
      const owned = ownedCosmetics.has(it.itemKey);
      const afford = diamonds >= it.price;
      const busy = cosmeticBusy === it.itemKey;
      const action = owned
        ? { label: busy ? 'Wearing…' : 'Wear', disabled: busy, onClick: () => wearCosmetic(it) }
        : { label: busy ? 'Buying…' : `Buy 💎${fmt(it.price)}`, disabled: busy || !afford, tone: afford ? undefined : 'ghost', onClick: () => buyCosmetic(it) };
      const realPart = partMeta[it.cat]?.byId?.[it.partId];
      const level = cosmeticLevels[it.itemKey] || 0;
      return {
        key: it.itemKey,
        icon: realPart ? <CosmeticThumb cat={it.cat} part={realPart} /> : (COSMETIC_ICON[it.cat] || '✨'),
        title: `${it.setLabel || it.cat} #${it.partId}`, badge: owned ? (level > 0 ? `+${level}` : 'Owned') : undefined,
        sub: cosmeticStatLine(it, level) || 'Cosmetic', action,
      };
    });
    if (cosmeticCat === 'coat') gear.push({ key: 'castle', icon: '🏰', title: 'Castle skins', sub: 'Restyle your home (in Home)', soon: true, action: { label: 'free', disabled: true, tone: 'ghost', onClick: () => {} } });
    return gear;
  }

  if (tab === 'sell') {
    const rows = Object.entries(snap.produce || {}).filter(([, n]) => Number(n) > 0).map(([id, n]) => {
      const info = produceInfo(id);
      return { key: 's-' + id, icon: info.icon, count: Number(n), title: info.name,
        sub: `${fmt(n)} × 🌸${info.sell} = 🌸${fmt(Number(n) * info.sell)}` };
    });
    if (rows.length) {
      const total = rows.reduce((a, r) => { const info = produceInfo(r.key.slice(2)); return a + info.sell * r.count; }, 0);
      rows[0] = { ...rows[0], action: { label: `Sell all · 🌸${fmt(total)}`, disabled: false, onClick: () => game.sellAll() } };
      // give every card the sell-all action so it's reachable from any feature.
      for (let i = 1; i < rows.length; i++) rows[i].action = { label: `Sell all · 🌸${fmt(total)}`, disabled: false, onClick: () => game.sellAll() };
    }
    return rows;
  }

  return [];
}

function forgeWares(ctx) {
  const { snap, mech, mechGame } = ctx;
  const { shopCatalog, ownedCosmetics, cosmeticLevels, cosmeticBusy, partMeta, enhanceItem } = ctx;
  const list = [];
  // Gear: weapon + armor (Craft/Upgrade tiers).
  for (const [slot, icon] of [['weapon', '⚔'], ['armor', '🛡']]) {
    const tier = mechGame.gearTier(slot);
    const max = mechGame.gearMax(slot);
    const cost = mechGame.gearCost(slot);
    const afford = mechGame.gearAfford(slot);
    const def = slot === 'weapon' ? weaponOf(tier) : armorOf(tier);
    const perk = slot === 'weapon' ? `+${weaponOf(tier).atk} ATK` : `+${armorOf(tier).def} DEF · +${armorOf(tier).hp} HP`;
    list.push({
      key: slot, icon, title: `${def.name}`, badge: `T${tier}${max ? ' ★' : ''}`,
      sub: max ? `${perk} · maxed` : `${perk} · → T${tier + 1} needs ${costLine(cost)}`,
      action: { label: max ? 'Max' : 'Craft', disabled: max || !afford, onClick: () => mechGame.upgradeGear(slot) },
    });
  }
  // Tools: pickaxe / axe / rod.
  for (const [key, icon, name, perk] of [['pickaxe', '⛏', 'Pickaxe', 'mine gold + gems'], ['axe', '🪓', 'Axe', 'chop hardwood'], ['rod', '🎣', 'Rod', 'better catches']]) {
    const tier = mech?.tools?.[key] || 1;
    const cost = mechGame.toolCost(key);
    const max = tier >= 3;
    const afford = (snap?.wood || 0) >= cost.wood && (snap?.stone || 0) >= cost.stone;
    list.push({
      key, icon, title: name, badge: `T${tier}${max ? ' ★' : ''}`,
      sub: max ? `${perk} · maxed` : `${perk} · → T${tier + 1} needs 🪵${cost.wood} 🪨${cost.stone}`,
      action: { label: max ? 'Max' : 'Upgrade', disabled: max || !afford, onClick: () => mechGame.upgradeTool(key) },
    });
  }
  // Refine.
  list.push({ key: 'smelt', icon: '🧱', title: 'Smelt Ingot', sub: `3🟨 → 1🧱 · have ${fmt(mech?.ingot || 0)}🧱`, action: { label: 'Smelt', disabled: !mechGame.canSmelt(), onClick: () => mechGame.smelt() } });
  list.push({ key: 'cook', icon: '🧪', title: 'Cook Potion', sub: `2🐟 → 1🧪 · have ${fmt(mech?.potion || 0)}🧪`, action: { label: 'Cook', disabled: !mechGame.canCook(), onClick: () => mechGame.cook() } });
  if ((mech?.potion || 0) > 0) list.push({ key: 'drink', icon: '🧪', title: 'Drink potion', sub: '+30 stamina now', action: { label: 'Drink', tone: 'ghost', disabled: false, onClick: () => mechGame.drinkPotion() } });

  // ✨ Enhance your gear — per-OWNED-cosmetic leveling, separate from the account-
  // level weapon/armor tiers above. Diamonds bought the piece; wood/stone/bloom
  // level it up (see net/cosmetics.js — no diamonds spent here, ever).
  const ownedItems = shopCatalog.filter((it) => ownedCosmetics.has(it.itemKey));
  if (!ownedItems.length) {
    list.push({ key: 'enh-empty', icon: '✨', title: 'Enhance your gear', sub: 'Buy a helmet, coat, weapon, or shield in Cosmetics first', soon: true, action: { label: 'Visit Cosmetics', disabled: true, tone: 'ghost', onClick: () => {} } });
  } else {
    for (const it of ownedItems) {
      const level = cosmeticLevels[it.itemKey] || 0;
      const maxed = level >= ENHANCE_MAX;
      const cost = enhanceCost(level + 1);
      const afford = (snap?.wood || 0) >= cost.wood && (snap?.stone || 0) >= cost.stone && (snap?.bloom || 0) >= cost.bloom;
      const realPart = partMeta[it.cat]?.byId?.[it.partId];
      const busy = cosmeticBusy === it.itemKey;
      list.push({
        key: 'enh-' + it.itemKey,
        icon: realPart ? <CosmeticThumb cat={it.cat} part={realPart} /> : (COSMETIC_ICON[it.cat] || '✨'),
        title: `${it.setLabel || it.cat} #${it.partId}`, badge: level > 0 ? `+${level}` : undefined,
        sub: maxed ? `${cosmeticStatLine(it, level)} · MAX level` : `${cosmeticStatLine(it, level)} · → Lv${level + 1} needs 🪵${cost.wood} 🪨${cost.stone} 🌸${cost.bloom}`,
        action: { label: maxed ? 'Max' : (busy ? 'Enhancing…' : 'Enhance'), disabled: maxed || busy || !afford, tone: maxed ? 'ghost' : undefined, onClick: () => enhanceItem(it, level) },
      });
    }
  }
  return list;
}

function produceInfo(id) {
  const crop = CROPS[id];
  if (crop) return { id, name: crop.name, icon: crop.emoji, sell: crop.sell };
  for (const sp of Object.values(SPECIES)) {
    if (sp.produce === id) return { id, name: sp.produceName, icon: sp.produceEmoji, sell: sp.sell };
  }
  return { id, name: id, icon: '📦', sell: 10 };
}

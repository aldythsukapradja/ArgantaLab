// Character Page — "Me": the character sheet + live paper-doll + skills. Locked
// concept: docs/LASHIRABLOOM-PROGRESSION-DESIGN.md §7. Every number here is REAL
// (read from FarmLogic's snapshot / the shared combat package) — nothing is a
// placeholder. Two things are deliberately marked "coming soon" rather than faked:
//  - Face/Hair slots (the shop + equip_cosmetic_item RPC only cover Helmet/Coat/
//    Weapon/Shield — those two composer slots have no player-facing buy/equip path
//    yet, only HQ's operator tool can set them).
//  - Mount (the diamond mount-shop writes profiles.equipped_mount, but the game's
//    renderer only reads the composer spec's OWN mount field — the two systems
//    aren't bridged yet; wiring that is a separate follow-up, not this pass).
import { useEffect, useRef, useState } from 'react';
import { pathSkillPower } from '@arganta/combat';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { loadShopCatalog, loadOwnedCosmetics, buyCosmeticItem, equipCosmeticItem } from '../net/cosmetics.js';
import { charParts } from '../engine/data.js';
import { CosmeticThumb, COSMETIC_ICON, cosmeticStatLine } from './Shop.jsx';

const TABS = [
  { id: 'character', icon: '👤', label: 'Character' },
  { id: 'equipment', icon: '🛡', label: 'Equipment' },
  { id: 'skills', icon: '✨', label: 'Skills' },
];
const SLOTS = [
  { id: 'helmet', icon: '⛑', label: 'Helmet' },
  { id: 'coat', icon: '🧥', label: 'Coat' },
  { id: 'sword', icon: '⚔', label: 'Weapon' },
  { id: 'shield', icon: '🛡', label: 'Shield' },
  { id: 'face', icon: '😊', label: 'Face', soon: true },
  { id: 'hair', icon: '✂️', label: 'Hair', soon: true },
];
const fmt = (n) => Number(n || 0).toLocaleString();

// The real composited hero, drawn idle-standing — same compositor FarmRoom uses,
// just a static portrait instead of the walking loop. Re-draws whenever `resources`
// changes identity, which is exactly what a live equip produces.
//
// Fit BOTH axes inside the box (classic "contain" fit), not just width — a held
// effect (a torch flame, a weapon glow) can widen the bbox a lot without adding
// much height, or a tall pose can do the opposite; scaling off one axis alone let
// the other axis overflow and get clipped by the canvas edge. Centering on the
// bbox's own centroid (not foot-anchoring) means whatever the pose/effect shape
// is, it always lands fully inside the frame with even padding.
function HeroAvatar({ tables, resources, hasWeapon, size = 176 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    // Soft stage: a faint radial vignette + a contact-shadow ellipse near the
    // bottom, so the portrait reads as a "stage" instead of a flat blank tile.
    const vignette = ctx.createRadialGradient(size / 2, size * 0.42, size * 0.15, size / 2, size * 0.5, size * 0.62);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.ellipse(size / 2, size * 0.93, size * 0.22, size * 0.045, 0, 0, Math.PI * 2); ctx.fill();
    if (!tables || !resources || !Object.keys(resources).length) return;
    const motion = (hasWeapon ? 'WeaponStandBy' : 'NormalStandBy') + 'South';
    if (!stepCount(tables, motion)) return;
    const list = resolveStep(tables, resources, motion, 0);
    const bb = drawListBBox([list]);
    if (!bb) return;
    const pad = size * 0.1;
    const bw = Math.max(1, bb.x1 - bb.x0), bh = Math.max(1, bb.y1 - bb.y0);
    const scale = Math.max(0.5, Math.min(4, Math.min((size - pad * 2) / bw, (size - pad * 2) / bh)));
    paintStep(ctx, list, { x: size / 2 - bb.cx * scale, y: size * 0.5 - bb.cy * scale }, scale);
  }, [tables, resources, hasWeapon, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />;
}

function Head({ title, sub, onClose }) {
  return (
    <div className="phead">
      <div><h2>{title}</h2><p className="psub">{sub}</p></div>
      <button className="xbtn" onClick={onClose}>✕</button>
    </div>
  );
}

export function CharacterPage({ snap, game, battleSkills, heroTables, heroResources, heroHasWeapon, onClose, onGearChanged }) {
  const [tab, setTab] = useState('character');
  const [slotId, setSlotId] = useState('helmet');

  const [shopCatalog, setShopCatalog] = useState([]);
  const [ownedCosmetics, setOwnedCosmetics] = useState(new Set());
  const [cosmeticLevels, setCosmeticLevels] = useState({});
  const [partMeta, setPartMeta] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [diamondOverride, setDiamondOverride] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadShopCatalog(), loadOwnedCosmetics()]).then(([cat, own]) => {
      if (!live) return;
      setShopCatalog(cat); setOwnedCosmetics(own.owned); setCosmeticLevels(own.levels);
    });
    Promise.all(['helmet', 'coat', 'sword', 'shield'].map((c) => charParts(c).then((p) => [c, p]).catch(() => [c, []])))
      .then((entries) => {
        if (!live) return;
        const out = {};
        for (const [c, parts] of entries) out[c] = { byId: Object.fromEntries((parts || []).map((p) => [p.id, p])) };
        setPartMeta(out);
      });
    return () => { live = false; };
  }, []);

  async function buy(item) {
    if (busy) return;
    setBusy(item.itemKey); setMsg(null);
    const r = await buyCosmeticItem(item.itemKey);
    setMsg(r.message);
    if (r.ok) { setOwnedCosmetics((o) => new Set(o).add(item.itemKey)); if (r.balance != null) setDiamondOverride(r.balance); }
    setBusy(null);
  }
  async function wear(item) {
    if (busy) return;
    setBusy(item.itemKey); setMsg(null);
    const r = await equipCosmeticItem(item.itemKey);
    if (r.ok) { setMsg('Equipped!'); await onGearChanged?.(); } else setMsg(r.message);
    setBusy(null);
  }
  // Enhancement itself lives in Shop's Forge tab (one place, not duplicated here) —
  // this page just shows the resulting +N badge, read from the same cosmeticLevels.

  const diamonds = diamondOverride ?? snap.diamonds;
  const kid = game?.isKid?.() ?? snap.role === 'kid';
  const slot = SLOTS.find((s) => s.id === slotId);
  const slotItems = shopCatalog.filter((it) => it.cat === slotId);

  return (
    <>
      <Head title={`👤 ${snap.name}`} sub={`${snap.pathIcon} ${snap.pathName} · ${snap.title} · level ${snap.level}`} onClose={onClose} />

      <div className="ptabs">
        {TABS.map((t) => (
          <button key={t.id} className={'ptab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span><small>{t.label}</small>
          </button>
        ))}
      </div>

      {msg && (tab === 'equipment') && <div className="empty-note shop-msg">{msg}</div>}

      {tab === 'character' && (
        <>
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="cpage-av" style={{ flex: '0 0 118px' }}>
              <HeroAvatar tables={heroTables} resources={heroResources} hasWeapon={heroHasWeapon} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {kid ? (
                <div className="empty-note" style={{ padding: '4px 0 10px' }}>Levels up by learning — finish lessons to earn XP.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 3 }}>Experience to level {Math.min(99, snap.level + 1)}</div>
                  <div style={{ height: 7, borderRadius: 999, background: 'rgba(120,120,150,.18)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${snap.xpPct}%`, background: 'var(--purple)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 11px' }}>{fmt(snap.xpCur)} / {fmt(snap.xpReq)}</div>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '7px 8px', alignItems: 'center', fontSize: 12 }}>
                <span>❤️</span><span style={{ color: 'var(--muted)' }}>HP</span><b style={{ textAlign: 'right' }}>{fmt(snap.maxHp)}</b>
                <span>💧</span><span style={{ color: 'var(--muted)' }}>MP</span><b style={{ textAlign: 'right' }}>{fmt(snap.maxStamina)}</b>
                <span>⚔</span><span style={{ color: 'var(--muted)' }}>Weapon</span><b style={{ textAlign: 'right' }}>{snap.weaponName} <small style={{ color: 'var(--muted)' }}>+{snap.atk} ATK</small></b>
                <span>🛡</span><span style={{ color: 'var(--muted)' }}>Armor</span><b style={{ textAlign: 'right' }}>{snap.armorName} <small style={{ color: 'var(--muted)' }}>+{snap.def} DEF</small></b>
              </div>
            </div>
          </div>
          <div className="empty-note" style={{ marginTop: 14 }}>Cosmetic gear's own ATK/DEF/HP (Equipment tab) is a look + a future power layer — it doesn't add to the numbers above yet.</div>
        </>
      )}

      {tab === 'equipment' && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', height: 300 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="cpage-slotgrid">
                {SLOTS.map((s) => (
                  <button key={s.id} className={'cpage-slot' + (slotId === s.id ? ' on' : '') + (s.soon ? ' soon' : '')}
                    disabled={s.soon} title={s.soon ? `${s.label} — coming soon` : s.label}
                    onClick={() => setSlotId(s.id)}>
                    {!s.soon && (cosmeticLevels[shopCatalog.find((it) => it.cat === s.id && ownedCosmetics.has(it.itemKey))?.itemKey] > 0) && (
                      <span className="cpage-enh">+{cosmeticLevels[shopCatalog.find((it) => it.cat === s.id && ownedCosmetics.has(it.itemKey))?.itemKey]}</span>
                    )}
                    <span>{s.icon}</span><small>{s.label}</small>
                  </button>
                ))}
              </div>
              <div className="cpage-picker">
                <div className="cpage-pickhead">
                  {slot.soon ? `${slot.label} — coming soon` : `${slot.label} · you own ${slotItems.filter((it) => ownedCosmetics.has(it.itemKey)).length}`}
                </div>
                <div className="cpage-pickgrid">
                  {slot.soon ? (
                    <div className="empty-note" style={{ gridColumn: '1 / -1' }}>Not player-equippable yet — coming in a future update.</div>
                  ) : !slotItems.length ? (
                    <div className="empty-note" style={{ gridColumn: '1 / -1' }}>Nothing in the shop for this slot yet.</div>
                  ) : slotItems.map((it) => {
                    const owned = ownedCosmetics.has(it.itemKey);
                    const afford = diamonds >= it.price;
                    const isBusy = busy === it.itemKey;
                    const realPart = partMeta[it.cat]?.byId?.[it.partId];
                    return (
                      <button key={it.itemKey} className="cpage-item" disabled={isBusy}
                        onClick={() => (owned ? wear(it) : buy(it))}>
                        {realPart ? <CosmeticThumb cat={it.cat} part={realPart} /> : <span style={{ fontSize: 20 }}>{COSMETIC_ICON[it.cat]}</span>}
                        <small>{isBusy ? '…' : owned ? 'Equip' : afford ? `💎${fmt(it.price)}` : 'Need 💎'}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="cpage-av" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <HeroAvatar tables={heroTables} resources={heroResources} hasWeapon={heroHasWeapon} size={260} />
              <span className="cpage-live">live preview</span>
            </div>
          </div>
          <div className="empty-note" style={{ marginTop: 9, textAlign: 'center' }}>Tap Equip and the hero repaints instantly — no reload.</div>
        </>
      )}

      {tab === 'skills' && (
        <>
          <div className="empty-note" style={{ marginBottom: 10 }}>Your 3 skills, scaled by level and {snap.pathName}'s magic power. Power grows automatically as you level — no separate skill points yet.</div>
          {(battleSkills || []).map((sk) => {
            const power = pathSkillPower(sk, snap.path, snap.level);
            const isHeal = sk.type === 'heal';
            return (
              <div className="row" key={sk.id}>
                <div className="ico">{sk.icon}</div>
                <div className="grow">
                  <div className="name">{sk.name}</div>
                  <div className="meta">{isHeal ? `+${power} HP heal` : sk.target === 'all' ? `${power} dmg × each monster` : `${power} dmg`} · {sk.manaCost} MP · {Math.round(sk.cdMs / 100) / 10}s cooldown</div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

// HUD — the unit-frame (HP/MP card), settings popup, and action cluster are
// copied AS IS from Kingdom Heroes (apps/kingdom/web/src/room/TestRoom.jsx):
// same TierIcon crest, same IconHeart/IconMana bars, same glass settings popup,
// same skill-circle/attack-circle cluster + slot badges. Polished to be CLEAN:
// only the card (crest/name/HP/MP) shows persistently — no resource chips.
// MP bar IS the farm's real energy/stamina meter (one number, not two).
// Diamonds (the only currency) and the guardian companion live in Settings.
import { useEffect, useState } from 'react';
import { computeRank } from '../net/hero.js';
import { IconMount } from '../components/HudIcons.jsx';
import { UnitCard, cardFromSnap, cardFromPeer } from './UnitCard.jsx';
import { CROPS } from '../data/crops.js';
import { supabase, hasSupabase } from '../net/supabase.js';
import { ActionCluster } from '@arganta/combat/cluster';
import { RewardToasts } from '@arganta/combat/reward';
import { SKIN_LIST, DEFAULT_SKIN, skinOf, GameIcon } from '@arganta/combat';

// chosen action-cluster skin, remembered per device.
const SKIN_KEY = 'lashira_cluster_skin';
const loadSkin = () => { try { return localStorage.getItem(SKIN_KEY) || DEFAULT_SKIN; } catch { return DEFAULT_SKIN; } };

const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
const fmt = (n) => Number(n || 0).toLocaleString();

// Wallet pills: operator = ∞. Otherwise show the FULL comma value until it gets
// too wide to keep the tray edge-aligned, then abbreviate (1,204,880 → 1.2M).
// The full value always stays available via the pill's title (see walletTitle).
const fmtWallet = (n) => {
  if (n === Infinity) return '∞';
  const v = Number(n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  return v.toLocaleString();
};
const walletTitle = (n) => (n === Infinity ? '' : ` · ${fmt(n)}`);
const xpProgress = (xp) => Math.round(((Math.max(0, Number(xp || 0)) % 500) / 500) * 100);

// circle id → human name (the QC pill should read "Keluarga Cerah Ceria", not a
// uuid). Cached per session so re-opening Settings never refetches.
const circleNameCache = new Map();
function useCircleName(circleId) {
  const [name, setName] = useState(() => circleNameCache.get(circleId) || null);
  useEffect(() => {
    if (!circleId || !hasSupabase || circleNameCache.has(circleId)) return undefined;
    let live = true;
    supabase.from('circles').select('name').eq('id', circleId).maybeSingle()
      .then(({ data }) => {
        if (data?.name) circleNameCache.set(circleId, data.name);
        if (live && data?.name) setName(data.name);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [circleId]);
  return name;
}

export function Hud({ snap, game, onUse, onSleep, onToggleMount, onOpen, zoom, setZoom, speed, setSpeed, usingHero, hero, presence, circleId, getSyncDebug, battle, battleSkills = [], onStrike, onSkill, onHarvestAll, onPlantAll, devMode = false, onToggleDev }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showSeeds, setShowSeeds] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [skinId, setSkinId] = useState(loadSkin);
  const pickSkin = (id) => { setSkinId(id); try { localStorage.setItem(SKIN_KEY, id); } catch { /* ignore */ } };
  // Live channel diagnostics, refreshed while Settings is open — a field
  // screenshot of this line pinpoints WHERE sync dies (never joined / died
  // later / joined but hearing nothing).
  const [syncDebug, setSyncDebug] = useState(null);
  useEffect(() => {
    if (!showSettings || !getSyncDebug) return undefined;
    const tick = () => setSyncDebug(getSyncDebug());
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [showSettings, getSyncDebug]);
  const rank = computeRank(snap.xp);
  // The player's own profile card (battle-aware HP). Same shape the live popup
  // feeds peer cards — one component, one design.
  const selfCard = cardFromSnap(snap, battle);
  const circleName = useCircleName(circleId);
  const activeKins = (snap.kins || []).slice(0, 6);
  const selectedCrop = CROPS[snap.selectedSeed] || CROPS.turnip;
  const selectedSeedCount = Number(snap.seeds?.[selectedCrop.id] || 0);
  const seedRows = Object.values(CROPS);
  const pickSeed = (id) => {
    game.setSeed(id);
    setShowSeeds(false);
  };

  return (
    <>
      {snap.toast && <div className="toasts"><div className="toast">{snap.toast}</div></div>}
      <RewardToasts rewards={snap.rewards} />

      {/* top bar — gear only. The wallet strip moved into the left stack, below
          the live row (a single place owns the top-left column). */}
      <div className="hud-top">
        <div className="topbar-right">
          <button type="button" className="hud-gear" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </div>

      {/* Top-left column — single owner of the whole stack, all blocks stretch to
          ONE width so every left/right edge lines up:
            profile card → wallet tray (💎 pinned right) → toolbar → live row.
          The UnitCard here and each card in the live popup are the SAME
          component, so a design change updates every card at once. */}
      <div className="left-stack">
        <UnitCard card={selfCard} />

        {/* wallet tray, fused under the card: 🪵🪨🌸 grouped left, divider,
            💎 pinned to the right edge (learning currency, set apart). */}
        <div className="res-strip">
          <button className="res res-wood" onClick={() => onOpen('shop')} title={`Wood — chop the forest (coming soon)${walletTitle(snap.wood)}`}>🪵 {fmtWallet(snap.wood)}</button>
          <button className="res res-stone" onClick={() => onOpen('shop')} title={`Stone — mine the quarry (coming soon)${walletTitle(snap.stone)}`}>🪨 {fmtWallet(snap.stone)}</button>
          <button className="res res-bloom" onClick={() => onOpen('shop')} title={`Bloom — the play currency, earned from every action${walletTitle(snap.bloom)}`}>🌸 {fmtWallet(snap.bloom)}</button>
          <span className="res-div" aria-hidden="true" />
          <button className="res res-diamond" onClick={() => onOpen('shop')} title={`Diamonds — learning currency, for cosmetics (Diamond shop coming)${walletTitle(snap.diamonds)}`}>💎 {fmtWallet(snap.diamonds)}</button>
        </div>

        <div className="quicknav">
          <button className="navbtn" onClick={() => onOpen('house')}>🏡 Home</button>
          <button className="navbtn" onClick={() => onOpen('barn')}>🐄 Barn</button>
          <button className="navbtn" onClick={() => onOpen('shop')}>🛒 Shop</button>
          <button className="navbtn" onClick={() => onOpen('kin')}>🍃 Kin</button>
          <button className="navbtn" onClick={() => onOpen('inventory')}>🎒 Bag</button>
          <button className="navbtn" onClick={() => onOpen('quests')}>📜 Quests</button>
        </div>

        {(circleName || presence?.count > 0) && (
          <div className="live-row">
            <button type="button" className="live-pill circle" title={circleName || 'Your circle'} onClick={() => setShowLive(true)}>
              <span className="circ-ic" aria-hidden="true" />
              <span className="live-label">{circleName || 'Circle'}</span>
            </button>
            <button type="button" className="live-pill count" title="See who's in the farm now" onClick={() => setShowLive(true)}>
              <span className="live-dot" aria-hidden="true" />
              <span className="live-label">{presence?.count || 0} live</span>
            </button>
          </div>
        )}
      </div>

      {showLive && (
        <LivePopup selfCard={selfCard} peers={presence?.peers || []} circleName={circleName} onClose={() => setShowLive(false)} />
      )}

      {!usingHero && (
        <div className="hero-note">Placeholder farmer — build your hero in <b>Kingdom Heroes</b> and it appears here.</div>
      )}

      {/* action cluster. In the ARENA it's the SHARED @arganta/combat cluster
          (same component Kingdom uses): 3 skills + mount + attack. On the farm
          it's the slim tap-to-farm cluster: Seed-picker / Sleep / Mount + work. */}
      {battle?.on ? (
        <ActionCluster
          skills={battleSkills}
          onSkill={onSkill}
          onAttack={onStrike}
          mp={snap.stamina}
          skin={skinId}
          utils={[{ key: 'mount', icon: <IconMount />, onClick: onToggleMount, title: 'mount' }]}
        />
      ) : (
      <div className="cluster">
        {showSeeds && (
          <div className="seed-fan" aria-label="seed inventory">
            <div className="seed-fan-title">Plant</div>
            {seedRows.map((crop, i) => {
              const count = Number(snap.seeds?.[crop.id] || 0);
              const active = snap.selectedSeed === crop.id;
              return (
                <button
                  key={crop.id}
                  type="button"
                  className={'seed-fan-item' + (active ? ' active' : '') + (count <= 0 ? ' empty' : '')}
                  style={{ '--i': i }}
                  title={`${crop.name} seed x${count}`}
                  onClick={() => pickSeed(crop.id)}
                >
                  <span className="seed-emoji">{crop.emoji}</span>
                  <span className="seed-name">{crop.name}</span>
                  <b>{count}</b>
                </button>
              );
            })}
          </div>
        )}
        <div className="small-ring">
          <button type="button" title={`Seed: ${selectedCrop.name} ×${selectedSeedCount}`}
            className={'skill-circle' + (showSeeds ? ' active' : '')}
            onClick={() => setShowSeeds((v) => !v)}>
            <span>{selectedCrop.emoji}</span>
            <span className="tool-count">×{selectedSeedCount}</span>
          </button>
          <button type="button" className="skill-circle util" onClick={onPlantAll} title="Plant all empty soil">🌱</button>
          <button type="button" className="skill-circle util" onClick={onHarvestAll} title="Harvest all ripe crops">🧺</button>
          <button type="button" className="skill-circle util" onClick={onSleep} title="sleep">😴</button>
          <button type="button" className="skill-circle util" onClick={onToggleMount} title="mount"><IconMount /></button>
        </div>
        <button type="button" className="attack-circle" onClick={onUse} aria-label="work the tile in front of you" title="Harvest / plant the tile ahead — or just tap the land">
          <span>👐</span>
        </button>
      </div>
      )}

      {showSettings && (
        <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings">
            <div className="browser-head"><b>Settings</b>
              <button className="closex" onClick={() => setShowSettings(false)}>✕</button></div>
            <div className="settings-body">
              {snap.operator && (
                <section className="set-card dev-card">
                  <h4>Developer mode <em className="op-badge">⚡ OPERATOR</em></h4>
                  <div className="setrow" style={{ justifyContent: 'space-between' }}>
                    <label style={{ width: 'auto' }}>Map overlay <span className="dev-dot walk" /> walk · <span className="dev-dot block" /> no-walk</label>
                    <button type="button" className={'dev-toggle' + (devMode ? ' on' : '')} onClick={onToggleDev} aria-pressed={devMode}>
                      <span className="dev-knob" />{devMode ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <p className="settings-empty">Draws the red/green collision boxes + numbered map key on the farm. Visible only to you — players never see it.</p>
                </section>
              )}
              <section className="set-card">
                <h4>Circle sync</h4>
                <div className="setrow" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span className={'sync-pill' + (circleId ? ' on' : ' off')} title={circleId || 'no circle bound'}>
                    {circleId ? '🔗 ' + (circleName || 'circle …' + String(circleId).slice(0, 6)) : '👤 personal (no circle)'}
                  </span>
                  <span className={'sync-pill' + ((presence?.count || 0) > 0 ? ' on' : '')} title="players broadcasting on this circle right now">
                    {(presence?.count || 0) > 0 ? '🟢 ' + presence.count + ' live' + (presence.names?.[0] ? ' · ' + presence.names.join(', ') : '') : '⚪ 0 live (solo)'}
                  </span>
                  <span className="sync-pill" title="where this farm's save is going">
                    {'💾 ' + (snap.saveSource || 'unknown')}
                  </span>
                </div>
                {syncDebug && (
                  <code className="sync-debug" title="live realtime channel state">
                    ch:{syncDebug.status}{syncDebug.subscribed ? '✓' : '✗'} · ws:{syncDebug.socket} · peers:{syncDebug.peers} · heard:{syncDebug.lastPeerAgoS < 0 ? 'never' : syncDebug.lastPeerAgoS + 's ago'} · s:{syncDebug.session}
                  </code>
                )}
              </section>
              <section className="set-card">
                <h4>{snap.pathIcon} {snap.pathName || 'Guardian'} · {snap.title} · Lv {fmt(snap.level)} <em className="set-count">{rank.name}</em></h4>
              </section>
              <section className="set-card">
                <h4>Wallet {snap.operator && <em className="op-badge">⚡ OPERATOR</em>}</h4>
                <div className="setrow diamond-row" style={{ gap: 14, flexWrap: 'wrap' }}>
                  <span className="diamond-count">🌸 {snap.bloom === Infinity ? '∞' : fmt(snap.bloom)}</span>
                  <span className="diamond-count">🪵 {snap.wood === Infinity ? '∞' : fmt(snap.wood)}</span>
                  <span className="diamond-count">🪨 {snap.stone === Infinity ? '∞' : fmt(snap.stone)}</span>
                  <span className="diamond-count">💎 {fmt(snap.diamonds)}</span>
                </div>
                <p className="settings-empty">🌸 Bloom runs the farm (every action earns it). 🪵🪨 gathered for upgrades. 💎 Diamonds are learning-earned — cosmetics only (Diamond shop coming).{snap.operator ? ' · Admin: everything free.' : ''}</p>
              </section>
              <section className="set-card">
                <h4>Active Kin <em className="set-count">{activeKins.length}/6</em></h4>
                {activeKins.length ? (
                  <div className="kin-chip-row">
                    {activeKins.map((k) => (
                      <span className="kin-chip" key={k.id} style={{ '--kin-c': k.color || '#8b5cf6' }} title={(k.name || 'Kin') + (k.task ? ' · ' + k.task : '')}>
                        <i />{k.name || 'Kin'}{k.task ? <b>{k.task === 'water' ? '💧' : '🌾'}</b> : null}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="settings-empty">No Kin on the farm yet — befriend them in ArgantaLab.</p>
                )}
              </section>
              <section className="set-card">
                <h4>Action skin <em className="set-count">{skinOf(skinId).name}</em></h4>
                <div className="skin-picker">
                  {SKIN_LIST.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={'skin-swatch' + (s.id === skinId ? ' on' : '')}
                      style={s.vars}
                      onClick={() => pickSkin(s.id)}
                      title={s.name}
                    >
                      <span className="skin-orbs">
                        <i className="so sk"><GameIcon name={s.icons.single} size={15} /></i>
                        <i className="so atk"><GameIcon name={s.icons.attack} size={22} /></i>
                        <i className="so sk"><GameIcon name={s.icons.heal} size={15} /></i>
                      </span>
                      <b>{s.name}</b>
                      <small>{s.blurb}</small>
                    </button>
                  ))}
                </div>
                <p className="settings-empty">Repaints the battle buttons (bottom-right). Each skin uses a different game-icons set — pick the look you like.</p>
              </section>
              <section className="set-card">
                <h4>Camera &amp; movement</h4>
                <div className="setrow">
                  <label>zoom</label>
                  <input type="range" min="0.1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                  <span>{zoom.toFixed(1)}×</span>
                </div>
                <div className="setrow">
                  <label>speed</label>
                  <input type="range" min="1" max="3" step="0.1" value={speed ?? 1.5} onChange={(e) => setSpeed(Number(e.target.value))} />
                  <span>{Number(speed ?? 1.5).toFixed(1)}×</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Live popup — tapping the live row opens this. Lists everyone in the farm right
// now as a full UnitCard (same component as the top-left), the player first.
function LivePopup({ selfCard, peers, circleName, onClose }) {
  const entries = [
    { key: 'self', card: selfCard, you: true },
    ...(peers || []).map((p) => ({ key: p.id, name: p.name, card: p.card ? cardFromPeer(p) : null })),
  ];
  return (
    <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="live-popup">
        <div className="browser-head">
          <b>🟢 In the farm now{circleName ? ' · ' + circleName : ''} <em className="set-count">{entries.length}</em></b>
          <button className="closex" onClick={onClose}>✕</button>
        </div>
        <div className="live-popup-body">
          {entries.map((e) => (
            <div className="live-card-wrap" key={e.key}>
              {e.you && <span className="live-you">YOU</span>}
              {e.card
                ? <UnitCard card={e.card} className="in-popup" />
                : <div className="live-card-loading">👤 {e.name || 'Farmer'} — loading…</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

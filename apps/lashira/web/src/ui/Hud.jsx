// HUD — the unit-frame (HP/MP card), settings popup, and action cluster are
// copied AS IS from Kingdom Heroes (apps/kingdom/web/src/room/TestRoom.jsx):
// same TierIcon crest, same IconHeart/IconMana bars, same glass settings popup,
// same skill-circle/attack-circle cluster + slot badges. Polished to be CLEAN:
// only the card (crest/name/HP/MP) shows persistently — no resource chips.
// MP bar IS the farm's real energy/stamina meter (one number, not two).
// Diamonds (the only currency) and the guardian companion live in Settings.
import { useEffect, useRef, useState } from 'react';
import { IconMount } from '../components/HudIcons.jsx';
import TierIcon from '../components/TierIcon.jsx';
import { UnitCard, cardFromSnap, cardFromPeer } from './UnitCard.jsx';
import { CROPS } from '../data/crops.js';
import { supabase, hasSupabase } from '../net/supabase.js';
import { ActionCluster, IconEmote } from '@arganta/combat/cluster';
import { RewardToasts } from '@arganta/combat/reward';
import { SKIN_LIST, DEFAULT_SKIN, skinOf, GameIcon, FARM_ICONS, EMOTES, EMOTE_EMOJI, loadFavoriteEmotes, saveFavoriteEmotes } from '@arganta/combat';
import { SettingsSheet } from './SettingsSheet.jsx';

// chosen action-cluster skin, remembered per device.
const SKIN_KEY = 'lashira_cluster_skin';
const loadSkin = () => { try { return localStorage.getItem(SKIN_KEY) || DEFAULT_SKIN; } catch { return DEFAULT_SKIN; } };
const FAV_EMOTES_KEY = 'lashira_fav_emotes';

// Whether the top-left HUD stack is minimized to just the SPARK orb. Remembered
// per device. First run (no stored choice): collapse on phone-sized screens,
// where the full card + quicknav otherwise cover a big chunk of the play field.
const HUD_MIN_KEY = 'lashira_hud_min';
const loadHudMin = () => {
  try {
    const v = localStorage.getItem(HUD_MIN_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  } catch { return false; }
};
const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

// Collapsed HUD — the SPARK crest wrapped in a thin HP (top, red) / MP (bottom,
// blue) ring, so vitals stay glanceable even minimized. Tap to expand the full
// card. The ring uses SVG pathLength=100 so each semicircle fills by percent.
function HudOrb({ card, onExpand }) {
  const hpPct = clampPct((card.hp / Math.max(1, card.maxHp)) * 100);
  const mpPct = clampPct((card.mp / Math.max(1, card.maxMp)) * 100);
  const C = 26, R = 22;
  const topArc = `M ${C - R} ${C} A ${R} ${R} 0 0 1 ${C + R} ${C}`;
  const botArc = `M ${C + R} ${C} A ${R} ${R} 0 0 1 ${C - R} ${C}`;
  return (
    <button type="button" className="hud-orb" onClick={onExpand}
      title={`${card.name || 'You'} · HP ${Math.round(hpPct)}% · tap to expand`} aria-label="Expand HUD">
      <svg className="orb-ring" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <path d={topArc} className="orb-track" pathLength="100" />
        <path d={botArc} className="orb-track" pathLength="100" />
        <path d={topArc} className="orb-hp" pathLength="100" style={{ strokeDasharray: `${hpPct} 100` }} />
        <path d={botArc} className="orb-mp" pathLength="100" style={{ strokeDasharray: `${mpPct} 100` }} />
      </svg>
      <span className="orb-gem"><TierIcon color={card.rank?.color || '#8b5cf6'} glyph={card.rank?.glyph || '◆'} size={30} /></span>
    </button>
  );
}

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

export function Hud({ snap, game, onUse, onSleep, onToggleMount, onEmote, onOpen, zoom, setZoom, speed, setSpeed, usingHero, hero, presence, circleId, myCircles = [], activeCircleId = null, onSelectCircle = null, onSignOut = null, getSyncDebug, battle, battleSkills = [], onStrike, onSkill, cooldownUI, zoneLabel, onHarvestAll, onPlantAll, devMode = false, onToggleDev }) {
  const [showSettings, setShowSettings] = useState(false);
  const [hudMin, setHudMin] = useState(loadHudMin);
  const setHudMinPersist = (v) => { setHudMin(v); try { localStorage.setItem(HUD_MIN_KEY, v ? '1' : '0'); } catch { /* ignore */ } };
  const [favEmotes, setFavEmotes] = useState(() => loadFavoriteEmotes(FAV_EMOTES_KEY));
  const [emoteFanOpen, setEmoteFanOpen] = useState(false);
  const emoteFanTimerRef = useRef(0);
  const pickFavEmotes = (list) => { setFavEmotes(list); saveFavoriteEmotes(FAV_EMOTES_KEY, list); };
  function toggleEmoteFan() {
    clearTimeout(emoteFanTimerRef.current);
    setEmoteFanOpen((open) => {
      const next = !open;
      if (next) emoteFanTimerRef.current = setTimeout(() => setEmoteFanOpen(false), 4000);
      return next;
    });
  }
  function playEmote(name) {
    onEmote?.(name);
    setEmoteFanOpen(false);
    clearTimeout(emoteFanTimerRef.current);
  }
  const emoteUtils = emoteFanOpen
    ? (favEmotes.length ? favEmotes : ['Victory']).map((name, i) => ({
        key: 'fan:' + name, icon: <span style={{ fontSize: 20 }}>{EMOTE_EMOJI[name] || '❔'}</span>,
        onClick: () => playEmote(name), title: name, className: 'fan-item fan-item-' + (i + 1),
      }))
    : [{ key: 'emote', icon: <IconEmote />, onClick: toggleEmoteFan, title: 'emote (pick a favorite)', className: 'emote' }];
  // Long-press Harvest All to toggle Sickle mode instead — folds a rarely-used
  // persistent tool into the button players already reach for most, rather than
  // giving it its own permanent orb.
  const harvestPressRef = useRef({ timer: 0, longFired: false });
  function harvestPointerDown() {
    harvestPressRef.current.longFired = false;
    harvestPressRef.current.timer = setTimeout(() => { harvestPressRef.current.longFired = true; toggleSickle(); }, 480);
  }
  function harvestPointerUp() {
    clearTimeout(harvestPressRef.current.timer);
    if (!harvestPressRef.current.longFired) onHarvestAll();
  }
  const [showSeeds, setShowSeeds] = useState(false);
  const seedFanRef = useRef(null);
  const seedBtnRef = useRef(null);
  // Auto-close the seed fan on any click outside it (same mousedown+contains
  // pattern the dye/skill/emote pop-ups already use) — previously it only
  // closed by picking a seed or tapping the toggle button again.
  useEffect(() => {
    if (!showSeeds) return undefined;
    function close(e) {
      if (seedFanRef.current?.contains(e.target)) return;
      if (seedBtnRef.current?.contains(e.target)) return;
      setShowSeeds(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showSeeds]);
  const [showLive, setShowLive] = useState(false);
  const [skinId, setSkinId] = useState(loadSkin);
  const pickSkin = (id) => { setSkinId(id); try { localStorage.setItem(SKIN_KEY, id); } catch { /* ignore */ } };
  // Plant All / Harvest All 6h cooldown — the wipe overlay needs a live "now" to
  // animate against; a 30s tick is plenty smooth for a multi-hour cooldown
  // without re-rendering constantly (matches the syncDebug interval pattern below).
  const [nowTick, setNowTick] = useState(() => Date.now());
  const cooldownActive = Date.now() < (snap.plantAllReadyAt || 0) || Date.now() < (snap.harvestAllReadyAt || 0);
  useEffect(() => {
    if (!cooldownActive) return undefined;
    const h = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(h);
  }, [cooldownActive]);
  const cdFrac = (readyAt) => {
    const remain = (readyAt || 0) - nowTick;
    return remain > 0 ? Math.min(1, remain / (6 * 60 * 60 * 1000)) : 0;
  };
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
  // Sickle is a persistent tool selection: on = taps remove crops; toggling off
  // returns to the seed/plant tool.
  const toggleSickle = () => game.setTool(snap.tool === 'sickle' ? 'seed' : 'sickle');
  // Visit mode (multi-farm): read-only view of a circle-mate's PERSONAL farm.
  // FarmLogic already no-ops every mutator server/logic-side (belt +
  // suspenders); here we just remove the temptation — hide the farm action
  // wheel entirely (keep Mount: it's the VIEWER's own cosmetic, touches no
  // farm state) and show a clear banner whose farm this is.
  const isVisitor = snap.viewerRole === 'visitor';

  return (
    <>
      {snap.toast && <div className="toasts"><div className="toast">{snap.toast}</div></div>}
      <RewardToasts rewards={snap.rewards} />

      {/* top bar — gear only. The wallet strip moved into the left stack, below
          the live row (a single place owns the top-left column). */}
      <div className="hud-top">
        <div className="topbar-right">
          {!hudMin && (
            <button type="button" className="hud-min" onClick={() => setHudMinPersist(true)}
              title="Minimize HUD" aria-label="Minimize HUD">▢</button>
          )}
          <button type="button" className="hud-gear" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </div>

      {/* Top-left column — single owner of the whole stack, all blocks stretch to
          ONE width so every left/right edge lines up:
            profile card → wallet tray (💎 pinned right) → toolbar → live row.
          The UnitCard here and each card in the live popup are the SAME
          component, so a design change updates every card at once. */}
      {/* Location-aware zone pill — always shows where you are (🌾 Farm /
          ⚔️ PvP Arena / ⛏️ Mines / …). Anchored to the bottom-left corner;
          non-interactive so it never steals the drag-to-move gesture. Turns
          red in the PvP arena so it doubles as the "combat is live here" cue. */}
      {zoneLabel && (
        <div className={'zone-pill' + (battle?.pvp ? ' pvp' : '')}>{zoneLabel}</div>
      )}

      {/* Minimizable: collapsed → just the SPARK orb; expanded → card + quicknav
          that spring out of the orb's corner. Auto-collapses on phones (see
          loadHudMin) so the stack stops covering gameplay; choice is remembered. */}
      <div className={'left-stack' + (hudMin ? ' minimized' : '')}>
        {hudMin ? (
          <HudOrb card={selfCard} onExpand={() => setHudMinPersist(false)} />
        ) : (
          <>
            {/* Wallet pills now render INSIDE the card itself (UnitCard's optional
                `wallet` row, 4 equal-width cells at HP/MP-bar text size) — no
                longer a separate strip below it. Same tap-to-open-Shop behavior. */}
            <UnitCard
              card={selfCard}
              wallet={{ wood: snap.wood, stone: snap.stone, bloom: snap.bloom, diamonds: snap.diamonds }}
              onWalletTap={() => onOpen('shop')}
            />

            <div className="quicknav">
              <button className="navbtn" onClick={() => onOpen('character')}>👤 Me</button>
              <button className="navbtn" onClick={() => onOpen('house')}>🏡 Home</button>
              <button className="navbtn" onClick={() => onOpen('shop')}>🛒 Shop</button>
              <button className="navbtn" onClick={() => onOpen('inventory')}>🎒 Bag</button>
              <button className="navbtn" onClick={() => onOpen('quests')}>📜 Quests</button>
            </div>
          </>
        )}

        {/* Circle name + live-player status moved into Settings → Circle sync
            (it already showed this, richer — with peer names). Tap either
            sync-pill there to open the same "who's online" popup this used
            to open from here. */}
      </div>

      {showLive && (
        <LivePopup selfCard={selfCard} peers={presence?.peers || []} circleName={circleName} onClose={() => setShowLive(false)} />
      )}

      {!usingHero && (
        <div className="hero-note">Placeholder farmer — build your hero in <b>Kingdom Heroes</b> and it appears here.</div>
      )}

      {isVisitor && (
        <div className="visit-banner">
          👁 Visiting <b>{snap.visitOwnerName || snap.name}</b>'s Farm — look, but only they can work it
        </div>
      )}

      {/* action cluster. In the ARENA it's the SHARED @arganta/combat cluster
          (same component Kingdom uses): 3 skills + mount + attack. On the farm
          it's the slim tap-to-farm cluster: Seed-picker / Sleep / Mount + work.
          VISITING: only Mount stays (the viewer's own cosmetic) — every farm
          tool is hidden, there's nothing here to tempt-and-block. */}
      {isVisitor ? (
        <div className="cluster visit-cluster" style={skinOf(skinId).vars} data-skin={skinId}>
          <button type="button" className="skill-circle util" onClick={onToggleMount} title="mount"><GameIcon name={skinOf(skinId).icons.mount} size={24} /></button>
        </div>
      ) : battle?.on ? (
        <ActionCluster
          skills={battleSkills}
          onSkill={onSkill}
          onAttack={onStrike}
          mp={snap.stamina}
          skin={skinId}
          cooldowns={cooldownUI?.skills}
          attackCooldown={cooldownUI?.attack || 0}
          utils={[
            { key: 'mount', icon: <IconMount />, onClick: onToggleMount, title: 'mount' },
            ...emoteUtils,
          ]}
        />
      ) : (
      <div className="cluster farm" style={skinOf(skinId).vars} data-skin={skinId}>
        {showSeeds && (
          <div className="seed-fan" aria-label="seed inventory" ref={seedFanRef}>
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
          <button type="button" ref={seedBtnRef} title={`Seed: ${selectedCrop.name} ×${selectedSeedCount}`}
            className={'skill-circle' + (showSeeds ? ' active' : '')}
            onClick={() => setShowSeeds((v) => !v)}>
            <span>{selectedCrop.emoji}</span>
            <span className="tool-count">×{selectedSeedCount}</span>
          </button>
          <button type="button" className={'skill-circle util' + (cdFrac(snap.plantAllReadyAt) > 0 ? ' cooling' : '')}
            onClick={onPlantAll} title="Plant all empty soil">
            <GameIcon name={FARM_ICONS.plant} size={22} />
            {cdFrac(snap.plantAllReadyAt) > 0 && <span className="cd-wipe" style={{ '--cd': cdFrac(snap.plantAllReadyAt) }} aria-hidden="true" />}
          </button>
          <button type="button" className={'skill-circle util' + (snap.tool === 'sickle' ? ' active' : '') + (cdFrac(snap.harvestAllReadyAt) > 0 ? ' cooling' : '')}
            onPointerDown={harvestPointerDown} onPointerUp={harvestPointerUp} onPointerLeave={harvestPointerUp}
            title="Harvest all ripe crops — hold to toggle Sickle (remove instead of collect)">
            <GameIcon name={snap.tool === 'sickle' ? FARM_ICONS.sickle : FARM_ICONS.harvest} size={22} />
            {cdFrac(snap.harvestAllReadyAt) > 0 && <span className="cd-wipe" style={{ '--cd': cdFrac(snap.harvestAllReadyAt) }} aria-hidden="true" />}
          </button>
          <button type="button" className="skill-circle util" onClick={onToggleMount} title="mount"><GameIcon name={skinOf(skinId).icons.mount} size={24} /></button>
          {emoteFanOpen
            ? favEmotes.map((name, i) => (
                <button key={name} type="button" className={'skill-circle util fan-item fan-item-' + (i + 1)}
                  onClick={() => playEmote(name)} title={name}>{EMOTE_EMOJI[name] || '❔'}</button>
              ))
            : <button type="button" className="skill-circle util emote" onClick={toggleEmoteFan} title="emote (pick a favorite)"><IconEmote /></button>}
        </div>
        <button type="button" className="attack-circle" onClick={onUse} aria-label="work the tile in front of you" title="Swing at the tile ahead — chop trees, mine ore, harvest or plant crops">
          <GameIcon name={snap.tool === 'sickle' ? FARM_ICONS.sickle : FARM_ICONS.work} size={40} />
        </button>
      </div>
      )}

      {showSettings && (
        <SettingsSheet
          world={{ name: circleName || 'Kingdom hub', color: '#8b5cf6', operator: snap.operator }}
          hero={{
            card: selfCard,
            wallet: { wood: snap.wood, stone: snap.stone, bloom: snap.bloom, diamonds: snap.diamonds },
            kins: activeKins,
            onOpenCharacter: () => { onOpen('character'); setShowSettings(false); },
            onWalletTap: () => { onOpen('shop'); setShowSettings(false); },
          }}
          circle={{
            live: { count: presence?.count || 0, names: presence?.names || [] },
            syncDebug,
            operator: snap.operator,
            onOpenLive: () => setShowLive(true),
            circles: onSelectCircle ? myCircles : undefined,
            activeCircleId,
            onSelectCircle: onSelectCircle ? (id) => { onSelectCircle(id); setShowSettings(false); } : undefined,
            locationLabel: zoneLabel || (circleId ? circleName || 'This circle' : 'Personal farm'),
          }}
          play={{
            worldActions: isVisitor ? [] : [{ id: 'sleep', icon: '😴', label: 'Sleep — refill stamina for the night', onClick: () => { onSleep?.(); setShowSettings(false); } }],
            speed: { value: speed ?? 1.5, min: 1, max: 3, step: 0.1, onChange: setSpeed },
            zoom: { value: zoom, min: 0.1, max: 3, step: 0.1, onChange: setZoom },
            skin: { list: SKIN_LIST, activeId: skinId, onPick: pickSkin },
            emotes: { all: EMOTES, favorites: favEmotes, max: 4, onSet: pickFavEmotes },
          }}
          sound={{}}
          system={{
            dev: snap.operator ? { overlayOn: devMode, onToggleOverlay: onToggleDev } : null,
            account: onSignOut ? { onSignOut } : null,
          }}
          onExit={null}
          onClose={() => setShowSettings(false)}
        />
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
    // `popover`: this opens from INSIDE Settings, so it must sit ABOVE the
    // settings backdrop (both were .browser-backdrop z:50 — this one lost the
    // tie by DOM order and rendered behind it). See styles.css .popover (z:55).
    <div className="browser-backdrop popover" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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

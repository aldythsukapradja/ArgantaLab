// HUD — the unit-frame (HP/MP card), settings popup, and action cluster are
// copied AS IS from Kingdom Heroes (apps/kingdom/web/src/room/TestRoom.jsx):
// same TierIcon crest, same IconHeart/IconMana bars, same glass settings popup,
// same skill-circle/attack-circle cluster + slot badges. Polished to be CLEAN:
// only the card (crest/name/HP/MP) shows persistently — no resource chips.
// MP bar IS the farm's real energy/stamina meter (one number, not two).
// Diamonds (the only currency) and the guardian companion live in Settings.
import { useEffect, useState } from 'react';
import { computeRank } from '../net/hero.js';
import TierIcon from '../components/TierIcon.jsx';
import { IconHeart, IconMana, IconMount } from '../components/HudIcons.jsx';
import { CROPS } from '../data/crops.js';
import { supabase, hasSupabase } from '../net/supabase.js';
import { ActionCluster } from '@arganta/combat/cluster';
import { RewardToasts } from '@arganta/combat/reward';

const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
const fmt = (n) => Number(n || 0).toLocaleString();
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

export function Hud({ snap, game, onUse, onSleep, onToggleMount, onOpen, zoom, setZoom, speed, setSpeed, usingHero, hero, presence, circleId, getSyncDebug, battle, battleSkills = [], onStrike, onSkill, onHarvestAll, onPlantAll }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showSeeds, setShowSeeds] = useState(false);
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
  const maxHp = Number(snap.maxHp || hero?.stats?.maxHp || 100);
  const circleName = useCircleName(circleId);
  const activeKins = (snap.kins || []).slice(0, 6);
  const energyPct = Math.max(0, Math.min(100, (snap.stamina / Math.max(1, snap.maxStamina)) * 100));
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

      {/* top bar — EXP readout + wallet strip (Wood · Stone · Bloom · Diamond) + gear */}
      <div className="hud-top">
        <div className="topbar-right">
          <div className="res-strip">
            <button className="res res-wood" onClick={() => onOpen('shop')} title="Wood — chop the forest (coming soon)">🪵 {snap.wood === Infinity ? '∞' : fmt(snap.wood)}</button>
            <button className="res res-stone" onClick={() => onOpen('shop')} title="Stone — mine the quarry (coming soon)">🪨 {snap.stone === Infinity ? '∞' : fmt(snap.stone)}</button>
            <button className="res res-bloom" onClick={() => onOpen('shop')} title="Bloom — the play currency, earned from every action">🌸 {snap.bloom === Infinity ? '∞' : fmt(snap.bloom)}</button>
            <button className="res res-diamond" onClick={() => onOpen('shop')} title="Diamonds — learning currency, for cosmetics (Diamond shop coming)">💎 {fmt(snap.diamonds)}</button>
          </div>
          <button type="button" className="hud-gear" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </div>

      {/* unit-frame + quick nav, stacked top-left. unit-frame markup is the
          exact Kingdom Heroes shape (TierIcon crest + IconHeart/IconMana bars).
          MP bar shows the real farm energy/stamina — one meter, not two. */}
      <div className="left-stack">
        <div className="unit-frame">
          <div className="unit-rank" title={`ArgantaLab rank: ${rank.name}`}>
            <TierIcon color={rank.color} glyph={rank.glyph} size={38} />
            <span className="rank-name" style={{ background: rank.color, borderColor: rank.color }}>{rank.name}</span>
          </div>
          <div className="unit-main">
            <div className="unit-name">
              <b className="uname" title={snap.name}>{snap.name}</b>
              <span className="utitle"><em className="path-chip">{snap.pathIcon} {snap.title || snap.pathName || 'Guardian'}</em><em className="lv-chip">Lv {fmt(snap.level)}</em></span>
            </div>
            <div className="unit-exp-row">
              <div className="unit-exp" title={`${snap.xpPct ?? 0}% to next level`}><span style={{ width: `${snap.xpPct ?? 0}%` }} /></div>
              <b className="exp-num" title="XP into this level / XP this level needs">
                ✨ {snap.level >= 99 ? 'MAX' : `${fmt(snap.xpCur)}/${fmt(snap.xpReq)}`}
              </b>
            </div>
            <div className="unit-bars">
              {battle?.on
                ? <div className="bar hp"><span style={{ width: `${Math.max(0, Math.min(100, (battle.hp / Math.max(1, battle.maxHp)) * 100))}%` }} /><b><IconHeart /> {fmt(battle.hp)}/{fmt(battle.maxHp)}</b></div>
                : <div className="bar hp"><span style={{ width: '100%' }} /><b><IconHeart /> {fmt(maxHp)}/{fmt(maxHp)}</b></div>}
              <div className="bar mp"><span style={{ width: `${energyPct}%` }} /><b><IconMana /> {fmt(snap.stamina)}/{fmt(snap.maxStamina)}</b></div>
            </div>
          </div>
        </div>

        <div className="quicknav">
          <button className="navbtn" onClick={() => onOpen('house')}>🏡 Home</button>
          <button className="navbtn" onClick={() => onOpen('barn')}>🐄 Barn</button>
          <button className="navbtn" onClick={() => onOpen('shop')}>🛒 Shop</button>
          <button className="navbtn" onClick={() => onOpen('kin')}>🍃 Kin</button>
          <button className="navbtn" onClick={() => onOpen('inventory')}>🎒 Bag</button>
        </div>
        {(circleName || presence?.count > 0) && (
          <div className="live-row">
            {circleName && <span className="live-pill circle" title={circleName}>🔗 {circleName}</span>}
            {presence?.count > 0 && <span className="live-pill count" title={`${presence.count} in the farm now`}>🟢 {presence.count} live</span>}
            {(presence?.names || []).slice(0, 4).map((n, i) => (
              <span className="live-pill name" key={i} title={n}>👤 {n}</span>
            ))}
          </div>
        )}
      </div>

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

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
  const maxHp = Number(hero?.stats?.maxHp || 100);
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

      {/* top bar — the gear is the ONLY persistent chrome besides the card */}
      <div className="hud-top">
        <button type="button" className="hud-gear" onClick={() => setShowSettings(true)}>⚙</button>
      </div>

      {/* unit-frame + quick nav, stacked top-left. unit-frame markup is the
          exact Kingdom Heroes shape (TierIcon crest + IconHeart/IconMana bars).
          MP bar shows the real farm energy/stamina — one meter, not two. */}
      <div className="left-stack">
        <div className="unit-frame">
          <div className="unit-rank" title={rank.name}>
            <TierIcon color={rank.color} glyph={rank.glyph} size={38} />
          </div>
          <div className="unit-main">
            <div className="unit-name">
              <b>{snap.name}</b>
              <span>{cap(snap.season)} · Day {snap.day} · Lv {fmt(snap.level)}</span>
            </div>
            <div className="unit-exp"><span style={{ width: `${xpProgress(snap.xp)}%` }} /></div>
            <div className="unit-bars">
              {battle?.on
                ? <div className="bar hp"><span style={{ width: `${Math.max(0, Math.min(100, (battle.hp / Math.max(1, battle.maxHp)) * 100))}%` }} /><b><IconHeart /> {fmt(battle.hp)}/{fmt(battle.maxHp)}</b></div>
                : <div className="bar hp"><span style={{ width: '100%' }} /><b><IconHeart /> {fmt(maxHp)}/{fmt(maxHp)}</b></div>}
              <div className="bar mp"><span style={{ width: `${energyPct}%` }} /><b><IconMana /> {fmt(snap.stamina)}/{fmt(snap.maxStamina)}</b></div>
            </div>
          </div>
        </div>

        <button type="button" className="gold-pill" onClick={() => onOpen('shop')} title="Gold — earn by selling produce, spend on seeds">
          🥇 <b>{snap.gold === Infinity ? '∞' : fmt(snap.gold)}</b> Gold
        </button>

        <div className="quicknav">
          <button className="navbtn" onClick={() => onOpen('house')}>🏡 Home</button>
          <button className="navbtn" onClick={() => onOpen('barn')}>🐄 Barn</button>
          <button className="navbtn" onClick={() => onOpen('shop')}>🛒 Shop</button>
          <button className="navbtn" onClick={() => onOpen('kin')}>🍃 Kin</button>
          <button className="navbtn" onClick={() => onOpen('inventory')}>🎒 Bag</button>
        </div>
        {presence?.count > 0 && (
          <div className="farm-online" title={presence.names?.join(', ') || 'Friends in farm'}>
            <i /> <b>{presence.count}</b> live {presence.names?.[0] ? <span>{presence.names.join(', ')}</span> : null}
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
                <h4>Wallet {snap.operator && <em className="op-badge">⚡ OPERATOR</em>}</h4>
                <div className="setrow diamond-row" style={{ gap: 14 }}>
                  <span className="diamond-count">🥇 {snap.gold === Infinity ? '∞' : fmt(snap.gold)}</span>
                  <span className="diamond-count">💎 {snap.operator ? '∞' : fmt(snap.diamonds)}</span>
                </div>
                <p className="settings-empty">🥇 Gold runs the farm. 💎 Diamonds are learning-earned — cosmetics only (Diamond shop coming).{snap.operator ? ' · Admin: everything free.' : ''}</p>
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

// Kingdom Heroes-style HUD. Unit-frame card replicates Heroes exactly: rank
// crest, name + Lv, EXP bar, HP (red→orange) + MP (blue→cyan) from the character's
// real stats, and the guardian strip. Farm resources (Bloom / energy / diamonds)
// sit in a top-right chip strip. Panel nav sits under the card.
import { useState } from 'react';
import { computeRank } from '../net/hero.js';

const TOOLS = [
  { id: 'hoe', icon: '⛏', label: 'Till' },
  { id: 'seed', icon: '🌰', label: 'Plant' },
  { id: 'can', icon: '💧', label: 'Water' },
];
const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
const xpPct = (xp) => Math.round(((Math.max(0, Number(xp || 0)) % 500) / 500) * 100);

function Crest({ rank, size = 46 }) {
  const c = rank?.color || '#f0a83a';
  return (
    <span className="unit-rank" title={rank?.name} style={{ width: size, height: size }}>
      <svg viewBox="0 0 56 56" width={size} height={size}>
        <path d="M28 5 L47 15 V33 L28 51 L9 33 V15 Z" fill={c} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="M28 5 L47 15 L28 27 L9 15 Z" fill="#fff" opacity="0.22" />
        <text x="28" y="36" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">{rank?.glyph || '✦'}</text>
      </svg>
    </span>
  );
}

export function Hud({ snap, game, onUse, onSleep, onOpen, zoom, setZoom, usingHero, hero }) {
  const [showSettings, setShowSettings] = useState(false);
  const rank = computeRank(snap.xp);
  const maxHp = Number(hero?.stats?.maxHp || 100);
  const maxMp = Number(hero?.stats?.maxMp || 40);
  const guardian = hero?.guardian;

  return (
    <>
      {snap.toast && <div className="toasts"><div className="toast">{snap.toast}</div></div>}

      <div className="hud-top">
        <span className="hud-keys">WASD / drag to move · Space use · 1/2/3 tools · Sleep to grow</span>
        <div className="top-right">
          <div className="res-strip">
            <span className="res">🌸 {snap.bloom}</span>
            <span className="res">⚡ {snap.stamina}/{snap.maxStamina}</span>
            <span className="res lock" title="Diamonds come from learning">💎 {snap.diamonds}</span>
          </div>
          <button type="button" className="hud-gear" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </div>

      {/* unit-frame card + quick nav, stacked top-left */}
      <div className="left-stack">
      <div className="unit-frame">
        <Crest rank={rank} />
        <div className="unit-main">
          <div className="unit-name">
            <b>{snap.name}</b>
            <span>{cap(snap.season)} · Day {snap.day} · Lv {snap.level}</span>
          </div>
          <div className="unit-exp"><span style={{ width: `${xpPct(snap.xp)}%` }} /></div>
          <div className="unit-bars">
            <div className="bar hp"><span style={{ width: '100%' }} /><b>❤ {maxHp}/{maxHp}</b></div>
            <div className="bar mp"><span style={{ width: '100%' }} /><b>💧 {maxMp}/{maxMp}</b></div>
          </div>
          {guardian && (
            <div className="guardian-strip">
              <span className="guardian-shield">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.5 4.5 5.5v6c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5v-6z" />
                  <path d="M9.2 11.8l2 2 3.6-3.8" />
                </svg>
              </span>
              <b>{guardian.displayName}</b>
              <small>{guardian.maxHp} HP · ATK {guardian.attack}</small>
            </div>
          )}
        </div>
      </div>

      <div className="quicknav">
        <button className="navbtn" onClick={() => onOpen('shop')}>🛒 Shop</button>
        <button className="navbtn" onClick={() => onOpen('barn')}>🐄 Barn</button>
        <button className="navbtn" onClick={() => onOpen('kin')}>🍃 Kin</button>
        <button className="navbtn" onClick={() => onOpen('house')}>🏡 Home</button>
      </div>
      </div>

      {!usingHero && (
        <div className="hero-note">Placeholder farmer — build your hero in <b>Kingdom Heroes</b> and it appears here.</div>
      )}

      <div className="cluster">
        <div className="small-ring">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" title={t.label}
              className={'skill-circle' + (snap.tool === t.id ? ' active' : '')}
              onClick={() => game.setTool(t.id)}>{t.icon}<small>{t.label}</small></button>
          ))}
          <button type="button" className="skill-circle util" title="Sleep" onClick={onSleep}>😴<small>sleep</small></button>
        </div>
        <button type="button" className="attack-circle" onClick={onUse} title="Use tool">⤵</button>
      </div>

      {showSettings && (
        <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings">
            <div className="browser-head"><b>Settings</b><button className="closex" onClick={() => setShowSettings(false)}>✕</button></div>
            <div className="settings-body">
              <section>
                <h4>Camera zoom</h4>
                <div className="setrow">
                  <input type="range" min="0.6" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                  <span>{zoom.toFixed(1)}×</span>
                </div>
              </section>
              <section>
                <h4>Hero</h4>
                <p className="settings-empty">{usingHero ? 'Rendering your Kingdom Heroes character.' : 'Placeholder farmer (Heroes art not loaded).'}</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

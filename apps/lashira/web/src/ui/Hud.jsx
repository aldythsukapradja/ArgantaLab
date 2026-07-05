// HUD — the unit-frame (HP/MP card), settings popup, and action cluster are
// copied AS IS from Kingdom Heroes (apps/kingdom/web/src/room/TestRoom.jsx):
// same TierIcon crest, same IconHeart/IconMana bars, same glass settings popup,
// same skill-circle/attack-circle cluster + slot badges. Farm-specific pieces
// (tool selection, resource chips, quick-nav) have no Kingdom equivalent and
// are Lashira's own, laid out so they don't collide with the copied pieces.
import { useState } from 'react';
import { computeRank } from '../net/hero.js';
import TierIcon from '../components/TierIcon.jsx';
import { IconHeart, IconMana, IconMount } from '../components/HudIcons.jsx';

const TOOLS = [
  { id: 'hoe', icon: '⛏', label: 'Till' },
  { id: 'seed', icon: '🌰', label: 'Plant' },
  { id: 'can', icon: '💧', label: 'Water' },
];
const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
const fmt = (n) => Number(n || 0).toLocaleString();
const xpProgress = (xp) => Math.round(((Math.max(0, Number(xp || 0)) % 500) / 500) * 100);

export function Hud({ snap, game, onUse, onSleep, onToggleMount, onOpen, zoom, setZoom, usingHero, hero }) {
  const [showSettings, setShowSettings] = useState(false);
  const rank = computeRank(snap.xp);
  const maxHp = Number(hero?.stats?.maxHp || 100);
  const maxMp = Number(hero?.stats?.maxMp || 40);
  const guardian = hero?.guardian;

  return (
    <>
      {snap.toast && <div className="toasts"><div className="toast">{snap.toast}</div></div>}

      {/* top bar — gear copied AS IS from Kingdom; resource chips are Lashira's own */}
      <div className="hud-top">
        <div className="top-right">
          <div className="res-strip">
            <span className="res">🌸 {snap.bloom}</span>
            <span className="res">⚡ {snap.stamina}/{snap.maxStamina}</span>
            <span className="res lock" title="Diamonds come from learning">💎 {snap.diamonds}</span>
          </div>
          <button type="button" className="hud-gear" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </div>

      {/* unit-frame + quick nav, stacked top-left. unit-frame markup is the
          exact Kingdom Heroes shape (TierIcon crest + IconHeart/IconMana bars). */}
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
              <div className="bar hp"><span style={{ width: '100%' }} /><b><IconHeart /> {fmt(maxHp)}/{fmt(maxHp)}</b></div>
              <div className="bar mp"><span style={{ width: '100%' }} /><b><IconMana /> {fmt(maxMp)}/{fmt(maxMp)}</b></div>
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
                <small>{fmt(guardian.maxHp)} HP · ATK {fmt(guardian.attack)}</small>
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

      {/* action cluster — attack-circle/skill-circle markup + arc positions
          copied AS IS from Kingdom Heroes. Slot meaning is farm-specific:
          3 numbered tools (Till/Plant/Water), Sleep + Mount as the two util
          orbs, and the big attack-circle applies the selected tool. */}
      <div className="cluster">
        <div className="small-ring">
          {TOOLS.map((t, i) => (
            <button key={t.id} type="button" title={t.label}
              className={'skill-circle' + (snap.tool === t.id ? ' active' : '')}
              onClick={() => game.setTool(t.id)}>
              <span>{t.icon}</span><span className="slot">{i + 1}</span>
            </button>
          ))}
          <button type="button" className="skill-circle util" onClick={onSleep} title="sleep">😴</button>
          <button type="button" className="skill-circle util" onClick={onToggleMount} title="mount"><IconMount /></button>
        </div>
        <button type="button" className="attack-circle" onClick={onUse} aria-label="use tool">
          {TOOLS.find((t) => t.id === snap.tool)?.icon || '⤵'}
        </button>
      </div>

      {showSettings && (
        <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings">
            <div className="browser-head"><b>Settings</b>
              <button className="closex" onClick={() => setShowSettings(false)}>✕</button></div>
            <div className="settings-body">
              <section>
                <h4>Camera</h4>
                <div className="setrow">
                  <label>zoom</label>
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

// SettingsSheet — the ONE settings "Command Sheet" shared by the farm AND every
// realm. Replaces the old flat GameSettingsSheet.jsx (deleted) + FarmRoom's
// inline .set-card stack. See docs/lashirabloom/Openworld Bloom Concept/
// DESIGN-unified-settings-command-sheet.md for the full spec — this is that
// design, built.
//
// 5 stable tabs (Hero/Circle/Play/Sound/System), a world-accented shell, ONE
// control kit. Every field in the props contract below is OPTIONAL — a caller
// (FarmRoom vs a realm) only passes what it has; the sheet renders/omits
// accordingly instead of forking layouts. See the props contract at the
// bottom of this comment block.
//
// SettingsSheetProps = {
//   world:  { name, color, operator },
//   hero:   { card, wallet?, kins?, onOpenCharacter?, onWalletTap? } | null,
//   circle: { live?, syncDebug?, circles?, activeCircleId?, onSelectCircle?,
//             onOpenLive?, locationLabel? } | null,
//   play:   { worldActions?: [{id,icon,label,intent,onClick}], speed?, zoom?,
//             skin?: {list,activeId,onPick}, emotes?: {all,favorites,max,onSet} } | null,
//   system: { help?, dev?: {overlayOn,onToggleOverlay}, account?: {onSignOut},
//             version? } | null,
//   onExit: (() => void) | null,   // renders the sticky footer (realms)
//   onClose: () => void,
// }
import { useState } from 'react';
import { sfx } from '../audio/sfx.js';
import { ambient } from '../audio/ambient.js';
import { UnitCard } from './UnitCard.jsx';
import { IconGear, IconSpeaker, IconMusic, IconSpeed, IconZoom, IconWrench, IconPin, IconDoor, IconFriends } from '../components/HudIcons.jsx';
import { skinOf, GameIcon, EMOTE_EMOJI } from '@arganta/combat';

const TABS = [
  { id: 'hero', icon: '👤', label: 'Hero' },
  { id: 'circle', icon: <IconFriends />, label: 'Circle' },
  { id: 'play', icon: '🎮', label: 'Play' },
  { id: 'sound', icon: <IconSpeaker />, label: 'Sound' },
  { id: 'system', icon: <IconGear />, label: 'System' },
];

// ---------------- control primitives (§6 of the design doc) ----------------
function Group({ cap, count, amber, note, children }) {
  return (
    <div className="cmd-group">
      <div className={'cmd-cap' + (amber ? ' amber' : '')}>{cap}{count != null && <em className="cmd-ct">{count}</em>}</div>
      <div className={'cmd-list' + (amber ? ' amber' : '')}>{children}</div>
      {note && <p className="cmd-note">{note}</p>}
    </div>
  );
}
function Row({ icon, label, sub, trail, tap, onClick }) {
  return (
    <div className={'cmd-row' + (tap ? ' tap' : '')} onClick={tap ? onClick : undefined}>
      {icon && <span className="cmd-ico">{icon}</span>}
      <div className="cmd-rc"><span className="cmd-rl">{label}</span>{sub && <span className="cmd-rs">{sub}</span>}</div>
      {trail && <div className="cmd-trail">{trail}</div>}
    </div>
  );
}
function Toggle({ on, onClick, color }) {
  return (
    <button type="button" className={'cmd-tog' + (on ? ' on' : '')} style={color ? { '--togc': color } : undefined}
      onClick={onClick} role="switch" aria-checked={on}>
      <i />
    </button>
  );
}
// value/min/max are the DISPLAY-domain numbers (e.g. 0-100 for a % slider);
// `onChange` receives that same display-domain number — the caller converts.
function Slider({ icon, label, value, min, max, step, unit, disabled, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  const disp = unit === '%' ? Math.round(value) + '%' : Number(value).toFixed(1) + (unit || '');
  return (
    <div className={'cmd-row' + (disabled ? ' dim' : '')}>
      {icon && <span className="cmd-ico">{icon}</span>}
      <span className="cmd-rl cmd-sl-label">{label}</span>
      <div className="cmd-sl">
        <div className="cmd-track">
          <div className="cmd-fill" style={{ width: pct + '%' }} />
          <div className="cmd-thumb" style={{ left: pct + '%' }} />
          <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
        </div>
        <span className="cmd-val">{disp}</span>
      </div>
    </div>
  );
}
function Disclosure({ icon, label, sub, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="cmd-row tap" onClick={() => setOpen((o) => !o)}>
        {icon && <span className="cmd-ico">{icon}</span>}
        <div className="cmd-rc"><span className="cmd-rl">{label}</span>{sub && <span className="cmd-rs">{sub}</span>}</div>
        <span className={'cmd-chev' + (open ? ' open' : '')}>›</span>
      </div>
      {open && <div className="cmd-disc-body">{children}</div>}
    </>
  );
}
function ActionButton({ icon, label, intent, onClick }) {
  return <button type="button" className={'cmd-act' + (intent ? ' ' + intent : '')} onClick={onClick}>{icon} {label}</button>;
}

// ---------------- tabs ----------------
function HeroTab({ hero }) {
  if (!hero) return null;
  return (
    <div className="cmd-panel">
      <UnitCard card={hero.card} wallet={hero.wallet} onWalletTap={hero.onWalletTap} />
      {hero.wallet && (
        <p className="cmd-note">🌸 runs the farm (every action earns it) · 🪵🪨 gathered for upgrades · 💎 learning-earned, cosmetics only.</p>
      )}
      {hero.kins && (
        <Group cap="Active Kin" count={hero.kins.length + '/6'}>
          <div className="cmd-kins">
            {hero.kins.length
              ? hero.kins.map((k) => (
                  <span className="cmd-kin" key={k.id} style={{ '--kc': k.color || '#8b5cf6' }} title={(k.name || 'Kin') + (k.task ? ' · ' + k.task : '')}>
                    <i />{k.name || 'Kin'}{k.task ? <b>{k.task === 'water' ? '💧' : '🌾'}</b> : null}
                  </span>
                ))
              : <p className="cmd-note" style={{ margin: '4px 0' }}>No Kin on the farm yet — befriend them in ArgantaLab.</p>}
          </div>
        </Group>
      )}
      {hero.onOpenCharacter && (
        <Group cap="Character">
          <Row tap icon="🎭" label="Open character sheet" sub="Equipment · skills · paper-doll"
            trail={<span className="cmd-chev">›</span>} onClick={hero.onOpenCharacter} />
        </Group>
      )}
    </div>
  );
}

function CircleTab({ circle, confirmCircle, setConfirmCircle }) {
  if (!circle) return null;
  const { live, syncDebug, circles, activeCircleId, onSelectCircle, onOpenLive, locationLabel, operator } = circle;
  return (
    <div className="cmd-panel">
      {live && (
        <Group cap="Live now">
          <Row tap icon="🟢" label={live.count > 0 ? live.count + ' live' + (live.names?.length ? ' · ' + live.names.join(', ') : '') : '0 live (solo)'}
            sub="tap to see who's here" trail={<span className="cmd-chev">›</span>} onClick={onOpenLive} />
          {operator && (
            <Disclosure icon={<IconWrench size={17} />} label="Diagnostics" sub="operator only">
              <div className="cmd-code">
                {syncDebug
                  ? <>ch:{syncDebug.status}{syncDebug.subscribed ? '✓' : '✗'} · ws:{syncDebug.socket} · peers:{syncDebug.peers} · heard:{syncDebug.lastPeerAgoS < 0 ? 'never' : syncDebug.lastPeerAgoS + 's ago'} · s:{syncDebug.session}</>
                  : 'no diagnostics for this world'}
              </div>
            </Disclosure>
          )}
        </Group>
      )}
      {circles && onSelectCircle && (
        <Group cap="Your circles" count={circles.length || 1}>
          {circles.length === 0 && (
            <div className="cmd-crow act">
              <span className="cmd-cdot2" />
              <div className="cmd-cname"><b>Personal farm</b><small>no circle — just you</small></div>
              <span className="cmd-cact">Active</span>
            </div>
          )}
          {circles.map((c) => {
            const isActive = c.id === activeCircleId;
            return (
              <div key={c.id} className={'cmd-crow' + (isActive ? ' act' : '')}>
                <span className="cmd-cdot2" />
                <div className="cmd-cname"><b>{c.emoji || '👥'} {c.name}</b><small>{c.memberCount} member{c.memberCount === 1 ? '' : 's'}{c.isOwner ? ' · you lead' : ''}</small></div>
                {isActive ? <span className="cmd-cact">Active</span> : <button type="button" className="cmd-csw" onClick={() => setConfirmCircle(c)}>Switch</button>}
              </div>
            );
          })}
          {activeCircleId && circles.length > 0 && (
            <div className="cmd-crow">
              <span className="cmd-cdot2 pers" />
              <div className="cmd-cname"><b>🏡 Personal farm</b><small>just you, no circle</small></div>
              <button type="button" className="cmd-csw" onClick={() => setConfirmCircle({ id: null, name: 'Personal farm' })}>Switch</button>
            </div>
          )}
          {confirmCircle && (
            <div className="cmd-confirm">
              <p>Switch to <b>{confirmCircle.name}</b>? Your farm view changes — nothing is lost.</p>
              <div className="cmd-confirm-row">
                <button type="button" className="cmd-cc-no" onClick={() => setConfirmCircle(null)}>Cancel</button>
                <button type="button" className="cmd-cc-yes" onClick={() => { onSelectCircle(confirmCircle.id); setConfirmCircle(null); }}>Switch</button>
              </div>
            </div>
          )}
        </Group>
      )}
      {locationLabel && (
        <Group cap="Location">
          <Row icon={<IconPin size={17} />} label={locationLabel} />
        </Group>
      )}
    </div>
  );
}

function PlayTab({ play }) {
  if (!play) return null;
  return (
    <div className="cmd-panel">
      {play.worldActions?.length > 0 && (
        <Group cap="This world">
          <div className="cmd-actstack">
            {play.worldActions.map((a) => (
              <ActionButton key={a.id} icon={a.icon} label={a.label} intent={a.intent === 'danger' ? 'danger' : undefined} onClick={a.onClick} />
            ))}
          </div>
        </Group>
      )}
      {(play.speed || play.zoom) && (
        <Group cap="Controls">
          {play.speed && (
            <Slider icon={<IconSpeed size={18} />} label="Speed" unit="×"
              value={play.speed.value} min={play.speed.min} max={play.speed.max} step={play.speed.step}
              onChange={play.speed.onChange} />
          )}
          {play.zoom && (
            <Slider icon={<IconZoom size={18} />} label="Zoom" unit="×"
              value={play.zoom.value} min={play.zoom.min} max={play.zoom.max} step={play.zoom.step}
              onChange={play.zoom.onChange} />
          )}
        </Group>
      )}
      {play.skin && (
        <Group cap="Action skin" count={skinOf(play.skin.activeId).name}>
          <div className="cmd-swatches">
            {play.skin.list.map((s) => (
              <button key={s.id} type="button" className={'cmd-sw' + (s.id === play.skin.activeId ? ' on' : '')} style={s.vars}
                onClick={() => play.skin.onPick(s.id)} title={s.name}>
                <span className="cmd-orbs">
                  <i className="cmd-o s"><GameIcon name={s.icons.single} size={15} /></i>
                  <i className="cmd-o a"><GameIcon name={s.icons.attack} size={22} /></i>
                  <i className="cmd-o s"><GameIcon name={s.icons.heal} size={15} /></i>
                </span>
                <b>{s.name}</b>
                <small>{s.blurb}</small>
              </button>
            ))}
          </div>
          <p className="cmd-note">Repaints the battle buttons (bottom-right). Each skin uses a different game-icons set.</p>
        </Group>
      )}
      {play.emotes && (
        <Group cap="Favorite emotes" count={play.emotes.favorites.length + '/' + play.emotes.max}>
          <div className="cmd-chips">
            {play.emotes.all.map((name) => {
              const on = play.emotes.favorites.includes(name);
              const full = !on && play.emotes.favorites.length >= play.emotes.max;
              return (
                <button key={name} type="button" className={'cmd-em' + (on ? ' on' : '') + (full ? ' dis' : '')} disabled={full}
                  onClick={() => play.emotes.onSet(on ? play.emotes.favorites.filter((e) => e !== name) : [...play.emotes.favorites, name])}>
                  <span className="cmd-eg">{EMOTE_EMOJI[name] || '❔'}</span>
                  <span className="cmd-en">{name}</span>
                </button>
              );
            })}
          </div>
          <p className="cmd-note">Pick up to {play.emotes.max} — tap the Emote orb (bottom-right, above Mount) to fan them out.</p>
        </Group>
      )}
    </div>
  );
}

function SoundTab({ sound, sfxMuted, setSfxMuted, sfxVol, setSfxVol, ambOn, setAmbOn, ambVol, setAmbVol }) {
  return (
    <div className="cmd-panel">
      <Group cap="Effects">
        <Row icon={<IconSpeaker size={18} />} label="Sound effects"
          trail={<Toggle on={!sfxMuted} color="#5ec27a" onClick={() => { const m = !sfxMuted; setSfxMuted(m); sfx.setMuted(m); if (!m) sfx.play('tap'); }} />} />
        <Slider label="Volume" unit="%" disabled={sfxMuted} value={Math.round(sfxVol * 100)} min={0} max={100} step={5}
          onChange={(v) => { const nv = v / 100; setSfxVol(nv); sfx.setVolume(nv); }} />
      </Group>
      <Group cap="Music & ambience" note={sound?.hqTuned ? '♪ Cues tuned in Circle HQ · Music Builder.' : null}>
        <Row icon={<IconMusic size={18} />} label="Ambience & music"
          trail={<Toggle on={ambOn} color="#5ec27a" onClick={() => { const on = !ambOn; setAmbOn(on); ambient.setEnabled(on); }} />} />
        <Slider label="Volume" unit="%" disabled={!ambOn} value={Math.round(ambVol * 100)} min={0} max={100} step={5}
          onChange={(v) => { const nv = v / 100; setAmbVol(nv); ambient.setVolume(nv); }} />
      </Group>
    </div>
  );
}

function SystemTab({ system }) {
  return (
    <div className="cmd-panel">
      <Group cap="How to play" note={system?.help || null}>
        <Disclosure icon="🎮" label="Controls & tips">
          <div className="cmd-kbd">
            <div><b>Move</b>drag anywhere</div>
            <div><b>Interact</b>tap a tile</div>
            <div><b>Tile menu</b>long-press</div>
            <div><b>Attack / act</b>the big orb, bottom-right</div>
          </div>
        </Disclosure>
      </Group>
      {system?.dev && (
        <Group cap="Operator ⚡" amber>
          <Row icon={<IconGear size={17} />} label="Map overlay" sub="🟩 walk · 🟥 no-walk"
            trail={<Toggle on={system.dev.overlayOn} color="#f0a83a" onClick={system.dev.onToggleOverlay} />} />
        </Group>
      )}
      {system?.account && (
        <Group cap="Account">
          <div className="cmd-actstack">
            <ActionButton icon={<IconDoor size={16} />} label="Sign out" intent="danger" onClick={system.account.onSignOut} />
          </div>
        </Group>
      )}
      <p className="cmd-note" style={{ textAlign: 'center' }}>LashiraBloom{system?.version ? ' · ' + system.version : ''} · your hero walks every ArgantaLab world</p>
    </div>
  );
}

// ---------------- the shell ----------------
export function SettingsSheet({ world, hero, circle, play, sound, system, onExit, onClose }) {
  const [tab, setTab] = useState('hero');
  const [sfxMuted, setSfxMuted] = useState(() => sfx.isMuted());
  const [sfxVol, setSfxVol] = useState(() => sfx.getVolume());
  const [ambOn, setAmbOn] = useState(() => ambient.isEnabled());
  const [ambVol, setAmbVol] = useState(() => ambient.getVolume());
  const [confirmCircle, setConfirmCircle] = useState(null);

  const worldColor = world?.color || '#8b5cf6';

  return (
    <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="cmd-sheet" style={{ '--world': worldColor }} role="dialog" aria-modal="true" aria-label="Settings">
        <div className="cmd-head">
          <span className="cmd-wchip"><span className="cmd-cdot" />{world?.name || 'Settings'}</span>
          {world?.operator && <span className="cmd-opbadge">⚡ OPERATOR</span>}
          <button type="button" className="cmd-closex" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cmd-body">
          <div className="cmd-rail" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                className={'cmd-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
                <span className="cmd-ti">{t.icon}</span>
                <span className="cmd-tl">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="cmd-pane">
            {tab === 'hero' && <HeroTab hero={hero} />}
            {tab === 'circle' && <CircleTab circle={circle} confirmCircle={confirmCircle} setConfirmCircle={setConfirmCircle} />}
            {tab === 'play' && <PlayTab play={play} />}
            {tab === 'sound' && (
              <SoundTab sound={sound} sfxMuted={sfxMuted} setSfxMuted={setSfxMuted} sfxVol={sfxVol} setSfxVol={setSfxVol}
                ambOn={ambOn} setAmbOn={setAmbOn} ambVol={ambVol} setAmbVol={setAmbVol} />
            )}
            {tab === 'system' && <SystemTab system={system} />}
          </div>
        </div>
        {onExit && (
          <div className="cmd-foot">
            <ActionButton icon={<IconDoor size={16} />} label={system?.exitLabel || 'Exit to Kingdom'} intent="prim"
              onClick={() => { onClose?.(); onExit(); }} />
          </div>
        )}
      </div>
    </div>
  );
}

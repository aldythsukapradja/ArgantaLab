// Character Lab — Composer.
// SKIN = the two true base bodies (#0/#1). ARMOR = one unified collection:
// every coat and every dressed body (id ≥ 2) — dressed bodies replace
// skin+coat when equipped. Loadout persists in localStorage. A practice
// ground beside the pickers mirrors the arena's player mechanics.
import { useEffect, useMemo, useRef, useState } from 'react';
import CompositeStage from '../components/CompositeStage.jsx';
import AccountBar from '../components/AccountBar.jsx';
import PartBrowser from './PartBrowser.jsx';
import DyePicker from './DyePicker.jsx';
import PracticePad from './PracticePad.jsx';
import SkillBrowser from './SkillBrowser.jsx';
import * as data from '../engine/data.js';

const DIRECTIONS = ['South', 'East', 'North', 'West'];
const ACTIONS = [
  { label: 'Stand', base: 'NormalStandBy' },
  { label: 'Walk', base: 'NormalWalk' },
  { label: 'Swing', base: 'Swing' },
  { label: 'Pierce', base: 'Pierce' },
  { label: 'Shoot', base: 'Shoot' },
  { label: 'Take', base: 'Get' },
  { label: 'Spell', base: 'Spell' },
  { label: 'Ride', base: 'Riding' },
  { label: 'Bow', base: 'Bow' },
];
const EMOTES = ['Victory', 'Smile', 'Cry', 'Blush', 'Wink', 'Yawn', 'Sleep',
  'Surprise', 'Angry', 'Merong', 'Kongi', 'Pish', 'Dance', 'Cold', 'HandToMouth'];

const SKIN_IDS = [0, 1];               // the only true unclothed bodies
const STORE_KEY = 'kingdom_lab_state_v2';
const MOUNT_NAMES = { 0: 'Horse' };     // id 0 is confirmed present in every install
const mountLabel = (id) => MOUNT_NAMES[id] || `mount #${id}`;
const PATHS = [
  { id: 'warrior', label: 'Warrior' },
  { id: 'mage', label: 'Mage' },
  { id: 'poet', label: 'Poet' },
  { id: 'rogue', label: 'Rogue' },
];
const DEFAULT_SKILLS = [{ fx: 22, skillId: null }, { fx: 1, skillId: null }, { fx: 131, skillId: null }];
const normalizeSkills = (skills) => DEFAULT_SKILLS.map((def, i) => ({
  fx: Number.isFinite(Number(skills?.[i]?.fx)) ? Number(skills[i].fx) : def.fx,
  skillId: typeof skills?.[i]?.skillId === 'string' ? skills[i].skillId : null,
  name: typeof skills?.[i]?.name === 'string' ? skills[i].name : null,
  path: typeof skills?.[i]?.path === 'string' ? skills[i].path : null,
  manaCost: Number.isFinite(Number(skills?.[i]?.manaCost)) ? Number(skills[i].manaCost) : null,
  spellType: typeof skills?.[i]?.spellType === 'string' ? skills[i].spellType : null,
}));

const DEFAULTS = {
  sel: {
    body: { cat: 'body', id: 0, palette: null },
    face: { cat: 'face', id: 0, palette: null },
    hair: { cat: 'hair', id: 0, palette: null },
    coat: { cat: 'coat', id: 2, palette: null },
  },
  mountOn: false, mountId: 0,
};

const SLOT_DEFS = [
  { key: 'face', cat: 'face', label: 'Face', group: 'Head' },
  { key: 'hair', cat: 'hair', label: 'Hair', group: 'Head', optional: true },
  { key: 'helmet', cat: 'helmet', label: 'Helmet', group: 'Head', optional: true },
  { key: 'facedec', cat: 'facedec', label: 'Face deco', group: 'Head', optional: true },
  { key: 'hairdec', cat: 'hairdec', label: 'Hair deco', group: 'Head', optional: true },
  { key: 'skin', special: 'skin', label: 'Skin', group: 'Body & Armor' },
  { key: 'armor', special: 'armor', label: 'Armor', group: 'Body & Armor' },
  { key: 'shoes', cat: 'shoes', label: 'Shoes', group: 'Body & Armor', optional: true },
  { key: 'mantle', cat: 'mantle', label: 'Mantle', group: 'Body & Armor', optional: true },
  { key: 'neck', cat: 'neck', label: 'Necklace', group: 'Body & Armor', optional: true },
  { key: 'weapon', cat: 'sword', label: 'Weapon', group: 'Weapon', optional: true, cats: ['sword', 'spear', 'bow', 'fan'] },
  { key: 'shield', cat: 'shield', label: 'Shield', group: 'Weapon', optional: true },
];
const GROUPS = ['Head', 'Body & Armor', 'Weapon', 'Mount', 'Path', 'Skills'];

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s?.sel?.body) return s;
  } catch { /* fresh */ }
  return null;
}

function useCategoryData(cats) {
  const [meta, setMeta] = useState({});
  useEffect(() => {
    let live = true;
    (async () => {
      const out = {};
      await Promise.all(cats.map(async (c) => {
        try {
          const [parts, palettes] = await Promise.all([data.charParts(c), data.charPalettes(c)]);
          out[c] = { parts, byId: Object.fromEntries(parts.map((p) => [p.id, p])), palettes: palettes.length };
        } catch { out[c] = { parts: [], byId: {}, palettes: 0 }; }
      }));
      if (live) setMeta(out);
    })();
    return () => { live = false; };
  }, [cats.join(',')]);
  return meta;
}

export default function CharacterLab({
  onSpec,
  account,
  onClaimed,
  onSignOut,
  onSaveBuild,
  onResetBuild,
  onRenameGuardian,
}) {
  const saved = useMemo(loadSaved, []);
  const [sel, setSel] = useState(saved?.sel || DEFAULTS.sel);
  const [mountOn, setMountOn] = useState(saved?.mountOn || false);
  const [mountId, setMountId] = useState(saved?.mountId || 0);
  const [mountCount, setMountCount] = useState(0);
  const [effects, setEffects] = useState([]);
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [skillPath, setSkillPath] = useState(account?.character?.path_id || account?.character?.pathId || 'warrior');
  const [skills, setSkills] = useState(normalizeSkills(saved?.skills));
  const [skillTest, setSkillTest] = useState(null);
  const [action, setAction] = useState('NormalStandBy');
  const [emote, setEmote] = useState('');
  const [dir, setDir] = useState('South');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(3);
  const [frameInfo, setFrameInfo] = useState('');
  const [browse, setBrowse] = useState(null);
  const [skillBrowse, setSkillBrowse] = useState(null);
  const [dyeFor, setDyeFor] = useState(null);
  const [dyeAnchor, setDyeAnchor] = useState(null);

  const allCats = useMemo(
    () => [...new Set(['body', 'coat', ...SLOT_DEFS.flatMap((s) => s.cats || (s.cat ? [s.cat] : []))])], []
  );
  const meta = useCategoryData(allCats);
  useEffect(() => {
    data.mounts().then((m) => {
      setMountCount(m.length);
      // guard against a stale/out-of-range saved id — horse (#0) is always valid
      setMountId((id) => (id >= 0 && id < m.length ? id : 0));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    data.effects().then(setEffects).catch(() => setEffects([]));
  }, []);
  useEffect(() => {
    data.loadJson(data.dataUrl('/data/core/skills.json')).then(setSkillCatalog).catch(() => setSkillCatalog([]));
  }, []);
  useEffect(() => {
    setSkillPath(account?.character?.path_id || account?.character?.pathId || 'warrior');
  }, [account?.character?.id, account?.character?.path_id, account?.character?.pathId]);

  // persist loadout across pages/sessions
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ sel, mountOn, mountId, skills }));
  }, [sel, mountOn, mountId, skills]);

  function applySpec(nextSpec, fallbackToDefaults = false) {
    const incoming = nextSpec && typeof nextSpec === 'object' ? nextSpec : null;
    if (!incoming || !Object.keys(incoming).length) {
      if (fallbackToDefaults) {
        setSel(DEFAULTS.sel);
        setMountOn(false);
        setMountId(0);
        setSkills(DEFAULT_SKILLS);
      }
      return;
    }
    const { mount, skills: incomingSkills, ...parts } = incoming;
    if (parts.body) setSel(parts);
    else if (fallbackToDefaults) setSel(DEFAULTS.sel);
    setMountOn(!!mount);
    setMountId(mount?.id ?? 0);
    setSkills(normalizeSkills(incomingSkills));
  }

  // Apply the cloud loadout to the composer ONLY when the host explicitly
  // signals it via account.applyToken (bumped on login and on Reset). Applying
  // on every cloudSpec change caused an infinite blink loop: an auto-saved
  // draft echoes back into account.cloudSpec, which re-hydrated here, which
  // re-emitted the spec, which saved again... Gating on the token means normal
  // edits/auto-saves never re-hydrate, but login and Reset still do.
  const applyToken = account?.applyToken ?? 0;
  useEffect(() => {
    const cs = account?.cloudSpec;
    if (cs) applySpec(cs, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyToken]);

  const bodyParts = meta.body?.parts || [];
  const skinParts = useMemo(() => bodyParts.filter((p) => SKIN_IDS.includes(p.id)), [bodyParts]);
  const armorBodies = useMemo(() => bodyParts.filter((p) => !SKIN_IDS.includes(p.id)), [bodyParts]);
  const bodyIsArmor = !SKIN_IDS.includes(sel.body?.id ?? 0);

  const armorEntries = useMemo(() => {
    const out = [];
    for (const p of meta.coat?.parts || []) {
      out.push({ key: `coat:${p.id}`, cat: 'coat', part: p, label: `armor c${p.id}`, group: `armor set ${Math.floor(p.frame_index / 2600)}` });
    }
    for (const p of armorBodies) {
      out.push({ key: `body:${p.id}`, cat: 'body', part: p, label: `armor b${p.id}`, group: `armor set B${Math.floor(p.frame_index / 2600)}` });
    }
    return out;
  }, [meta.coat, armorBodies]);

  const armorValue = bodyIsArmor ? `body:${sel.body?.id}` : sel.coat ? `coat:${sel.coat.id}` : null;
  const armorLabel = bodyIsArmor ? `armor b${sel.body.id}` : sel.coat ? `armor c${sel.coat.id}` : '— none —';

  function pickArmor(entry) {
    setSel((prev) => {
      const next = { ...prev };
      if (entry.cat === 'coat') {
        if (!SKIN_IDS.includes(next.body?.id)) next.body = { cat: 'body', id: 0, palette: null };
        next.coat = { cat: 'coat', id: entry.part.id, palette: next.coat?.palette ?? null };
      } else {
        next.body = { cat: 'body', id: entry.part.id, palette: null };
        delete next.coat;
      }
      return next;
    });
  }
  function pickSkin(entry) {
    setSel((prev) => {
      const next = { ...prev, body: { cat: 'body', id: entry.part.id, palette: prev.body?.palette ?? null } };
      if (!next.coat) next.coat = { cat: 'coat', id: 2, palette: null }; // leaving armor-body: wear something
      return next;
    });
  }
  function pickSlot(slotKey, entry) {
    setSel((prev) => ({ ...prev, [slotKey]: { cat: entry.cat, id: entry.part.id, palette: prev[slotKey]?.palette ?? null } }));
  }
  function toggle(slot) {
    setSel((prev) => {
      const nxt = { ...prev };
      if (nxt[slot.key]) delete nxt[slot.key];
      else nxt[slot.key] = { cat: slot.cat, id: meta[slot.cat]?.parts[0]?.id ?? 0, palette: null };
      return nxt;
    });
  }
  function stepEntry(entries, curKey, delta, pickFn) {
    if (!entries.length) return;
    const i = entries.findIndex((e) => e.key === curKey);
    pickFn(entries[(i + delta + entries.length) % entries.length]);
  }
  async function reset() {
    if (account?.character && onResetBuild) {
      const state = await onResetBuild();
      const next = state?.draftSpec || account?.syncedSpec || null;
      applySpec(next, true);
      setAction('NormalStandBy'); setEmote(''); setDir('South');
      setSpeed(1); setScale(3); setPlaying(true);
      return;
    }
    localStorage.removeItem(STORE_KEY);
    setSel(DEFAULTS.sel);
    setMountOn(false); setMountId(0);
    setSkills(DEFAULT_SKILLS);
    setAction('NormalStandBy'); setEmote(''); setDir('South');
    setSpeed(1); setScale(3); setPlaying(true);
  }

  const availableEffects = useMemo(() => effects.filter((e) => e?.sheet && e?.animation?.length), [effects]);
  const effectById = useMemo(() => Object.fromEntries(availableEffects.map((e) => [e.id, e])), [availableEffects]);
  const skillLabel = (fx) => effectById[fx] ? `effect #${String(fx).padStart(3, '0')}` : `effect #${fx}`;
  function setSkillFx(slot, fx) {
    setSkills((arr) => arr.map((s, i) => (i === slot ? { ...s, fx } : s)));
  }
  function setSkillScrape(slot, skillId) {
    const entry = skillCatalog.find((s) => s.id === skillId);
    setSkills((arr) => arr.map((s, i) => {
      if (i !== slot) return s;
      if (!entry) return { ...s, skillId: null, name: null, path: null, manaCost: null, spellType: null };
      return {
        ...s,
        skillId: entry.id,
        name: entry.name,
        path: entry.path,
        manaCost: entry.manaCost ?? null,
        spellType: entry.spellType ?? null,
      };
    }));
  }
  function stepSkill(slot, delta) {
    if (!availableEffects.length) return;
    const cur = skills[slot]?.fx ?? DEFAULT_SKILLS[slot]?.fx ?? availableEffects[0].id;
    const i = availableEffects.findIndex((e) => e.id === cur);
    const next = availableEffects[(i + delta + availableEffects.length) % availableEffects.length] || availableEffects[0];
    setSkillFx(slot, next.id);
  }
  function testSkillFx(fx) {
    setSkillTest({ fx, nonce: performance.now() });
  }

  const accountLevel = Number(account?.profile?.level || 1);
  const pathSkills = useMemo(() => skillCatalog
    .filter((s) => (s.pathSlug || s.path || '').toLowerCase() === skillPath)
    .filter((s) => Number(s.levelNumber || 0) <= accountLevel || !Number.isFinite(Number(s.levelNumber)))
    .sort((a, b) => (Number(a.levelNumber || 0) - Number(b.levelNumber || 0)) || a.name.localeCompare(b.name)),
    [skillCatalog, skillPath, accountLevel]);

  const hasWeapon = !!sel.weapon;
  let effAction = action;
  if (hasWeapon && action === 'NormalStandBy') effAction = 'WeaponStandBy';
  if (hasWeapon && action === 'NormalWalk') effAction = 'WeaponWalk';
  const motionName = emote || effAction + dir;

  const spec = useMemo(() => {
    const s = { ...sel, skills };
    if (mountOn) s.mount = { id: mountId };
    return s;
  }, [sel, mountOn, mountId, skills]);
  useEffect(() => { onSpec?.(spec); }, [spec]);
  useEffect(() => { if (mountOn && action !== 'Riding') setAction('Riding'); }, [mountOn]);

  function entriesFor(slot) {
    if (slot.special === 'skin') {
      return skinParts.map((p, i) => ({
        key: `body:${p.id}`, cat: 'body', part: p,
        label: `skin ${p.id === 0 ? 'A' : 'B'}`, group: 'skins',
      }));
    }
    if (slot.special === 'armor') return armorEntries;
    const cats = slot.cats || [slot.cat];
    const out = [];
    for (const c of cats) {
      for (const p of meta[c]?.parts || []) {
        const bankSize = ['face', 'hair', 'helmet', 'facedec', 'hairdec'].includes(c) ? 1000 : 2600;
        out.push({ key: `${c}:${p.id}`, cat: c, part: p, label: `${c} #${p.id}`, group: `${c} · set ${Math.floor(p.frame_index / bankSize)}` });
      }
    }
    return out;
  }
  function currentKeyFor(slot) {
    if (slot.special === 'skin') return !bodyIsArmor && sel.body ? `body:${sel.body.id}` : null;
    if (slot.special === 'armor') return armorValue;
    const cur = sel[slot.key];
    return cur ? `${cur.cat}:${cur.id}` : null;
  }
  function labelFor(slot) {
    if (slot.special === 'skin') return bodyIsArmor ? '(armor body active)' : `skin ${sel.body?.id === 0 ? 'A' : 'B'}`;
    if (slot.special === 'armor') return armorLabel;
    const cur = sel[slot.key];
    return cur ? `${cur.cat} #${cur.id}` : '— none —';
  }
  function pickFor(slot) {
    if (slot.special === 'skin') return pickSkin;
    if (slot.special === 'armor') return pickArmor;
    return (e) => pickSlot(slot.key, e);
  }
  const dyeTarget = (slotKey) =>
    slotKey === 'skin' ? 'body'
    : slotKey === 'armor' ? (bodyIsArmor ? 'body' : 'coat')
    : slotKey;

  return (
    <div className="lab">
      <div className="stage-col card">
        {account && (
          <AccountBar
            account={account}
            onClaimed={onClaimed}
            onSignOut={onSignOut}
            onSaveBuild={onSaveBuild}
            onResetBuild={onResetBuild}
            onRenameGuardian={onRenameGuardian}
          />
        )}
        <div className="stage-frame">
          <CompositeStage
            spec={spec} motionName={motionName} playing={playing}
            scale={scale} speed={speed} width={360} height={330}
            onStep={(i, n) => setFrameInfo(`step ${i + 1}/${n} · ${motionName}`)}
          />
        </div>
        <div className="stage-info">{frameInfo}</div>
        <div className="btnrow">
          {ACTIONS.map((a) => (
            <button key={a.base} className={action === a.base && !emote ? 'on' : ''}
              onClick={() => { setEmote(''); setAction(a.base); }}>{a.label}</button>
          ))}
          <select value={emote} onChange={(e) => setEmote(e.target.value)}>
            <option value="">Emote…</option>
            {EMOTES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="btnrow">
          {DIRECTIONS.map((d) => (
            <button key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>{d[0]}</button>
          ))}
          <button onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
          <label>speed <input type="range" min="0.25" max="2" step="0.25" value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))} /></label>
          <label>zoom <input type="range" min="1" max="5" step="1" value={scale}
            onChange={(e) => setScale(Number(e.target.value))} /></label>
          <button className="danger" onClick={reset}>Reset to synced</button>
        </div>
      </div>

      <div className="picker-col">
        {GROUPS.map((group) => (
          <section key={group} className="card">
            <h3>{group}</h3>
            {group === 'Mount' ? (
              <div className="slotrow">
                <label className="slotlabel"><input type="checkbox" checked={mountOn} onChange={(e) => setMountOn(e.target.checked)} /> Ride</label>
                <button onClick={() => setMountId((m) => (m - 1 + mountCount) % Math.max(1, mountCount))}>◀</button>
                <span className="slotval">{mountLabel(mountId)} <small>/{mountCount}</small></span>
                <button onClick={() => setMountId((m) => (m + 1) % Math.max(1, mountCount))}>▶</button>
                {mountId !== 0 && (
                  <button title="back to the default horse" onClick={() => setMountId(0)}>🐎 Horse</button>
                )}
              </div>
            ) : group === 'Path' ? (
              <div className="path-panel">
                <div className="path-truth">
                  <small>Character path from DB</small>
                  <b>{PATHS.find((p) => p.id === (account?.character?.path_id || account?.character?.pathId))?.label || 'Warrior'}</b>
                  <span>Spell list unlocks use ArgantaLab Level {accountLevel}.</span>
                </div>
                <div className="path-pills">
                  {PATHS.map((p) => (
                    <button key={p.id} className={skillPath === p.id ? 'on' : ''} onClick={() => setSkillPath(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : group === 'Skills' ? (
              <>
                {skills.map((skill, i) => (
                  <div className="slotrow skill-slotrow" key={i}>
                    <label className="slotlabel"><span className="dot" /> Skill {i + 1}</label>
                    <select className="skill-source" value={skill.skillId || ''} onChange={(e) => setSkillScrape(i, e.target.value)}>
                      <option value="">Client effect only</option>
                      {pathSkills.map((s) => (
                        <option key={s.id} value={s.id}>
                          Lv {s.levelNumber || '?'} · {s.name} · {s.spellType || 'spell'}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => stepSkill(i, -1)}>◀</button>
                    <button className="browse-btn" onClick={() => setSkillBrowse({ slot: i })}>
                      {skillLabel(skill.fx)} <span className="caret">▦</span>
                    </button>
                    <button onClick={() => stepSkill(i, +1)}>▶</button>
                    <button onClick={() => testSkillFx(skill.fx)}>test</button>
                    {skill.name && <small className="skill-picked">{skill.name} · {skill.manaCost ?? 0} MP</small>}
                  </div>
                ))}
                <p className="skill-help">Each slot saves both a scraped spell identity and a client visual effect. The arena 1/2/3 buttons use this saved build.</p>
              </>
            ) : (
              SLOT_DEFS.filter((s) => s.group === group).map((slot) => {
                const curKey = currentKeyFor(slot);
                const on = slot.special ? true : !!sel[slot.key];
                const dtKey = dyeTarget(slot.key);
                const dtCat = sel[dtKey]?.cat || (dtKey === 'body' ? 'body' : slot.cat);
                const dyeable = on && !!sel[dtKey] && (meta[dtCat]?.palettes ?? 0) > 1;
                // Selecting always works: any picker interaction on an
                // unequipped optional slot equips it (ticks the box itself).
                const pickAndEquip = pickFor(slot);
                return (
                  <div className="slotrow" key={slot.key}>
                    <label className="slotlabel">
                      {slot.optional
                        ? <input type="checkbox" checked={on} onChange={() => toggle(slot)} />
                        : <span className="dot" />}
                      {slot.label}
                    </label>
                    <button onClick={() => stepEntry(entriesFor(slot), curKey, -1, pickAndEquip)}>◀</button>
                    <button className="browse-btn" onClick={() => setBrowse({ slot })}>
                      {labelFor(slot)} <span className="caret">▦</span>
                    </button>
                    <button onClick={() => stepEntry(entriesFor(slot), curKey, +1, pickAndEquip)}>▶</button>
                    {dyeable && (
                      <button className="dye" title="pick color"
                        onClick={(e) => { setDyeFor(slot.key); setDyeAnchor(e.currentTarget.getBoundingClientRect()); }}>🎨</button>
                    )}
                  </div>
                );
              })
            )}
          </section>
        ))}
      </div>

      <div className="pad-col card">
        <PracticePad spec={spec} skills={skills} skillTest={skillTest} account={account} />
      </div>

      {browse && (
        <PartBrowser
          title={`${browse.slot.label} collection`}
          entries={entriesFor(browse.slot)}
          value={currentKeyFor(browse.slot)}
          onPick={pickFor(browse.slot)}
          onClose={() => setBrowse(null)}
        />
      )}
      {skillBrowse && (
        <SkillBrowser
          title={`Skill ${skillBrowse.slot + 1} effect`}
          effects={availableEffects}
          value={skills[skillBrowse.slot]?.fx}
          onPick={(entry) => {
            setSkillFx(skillBrowse.slot, entry.id);
            testSkillFx(entry.id);
          }}
          onTest={(entry) => testSkillFx(entry.id)}
          onClose={() => setSkillBrowse(null)}
        />
      )}
      {dyeFor && (() => {
        const target = dyeTarget(dyeFor);
        const cur = sel[target];
        if (!cur) return null;
        return (
          <DyePicker
            cat={cur.cat} part={meta[cur.cat]?.byId[cur.id]} value={cur.palette}
            anchorRect={dyeAnchor}
            onPick={(pal) => setSel((prev) => ({ ...prev, [target]: { ...prev[target], palette: pal } }))}
            onClose={() => setDyeFor(null)}
          />
        );
      })()}
    </div>
  );
}

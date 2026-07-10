import { useEffect, useMemo, useRef, useState } from 'react';
import * as engine from '../engine/data.js';
import HeroStage from './HeroStage.jsx';
import { loadShopCatalog } from '../net/cosmetics.js';
import {
  PATHS_META, DEFAULT_PATH, HORSE_MOUNTS, baseLookSel, buildSpec, saveOnboarding,
} from '../net/onboarding.js';
import './onboarding.css';

// The forced first-run wizard: Name → Path → Look → Ride → Confirm. Built on the
// shared ArgantaLab login chrome; the live preview is the SAME compositor the farm
// uses, so the hero here is the hero that walks the farm. One-time per player —
// completing it stamps the character so it never shows again (see onboarding.js).

const LOOK_SLOTS = [
  { key: 'hair', cat: 'hair', label: 'Hair' },
  { key: 'face', cat: 'face', label: 'Face' },
];
const STEPS = ['name', 'path', 'look', 'ride', 'confirm'];

// Offline/no-migration fallback — mirrors migration_character_shop.sql's real
// "Coat Set 1" rows exactly (part ids 33-42), so the picker shows genuine store
// items even before a network round trip completes. The live catalog (loaded
// below) always wins once it arrives; this is only ever a seed for a blank frame.
const FALLBACK_COAT_CATALOG = Array.from({ length: 10 }, (_, i) => ({
  itemKey: `coat:${33 + i}`, cat: 'coat', partId: 33 + i,
  setLabel: 'Coat Set 1', price: 2000 + i * 900,
}));

export default function Onboarding({ profile, onComplete, onExit }) {
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState((profile?.displayName || '').trim());
  const [path, setPath] = useState(DEFAULT_PATH);
  // sel.coat seeds straight from the fallback catalog's cheapest item (NOT
  // baseLookSel's coat:2 — that's a database fallback, never a real store item,
  // so the Outfit picker must never start on a value that isn't in its own list).
  const [sel, setSel] = useState(() => ({ ...baseLookSel(), coat: { cat: 'coat', id: FALLBACK_COAT_CATALOG[0].partId, palette: null } }));
  const [mountId, setMountId] = useState(0); // 0 = no ride
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ids, setIds] = useState({ hair: [], face: [] });
  // Outfit is restricted to the REAL Shop catalog (only what's actually
  // ownable/buyable), not the raw art-engine part list — whichever one is picked
  // gets granted free on finish (see saveOnboarding -> grantStarterOutfit).
  const [coatCatalog, setCoatCatalog] = useState(FALLBACK_COAT_CATALOG);
  const outfitTouched = useRef(false); // true once the player manually steps Outfit

  // Load the id lists for each look slot (offline → empty → steppers no-op).
  useEffect(() => {
    let live = true;
    (async () => {
      const out = { hair: [], face: [] };
      await Promise.all(['hair', 'face'].map(async (cat) => {
        try {
          const parts = await engine.charParts(cat);
          out[cat] = parts.map((p) => p.id);
        } catch { out[cat] = []; }
      }));
      if (live) setIds(out);
    })();
    return () => { live = false; };
  }, []);

  // Load the real store catalog, coat items only. Replaces the fallback seed
  // with the LIVE cheapest item once known — but only if the player hasn't
  // already stepped through the picker themselves (never clobber a real choice).
  useEffect(() => {
    let live = true;
    loadShopCatalog().then((items) => {
      if (!live) return;
      const coats = items.filter((i) => i.cat === 'coat').sort((a, b) => a.price - b.price);
      if (coats.length) {
        setCoatCatalog(coats);
        if (!outfitTouched.current) setSel((prev) => ({ ...prev, coat: { cat: 'coat', id: coats[0].partId, palette: null } }));
      }
    });
    return () => { live = false; };
  }, []);

  function stepOutfit(delta) {
    if (!coatCatalog.length) return;
    outfitTouched.current = true;
    setSel((prev) => {
      const i = coatCatalog.findIndex((c) => c.partId === prev.coat?.id);
      const next = coatCatalog[((i < 0 ? 0 : i) + delta + coatCatalog.length) % coatCatalog.length];
      return { ...prev, coat: { cat: 'coat', id: next.partId, palette: null } };
    });
  }
  const currentCoat = coatCatalog.find((c) => c.partId === sel.coat?.id) || coatCatalog[0];

  const riding = mountId > 0;
  const previewSpec = useMemo(() => buildSpec({ sel, path, mountId }), [sel, path, mountId]);
  const previewMotion = (STEPS[step] === 'ride' || STEPS[step] === 'confirm') && riding
    ? 'RidingSouth' : 'NormalStandBySouth';

  function stepSlot(slot, delta) {
    const list = ids[slot.cat];
    if (!list || !list.length) return;
    setSel((prev) => {
      const cur = prev[slot.key]?.id ?? list[0];
      const i = list.indexOf(cur);
      const nextId = list[((i < 0 ? 0 : i) + delta + list.length) % list.length];
      return { ...prev, [slot.key]: { cat: slot.cat, id: nextId, palette: null } };
    });
  }
  function randomize() {
    outfitTouched.current = true;
    setSel(() => {
      const next = baseLookSel();
      for (const slot of LOOK_SLOTS) {
        const list = ids[slot.cat];
        if (list && list.length) {
          next[slot.key] = { cat: slot.cat, id: list[Math.floor(Math.random() * list.length)], palette: null };
        }
      }
      if (coatCatalog.length) {
        const pick = coatCatalog[Math.floor(Math.random() * coatCatalog.length)];
        next.coat = { cat: 'coat', id: pick.partId, palette: null };
      }
      return next;
    });
  }

  const go = (n) => { setErr(''); setStep(n); };
  const nameOk = nickname.trim().length >= 2;

  async function finish() {
    setBusy(true); setErr('');
    const res = await saveOnboarding({ profile, nickname: nickname.trim(), path, sel, mountId });
    setBusy(false);
    if (!res.ok) { setErr(res.error || 'Could not save — please try again.'); return; }
    onComplete?.({ spec: res.spec, nickname: nickname.trim(), path, local: !!res.local });
  }

  const pathLabel = PATHS_META.find((p) => p.id === path)?.label || 'Warrior';
  const rideLabel = riding ? (HORSE_MOUNTS.find((m) => m.id === mountId)?.label || 'Horse') : 'None';
  const name = STEPS[step];

  return (
    <div className="ob-root">
      <div className="ob-card">
        <div className="ob-topbar">
          <div className="ob-dots">
            {STEPS.map((s, i) => <i key={s} className={i === step ? 'on' : ''} />)}
          </div>
          {onExit && <button className="ob-exit" onClick={onExit}>Sign out</button>}
        </div>

        {name === 'name' && (
          <div className="ob-step">
            <div className="ob-mark"><i /></div>
            <div className="ob-eyebrow">Welcome to</div>
            <h2 className="ob-h"><span className="grad-text">LashiraBloom</span></h2>
            <p className="ob-sub">Let's set up your hero — it takes a moment, then you're farming.</p>
            <input
              className="ob-field" value={nickname} maxLength={16} autoFocus
              placeholder="Pick a nickname…"
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && nameOk) go(1); }}
            />
            <p className="ob-sub" style={{ margin: '2px 0 14px', fontSize: 12 }}>This is the name your circle will see.</p>
            <button className="ob-cta" disabled={!nameOk} onClick={() => go(1)}>Next →</button>
          </div>
        )}

        {name === 'path' && (
          <div className="ob-step">
            <div className="ob-eyebrow">Step 1 of 3</div>
            <h2 className="ob-h">Pick your Path</h2>
            <p className="ob-sub">Every Path plays the farm a little differently.</p>
            <div className="ob-paths">
              {PATHS_META.map((p) => (
                <button key={p.id} className={'ob-path' + (p.id === path ? ' on' : '')} onClick={() => setPath(p.id)}>
                  <span className="ic">{p.icon}</span>
                  <span className="nm">{p.label}</span>
                  <span className="fl">{p.flavor}</span>
                </button>
              ))}
            </div>
            <div className="ob-row">
              <button className="ob-ghost ob-back" onClick={() => go(0)}>← Back</button>
              <button className="ob-cta" onClick={() => go(2)}>Next →</button>
            </div>
          </div>
        )}

        {name === 'look' && (
          <div className="ob-step">
            <div className="ob-eyebrow">Step 2 of 3</div>
            <h2 className="ob-h">Build your look</h2>
            <p className="ob-sub">Swipe through each part — nothing locks in yet.</p>
            <div className="ob-stage" style={{ width: 168, height: 196 }}>
              <HeroStage spec={previewSpec} motion="NormalStandBySouth" />
            </div>
            {LOOK_SLOTS.map((slot) => (
              <div className="ob-slot" key={slot.key}>
                <div className="ob-slot-label">{slot.label}</div>
                <div className="ob-stepper">
                  <button className="ob-arrow" onClick={() => stepSlot(slot, -1)} aria-label={`previous ${slot.label}`}>◀</button>
                  <span className="val">{slot.label} #{sel[slot.key]?.id ?? 0}</span>
                  <button className="ob-arrow" onClick={() => stepSlot(slot, 1)} aria-label={`next ${slot.label}`}>▶</button>
                </div>
              </div>
            ))}
            <div className="ob-slot">
              <div className="ob-slot-label">Outfit</div>
              <div className="ob-stepper">
                <button className="ob-arrow" onClick={() => stepOutfit(-1)} aria-label="previous outfit">◀</button>
                <span className="val">{currentCoat ? `${currentCoat.setLabel} · 💎${currentCoat.price.toLocaleString()}` : 'Loading…'}</span>
                <button className="ob-arrow" onClick={() => stepOutfit(1)} aria-label="next outfit">▶</button>
              </div>
              <p className="ob-note">A free starter gift — no diamonds charged.</p>
            </div>
            <button className="ob-ghost" onClick={randomize}>🎲 Surprise me</button>
            <div className="ob-row">
              <button className="ob-ghost ob-back" onClick={() => go(1)}>← Back</button>
              <button className="ob-cta" onClick={() => go(3)}>Next →</button>
            </div>
          </div>
        )}

        {name === 'ride' && (
          <div className="ob-step">
            <div className="ob-eyebrow">Step 3 of 3</div>
            <h2 className="ob-h">Choose your ride</h2>
            <p className="ob-sub">Optional — you can always tame one later.</p>
            <div className="ob-stage" style={{ width: 168, height: 196 }}>
              <HeroStage spec={previewSpec} motion={riding ? 'RidingSouth' : 'NormalStandBySouth'} />
            </div>
            <div className="ob-rides">
              <button className={'ob-ride' + (mountId === 0 ? ' on' : '')} onClick={() => setMountId(0)}>
                <span className="ic">🚫</span>No ride
              </button>
              {HORSE_MOUNTS.map((m) => (
                <button key={m.id} className={'ob-ride' + (mountId === m.id ? ' on' : '')} onClick={() => setMountId(m.id)}>
                  <span className="ic">🐴</span>{m.label}
                </button>
              ))}
            </div>
            <div className="ob-row">
              <button className="ob-ghost ob-back" onClick={() => go(2)}>← Back</button>
              <button className="ob-cta" onClick={() => go(4)}>Next →</button>
            </div>
          </div>
        )}

        {name === 'confirm' && (
          <div className="ob-step">
            <div className="ob-eyebrow">All set</div>
            <h2 className="ob-h">Ready, {nickname.trim() || 'farmer'}?</h2>
            <p className="ob-sub">This hero walks every ArgantaLab world.</p>
            <div className="ob-stage" style={{ width: 168, height: 196 }}>
              <HeroStage spec={previewSpec} motion={previewMotion} />
              <Confetti />
            </div>
            <div className="ob-recap">
              <span>Name: <b>{nickname.trim() || 'Farmer'}</b></span>
              <span>Path: <b>{pathLabel}</b></span>
              <span>Ride: <b>{rideLabel}</b></span>
            </div>
            {err && <p className="ob-err">{err}</p>}
            <div className="ob-row">
              <button className="ob-ghost ob-back" disabled={busy} onClick={() => go(3)}>← Back</button>
              <button className="ob-cta" disabled={busy} onClick={finish}>
                {busy ? 'Saving…' : 'Enter LashiraBloom →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// One celebratory burst, reduced-motion aware — fires once on mount.
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 168, h = canvas.clientHeight || 196;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.scale(dpr, dpr);
    const colors = ['#4d9fff', '#8b5cf6', '#e879b9', '#f6c945'];
    const n = reduce ? 12 : 30;
    const parts = Array.from({ length: n }, () => ({
      x: w / 2, y: h / 2 - 24,
      vx: (Math.random() - 0.5) * (reduce ? 1.6 : 4.2),
      vy: -Math.random() * (reduce ? 2 : 4.2) - 1,
      g: 0.12 + Math.random() * 0.09,
      size: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 62 + Math.random() * 34,
    }));
    let frame = 0, raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of parts) {
        if (frame > p.life) continue;
        alive = true;
        p.vy += p.g; p.x += p.vx; p.y += p.vy;
        ctx.globalAlpha = Math.max(0, 1 - frame / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      if (alive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="ob-confetti" style={{ width: '100%', height: '100%' }} />;
}

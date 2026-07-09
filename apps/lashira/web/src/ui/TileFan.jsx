// Tile fan-out — the radial action menu that opens when you tap an empty/growing
// field tile (or long-press any tile). Context-aware:
//   • empty  → pick ANY crop to plant (owned → plants; not owned → opens the Shop
//              on the Seeds tab so buying is one tap away, never a dead end)
//   • growing→ progress readout + 🌾 sickle (remove)
//   • ripe   → 🧺 harvest + 🌾 sickle   (only reached via long-press; a plain tap
//              on a ripe crop harvests instantly — the hybrid fast path)
//
// Positioning: anchored to the TILE's on-screen rect (fan.rect, computed by
// FarmRoom from the live camera), not the raw tap pixel — so the popup never
// covers the tile you just tapped. Measure-then-place: renders once invisibly to
// get its real size, then places itself above the tile (flipping below if there
// isn't room) and clamps horizontally/vertically to stay fully on-screen.
import { useLayoutEffect, useRef, useState } from 'react';
import { CROPS, cropIsRipe, cropGrowthFrac } from '../data/crops.js';

const GAP = 10;      // px between the tile and the popup
const EDGE_PAD = 8;  // min distance kept from the viewport edge

export function TileFan({ fan, game, snap, onResult, onClose, onOpenShop }) {
  const elRef = useRef(null);
  const [pos, setPos] = useState(null); // null until measured

  useLayoutEffect(() => {
    setPos(null); // remeasure for the new tile/state (its size can change)
    const el = elRef.current; if (!el || !fan?.rect) return;
    const raf = requestAnimationFrame(() => {
      if (!elRef.current) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      const { x: tx0, y: ty0, w: tw, h: th } = fan.rect;

      let top = ty0 - GAP - h, placement = 'above';
      if (top < EDGE_PAD) { top = ty0 + th + GAP; placement = 'below'; }
      top = Math.max(EDGE_PAD, Math.min(top, vh - h - EDGE_PAD));

      let left = tx0 + tw / 2 - w / 2;
      left = Math.max(EDGE_PAD, Math.min(left, vw - w - EDGE_PAD));

      setPos({ left, top, placement });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fan?.tx, fan?.ty, fan?.rect?.x, fan?.rect?.y]);

  if (!fan || !game) return null;
  const key = fan.tx + ',' + fan.ty;
  const p = game.state?.plots?.[key];
  const ripe = !!(p?.cropId && cropIsRipe(p));
  const growing = !!(p?.cropId && !ripe);
  const state = ripe ? 'ripe' : growing ? 'growing' : 'empty';

  const close = () => onClose?.();
  const act = (fn) => { const r = fn(); onResult?.(r); close(); };
  const buyShortcut = () => { onOpenShop?.('seeds'); close(); };

  const crop = p?.cropId ? CROPS[p.cropId] : null;
  const pct = growing ? Math.round(cropGrowthFrac(p) * 100) : 0;
  const allCrops = Object.values(CROPS);

  const style = pos
    ? { left: pos.left, top: pos.top }
    : { left: (fan.rect?.x ?? 0), top: (fan.rect?.y ?? 0), visibility: 'hidden' };

  return (
    <div className="tilefan-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        ref={elRef}
        className={'tilefan' + (pos ? ' ' + pos.placement : '')}
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {state === 'empty' && (
          <>
            <div className="tilefan-title">🌱 Plant</div>
            <div className="tilefan-seeds">
              {allCrops.map((c) => {
                const owned = Number(snap?.seeds?.[c.id] || 0);
                const active = snap?.selectedSeed === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={'tilefan-seed' + (active ? ' active' : '') + (owned <= 0 ? ' buyable' : '')}
                    title={owned > 0 ? `${c.name} ×${owned}` : `${c.name} — tap to buy at the Shop`}
                    onClick={() => (owned > 0 ? act(() => game.plantAt(fan.tx, fan.ty, c.id)) : buyShortcut())}
                  >
                    <span className="tf-emoji">{c.emoji}</span>
                    {owned > 0 ? <b>{owned}</b> : <b className="tf-buy">🛒</b>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {state === 'growing' && (
          <>
            <div className="tilefan-title">{crop?.emoji} {crop?.name} · {pct}%</div>
            <div className="tilefan-row">
              <button type="button" className="tilefan-btn cut" onClick={() => act(() => game.removeCrop(fan.tx, fan.ty))}>🌾 Remove</button>
            </div>
          </>
        )}

        {state === 'ripe' && (
          <>
            <div className="tilefan-title">{crop?.emoji} {crop?.name} · ripe</div>
            <div className="tilefan-row">
              <button type="button" className="tilefan-btn go" onClick={() => act(() => game.harvestTile(fan.tx, fan.ty))}>🧺 Harvest</button>
              <button type="button" className="tilefan-btn cut" onClick={() => act(() => game.removeCrop(fan.tx, fan.ty))}>🌾 Remove</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

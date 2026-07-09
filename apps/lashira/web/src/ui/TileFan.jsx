// Tile fan-out — the radial action menu that opens when you tap an empty/growing
// field tile (or long-press any tile). Context-aware:
//   • empty  → pick a seed to plant right here (crop selection on the tile)
//   • growing→ progress readout + 🌾 sickle (remove)
//   • ripe   → 🧺 harvest + 🌾 sickle   (only reached via long-press; a plain tap
//              on a ripe crop harvests instantly — the hybrid fast path)
// Positioned at the tap point inside the room-canvas. Purely local UI; every
// action routes through FarmLogic (which emits the sync intents).
import { CROPS, cropIsRipe, cropGrowthFrac } from '../data/crops.js';

export function TileFan({ fan, game, snap, onResult, onClose }) {
  if (!fan || !game) return null;
  const key = fan.tx + ',' + fan.ty;
  const p = game.state?.plots?.[key];
  const ripe = !!(p?.cropId && cropIsRipe(p));
  const growing = !!(p?.cropId && !ripe);
  const state = ripe ? 'ripe' : growing ? 'growing' : 'empty';

  const close = () => onClose?.();
  const act = (fn) => { const r = fn(); onResult?.(r); close(); };

  // seeds you actually own (for the empty-tile crop picker).
  const ownedSeeds = Object.values(CROPS).filter((c) => Number(snap?.seeds?.[c.id] || 0) > 0);
  const crop = p?.cropId ? CROPS[p.cropId] : null;
  const pct = growing ? Math.round(cropGrowthFrac(p) * 100) : 0;

  return (
    <div className="tilefan-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="tilefan" style={{ left: fan.x, top: fan.y }} onPointerDown={(e) => e.stopPropagation()}>
        {state === 'empty' && (
          <>
            <div className="tilefan-title">🌱 Plant</div>
            {ownedSeeds.length ? (
              <div className="tilefan-seeds">
                {ownedSeeds.map((c) => (
                  <button key={c.id} type="button" className={'tilefan-seed' + (snap?.selectedSeed === c.id ? ' active' : '')}
                    title={`${c.name} ×${snap?.seeds?.[c.id] || 0}`}
                    onClick={() => act(() => game.plantAt(fan.tx, fan.ty, c.id))}>
                    <span className="tf-emoji">{c.emoji}</span>
                    <b>{snap?.seeds?.[c.id] || 0}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="tilefan-empty">No seeds — buy some at the 🛒 Shop</div>
            )}
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

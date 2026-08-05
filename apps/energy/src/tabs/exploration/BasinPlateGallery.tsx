// BasinPlateGallery.tsx — the swipeable picture card at the top-left of the dossier.
//
// Swipe or arrow between the basin's plates; star one to make it the card's main
// picture. The choice persists per basin, so the dossier reopens on the frame you
// chose to present from.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Maximize2 } from 'lucide-react';
import type { Plate } from './basin-plates.tsx';

const KEY = 'arganta:basin-plate-main';

function readMain(basinKey: string): string | null {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}')[basinKey] ?? null; } catch { return null; }
}
function writeMain(basinKey: string, plateId: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (plateId) all[basinKey] = plateId; else delete all[basinKey];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* private mode — the gallery still works, it just won't remember */ }
}

export function BasinPlateGallery({ plates, basinKey, onExpand }: {
  plates: Plate[];
  /** Stable per-basin key the main-picture choice is stored against. */
  basinKey: string;
  onExpand?: (plate: Plate) => void;
}) {
  const [mainId, setMainId] = useState<string | null>(() => readMain(basinKey));
  // Ordering puts the starred plate first, so "main" genuinely means the frame you
  // open on rather than just a highlighted item somewhere in the strip.
  const ordered = useMemo(() => {
    if (!mainId) return plates;
    const i = plates.findIndex((p) => p.id === mainId);
    return i <= 0 ? plates : [plates[i], ...plates.slice(0, i), ...plates.slice(i + 1)];
  }, [plates, mainId]);

  const [idx, setIdx] = useState(0);
  useEffect(() => { setMainId(readMain(basinKey)); setIdx(0); }, [basinKey]);
  useEffect(() => { if (idx > ordered.length - 1) setIdx(0); }, [ordered.length, idx]);

  const go = useCallback((d: number) => {
    setIdx((i) => (i + d + ordered.length) % ordered.length);
  }, [ordered.length]);

  const down = useRef<{ x: number; y: number } | null>(null);

  if (!ordered.length) return null;
  const cur = ordered[idx];
  const isMain = mainId ? cur.id === mainId : idx === 0;

  // Drag to browse, tap to open. One pointer gesture has to serve both, so the
  // distance travelled decides: a real swipe advances the strip, a stationary tap
  // opens the figure full size. Anything in between does nothing rather than
  // guessing — an accidental modal on a half-swipe is worse than a no-op.
  const onDown = (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    if (!down.current) return;
    const dx = e.clientX - down.current.x;
    const dy = e.clientY - down.current.y;
    down.current = null;
    if (Math.abs(dx) > 34) { go(dx > 0 ? -1 : 1); return; }
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) onExpand?.(cur);
  };

  const star = () => {
    const next = cur.id === mainId ? null : cur.id;
    writeMain(basinKey, next);
    setMainId(next);
    setIdx(0);
  };

  return (
    <div className="exs-plates"
      onPointerDown={onDown} onPointerUp={onUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
        // Enter/Space opens the figure, so the card is usable without a pointer —
        // but ONLY when focus is on the card itself. The nav, star and dot buttons
        // live inside it, and swallowing their Enter would make them unusable by
        // keyboard.
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onExpand?.(cur);
        }
      }}
      tabIndex={0} role="group"
      aria-label={`${cur.title} — plate ${idx + 1} of ${ordered.length}. Enter to enlarge, left and right arrows to browse.`}>

      {/* The card is only 104x52 — too small to read a cross-section, so the whole
          plate is a click target that opens it full size. The caption lives in the
          tooltip rather than a footer to keep the header compact. */}
      <div className={'exs-plate-stage' + (isMain ? ' is-main' : '') + (onExpand ? ' zoomable' : '')}
        title={`${cur.title} — ${cur.provenance}${onExpand ? '  ·  click to enlarge' : ''}${ordered.length > 1 ? `, drag or arrow to browse (${idx + 1}/${ordered.length})` : ''}`}>
        {cur.node}
        {onExpand && <span className="exs-plate-zoom" aria-hidden><Maximize2 size={13} /></span>}
        {ordered.length > 1 && (
          <>
            {/* stopPropagation everywhere below: these sit inside the click-to-open
                surface, and pressing "next" must not also open the modal. */}
            <button className="exs-plate-nav prev" onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label="Previous figure"><ChevronLeft size={11} /></button>
            <button className="exs-plate-nav next" onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label="Next figure"><ChevronRight size={11} /></button>
          </>
        )}
        <div className="exs-plate-tools">
          <button className={'exs-plate-star' + (isMain ? ' on' : '')}
            onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); star(); }}
            title={isMain ? 'Main picture — click to unset' : 'Make this the main picture'}
            aria-pressed={isMain}>
            <Star size={9} />
          </button>
        </div>
        {ordered.length > 1 && (
          <div className="exs-plate-dots" role="tablist">
            {ordered.map((p, i) => (
              <button key={p.id} className={'exs-plate-dot' + (i === idx ? ' on' : '') + (p.id === mainId ? ' main' : '')}
                onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                role="tab" aria-selected={i === idx} title={p.title} aria-label={p.title} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

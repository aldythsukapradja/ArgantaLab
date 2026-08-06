// The keynote surface. Owns the whole viewport — no rail, no ribbon, no scope
// bar — because the audience should forget they are looking at an application.
//
// Mounted outside the Cosmo shell and rendered in a portal to <body>, so no
// ancestor's overflow, transform or z-index can clip it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SCENES } from './scenes';
import { gsap, prefersReducedMotion, revertSplits } from './timeline';
import './keynote.css';

export function KeynoteSurface({ onExit, startDark = true }: {
  onExit: () => void; startDark?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [dark, setDark] = useState(startDark);
  const [overview, setOverview] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const scene = SCENES[index];

  // Elapsed timer — a presenter needs to know, and it costs one interval.
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const clamp = (n: number) => Math.max(0, Math.min(SCENES.length - 1, n));
  /** Absolute jump — for the dots and the overview. */
  const go = useCallback((next: number) => setIndex(() => clamp(next)), []);
  /** Relative step, resolved against the CURRENT index inside the updater.
   *  Reading `index` from the handler's closure meant two fast key presses both
   *  computed from the same stale value and the second was swallowed — which a
   *  presenter tapping through a build would hit immediately. */
  const step = useCallback((delta: number) => setIndex((cur) => clamp(cur + delta)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown':
          e.preventDefault(); setOverview(false); step(1); break;
        case 'ArrowLeft': case 'PageUp':
          e.preventDefault(); setOverview(false); step(-1); break;
        case 'Home': e.preventDefault(); go(0); break;
        case 'End': e.preventDefault(); go(SCENES.length - 1); break;
        case 'o': case 'O': setOverview((v) => !v); break;
        case 't': case 'T': setDark((v) => !v); break;
        case 'p': case 'P': setPresenter((v) => !v); break;
        case 'f': case 'F':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen?.().catch(() => {});
          break;
        case 'Escape':
          if (overview) setOverview(false);
          else if (document.fullscreenElement) document.exitFullscreen();
          else onExit();
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overview, go, step, onExit]);

  // The deck is dark end to end — there is no light half any more, so no scene
  // may drift the theme. `T` still toggles it for a bright room; this only
  // guarantees advancing a slide never changes it.

  // Scene lifecycle. enter() on mount, idle() loops until interrupted — the
  // deck NEVER advances itself.
  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    // Deliberately NOT wrapped in gsap.context(). A context reverts every
    // SplitText created inside it, and React StrictMode double-invokes this
    // effect in dev — so the split was being created, torn down, and the text
    // left unsplit and invisible. Owning the lifecycle explicitly is boring and
    // it works.
    const tl = scene.api.enter(root);
    if (scene.api.idle) tl.add(scene.api.idle(root), '>-0.2');
    return () => {
      tl.kill();
      gsap.killTweensOf(root.querySelectorAll('*'));
      revertSplits(root);
      gsap.set(root, { clearProps: 'opacity' });
    };
  }, [index, scene]);

  const Body = scene.Component;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return createPortal(
    <div className={'kn-root' + (dark ? ' dark' : ' light')} data-reduced={prefersReducedMotion() ? '1' : '0'}>
      <div className="kn-stage" ref={stageRef} key={index}>
        <Body />
      </div>

      {/* Chrome is deliberately near-invisible until the pointer moves. */}
      <div className="kn-chrome">
        <button className="kn-exit" onClick={onExit} title="Exit (Esc)">Esc</button>
        <div className="kn-dots" role="tablist" aria-label="Scenes">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              className={'kn-dot' + (i === index ? ' on' : '') + (i < index ? ' past' : '')}
              onClick={() => go(i)}
              aria-label={`${i + 1}. ${s.title}`}
              aria-selected={i === index}
              role="tab"
            />
          ))}
        </div>
        <span className="kn-count">{index + 1} / {SCENES.length}</span>
      </div>

      {overview && (
        <div className="kn-overview" onClick={() => setOverview(false)}>
          <div className="kn-overview-grid">
            {SCENES.map((s, i) => (
              <button key={s.id} className={'kn-ov-card' + (i === index ? ' on' : '')}
                onClick={(e) => { e.stopPropagation(); go(i); setOverview(false); }}>
                <span className="kn-ov-num">{String(i + 1).padStart(2, '0')}</span>
                <b>{s.title}</b>
                <em>{s.emotion}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      {presenter && (
        <aside className="kn-presenter">
          <header><b>{scene.title}</b><span>{mmss}</span></header>
          <p className="kn-pres-punch">{scene.punchline}</p>
          {scene.notes && <p className="kn-pres-note">{scene.notes}</p>}
          <footer>next · {SCENES[index + 1]?.title ?? 'end'}</footer>
        </aside>
      )}
    </div>,
    document.body,
  );
}

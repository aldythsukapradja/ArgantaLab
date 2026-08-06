// The keynote's motion engine.
//
// Two rules from the brief that everything here exists to honour:
//   1. Nothing auto-advances. He will interrupt; a deck that keeps moving while
//      a senior geologist is talking loses him. `idle()` loops forever.
//   2. Nothing is abrupt. Every scene has enter/idle/exit. Cuts are for
//      reduced-motion only.
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Flip } from 'gsap/Flip';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(CustomEase, Flip, DrawSVGPlugin, Physics2DPlugin, ScrambleTextPlugin, SplitText);

// Dev-only handle so the split can be exercised from the console when a reveal
// silently does nothing — the failure mode is invisible otherwise.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__kn = { gsap, SplitText };
}

// Cinematic easing: heavy at the head, long settle, zero overshoot. The brief
// asked for momentum, never bounce — `power2.inOut` is too eager to be mass.
export const CINEMA = CustomEase.create('cinema', 'M0,0 C0.25,0 0.15,1 1,1');
export const SETTLE = CustomEase.create('settle', 'M0,0 C0.16,1 0.3,1 1,1');
gsap.defaults({ ease: CINEMA, duration: 1.1 });

export const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reduced motion is a DESIGNED mode: the story reads end to end, it just cuts. */
export const dur = (seconds: number) => (prefersReducedMotion() ? 0.001 : seconds);

export interface SceneApi {
  enter: (root: HTMLElement) => gsap.core.Timeline;
  idle?: (root: HTMLElement) => gsap.core.Timeline;
  exit?: (root: HTMLElement) => gsap.core.Timeline;
}

/* ── TYPOGRAPHY MOTION ────────────────────────────────────────────────────────
   The single biggest reason v1 felt flat: text faded in. Real keynote type
   RISES OUT OF A MASK, line by line, slightly overlapped. SplitText gives us
   the lines; the mask gives us the edge that makes it feel printed. */

const splits = new WeakMap<HTMLElement, SplitText>();

/** Split an element into masked lines and rise them in. Returns a timeline. */
export function riseLines(
  el: Element | null,
  opts: { delay?: number; stagger?: number; duration?: number } = {},
): gsap.core.Timeline {
  const tl = gsap.timeline();
  if (!el) return tl;
  const host = el as HTMLElement;

  if (prefersReducedMotion()) {
    tl.fromTo(host, { opacity: 0 }, { opacity: 1, duration: 0.001 }, opts.delay ?? 0);
    return tl;
  }

  // Revert any previous split so re-entering a scene does not nest wrappers.
  splits.get(host)?.revert();
  const split = new SplitText(host, {
    type: 'lines',
    linesClass: 'kn-line',
    // Each line gets its own overflow-hidden parent — that clipped edge is what
    // separates a keynote reveal from a fade.
    mask: 'lines',
  });
  splits.set(host, split);

  tl.fromTo(split.lines,
    { yPercent: 118, opacity: 0 },
    {
      yPercent: 0, opacity: 1,
      duration: opts.duration ?? 1.15,
      ease: SETTLE,
      stagger: opts.stagger ?? 0.085,
    }, opts.delay ?? 0);
  return tl;
}

/** Rise every `[data-rise]` in the scene, in document order. Text nodes get the
 *  masked-line treatment; everything else gets a soft lift. */
export function riseIn(root: HTMLElement, selector = '[data-rise]'): gsap.core.Timeline {
  const tl = gsap.timeline();
  const items = [...root.querySelectorAll<HTMLElement>(selector)];
  if (!items.length) return tl;

  items.forEach((el, i) => {
    const at = i * (prefersReducedMotion() ? 0 : 0.11);
    if (el.dataset.rise === 'text') {
      tl.add(riseLines(el, { stagger: 0.075 }), at);
    } else {
      tl.fromTo(el,
        { opacity: 0, y: prefersReducedMotion() ? 0 : 22, filter: 'blur(7px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: dur(1.15), ease: SETTLE }, at);
    }
  });
  return tl;
}

/** Numbers and short labels that decode into place. */
export function scrambleIn(el: Element | null, text: string, seconds = 1.2) {
  if (!el) return gsap.timeline();
  if (prefersReducedMotion()) { (el as HTMLElement).textContent = text; return gsap.timeline(); }
  return gsap.to(el, {
    duration: dur(seconds),
    scrambleText: { text, chars: '0123456789·—', speed: 0.45, revealDelay: 0.15 },
  });
}

export function fadeOut(root: HTMLElement): gsap.core.Timeline {
  return gsap.timeline().to(root, { opacity: 0, duration: dur(0.55), ease: 'power1.in' });
}

/** Hold — the most underused tool in a keynote. Silence is a design element. */
export const hold = (tl: gsap.core.Timeline, seconds: number) =>
  tl.to({}, { duration: dur(seconds) });

/** Clean up any SplitText wrappers a scene created. */
export function revertSplits(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-rise="text"]').forEach((el) => {
    splits.get(el)?.revert();
    splits.delete(el);
  });
}

export { gsap, Flip, SplitText };

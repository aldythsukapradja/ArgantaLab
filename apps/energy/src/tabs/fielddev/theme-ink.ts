// theme-ink — the palette a CANVAS has to be told about.
//
// A canvas gets no CSS variables. Every colour drawn into one is a literal, so a viewer
// that hardcodes `#94a3b8` for its axes is a viewer that only works in the dark theme —
// and the light theme is where it will be screenshotted for a report. This is the one
// place those literals live, keyed off the same `data-theme` attribute the stylesheet
// reads, so a canvas and the panel around it can never disagree about which theme they
// are in.
//
// It watches the attribute rather than sampling it once: the theme toggle does not
// remount anything, so a one-shot read leaves every canvas painted for the old theme
// until something else happens to redraw it.
import { useEffect, useMemo, useState } from 'react';

export interface ThemeInk {
  dark: boolean;
  /** faint rules inside a plot */
  grid: string;
  /** axis labels and tick text */
  axis: string;
  /** the box around a track or panel */
  frame: string;
  /** a track's own background wash */
  panel: string;
  /** ground for a region with no data — must NOT read as a low value on the ramp */
  empty: string;
  /** the blocked-cell step, and the halo that keeps it legible over a fill */
  step: string;
  stepHalo: string;
  /** crosshair */
  cross: string;
  /** readout chip */
  tipBg: string;
  tipInk: string;
  /** an interactive handle the user can grab */
  handle: string;
}

const DARK: ThemeInk = {
  dark: true,
  grid: 'rgba(148,163,184,0.16)',
  axis: '#94a3b8',
  frame: 'rgba(148,163,184,0.28)',
  panel: 'rgba(148,163,184,0.05)',
  empty: 'rgba(148,163,184,0.09)',
  step: '#ffffff',
  stepHalo: 'rgba(15,23,42,0.85)',
  cross: 'rgba(226,232,240,0.55)',
  tipBg: 'rgba(2,6,16,0.94)',
  tipInk: '#e2e8f0',
  handle: '#fbbf24',
};

const LIGHT: ThemeInk = {
  dark: false,
  grid: 'rgba(71,85,105,0.16)',
  axis: '#475569',
  frame: 'rgba(71,85,105,0.30)',
  panel: 'rgba(71,85,105,0.04)',
  // a hatched-looking grey, deliberately cooler than any ramp's pale end: an
  // unmodelled column has to stay distinguishable from a modelled one reading low
  empty: 'rgba(100,116,139,0.14)',
  step: '#0f172a',
  stepHalo: 'rgba(255,255,255,0.9)',
  cross: 'rgba(15,23,42,0.45)',
  tipBg: 'rgba(255,255,255,0.97)',
  tipInk: '#0f172a',
  handle: '#b45309',
};

/** the current theme, as literals a canvas can use */
export function themeInk(theme: string | null | undefined): ThemeInk {
  return theme === 'light' ? LIGHT : DARK;
}

export function useThemeInk(): ThemeInk {
  const [theme, setTheme] = useState<string | null>(
    typeof document === 'undefined' ? null : document.documentElement.getAttribute('data-theme'),
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const read = () => setTheme(document.documentElement.getAttribute('data-theme'));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return useMemo(() => themeInk(theme), [theme]);
}

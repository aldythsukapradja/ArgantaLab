// registry.ts — the Exploration lifecycle sub-tabs. The tab SET and the per-tab
// acceptance SPEC are the founder's, taken 1:1 from COSMO_Final.html (TAB_SPECS.
// exploration) via scripts/extract-tabspecs.mjs → src/cosmo/tabspec-data.json — never
// hand-transcribed. Seven tabs are built as live deterministic viewers; Seismic
// renders the founder's rendered MD spec until its interpretation canvas is built.
import tabspecData from '../../../cosmo/tabspec-data.json';

export type ExplStatus = 'live' | 'spec';

export interface TabSpec {
  title: string;
  purpose: string;
  contains: string[];
  sources: string[];
  flow: string[];
  visual: string;
}

interface TabspecData {
  specs: Record<string, Record<string, TabSpec>>;
  md: Record<string, Record<string, string>>;
}
const DATA = tabspecData as unknown as TabspecData;

/** Canonical exploration tab order (exactly the founder's TAB_SPECS.exploration keys). */
export const EXPL_TAB_NAMES = [
  'Overview', 'Basemap', 'Seismic', 'Wells',
  'Interpretation', 'Plays & Prospects', 'Volumetrics', 'Risk & Uncertainty',
] as const;
export type ExplTabName = typeof EXPL_TAB_NAMES[number];

/** Which tabs are built live vs still rendering the founder's spec. */
const LIVE = new Set<ExplTabName>([
  'Overview', 'Basemap', 'Wells', 'Interpretation', 'Plays & Prospects', 'Volumetrics', 'Risk & Uncertainty',
]);
export const explStatus = (name: string): ExplStatus => (LIVE.has(name as ExplTabName) ? 'live' : 'spec');

/** The founder's structured spec for a tab (title/purpose/contains/sources/flow/visual). */
export const explSpec = (name: string): TabSpec | null => DATA.specs.exploration?.[name] ?? null;

/** The founder's rendered acceptance MD for a tab (Obsidian-style, canonical template). */
export const explSpecMd = (name: string): string =>
  DATA.md.exploration?.[name] ?? `# ${name}\n\n> [!warning] No spec mapped.`;

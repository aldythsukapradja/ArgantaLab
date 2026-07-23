// Cosmonaut router — DETERMINISTIC (tier 0A). No LLM call anywhere. Lowercase the prompt,
// bucket by keywords, answer from foundation.json + schema-meta FKS + kb.json, and attach a
// truthful trace + dataNature badges to every reply. SOV/FRO tiers are a declared, locked seam.
import foundation from '../data/foundation.json';
import { FKS, TABLES } from '../model/schema-meta';
import type { VaultNote } from '../knowledge/types';

export type Nature = 'measured' | 'reported' | 'interpreted' | 'derived';

export type Artifact =
  | { kind: 'svg'; title: string; svg: string }
  | { kind: 'table'; title: string; columns: string[]; rows: (string | number)[][] }
  | { kind: 'md'; title: string; md: string }
  | null;

export interface Trace {
  intent: string;
  classification: string;
  route: string;
  grounded: string;
  evidence: string;
}

export interface CosmoReply {
  text: string;
  badges: { label: string; nature: Nature }[];
  artifact: Artifact;
  trace: Trace;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const short = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));

export const SUGGESTIONS = [
  'Field production summary',
  'Wellbore coverage',
  'Show the schema relationships',
  'List the surfaces and pick counts',
  'Knowledge base stats',
];

// ── Deterministic SVG bar chart (theme-var fills; no external lib) ──
function barChart(title: string, data: { label: string; value: number }[], accent = 'var(--amber)'): string {
  const W = 440, H = 30 + data.length * 26, labelW = 108, max = Math.max(...data.map((d) => d.value), 1);
  const rows = data.map((d, i) => {
    const y = 24 + i * 26;
    const bw = Math.round((d.value / max) * (W - labelW - 70));
    return (
      `<text x="0" y="${y + 11}" fill="var(--muted)" font-size="11" font-family="var(--mono)">${escapeXml(d.label)}</text>` +
      `<rect x="${labelW}" y="${y}" width="${bw}" height="15" rx="2" fill="${accent}" opacity="0.85"/>` +
      `<text x="${labelW + bw + 6}" y="${y + 11}" fill="var(--text)" font-size="10.5" font-family="var(--mono)">${short(d.value)}</text>`
    );
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}">` +
    `<text x="0" y="12" fill="var(--muted)" font-size="10" letter-spacing="0.14em" font-family="var(--mono)">${escapeXml(title.toUpperCase())}</text>` +
    rows + `</svg>`;
}
function escapeXml(s: string) { return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!)); }

const DET_ROUTE = 'route tier 0A (deterministic · no LLM call)';

export function route(promptRaw: string, notes: VaultNote[]): CosmoReply {
  const p = promptRaw.toLowerCase().trim();
  const has = (...ks: string[]) => ks.some((k) => p.includes(k));

  // 1 · Production
  if (has('production', 'oil', 'gas', 'rate', 'decline', 'produce', 'sm3', 'barrel')) {
    const prod = foundation.production;
    const wbs = [...prod.wellbores].sort((a, b) => b.oil - a.oil);
    const chart = barChart('oil produced by wellbore (Sm3)', wbs.slice(0, 8).map((w) => ({ label: w.wellbore.replace('15/9-', ''), value: w.oil })));
    const text =
      `**Volve field production** (reported daily volumes, Sm³):\n\n` +
      `- Total oil: **${fmt(prod.oil_sm3)} Sm³**\n` +
      `- Total gas: **${fmt(prod.gas_sm3)} Sm³**\n` +
      `- Producing wellbores: **${wbs.length}**\n` +
      `- Top producer: **${wbs[0].wellbore}** (${fmt(wbs[0].oil)} Sm³ oil, ${wbs[0].rows} daily rows ${wbs[0].date_min}→${wbs[0].date_max}).\n`;
    return {
      text,
      badges: [{ label: 'REPORTED', nature: 'reported' }],
      artifact: { kind: 'svg', title: 'Oil by wellbore', svg: chart },
      trace: {
        intent: 'production summary',
        classification: 'C1-internal · production/rate keyword bucket',
        route: DET_ROUTE,
        grounded: 'foundation.production (Production_data)',
        evidence: 'volumes carried verbatim from processed production.json · source_id → mirror ledger',
      },
    };
  }

  // 2 · Coverage
  if (has('coverage', 'wellbore', 'wells', 'which wells', 'well ')) {
    const prod = new Map(foundation.production.wellbores.map((w) => [w.wellbore, w]));
    const traj = new Map(foundation.trajectories.map((t) => [t.wellbore, t]));
    const names = new Set<string>([...prod.keys(), ...traj.keys()]);
    const rows: (string | number)[][] = [...names].sort().map((n) => [
      n.replace('15/9-', ''),
      prod.has(n) ? `${short(prod.get(n)!.oil)} Sm³` : '—',
      traj.has(n) ? `${traj.get(n)!.stations} sta` : '—',
    ]);
    return {
      text: `**Wellbore coverage** across production + trajectory sources — ${names.size} wellbores with at least one dataset. "—" means that source has no rows for the wellbore (an honest gap, never imputed).`,
      badges: [{ label: 'REPORTED', nature: 'reported' }, { label: 'MEASURED', nature: 'measured' }],
      artifact: { kind: 'table', title: 'Wellbore coverage', columns: ['Wellbore', 'Production', 'Trajectory'], rows },
      trace: {
        intent: 'well coverage',
        classification: 'C1-internal · wells/coverage keyword bucket',
        route: DET_ROUTE,
        grounded: 'foundation.production + foundation.trajectories',
        evidence: 'presence derived from processed tables · orphans preserved (schema-meta FK truth)',
      },
    };
  }

  // 3 · Schema / relationships
  if (has('schema', 'model', 'relationship', 'foreign key', 'fk', 'star', 'join', 'table')) {
    const rows: (string | number)[][] = FKS.map((f) => [f.from, f.to, f.card, f.orphans == null ? 'n/a' : f.orphans]);
    return {
      text: `**Semantic model** — ${TABLES.length} tables, ${FKS.length} foreign-key edges (contract v1.0.0). Orphan counts are data-quality truth, carried verbatim; e.g. the 92 marker orphans are 12 regional/pilot wells outside the Volve field — proposed, never force-merged.`,
      badges: [{ label: 'DERIVED', nature: 'derived' }],
      artifact: { kind: 'table', title: 'FK ledger', columns: ['From', 'To', 'Card', 'Orphans'], rows },
      trace: {
        intent: 'schema / relationships',
        classification: 'C1-internal · schema/FK keyword bucket',
        route: DET_ROUTE,
        grounded: 'model/schema-meta.ts (FKS, TABLES) — locked contract',
        evidence: 'edge ids derived from from|to (collision-proof); orphans from the FK ledger',
      },
    };
  }

  // 4 · Surfaces / formations / tops
  if (has('surface', 'formation', 'top', 'strat', 'horizon', 'pick')) {
    const surfNotes = notes.filter((n) => n.type === 'surface');
    const rows: (string | number)[][] = surfNotes.map((s) => [s.title, s.backlinks.length + s.links.length]);
    return {
      text: `**Surfaces / formation tops** — ${surfNotes.length} surfaces in the stratigraphic bridge. Degree = wikilink references from wells/wellbores/field. Surfaces are interpreted (not measured): each formation top comes from a picked marker.`,
      badges: [{ label: 'INTERPRETED', nature: 'interpreted' }],
      artifact: { kind: 'table', title: 'Surfaces', columns: ['Surface', 'Link degree'], rows },
      trace: {
        intent: 'surfaces / tops',
        classification: 'C1-internal · surface/formation keyword bucket',
        route: DET_ROUTE,
        grounded: 'kb.json surface notes + link graph',
        evidence: 'surface set = 16 stratigraphic bridge entries; degree from recomputed links',
      },
    };
  }

  // 5 · Knowledge stats
  if (has('knowledge', 'note', 'link', 'vault', 'graph', 'stats', 'backlink')) {
    const byType: Record<string, number> = {};
    for (const n of notes) byType[n.type] = (byType[n.type] ?? 0) + 1;
    const edges = notes.reduce((a, n) => a + n.links.length, 0);
    const top = [...notes].sort((a, b) => (b.links.length + b.backlinks.length) - (a.links.length + a.backlinks.length)).slice(0, 6);
    const rows: (string | number)[][] = top.map((n) => [n.title, n.type, n.links.length + n.backlinks.length]);
    return {
      text: `**Knowledge base** — ${notes.length} notes, ${edges} directed links. By type: ${Object.entries(byType).map(([t, c]) => `${t} ${c}`).join(' · ')}.`,
      badges: [{ label: 'DERIVED', nature: 'derived' }],
      artifact: { kind: 'table', title: 'Top-degree entities', columns: ['Note', 'Type', 'Degree'], rows },
      trace: {
        intent: 'knowledge stats',
        classification: 'C1-internal · knowledge/note keyword bucket',
        route: DET_ROUTE,
        grounded: 'merged vault (kb.json ▸ user layer)',
        evidence: 'counts computed live over the merged, link-recomputed note set',
      },
    };
  }

  // 6 · Fallback capability card
  return {
    text:
      `I'm **Arganta** — a deterministic query surface over the Volve knowledge OS. I don't call an LLM; I route your words to a grounded answer with evidence. Try:\n\n` +
      SUGGESTIONS.map((s) => `- ${s}`).join('\n'),
    badges: [],
    artifact: {
      kind: 'md', title: 'Capabilities',
      md: `| Intent | Source |\n| --- | --- |\n| Production summary | foundation.production |\n| Wellbore coverage | production + trajectories |\n| Schema / FK | schema-meta.ts |\n| Surfaces / tops | kb.json |\n| Knowledge stats | merged vault |`,
    },
    trace: {
      intent: 'capability card',
      classification: 'C1-internal · no keyword bucket matched',
      route: DET_ROUTE,
      grounded: 'router intent table',
      evidence: 'no figure asserted — capability listing only',
    },
  };
}

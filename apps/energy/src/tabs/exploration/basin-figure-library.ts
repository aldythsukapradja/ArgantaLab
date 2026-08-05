// basin-figure-library.ts — the PUBLISHED figures behind each basin's picture card.
//
// SOURCE OF TRUTH IS THE REGISTRY, NOT A FILE LISTING.
// Figures are governed evidence objects: `Figure Registry` holds the figure, `Figure
// Links` holds which entities use it and which is preferred for each. Both ride in the
// KB spine, so the UI reads exactly what the workbook governs — reading a directory or
// a flat manifest would let an ungoverned image reach the screen.
//
// RIGHTS. The gate is `redistribution_status`, never `licence_status` and never "is
// there a file on disk". A USGS report is a US Government work and public domain, but
// figures reproduced INSIDE it from third parties are not — measured at 27% of the
// monograph corpus and 50% of Bulletin 2204-C. Those carry
// `internal-reference-only`, live in a gitignored directory, and must never be shown
// as a basin's default plate.

export type FigureType =
  | 'cross-section' | 'strat-chart' | 'depositional' | 'map'
  | 'events-chart' | 'burial' | 'creaming' | 'other';

export type RedistributionStatus =
  | 'local-copy-permitted' | 'link-only' | 'internal-reference-only' | 'do-not-ingest';

/** Registry row as it arrives in the spine. */
export interface RegistryFigure {
  figure_id: string;
  title?: string;
  figure_scope?: string;
  // Typed as `string`, not FigureType: this arrives from a spreadsheet and may hold a
  // value the app has never heard of. Narrowing happens where it is used, so an
  // unrecognised type sorts last rather than crashing the card.
  figure_type: string;
  formation_id?: string;
  basin_id?: string;
  source_citation_id?: string;
  source_url?: string;
  publication_year?: number;
  page?: number;
  figure_number?: number;
  caption?: string;
  authority_type?: string;
  geographic_scope?: string;
  resolution_quality?: string;
  licence_status?: string;
  redistribution_status?: string;
  local_asset_path?: string;
  thumbnail_allowed?: string;
  candidate_score?: number;
  score_coverage_pct?: number;
  review_status?: string;
  reviewer_notes?: string;
}

export interface FigureLink {
  figure_link_id: string;
  figure_id: string;
  entity_type?: string;
  entity_id?: string;
  relationship?: string;
  relevance_rank?: number;
  preferred_for_scope?: string;
  notes?: string;
}

interface SpineLike {
  figureRegistry?: RegistryFigure[];
  figureLinks?: FigureLink[];
}

/** The order a geologist wants to meet a basin in: what it looks like in section
 *  first, then how it is layered, then where the rocks were laid down, then where it
 *  is on a map. Timing charts and discovery curves come last. */
export const FIGURE_TYPE_ORDER: FigureType[] = [
  'cross-section', 'strat-chart', 'depositional', 'map',
  'events-chart', 'burial', 'creaming', 'other',
];

/** Human label for a figure type. Takes a plain string because the value comes from a
 *  spreadsheet — an unrecognised type gets a neutral label rather than `undefined`. */
export function figureTypeLabel(t: string): string {
  return FIGURE_TYPE_LABEL[t as FigureType] ?? 'Figure';
}

export const FIGURE_TYPE_LABEL: Record<FigureType, string> = {
  'cross-section': 'Cross section',
  'strat-chart': 'Stratigraphic chart',
  depositional: 'Depositional environment',
  map: 'Basin map',
  'events-chart': 'Events chart',
  burial: 'Burial history',
  creaming: 'Discovery history',
  other: 'Figure',
};

/** Only this status may be rendered. Everything else is metadata-and-link only. */
const SHOWABLE = new Set<RedistributionStatus>(['local-copy-permitted']);

export function isShowable(f: RegistryFigure): boolean {
  return SHOWABLE.has((f.redistribution_status ?? 'do-not-ingest') as RedistributionStatus);
}

/** Image URL derived from the governed asset path, so a figure can never be shown
 *  from a location the registry does not know about. */
export function figureSrc(f: RegistryFigure): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const p = (f.local_asset_path ?? '').replace(/^apps\/energy\/public\//, '');
  return base + p;
}

/** Figures for one entity, already in card order, filtered to what we may show.
 *  A figure flagged preferred for this entity leads regardless of type order —
 *  that is what "preferred" means. */
export function figuresForEntity(spine: SpineLike | null, entityId?: string | null): RegistryFigure[] {
  if (!spine?.figureRegistry || !spine.figureLinks || !entityId) return [];
  const byId = new Map(spine.figureRegistry.map((f) => [f.figure_id, f]));
  const rank = (t: string) => {
    const i = FIGURE_TYPE_ORDER.indexOf(t as FigureType);
    return i < 0 ? 99 : i;     // unknown type sorts last, never throws
  };
  const rows = spine.figureLinks
    .filter((l) => l.entity_id === entityId)
    .map((l) => ({ f: byId.get(l.figure_id), l }))
    .filter((x): x is { f: RegistryFigure; l: FigureLink } => !!x.f && isShowable(x.f));

  rows.sort((a, b) => {
    const ap = /preferred_general/.test(a.l.preferred_for_scope ?? '') ? 0 : 1;
    const bp = /preferred_general/.test(b.l.preferred_for_scope ?? '') ? 0 : 1;
    return ap - bp
      || rank(a.f.figure_type) - rank(b.f.figure_type)
      || (b.f.candidate_score ?? 0) - (a.f.candidate_score ?? 0);
  });
  return rows.map((x) => x.f);
}

/** Figures linked to this entity that we may NOT redistribute.
 *
 *  These must not be hidden. They are usually the best figures in the corpus — for the
 *  North Sea Graben the stratigraphic summary and the burial curves are both here — and
 *  silently dropping them makes a rich basin look empty. The governed answer is
 *  LINK ONLY: show what the figure is, who holds it, and where to go and read it. */
export function linkOnlyForEntity(spine: SpineLike | null, entityId?: string | null): RegistryFigure[] {
  if (!spine?.figureRegistry || !spine.figureLinks || !entityId) return [];
  const byId = new Map(spine.figureRegistry.map((f) => [f.figure_id, f]));
  const seen = new Set<string>();
  const out: RegistryFigure[] = [];
  for (const l of spine.figureLinks) {
    if (l.entity_id !== entityId) continue;
    const f = byId.get(l.figure_id);
    if (!f || isShowable(f) || seen.has(f.figure_id)) continue;
    seen.add(f.figure_id);
    out.push(f);
  }
  const rank = (t: string) => {
    const i = FIGURE_TYPE_ORDER.indexOf(t as FigureType);
    return i < 0 ? 99 : i;
  };
  return out.sort((a, b) => rank(a.figure_type) - rank(b.figure_type));
}

/** Where a reader can go and look at a figure we cannot reproduce. */
export function figureSourceLink(f: RegistryFigure): string | null {
  return f.source_url ?? null;
}

/** Attribution. A public-domain figure still names its source publication and page —
 *  the point of the card is that the reader can go and find the original. */
export function figureAttribution(f: RegistryFigure): string {
  const where = [f.source_citation_id, f.page ? `p.${f.page}` : null]
    .filter(Boolean).join(', ');
  if (f.redistribution_status === 'internal-reference-only') {
    return `${where} — third-party figure, internal use only; not cleared for redistribution.`;
  }
  if (f.licence_status === 'public-domain') {
    return `${where} — USGS, public domain.`;
  }
  return `${where} — ${f.licence_status ?? 'licence unrecorded'}.`;
}

/** Coverage by type, computed from the registry rather than a directory listing. */
export function figureCoverage(spine: SpineLike | null, totalBasins: number) {
  if (!spine?.figureRegistry || !spine.figureLinks) return null;
  const byId = new Map(spine.figureRegistry.map((f) => [f.figure_id, f]));
  const perEntity = new Map<string, Set<string>>();
  for (const l of spine.figureLinks) {
    const f = byId.get(l.figure_id);
    if (!f || !l.entity_id || !isShowable(f)) continue;
    if (!perEntity.has(l.entity_id)) perEntity.set(l.entity_id, new Set());
    perEntity.get(l.entity_id)!.add(f.figure_type);
  }
  const has = (t: FigureType) => [...perEntity.values()].filter((s) => s.has(t)).length;
  return {
    figures: spine.figureRegistry.length,
    showable: spine.figureRegistry.filter(isShowable).length,
    restricted: spine.figureRegistry.filter((f) => !isShowable(f)).length,
    entities: perEntity.size,
    totalBasins,
    crossSection: has('cross-section'),
    stratChart: has('strat-chart'),
    depositional: has('depositional'),
    eventsChart: has('events-chart'),
    map: has('map'),
  };
}

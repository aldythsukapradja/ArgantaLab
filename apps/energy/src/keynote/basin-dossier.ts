// Slide 1's click-through: a province code in, the Knowledge Bank's two
// signature charts out.
//
// This is the same derivation the Knowledge Bank runs (KnowledgeBank.tsx's
// `events` and `tecto` memos), lifted so the keynote can call it with nothing
// but a code. Deliberately NOT a copy of the charts themselves — EventsChartView
// and TectonoStratChart are pure and prop-driven, so the deck reuses the real
// components and only has to reproduce the joins that feed them.
//
// Reproducing the joins is the honest trade: mounting the whole Knowledge Bank
// inside a keynote popup would drag in its scope store, its figure gating and
// its cross-section header, none of which belong on a title slide.
import { loadKbSpine, type KbSpine } from '../dataqc/masterkb';
import { buildPetroleumSystemChart, type EventsChart } from '../tabs/exploration/basin-insight';
import type { TectonoPeriod, TectonoCycle, TectonoElement } from '../tabs/exploration/BasinCharts';

export interface BasinDossier {
  code: string;
  provinceName: string;
  /** Null when the province has a petroleum system but no timed model behind it. */
  events: EventsChart | null;
  tecto: { periods: TectonoPeriod[]; cycles: TectonoCycle[]; elements: TectonoElement[] };
  modelTitle?: string;
  /** The model's completeness grade (G1…), shown so the chart is never read as
   *  more complete than it is. */
  grade?: string;
  /** Worst citation state across the cycles on screen. The Indonesian cycles are
   *  `recalled` — literature the model knows but has not cited — and a deck that
   *  claims "measure it, don't claim it" has to say so on the slide. */
  citation: 'cited' | 'verified' | 'recalled' | 'none';
  cycleCount: number;
}

/** Cycles belonging to any basin in this province, oldest first. */
function cyclesOfProvince(spine: KbSpine, provinceId: string | undefined) {
  const basinIds = new Set(
    spine.basin.filter((b) => b.province_id === provinceId).map((b) => b.basin_id));
  return spine.basinCycle.filter((c) => c.basin_id && basinIds.has(c.basin_id));
}

const CITATION_RANK = { none: 0, recalled: 1, verified: 2, cited: 3 } as const;

let cache: Map<string, Promise<BasinDossier | null>> | null = null;

export function basinDossier(code: string): Promise<BasinDossier | null> {
  cache ??= new Map();
  const hit = cache.get(code);
  if (hit) return hit;

  const run = (async (): Promise<BasinDossier | null> => {
    const spine = await loadKbSpine();
    if (!spine) return null;
    const province = spine.province.find((p) => p.code === code);
    if (!province) return null;

    // A province can hold several petroleum systems; take the first that has a
    // timed model behind it rather than the first in file order, otherwise a
    // province whose lead system is unmodelled shows an empty chart.
    const systems = spine.petroleumSystem.filter((t) => t.province_id === province.province_id);
    const modelled = systems
      .map((tps) => ({ tps, model: spine.psModel.find((m) => m.tps_id === tps.tps_id) }))
      .find((x) => x.model);
    const model = modelled?.model;

    let events: EventsChart | null = null;
    if (model) {
      const elements = spine.psElement.filter((e) => e.model_id === model.model_id);
      const processEvents = spine.psEvent.filter((e) => e.model_id === model.model_id);
      const contributions = new Map(
        spine.psCycle.filter((x) => x.tps_id === model.tps_id).map((x) => [x.cycle_id, x.contribution]));
      const chartCycles = spine.basinCycle
        .filter((c) => contributions.has(c.cycle_id))
        .map((c) => ({ ...c, contribution: contributions.get(c.cycle_id) }));
      events = buildPetroleumSystemChart(
        elements, processEvents, chartCycles, spine.geologicTimescale,
        {
          title: model.title, grade: model.completeness_grade,
          timescale: model.timescale_version,
          scope: `${model.scope_type.replace(/-/g, ' ')} · ${model.status ?? 'draft'}`,
        });
    }

    const periods: TectonoPeriod[] = spine.geologicTimescale
      .filter((p) => p.rank === 'period' && Number.isFinite(p.start_ma))
      .map((p) => ({ id: p.unit_id, name: p.name, from: p.start_ma, to: p.end_ma, parent: p.parent_name }))
      .sort((a, b) => b.from - a.from);

    const provCycles = cyclesOfProvince(spine, province.province_id);
    // age_top_ma is the OLDER bound in this table — read both bounds through
    // max/min rather than assuming an orientation.
    const cycles: TectonoCycle[] = provCycles
      .filter((c) => Number.isFinite(c.age_top_ma) && Number.isFinite(c.age_base_ma))
      .map((c) => ({
        id: c.cycle_id, label: c.title ?? c.cycle_id,
        from: Math.max(c.age_top_ma!, c.age_base_ma!), to: Math.min(c.age_top_ma!, c.age_base_ma!),
        geodynamics: c.geodynamics,
      }))
      .sort((a, b) => b.from - a.from);

    const elements: TectonoElement[] = model
      ? spine.psElement.filter((e) => e.model_id === model.model_id).map((e) => ({
        unitName: e.unit_name, role: e.element_role,
        from: Math.max(e.start_ma, e.end_ma), to: Math.min(e.start_ma, e.end_ma),
        effectiveness: e.effectiveness, confidence: e.confidence, cycleId: e.basin_cycle_id,
      }))
      : [];

    let citation: BasinDossier['citation'] = 'none';
    for (const c of provCycles) {
      const s = (c.citation_status ?? 'none') as BasinDossier['citation'];
      if (CITATION_RANK[s] === undefined) continue;
      if (citation === 'none' || CITATION_RANK[s] < CITATION_RANK[citation]) citation = s;
    }

    return {
      code, provinceName: province.name ?? code,
      events, tecto: { periods, cycles, elements },
      modelTitle: model?.title, grade: model?.completeness_grade,
      citation, cycleCount: cycles.length,
    };
  })();

  cache.set(code, run);
  return run;
}

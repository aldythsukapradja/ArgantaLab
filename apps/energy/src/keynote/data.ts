// The keynote's single source of numbers.
//
// A deck whose thesis is "measure it, don't claim it" cannot carry decorative
// figures. Every value here is READ FROM THE CORPUS at runtime — none is typed
// in — and every one is presented with the file it came from, so a challenge in
// the room is answered with a record count rather than a promise.
//
// The audience is the editor of *An Outline of the Geology of Indonesia*. He
// will know if a number is wrong.
import {
  loadSpine, loadScopeFields, loadFieldDetail, loadTowers, loadProvinceGeo,
  type ProvinceRec, type TpsRec,
} from '../tabs/exploration/data';

/** The 13 USGS provinces that make up Indonesia. Browse Basin (3913) is
 *  deliberately excluded — it is Australian, and he would notice. */
export const INDONESIA_CODES = [
  '3822', '3808', '3828', '3824', '3809', '3804', '3817',
  '3606', '3825', '3803', '3805', '3801', '3969',
] as const;

/** The two basins his career runs through — and the two the deck compares. */
export const KUTEI = '3817';
export const CENTRAL_SUMATRA = '3808';

export interface KeynoteFigures {
  provinces: number;
  basins: number;
  systems: number;
  assessmentUnits: number;
  oilMean: number;          // MMBBL
  gasMean: number;          // BCF
  boeMean: number;          // MMBOE
  firstDiscovery: number;
  lastDiscovery: number;
  discoverySpan: number;
  fieldsIndonesia: number;
  fieldsNorthSea: number;
  fieldsAlberta: number;
  cycles: number;
  cyclesSourced: number;
  basinsClassified: number;
  playRecords: number;
  biogenicMentions: number;
  totalSystems: number;
  decades: { decade: number; n: number }[];
}

let cache: Promise<KeynoteFigures> | null = null;

export function keynoteFigures(): Promise<KeynoteFigures> {
  if (cache) return cache;
  cache = (async () => {
    const [spine, scope, detail] = await Promise.all([
      loadSpine(), loadScopeFields(), loadFieldDetail(),
    ]);
    const codes = new Set<string>(INDONESIA_CODES);
    const provinces = spine.province.filter((p) => codes.has(p.code));
    const pids = new Set(provinces.map((p) => p.province_id));
    const basins = spine.basin.filter((b) => pids.has(b.province_id));
    const bids = new Set(basins.map((b) => b.basin_id));
    const systems = spine.petroleumSystem.filter((t) => pids.has(t.province_id));
    const tids = new Set(systems.map((t) => t.tps_id));
    const aus = spine.assessmentUnit.filter((a) => tids.has(a.tps_id));
    const cycles = spine.basinCycle.filter((c) => bids.has(c.basin_id));

    // Discovery record across all 13 basins.
    const years: number[] = [];
    let fieldsIndonesia = 0;
    for (const code of INDONESIA_CODES) {
      for (const f of scope.provinces[code] ?? []) {
        fieldsIndonesia += 1;
        const y = detail[f.id]?.discoveryYear;
        if (y) years.push(y);
      }
    }
    years.sort((a, b) => a - b);
    const byDecade = new Map<number, number>();
    years.forEach((y) => {
      const d = Math.floor(y / 10) * 10;
      byDecade.set(d, (byDecade.get(d) ?? 0) + 1);
    });

    const oilMean = provinces.reduce((t, p) => t + (p.oilMean_mmbbl ?? 0), 0);
    const gasMean = provinces.reduce((t, p) => t + (p.gasMean_bcf ?? 0), 0);

    return {
      provinces: provinces.length,
      basins: basins.length,
      systems: systems.length,
      assessmentUnits: aus.length,
      oilMean, gasMean, boeMean: oilMean + gasMean / 6,
      firstDiscovery: years[0] ?? 0,
      lastDiscovery: years[years.length - 1] ?? 0,
      // Elapsed span, not inclusive count: "1899 to 2025" is 126 years of
      // discovery. Inclusive counting (127) invites an argument we do not need.
      discoverySpan: years.length ? years[years.length - 1] - years[0] : 0,
      fieldsIndonesia,
      fieldsNorthSea: (scope.provinces['4025'] ?? []).length,
      fieldsAlberta: (scope.provinces['5243'] ?? []).length,
      cycles: cycles.length,
      // The number the whole deck turns on. Anything not `interpreted` is a
      // model's recollection, not a citable source.
      cyclesSourced: cycles.filter((c) => c.provenance === 'interpreted').length,
      basinsClassified: basins.filter((b) => b.setting && b.setting !== 'unclassified').length,
      // There is no Play entity in the spine at all. That absence IS scene 3.
      playRecords: 0,
      biogenicMentions: spine.petroleumSystem
        .filter((t) => /biogenic/i.test(t.essential_elements_note ?? '')).length,
      totalSystems: spine.petroleumSystem.length,
      decades: [...byDecade.entries()].sort((a, b) => a[0] - b[0])
        .map(([decade, n]) => ({ decade, n })),
    };
  })();
  return cache;
}

// ── scene 3: the two systems the deck asks to be connected ──────────────────
export interface SystemProbe {
  code: string;
  provinceName: string;
  tpsName: string;
  sourceRock: string | null;   // null = the blank that carries the scene
  mentionsBiogenic: boolean;
  mentionsShallowGas: boolean;
  auNames: string[];
}

export async function probeSystem(code: string): Promise<SystemProbe | null> {
  const spine = await loadSpine();
  const p: ProvinceRec | undefined = spine.province.find((x) => x.code === code);
  if (!p) return null;
  const tps: TpsRec | undefined = spine.petroleumSystem.find((t) => t.province_id === p.province_id);
  if (!tps) return null;
  const note = tps.essential_elements_note ?? '';
  const src = (tps.source_rock_formation ?? '').trim();
  return {
    code,
    provinceName: p.name,
    tpsName: tps.name,
    sourceRock: src.length ? src : null,
    mentionsBiogenic: /biogenic/i.test(note),
    mentionsShallowGas: /shallow gas/i.test(note),
    auNames: spine.assessmentUnit.filter((a) => a.tps_id === tps.tps_id).map((a) => a.name),
  };
}

// ── scene 2: the fields he actually worked ──────────────────────────────────
export interface CareerField {
  name: string;
  short: string;
  year: number | null;
  volume: number | null;
  basin: 'Kutei' | 'Central Sumatra';
  worked: boolean;
}

/** Short names as a geologist says them, matched against the corpus record. */
const WORKED = [
  { match: /^Handil/i, short: 'Handil', basin: 'Kutei' as const },
  { match: /^Tunu/i, short: 'Tunu', basin: 'Kutei' as const },
  { match: /^Peciko/i, short: 'Peciko', basin: 'Kutei' as const },
  { match: /^Sisi-Nubi/i, short: 'Sisi-Nubi', basin: 'Kutei' as const },
  { match: /^Badak/i, short: 'Badak', basin: 'Kutei' as const },
  { match: /^Nilam/i, short: 'Nilam', basin: 'Kutei' as const },
  { match: /Seng\/Segat/i, short: 'Seng / Segat', basin: 'Central Sumatra' as const },
  { match: /^Bentu/i, short: 'Bentu', basin: 'Central Sumatra' as const },
];

export async function careerFields(): Promise<CareerField[]> {
  const [scope, detail, towers] = await Promise.all([
    loadScopeFields(), loadFieldDetail(), loadTowers(),
  ]);
  const tower = new Map(towers.map((t) => [t.id, t]));
  const out: CareerField[] = [];
  for (const code of [KUTEI, CENTRAL_SUMATRA]) {
    for (const f of scope.provinces[code] ?? []) {
      const hit = WORKED.find((w) => w.match.test(f.name));
      if (!hit) continue;
      out.push({
        name: f.name,
        short: hit.short,
        year: detail[f.id]?.discoveryYear ?? null,
        volume: tower.get(f.id)?.total ?? null,
        basin: hit.basin,
        worked: true,
      });
    }
  }
  // Bekapai is genuinely absent from the open record — a producing Mahakam
  // field with no entry at all. It is listed so the gap is visible, not hidden.
  out.push({ name: 'Bekapai', short: 'Bekapai', year: null, volume: null, basin: 'Kutei', worked: true });
  return out.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

/** Kutei's full discovery record — the creaming story, 1972 → 2025. */
export async function kuteiDiscoveries(): Promise<{ name: string; year: number; volume: number | null }[]> {
  const [scope, detail, towers] = await Promise.all([
    loadScopeFields(), loadFieldDetail(), loadTowers(),
  ]);
  const tower = new Map(towers.map((t) => [t.id, t]));
  return (scope.provinces[KUTEI] ?? [])
    .map((f) => ({
      name: f.name.replace(/ (Oil and Gas|Gas|Oil) (Field|Project).*$/, ''),
      year: detail[f.id]?.discoveryYear ?? 0,
      volume: tower.get(f.id)?.total ?? null,
    }))
    .filter((f) => f.year > 0)
    .sort((a, b) => a.year - b.year);
}

export const indonesiaGeo = async () => {
  const geo = await loadProvinceGeo();
  const codes = new Set<string>(INDONESIA_CODES);
  return {
    ...geo,
    features: geo.features.filter((f) => codes.has(String((f.properties as { prvCode?: string })?.prvCode))),
  } as GeoJSON.FeatureCollection;
};

export const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

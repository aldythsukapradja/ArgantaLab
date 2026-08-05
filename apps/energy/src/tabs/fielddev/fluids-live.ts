// fluids-live.ts — the Fluids & Rock stage's data seam.
//
// fluid-model.ts is pure physics and knows nothing about where numbers come from.
// This module is the other half: it reads the WORKSPACE (the ingested asset store —
// the same single query the Input tree and the map read) and hands the physics its
// inputs. Nothing here fetches from public/ and nothing here invents a value.
//
// Three reads:
//
//   anchors        the `wellmaster` asset — the delivery's own manifest, which carries
//                  the deck's PVT block, the rock compaction record, the fluid
//                  contacts, the screening volumetrics and the regulator's published
//                  in-place. One asset, so the tab cannot disagree with the tree.
//   pressure       every `pressure` asset — real MDT/LWD gauge runs. Each run is one
//                  test at one depth, and the formation pressure is the stabilised
//                  buildup plateau inside it — NOT the last sample, which is usually
//                  the mud column the tool retracted into. See fluids-depth.ts: on
//                  this delivery that distinction is worth ~100 bar per station.
//   trajectories   the survey for each of those wells, so a gauge depth in MD can be
//                  put on the TVDSS axis the initialization lives on. A station with
//                  no survey to convert it is DROPPED, not plotted at its MD — an
//                  MD plotted as TVD in a deviated well is a fabricated depth.
import { useEffect, useState } from 'react';
import { readRecord } from '../../dataqc/readDigest';
import { wellKey } from '../../dataqc/audit';
import { useScene } from './scene';
import { getWorkspace, type Workspace } from './workspace';
import type { DigestedCurve, DigestedLog } from '../../dataqc/types';
import type { PublishedArchie } from './petro-compute';
import {
  readAnchors, buildCase, swcFromLogs, applyPublishedShf, SCAL_ANALOGUE, ROCK_DEFAULTS,
  type ContactSpec, type DynamicInitialization, type FluidAnchors, type PublishedShf,
  type PressurePoint, type RockModel, type SatSample, type ScalEndpoints, type SwcAnchor,
} from './fluid-model';
import {
  kbElevation, stationsOf, tvdAtMd, tvdssOf,
  type PressPayloadLike as PressPayload, type SurveyStation,
} from './fluids-depth';

export * from './fluids-depth';

/** The parts of the well master this stage reads beyond the PVT block itself. */
interface MasterExtras {
  contacts?: ContactSpec[];
  defaults?: { phi?: number; ntg?: number; sw?: number; bo?: number };
  official?: { stoiipMMSm3?: number; giipBcm?: number; producedOilMMSm3?: number; reservoir?: string; drive?: string };
  validation?: { stoiip?: { grvMm3?: number; stoiipMMSm3?: number; owc?: number; method?: string } };
  pvt?: { source?: string; Bo_note?: string; T?: number };
  shf?: PublishedShf & { archie?: PublishedArchie; brine?: PublishedArchie['brine'] };
}

interface TrajPayload { well?: string; stations?: SurveyStation[] }

/** Curve-name families this stage needs. The delivery's LFP wells publish SWE/PHIE/VSH;
 *  other operators name them differently, so match a family rather than one mnemonic. */
const SAT_CURVE = /^(SW|SWE|SWT|SUWI|SWIR)$/i;
const POR_CURVE = /^(PHIE|PHIF|PHI|POR|PHIT)$/i;
const SHALE_CURVE = /^(VSH|VCL|VSHALE|VCLAY)$/i;

/**
 * Pull one curve out of a DIGESTED log.
 *
 * Note the shape. The raw delivery file keys curves by name; the INGESTED asset — what
 * this module actually reads — stores them as a `DigestedCurve[]`. Assuming the raw
 * shape here silently yields no curves and therefore no anchor, with nothing on screen
 * to say why, so the array form is what is matched.
 */
const pickCurve = (curves: DigestedCurve[] | undefined, re: RegExp): (number | null)[] | null => {
  for (const c of curves ?? []) {
    if (!Array.isArray(c?.values)) continue;
    if (re.test(String(c.mnemonic ?? '')) || (c.family && re.test(String(c.family)))) return c.values;
  }
  return null;
};

/**
 * The interpreted saturation samples the delivery carries, per well.
 *
 * Only wells that publish saturation, porosity AND shale volume together can enter a
 * Buckles analysis — a saturation with no porosity beside it cannot be turned into a
 * Buckles number, and one with no shale volume cannot be screened for clean rock.
 * Wells missing any of the three are simply absent from the result rather than
 * half-included.
 */
export async function loadSatSamples(ws: Workspace): Promise<Array<{ well: string; samples: SatSample[] }>> {
  // ONLY open the logs that can possibly contribute.
  //
  // The workspace already inventoried which curve TYPES each bore carries, so the
  // wells with an interpreted saturation are known before a single asset is read.
  // Opening all of them instead means decompressing every curve of every well —
  // on this delivery, 24 logs to find the 3 that matter — and that ran on the main
  // thread and locked the tab. Read the inventory, then read three assets.
  const wanted = new Set<string>();
  for (const bore of ws.bores) {
    const hasSat = bore.curves.some((k) => SAT_CURVE.test(k));
    const hasPor = bore.curves.some((k) => POR_CURVE.test(k));
    const hasShale = bore.curves.some((k) => SHALE_CURVE.test(k));
    if (hasSat && hasPor && hasShale && bore.assetIds.log) wanted.add(bore.assetIds.log);
  }
  const logs = ws.assets.filter((a) => a.kind === 'log' && wanted.has(a.id));
  if (!logs.length) return [];

  const out = await Promise.all(logs.map(async (a) => {
    const rec = await readRecord<DigestedLog>(a).catch(() => null);
    const well = String(rec?.well ?? a.meta.well ?? '').trim();
    if (!rec || !well) return null;
    const sw = pickCurve(rec.curves, SAT_CURVE);
    const phi = pickCurve(rec.curves, POR_CURVE);
    const vsh = pickCurve(rec.curves, SHALE_CURVE);
    if (!sw || !phi || !vsh) return null;
    const n = Math.min(sw.length, phi.length, vsh.length);
    const samples: SatSample[] = [];
    for (let i = 0; i < n; i++) {
      const s = sw[i], p = phi[i], v = vsh[i];
      if (s == null || p == null || v == null) continue;
      if (!Number.isFinite(s) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
      samples.push({ sw: s, phi: p, vsh: v });
    }
    return samples.length ? { well, samples } : null;
  }));
  return out.filter((v): v is { well: string; samples: SatSample[] } => !!v);
}

/**
 * Every measured formation pressure in the delivery, on the TVDSS axis.
 *
 * Reported alongside how many stations could NOT be placed, because "37 gauge
 * readings, 6 of them unplaceable" and "31 gauge readings" are different statements
 * about the delivery and the second one quietly loses six tests.
 */
export async function loadPressurePoints(
  ws: Workspace,
  kbByBore: Map<string, number>,
): Promise<{ points: PressurePoint[]; unplaceable: number; wells: number; noKb: number }> {
  const byId = new Map(ws.assets.map((a) => [a.id, a]));
  const pressAssets = ws.assets.filter((a) => a.kind === 'pressure');
  if (!pressAssets.length) return { points: [], unplaceable: 0, wells: 0, noKb: 0 };

  // surveys, keyed the same way the workspace keys bores
  const surveys = new Map<string, Array<{ md?: number; tvd?: number }>>();
  await Promise.all(ws.assets.filter((a) => a.kind === 'trajectory').map(async (a) => {
    const rec = await readRecord<TrajPayload>(a).catch(() => null);
    const well = String(rec?.well ?? a.meta.well ?? '').trim();
    if (well && rec?.stations?.length) surveys.set(wellKey(well), rec.stations);
  }));

  const points: PressurePoint[] = [];
  let unplaceable = 0, noKb = 0;
  const wells = new Set<string>();
  await Promise.all(pressAssets.map(async (asset) => {
    const rec = await readRecord<PressPayload>(byId.get(asset.id) ?? asset).catch(() => null);
    const well = String(rec?.well ?? asset.meta.well ?? '').trim();
    if (!rec || !well) return;
    const key = wellKey(well);
    const survey = surveys.get(key);
    const kb = kbByBore.get(key);
    // the depth hint is what lets a retracted-tool reading be rejected on physical
    // grounds rather than by a magic number — see fluids-depth.formationPressure
    const hint = (md: number) => {
      if (kb == null || !survey) return null;
      const tvd = tvdAtMd(survey, md);
      return tvd == null ? null : tvdssOf(tvd, kb);
    };
    const stations = stationsOf(rec, hint);
    if (kb == null) { noKb += stations.length; return; }
    for (const s of stations) {
      const tvd = survey ? tvdAtMd(survey, s.md) : null;
      if (tvd == null) { unplaceable++; continue; }
      wells.add(well);
      points.push({
        well, tvdss: tvdssOf(tvd, kb), pressure: s.pressure,
        md: s.md, temperature: s.temperature, quality: s.quality,
      });
    }
  }));

  points.sort((a, b) => a.tvdss - b.tvdss);
  return { points, unplaceable, wells: wells.size, noKb };
}

/** Everything the stage reads, before any user override is applied. */
export interface FluidBasis {
  anchors: FluidAnchors | null;
  contacts: ContactSpec[];
  extras: MasterExtras;
  /** the rock the delivery's own defaults describe */
  rock: RockModel;
  points: PressurePoint[];
  /** stations whose gauge depth falls outside the well's own survey */
  unplaceable: number;
  /** stations on a bore the master publishes no rig-floor elevation for */
  noKb: number;
  pressureWells: number;
  /** wells that carry a pressure asset at all — the ceiling on `pressureWells` */
  boresWithPressure: number;
  /**
   * Connate water read off the delivery's own interpreted logs, when it has any.
   * OFFERED, never applied silently: it is an interpretation of an interpretation,
   * and swapping the analogue for it changes the in-place volume — so the engineer
   * takes it deliberately or not at all.
   */
  swcAnchor: SwcAnchor | null;
  /** wells that publish interpreted saturation at all */
  satWells: number;
  /** why there is no case, when there is none */
  gap: string | null;
}

/** Read the delivery's fluid/rock basis. Never throws; an unreadable delivery yields
 *  a basis with a stated gap rather than a half-built case. */
export async function loadFluidBasis(fieldId: string, dataVersion = 0): Promise<FluidBasis> {
  const empty: FluidBasis = {
    anchors: null, contacts: [], extras: {}, rock: ROCK_DEFAULTS,
    points: [], unplaceable: 0, noKb: 0, pressureWells: 0, boresWithPressure: 0, swcAnchor: null, satWells: 0,
    gap: 'The delivery has not been digested yet.',
  };
  const ws = await getWorkspace(fieldId, dataVersion).catch(() => null);
  if (!ws || !ws.assets.length) return empty;

  const masterAsset = ws.assets.find((a) => a.kind === 'wellmaster');
  if (!masterAsset) {
    // A package mid-ingest and a package with no master look identical if you only
    // check for the master. They are opposite statements, so they are separated:
    // one resolves itself by waiting, the other never will.
    return {
      ...empty,
      gap: ws.assets.length
        ? 'The delivery is still digesting — the well master, which carries the PVT block, has not landed yet.'
        : 'This delivery carries no well master, so it publishes no PVT block.',
    };
  }
  const master = await readRecord<MasterExtras & Parameters<typeof readAnchors>[0] & { wells?: Array<{ name?: string; kb?: unknown }> }>(masterAsset).catch(() => null);
  const anchors = readAnchors(master);
  const boresWithPressure = ws.bores.filter((b) => b.hasPressure).length;

  const kbByBore = new Map<string, number>();
  for (const w of master?.wells ?? []) {
    const kb = kbElevation(w?.kb);
    if (w?.name && kb != null) kbByBore.set(wellKey(String(w.name)), kb);
  }

  const [{ points, unplaceable, wells, noKb }, satPerWell] = await Promise.all([
    loadPressurePoints(ws, kbByBore).catch(() => ({ points: [], unplaceable: 0, wells: 0, noKb: 0 })),
    loadSatSamples(ws).catch(() => [] as Array<{ well: string; samples: SatSample[] }>),
  ]);

  const d = master?.defaults;
  const rock: RockModel = {
    ...ROCK_DEFAULTS,
    phi: Number.isFinite(d?.phi) ? (d!.phi as number) : ROCK_DEFAULTS.phi,
    ntg: Number.isFinite(d?.ntg) ? (d!.ntg as number) : ROCK_DEFAULTS.ntg,
    sw: Number.isFinite(d?.sw) ? (d!.sw as number) : ROCK_DEFAULTS.sw,
    cf: anchors?.rockCf ?? ROCK_DEFAULTS.cf,
    pref: anchors?.rockPref ?? ROCK_DEFAULTS.pref,
    basis: {
      phi: d?.phi != null ? 'deck' : 'analogue',
      ntg: d?.ntg != null ? 'deck' : 'analogue',
      sw: d?.sw != null ? 'deck' : 'analogue',
      kMd: 'analogue',
      cf: anchors ? 'deck' : 'analogue',
    },
  };

  return {
    anchors,
    contacts: (master?.contacts ?? []).filter((c) => Number.isFinite(c?.tvdss)) as ContactSpec[],
    extras: master ?? {},
    rock,
    points, unplaceable, noKb, pressureWells: wells, boresWithPressure,
    // read at the delivery's own porosity, so the offered Swc and the volumetrics it
    // would feed are on the same rock
    swcAnchor: swcFromLogs(satPerWell, rock.phi),
    satWells: satPerWell.length,
    gap: anchors ? null : 'This delivery publishes no PVT block — there is nothing to build a fluid model from.',
  };
}

/**
 * The Archie constants and reservoir temperature this delivery publishes, for the
 * Petrophysics tab.
 *
 * Deliberately a THIN read — only the well master, none of the pressure or saturation
 * work `useFluidBasis` does — because Petrophysics needs four numbers, not a fluid
 * case, and should not pay for one to get them. The underlying workspace query is the
 * same cached one, so this costs a single digest read.
 */
export function usePublishedArchie(): { archie: PublishedArchie | null; reservoirTempC: number | null; ready: boolean } {
  const fieldId = useScene((s) => s.fieldId);
  const dataVersion = useScene((s) => s.dataVersion);
  const [state, setState] = useState<{ archie: PublishedArchie | null; reservoirTempC: number | null; ready: boolean }>(
    { archie: null, reservoirTempC: null, ready: false },
  );
  useEffect(() => {
    if (!fieldId) return;
    let alive = true;
    (async () => {
      const ws = await getWorkspace(fieldId, dataVersion).catch(() => null);
      const master = ws?.assets.find((a) => a.kind === 'wellmaster');
      if (!master) { if (alive) setState({ archie: null, reservoirTempC: null, ready: true }); return; }
      const rec = await readRecord<MasterExtras & { pvt?: { T?: number } }>(master).catch(() => null);
      const shf = rec?.shf;
      if (!alive) return;
      setState({
        archie: shf?.archie ? { ...shf.archie, brine: shf.brine } : null,
        reservoirTempC: Number.isFinite(rec?.pvt?.T) ? (rec!.pvt!.T as number) : null,
        ready: true,
      });
    })();
    return () => { alive = false; };
  }, [fieldId, dataVersion]);
  return state;
}

/** Endpoints and rock the engineer has moved off the delivery's own basis. */
export interface FluidOverrides {
  scal?: Partial<ScalEndpoints>;
  rock?: Partial<Pick<RockModel, 'phi' | 'ntg' | 'sw' | 'kMd'>>;
}

/** Assemble the published case from the basis plus whatever has been overridden. */
export function assembleCase(fieldId: string, basis: FluidBasis, over: FluidOverrides): DynamicInitialization | null {
  if (!basis.anchors) return null;
  const touchedScal = Object.keys(over.scal ?? {}).length > 0;
  const rockBasis = { ...basis.rock.basis };
  for (const key of Object.keys(over.rock ?? {}) as Array<keyof NonNullable<FluidOverrides['rock']>>) {
    rockBasis[key] = 'user';
  }
  // THE CAPILLARY SIDE COMES FROM THE DELIVERY WHEN THE DELIVERY PUBLISHES IT.
  // The analogue Brooks–Corey pair (J_entry 0.25, λ 2.0) produces a transition zone
  // 16–900× too thin against Volve's own published Swn = 2.222·J^-1.111. So a
  // published SHF supersedes it — and only the capillary terms, never the kr end
  // points, which are a different measurement the report does not supply.
  const rockK = over.rock?.kMd ?? basis.rock.kMd;
  const shf = basis.extras.shf ?? null;
  const withShf = applyPublishedShf(SCAL_ANALOGUE, shf, rockK);
  return buildCase({
    fieldId,
    anchors: basis.anchors,
    scal: { ...withShf, ...over.scal },
    scalBasis: touchedScal ? 'user' : shf ? 'interpreted' : 'analogue',
    rock: { ...basis.rock, ...over.rock, basis: rockBasis },
    contacts: basis.contacts,
    pressurePoints: basis.points,
    grvM3: basis.extras.validation?.stoiip?.grvMm3 ? basis.extras.validation.stoiip.grvMm3 * 1e6 : null,
    officialStoiipMMSm3: basis.extras.official?.stoiipMMSm3 ?? null,
    officialGiipBcm: basis.extras.official?.giipBcm ?? null,
    producedOilMMSm3: basis.extras.official?.producedOilMMSm3 ?? null,
  });
}

/**
 * Subscribe to the fluid basis for the field the scene is on.
 *
 * `ready` separates "still reading" from "read, and the delivery genuinely has no
 * PVT". It goes false only on the FIRST read of a field — a package digesting in the
 * background bumps `dataVersion` every few seconds, and blanking the whole case back
 * to a spinner on each bump would mean the tab showed nothing for the several minutes
 * a cold ingest takes. Instead the case stays on screen and gains stations as they
 * land, which is what the rest of the suite does.
 */
export function useFluidBasis(): { basis: FluidBasis; ready: boolean } {
  const fieldId = useScene((s) => s.fieldId);
  const dataVersion = useScene((s) => s.dataVersion);
  const [state, setState] = useState<{ basis: FluidBasis; ready: boolean }>(() => ({
    basis: {
      anchors: null, contacts: [], extras: {}, rock: ROCK_DEFAULTS,
      points: [], unplaceable: 0, noKb: 0, pressureWells: 0, boresWithPressure: 0, swcAnchor: null, satWells: 0, gap: null,
    },
    ready: false,
  }));

  // Only a change of FIELD resets to the loading state; a data-version bump re-reads
  // in place and swaps the result in when it arrives.
  useEffect(() => {
    setState((prev) => ({ ...prev, ready: false }));
  }, [fieldId]);

  useEffect(() => {
    if (!fieldId) return;
    let alive = true;
    loadFluidBasis(fieldId, dataVersion)
      .then((basis) => { if (alive) setState({ basis, ready: true }); })
      .catch(() => { if (alive) setState((p) => ({ basis: { ...p.basis, gap: 'The delivery could not be read.' }, ready: true })); });
    return () => { alive = false; };
  }, [fieldId, dataVersion]);

  return state;
}

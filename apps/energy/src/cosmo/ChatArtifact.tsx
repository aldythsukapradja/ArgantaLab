// cosmo/ChatArtifact.tsx — real content, mounted inside the answer itself.
//
// `AnswerCard.artifact` has carried a {component, props} pair since the card
// type was written, and nothing ever rendered it: the agent could tell you a
// basin had 49 figures and then send you to another pane to look at them. An
// answer that describes evidence it will not show is doing half the job.
//
// This is the host. It switches on the component key and mounts the SAME
// components the full surfaces use — never a second, chat-flavoured copy of a
// viewer, because two implementations drift and the reader has no way to know
// which one they are looking at.
//
// Anything mounted here is bounded in height and scrolls internally. The chat
// is a conversation, not a dashboard; an artifact that pushes the next message
// off the screen has stopped being an answer and become a takeover.

import { useEffect, useMemo, useState } from 'react';
import { Search, Images, ExternalLink, Route, Activity, Eye } from 'lucide-react';
import {
  figuresForEntity, figureSrc, figureAttribution, isShowable, figureTypeLabel,
  type RegistryFigure,
} from '../tabs/exploration/basin-figure-library';

/** The spine carries the figure registry and the entity→figure links. Loaded
 *  once per session and shared by every artifact that needs it. */
type Spine = Parameters<typeof figuresForEntity>[0];
let spineCache: Spine | null = null;
let spinePromise: Promise<Spine> | null = null;

function loadSpine(): Promise<Spine> {
  if (spineCache) return Promise.resolve(spineCache);
  if (!spinePromise) {
    const base = import.meta.env.BASE_URL ?? '/';
    spinePromise = fetch(`${base}kb/master-kb-spine.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { spineCache = j; return j; })
      .catch(() => null);
  }
  return spinePromise;
}

/** The prompt handed to a Frontier engine for one figure.
 *
 *  It names the FILE, because the agent is a local process that can open it —
 *  and it says so explicitly, since an agent told only "look at this figure"
 *  will apologise that it cannot see images. The caption and attribution ride
 *  along as context the agent would otherwise have to guess at. */
function examinePrompt(f: RegistryFigure, basin?: string): string {
  return [
    `Open and examine this figure: ${f.local_asset_path}`,
    '',
    `It is a ${figureTypeLabel(f.figure_type)}${basin ? ` linked to ${basin}` : ''}.`,
    f.title ? `Title: ${f.title}` : '',
    f.caption ? `Caption: ${f.caption}` : '',
    `Source: ${figureAttribution(f)}`,
    '',
    'Read the image file directly, then tell me what it actually shows and what it',
    'implies for the play. If the image is unreadable or you cannot open it, say so',
    'plainly rather than describing what a figure of this type usually contains.',
  ].filter(Boolean).join('\n');
}

// ── basin figures ────────────────────────────────────────────────────────────

function BasinFigures({ entityId, name, onExamine }: { entityId: string; name?: string; onExamine?: (p: string) => void }) {
  const [spine, setSpine] = useState<Spine | null>(spineCache);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<RegistryFigure | null>(null);

  useEffect(() => {
    let alive = true;
    loadSpine().then((s) => { if (alive) setSpine(s); });
    return () => { alive = false; };
  }, []);

  // Only showable figures. A rights-restricted figure is real and is counted on
  // the card, but it must not be rendered — see basin-figure-library.isShowable.
  const all = useMemo(
    () => figuresForEntity(spine, entityId).filter(isShowable),
    [spine, entityId],
  );

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    // `title` is optional on RegistryFigure -- the registry comes from a
    // spreadsheet -- so search over what is actually there, and fall back to the
    // figure id, which always exists and is what someone hunting a specific
    // figure number would type.
    return all.filter((f) => [f.title, f.caption, f.figure_type, f.figure_id]
      .some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)));
  }, [all, q]);

  if (!spine) return <div className="ca-loading">Loading the figure library…</div>;
  if (!all.length) {
    return <div className="ca-empty">No public-domain figures are linked to {name ?? 'this basin'}.</div>;
  }

  return (
    <div className="ca-figs">
      <div className="ca-figs-bar">
        <Search size={12} strokeWidth={2.2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${all.length} figures — title, caption, type`}
          aria-label="Search figures"
        />
        {q && <span className="ca-figs-count">{hits.length} of {all.length}</span>}
      </div>

      {hits.length === 0 ? (
        <div className="ca-empty">Nothing matches “{q}”.</div>
      ) : (
        <div className="ca-figs-grid">
          {hits.map((f) => (
            <button key={f.figure_id} className="ca-fig" onClick={() => setOpen(f)} title={f.title ?? f.figure_id}>
              <img src={figureSrc(f)} alt={f.title ?? figureTypeLabel(f.figure_type)} loading="lazy" />
              <span className="ca-fig-meta">
                <b>{f.title ?? f.figure_id}</b>
                <em>{figureTypeLabel(f.figure_type)}</em>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="ca-lightbox" onClick={() => setOpen(null)} role="presentation">
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={figureSrc(open)} alt={open.title ?? open.figure_id} />
            <figcaption>
              <b>{open.title ?? open.figure_id}</b>
              {open.caption && <span>{open.caption}</span>}
              {/* Attribution is not decoration: every figure here is someone
                  else's work, shown because it is public domain. */}
              <cite>{figureAttribution(open)}</cite>
              <div className="ca-fig-actions">
                {open.source_url && (
                  <a href={open.source_url} target="_blank" rel="noopener noreferrer nofollow">
                    <ExternalLink size={11} strokeWidth={2.2} /> Source
                  </a>
                )}
                {onExamine && open.local_asset_path && (
                  // The Frontier agent runs on THIS machine with the repo as its
                  // cwd, so it can open the PNG itself. What travels is the path,
                  // not the image -- the bridge carries text only, and inventing
                  // an upload channel that does not exist would fail silently.
                  <button
                    type="button"
                    className="ca-fig-examine"
                    onClick={() => { onExamine(examinePrompt(open, name)); setOpen(null); }}
                  >
                    <Eye size={11} strokeWidth={2.2} /> Examine this figure
                  </button>
                )}
              </div>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

// ── well trajectory ──────────────────────────────────────────────────────────

/** One directional survey station, as the wb bundle publishes it. */
interface Station { md: number; tvd: number; dispNs: number; dispEw: number; incl?: number }

/** Slug matching the wb bundle's own file naming (see dataqc/bundle.ts). */
const slugWell = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const nice = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1));

function WellTrajectory({ well }: { well: string }) {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const base = import.meta.env.BASE_URL ?? '/';
    fetch(`${base}wb/traj-${slugWell(well)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then((j) => { if (alive) setStations(Array.isArray(j?.stations) ? j.stations : []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [well]);

  const geom = useMemo(() => {
    if (!stations?.length) return null;
    // Section view is TVD against HORIZONTAL DISPLACEMENT, not against MD.
    // Plotting MD would draw a deviated well as if it were vertical, which is
    // the one thing a trajectory plot exists to disprove.
    const pts = stations
      .filter((p) => Number.isFinite(p.tvd) && Number.isFinite(p.dispNs) && Number.isFinite(p.dispEw))
      .map((p) => ({ ...p, hd: Math.hypot(p.dispNs, p.dispEw) }));
    if (pts.length < 2) return null;
    const maxHd = Math.max(...pts.map((p) => p.hd), 1);
    const maxTvd = Math.max(...pts.map((p) => p.tvd), 1);
    const ext = Math.max(...pts.map((p) => Math.max(Math.abs(p.dispNs), Math.abs(p.dispEw))), 1);
    return { pts, maxHd, maxTvd, ext, last: pts[pts.length - 1] };
  }, [stations]);

  if (failed) return <div className="ca-empty">No survey file published for {well}.</div>;
  if (!stations) return <div className="ca-loading">Loading the directional survey…</div>;
  if (!geom) return <div className="ca-empty">The survey for {well} has too few usable stations to plot.</div>;

  const W = 300, H = 200, PAD = 26;
  const sx = (hd: number) => PAD + (hd / geom.maxHd) * (W - PAD * 2);
  const sy = (tvd: number) => PAD + (tvd / geom.maxTvd) * (H - PAD * 2);
  const px = (ew: number) => W / 2 + (ew / geom.ext) * (W / 2 - PAD);
  const py = (ns: number) => H / 2 - (ns / geom.ext) * (H / 2 - PAD);

  return (
    <div className="ca-traj">
      <div className="ca-traj-views">
        <figure>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${well} section view`}>
            <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="ca-axis" />
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="ca-axis" />
            <path d={geom.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.hd).toFixed(1)},${sy(p.tvd).toFixed(1)}`).join('')} className="ca-path" />
            <circle cx={sx(geom.pts[0].hd)} cy={sy(geom.pts[0].tvd)} r="2.6" className="ca-dot-start" />
            <circle cx={sx(geom.last.hd)} cy={sy(geom.last.tvd)} r="2.6" className="ca-dot-end" />
          </svg>
          <figcaption>Section · TVD vs horizontal displacement</figcaption>
        </figure>

        <figure>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${well} plan view`}>
            <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} className="ca-axis" />
            <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} className="ca-axis" />
            <path d={geom.pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.dispEw).toFixed(1)},${py(p.dispNs).toFixed(1)}`).join('')} className="ca-path" />
            <circle cx={px(0)} cy={py(0)} r="2.6" className="ca-dot-start" />
            <circle cx={px(geom.last.dispEw)} cy={py(geom.last.dispNs)} r="2.6" className="ca-dot-end" />
          </svg>
          <figcaption>Plan · N up, from the wellhead</figcaption>
        </figure>
      </div>

      <div className="ca-traj-facts">
        <span><b>{geom.pts.length}</b> stations</span>
        <span>TD <b>{nice(geom.last.md)}</b> m MD</span>
        <span>TVD <b>{nice(geom.last.tvd)}</b> m</span>
        <span>Step-out <b>{nice(geom.last.hd)}</b> m</span>
      </div>
    </div>
  );
}

// ── well logs ────────────────────────────────────────────────────────────────

interface LogCurve { source?: string; unit?: string; values: (number | null)[] }
interface LogFile { well: string; depth_unit?: string; md: number[]; curves: Record<string, LogCurve> }

/** The LAS absent convention. It is a perfectly finite number, so a
 *  Number.isFinite guard lets it through -- and a -999.25 plotted on a gamma
 *  track drags the whole scale flat. Screened here for the same reason
 *  petro-xplot screens it. */
const isAbsent = (v: number) => v <= -999 && v >= -9999.99;

/** Tracks worth showing, with the scales a petrophysicist expects to read
 *  them on. Fixed rather than auto-fitted: an auto-scaled gamma track makes
 *  every well look like it has the same shale baseline. */
const LOG_TRACKS: { curve: string; label: string; lo: number; hi: number; log?: boolean; colour: string }[] = [
  { curve: 'GR', label: 'GR', lo: 0, hi: 150, colour: '#16a34a' },
  { curve: 'RT', label: 'RT', lo: 0.2, hi: 2000, log: true, colour: '#e0913a' },
  { curve: 'RHOB', label: 'RHOB', lo: 1.95, hi: 2.95, colour: '#0ea5e9' },
];

function WellLogs({ well }: { well: string }) {
  const [file, setFile] = useState<LogFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const base = import.meta.env.BASE_URL ?? '/';
    fetch(`${base}wb/logs-${slugWell(well)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then((j) => { if (alive) setFile(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [well]);

  const tracks = useMemo(() => {
    if (!file?.md?.length) return null;
    const n = file.md.length;
    // 3,900 samples is more than a 220px-tall track can resolve. Decimating to
    // ~900 keeps every visible inflection and keeps the SVG light.
    const step = Math.max(1, Math.ceil(n / 900));
    const top = file.md[0], bot = file.md[n - 1];
    const present = LOG_TRACKS
      .map((t) => ({ t, c: file.curves?.[t.curve] }))
      .filter((x): x is { t: typeof LOG_TRACKS[number]; c: LogCurve } => !!x.c?.values?.length);
    if (!present.length) return null;
    return { top, bot, step, present, n };
  }, [file]);

  if (failed) return <div className="ca-empty">No log file published for {well}.</div>;
  if (!file) return <div className="ca-loading">Loading the curves…</div>;
  if (!tracks) return <div className="ca-empty">{well} carries no GR, RT or RHOB curve to plot.</div>;

  const H = 230, PAD_T = 16, PAD_B = 14;
  const depthY = (md: number) => PAD_T + ((md - tracks.top) / (tracks.bot - tracks.top || 1)) * (H - PAD_T - PAD_B);

  return (
    <div className="ca-logs">
      <div className="ca-logs-tracks">
        {tracks.present.map(({ t, c }) => {
          const W = 100;
          const scale = (v: number) => {
            const x = t.log
              ? (Math.log10(Math.max(v, t.lo)) - Math.log10(t.lo)) / (Math.log10(t.hi) - Math.log10(t.lo))
              : (v - t.lo) / (t.hi - t.lo);
            return 6 + Math.min(1, Math.max(0, x)) * (W - 12);
          };
          let d = '';
          let penDown = false;
          for (let i = 0; i < tracks.n; i += tracks.step) {
            const v = c.values[i];
            const md = file.md[i];
            if (typeof v !== 'number' || !Number.isFinite(v) || isAbsent(v) || !Number.isFinite(md)) {
              penDown = false;          // a gap is a gap; never bridge across absent samples
              continue;
            }
            d += `${penDown ? 'L' : 'M'}${scale(v).toFixed(1)},${depthY(md).toFixed(1)}`;
            penDown = true;
          }
          return (
            <figure key={t.curve}>
              <figcaption>
                <b style={{ color: t.colour }}>{t.label}</b>
                <span>{t.lo}–{t.hi}{c.unit ? ` ${c.unit}` : ''}{t.log ? ' log' : ''}</span>
              </figcaption>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${t.label} track`}>
                <rect x="0" y={PAD_T} width={W} height={H - PAD_T - PAD_B} className="ca-log-bg" />
                <path d={d} style={{ stroke: t.colour }} className="ca-log-curve" />
              </svg>
            </figure>
          );
        })}
      </div>
      <div className="ca-traj-facts">
        <span>MD <b>{nice(tracks.top)}</b>–<b>{nice(tracks.bot)}</b> {file.depth_unit ?? 'm'}</span>
        <span><b>{tracks.n.toLocaleString('en-US')}</b> samples</span>
        <span><b>{Object.keys(file.curves ?? {}).length}</b> curves on file</span>
      </div>
    </div>
  );
}

// ── petroleum-system events ──────────────────────────────────────────────────

interface PsEvent {
  event_id: string; model_id: string; event_type: string; label?: string;
  start_ma?: number; end_ma?: number; event_status?: string; certainty?: string;
}

/** Magoon & Dow order. A events chart read in any other sequence is just bars. */
const EVENT_ORDER = [
  'deposition', 'source-rock', 'reservoir', 'seal', 'overburden',
  'trap-formation', 'generation', 'expulsion', 'migration', 'accumulation',
  'preservation', 'critical-moment',
];
const eventRank = (t: string) => {
  const i = EVENT_ORDER.indexOf(t);
  return i < 0 ? EVENT_ORDER.length : i;
};

function PsEvents({ provinceId, name }: { provinceId: string; name?: string }) {
  const [spine, setSpine] = useState<any>(spineCache);
  useEffect(() => {
    let alive = true;
    loadSpine().then((sp) => { if (alive) setSpine(sp); });
    return () => { alive = false; };
  }, []);

  const chart = useMemo(() => {
    if (!spine?.psEvent) return null;
    const systems = (spine.petroleumSystem ?? []).filter((p: any) => p.province_id === provinceId);
    if (!systems.length) return null;
    const models = (spine.psModel ?? []).filter((m: any) => systems.some((p: any) => p.tps_id === m.tps_id));
    const events: PsEvent[] = (spine.psEvent ?? [])
      .filter((e: PsEvent) => models.some((m: any) => m.model_id === e.model_id))
      .filter((e: PsEvent) => Number.isFinite(e.start_ma) && Number.isFinite(e.end_ma));
    if (!events.length) return null;

    const oldest = Math.max(...events.map((e) => Math.max(e.start_ma!, e.end_ma!)));
    const critical = events.find((e) => e.event_type === 'critical-moment');
    const bars = events
      .filter((e) => e.event_type !== 'critical-moment')
      .sort((a, b) => eventRank(a.event_type) - eventRank(b.event_type));
    return { systems, bars, critical, oldest: Math.ceil(oldest / 50) * 50 || 100 };
  }, [spine, provinceId]);

  if (!spine) return <div className="ca-loading">Loading the petroleum-system model…</div>;
  if (!chart) return <div className="ca-empty">No modelled petroleum-system events for {name ?? 'this basin'}.</div>;

  // Time runs oldest LEFT to present RIGHT, the convention every events chart
  // uses. Reversing it to match a normal number line would read as wrong to
  // anyone who has seen one before.
  const x = (ma: number) => 100 - (ma / chart.oldest) * 100;
  const derived = chart.bars.filter((b) => b.event_status !== 'modelled').length;

  return (
    <div className="ca-events">
      <div className="ca-ev-sub">{chart.systems.map((s: any) => s.name).join(' · ')}</div>
      <div className="ca-ev-rows">
        {chart.bars.map((e) => {
          const lo = Math.min(e.start_ma!, e.end_ma!);
          const hi = Math.max(e.start_ma!, e.end_ma!);
          const left = x(hi);
          const width = Math.max(x(lo) - x(hi), 1.2);
          return (
            <div className="ca-ev-row" key={e.event_id}>
              <span className="ca-ev-label">{e.label ?? e.event_type}</span>
              <span className="ca-ev-track">
                <i
                  className={'ca-ev-bar' + (e.event_status === 'modelled' ? ' is-modelled' : ' is-derived')}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${hi}–${lo} Ma · ${e.event_status ?? 'unknown status'} · certainty ${e.certainty ?? 'unstated'}`}
                />
                {chart.critical?.start_ma != null && (
                  <b className="ca-ev-crit" style={{ left: `${x(chart.critical.start_ma)}%` }} />
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="ca-ev-axis">
        <span>{chart.oldest} Ma</span><span>present</span>
      </div>
      <div className="ca-ev-key">
        <span><i className="is-modelled" /> modelled</span>
        <span><i className="is-derived" /> derived by rule</span>
        {chart.critical && <span><b /> critical moment</span>}
        {/* Said out loud, because a chart makes everything on it look equally
            measured. Over half of these bars are usually rule-derived. */}
        {derived > 0 && <em>{derived} of {chart.bars.length} bars are rule-derived, not modelled</em>}
      </div>
    </div>
  );
}

// ── the host ─────────────────────────────────────────────────────────────────

export interface ChatArtifactProps {
  component: string;
  props: Record<string, unknown>;
  /** Hand a figure to the Frontier agent, which runs on this machine and can
   *  open the file directly. Absent when no Frontier engine is selected. */
  onExamine?: (prompt: string) => void;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export function ChatArtifact({ component, props, onExamine }: ChatArtifactProps) {
  const body = (() => {
    switch (component) {
      case 'basin-figures': {
        const entityId = str(props.entityId);
        if (!entityId) return null;
        return <BasinFigures entityId={entityId} name={str(props.name)} onExamine={onExamine} />;
      }
      case 'basin-events': {
        const provinceId = str(props.provinceId);
        if (!provinceId) return null;
        return <PsEvents provinceId={provinceId} name={str(props.name)} />;
      }
      case 'well-logs': {
        const well = str(props.well);
        if (!well) return null;
        return <WellLogs well={well} />;
      }
      case 'well-trajectory': {
        const well = str(props.well);
        if (!well) return null;
        return <WellTrajectory well={well} />;
      }
      default:
        // An unknown key is a wiring mistake, not something to paper over with a
        // placeholder that looks like content.
        return null;
    }
  })();

  if (!body) return null;

  return (
    <div className="chat-artifact">
      <div className="ca-head">
        {component === 'well-trajectory' ? <Route size={12} strokeWidth={2.2} />
          : component === 'well-logs' ? <Activity size={12} strokeWidth={2.2} />
            : <Images size={12} strokeWidth={2.2} />}
        <span>{str(props.name) ?? 'Artifact'}</span>
      </div>
      {body}
    </div>
  );
}

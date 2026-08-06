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
import { Search, Images, ExternalLink, Route } from 'lucide-react';
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

// ── basin figures ────────────────────────────────────────────────────────────

function BasinFigures({ entityId, name }: { entityId: string; name?: string }) {
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
              {open.source_url && (
                <a href={open.source_url} target="_blank" rel="noopener noreferrer nofollow">
                  <ExternalLink size={11} strokeWidth={2.2} /> Source
                </a>
              )}
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

// ── the host ─────────────────────────────────────────────────────────────────

export interface ChatArtifactProps {
  component: string;
  props: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export function ChatArtifact({ component, props }: ChatArtifactProps) {
  const body = (() => {
    switch (component) {
      case 'basin-figures': {
        const entityId = str(props.entityId);
        if (!entityId) return null;
        return <BasinFigures entityId={entityId} name={str(props.name)} />;
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
        {component === 'well-trajectory' ? <Route size={12} strokeWidth={2.2} /> : <Images size={12} strokeWidth={2.2} />}
        <span>{str(props.name) ?? (component === 'well-trajectory' ? 'Well path' : 'Figures')}</span>
      </div>
      {body}
    </div>
  );
}

// BasinChartLibrary.tsx — the tectonostratigraphy popup, rebuilt as a chart library.
//
// It used to be two text columns: a list of cycles and Volve's hard-coded stratigraphic
// column. That answered almost nothing, and for 178 basins it never even opened.
//
// A reader opening this wants four things, in this order:
//   1. SHOW ME THE CHART — full size, switchable between the versions we hold
//   2. WHAT WAS THIS BASIN DOING — cycle by cycle, with a picture of the depositional
//      setting, because "sag / marine / carbonate" is not a mental image
//   3. WHAT DOES THAT MEAN FOR PETROLEUM — which cycle sourced, reservoired, sealed
//   4. WHAT ELSE EXISTS THAT I CANNOT SEE HERE — the link-only figures, named and
//      linked rather than silently dropped
//
// Point 4 is the one that changes the character of the panel. Measured across the USGS
// corpus, the best geology figures are third-party plates inside public-domain reports.
// Hiding them made the North Sea Graben — a basin with 14 catalogued figures — look
// like it had one.
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ExternalLink, Lock, Layers, Image as ImageIcon,
  Mountain, Waves, Droplets, ShieldCheck, Flame, Boxes,
} from 'lucide-react';
import {
  figureAttribution, figureSrc, figureTypeLabel, figureSourceLink,
  FIGURE_TYPE_ORDER, type RegistryFigure,
} from './basin-figure-library';
import { DepositionalSchematic, type CycleFacts } from './DepositionalSchematic';

export interface LibraryCycle extends CycleFacts {
  citationStatus?: string;
  confidence?: string;
  /** Petroleum-system elements whose interval sits inside this cycle. */
  elements?: Array<{ unit: string; role?: string; from?: number; to?: number; derived?: boolean }>;
}

/** Symbol per petroleum-system role. A dossier is scanned, not read — a role reads
 *  faster as a mark than as a word, and the same mark is reused on the cycle card, the
 *  element list and the legend so the association is learned once. */
const ROLE_ICON: Record<string, typeof Droplets> = {
  source: Flame, reservoir: Droplets, seal: ShieldCheck,
  overburden: Boxes, mixed: Layers,
};
/** Depositional setting mark, driven by the cycle's own `fill`. */
function FillIcon({ fill }: { fill?: string }) {
  const f = (fill ?? '').toLowerCase();
  if (/non-marine/.test(f)) return <Mountain size={11} />;
  if (/marine|mixed/.test(f)) return <Waves size={11} />;
  return <Layers size={11} />;
}

export function BasinChartLibrary({
  basinName, figures, linkOnly, cycles, onOpenFigure, analogues, analogueCount,
}: {
  basinName: string;
  figures: RegistryFigure[];
  linkOnly: RegistryFigure[];
  cycles: LibraryCycle[];
  onOpenFigure?: (f: RegistryFigure) => void;
  /** Comparable basins from the literature. Rendered as a PAGE, not appended below:
   *  as a sibling it added height beneath a fixed-height panel, which squeezed the
   *  chart frame and clipped the figure inside it. */
  analogues?: React.ReactNode;
  analogueCount?: number;
}) {
  // Version rail: only the types we actually hold, in reading order.
  const types = useMemo(() => {
    const present = new Set(figures.map((f) => f.figure_type));
    return FIGURE_TYPE_ORDER.filter((t) => present.has(t));
  }, [figures]);
  const [type, setType] = useState<string | null>(null);
  const shown = useMemo(
    () => (type ? figures.filter((f) => f.figure_type === type) : figures),
    [figures, type],
  );
  const [idx, setIdx] = useState(0);
  const current = shown[Math.min(idx, Math.max(0, shown.length - 1))] ?? null;

  // The panel pages sideways instead of scrolling. A dossier popup that scrolls hides
  // its own contents — you cannot tell from the first screen that a "not
  // redistributable" section exists at all. Three fixed-height pages, arrow-navigable,
  // make the whole shape of what we hold visible immediately.
  const pages = useMemo(() => {
    const p = [
      { key: 'chart', label: 'Charts', n: figures.length },
      { key: 'cycles', label: 'Basin cycles', n: cycles.length },
    ];
    if (linkOnly.length) p.push({ key: 'locked', label: 'Link-only', n: linkOnly.length });
    if (analogues) p.push({ key: 'analogue', label: 'Analogues', n: analogueCount ?? 0 });
    return p;
  }, [figures.length, cycles.length, linkOnly.length, analogues, analogueCount]);
  const [page, setPage] = useState(0);
  const go = (d: number) => setPage((v) => (v + d + pages.length) % pages.length);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  const at = pages[page]?.key;

  return (
    <div className="exs-lib">
      <nav className="exs-lib-pager">
        <button onClick={() => go(-1)} aria-label="Previous section"><ChevronLeft size={14} /></button>
        <div className="exs-lib-pagetabs">
          {pages.map((p, i) => (
            <button key={p.key} className={'exs-lib-pagetab' + (i === page ? ' on' : '')}
              onClick={() => setPage(i)}>
              {p.label} <em>{p.n}</em>
            </button>
          ))}
        </div>
        <button onClick={() => go(1)} aria-label="Next section"><ChevronRight size={14} /></button>
      </nav>

      {/* ── 1 · the chart stage ─────────────────────────────────────────── */}
      {at === 'chart' && (
      <section className="exs-lib-stage">
        <div className="exs-lib-rail">
          <button className={'exs-lib-tab' + (type === null ? ' on' : '')}
            onClick={() => { setType(null); setIdx(0); }}>
            All <em>{figures.length}</em>
          </button>
          {types.map((t) => (
            <button key={t} className={'exs-lib-tab' + (type === t ? ' on' : '')}
              onClick={() => { setType(t); setIdx(0); }}>
              {figureTypeLabel(t)} <em>{figures.filter((f) => f.figure_type === t).length}</em>
            </button>
          ))}
        </div>

        {current ? (
          <>
            <button className="exs-lib-frame" onClick={() => onOpenFigure?.(current)}
              title="Click to enlarge">
              <img src={figureSrc(current)} alt={current.caption ?? ''} />
            </button>
            <div className="exs-lib-cap">
              <b>{figureTypeLabel(current.figure_type)}</b>
              <p>{current.caption}</p>
              <small>{figureAttribution(current)}</small>
            </div>
            {shown.length > 1 && (
              <div className="exs-lib-dots">
                {shown.map((f, i) => (
                  <button key={f.figure_id} className={'exs-lib-dot' + (i === idx ? ' on' : '')}
                    onClick={() => setIdx(i)} title={f.caption ?? ''} aria-label={f.caption ?? ''} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="exs-lib-empty">
            <ImageIcon size={18} />
            <b>No redistributable chart for {basinName}</b>
            <span>
              {linkOnly.length
                ? `${linkOnly.length} published figure${linkOnly.length > 1 ? 's exist' : ' exists'} but cannot be reproduced here — listed below with their sources.`
                : 'Nothing published has been located yet. The schematics below are drawn from the basin cycle framework.'}
            </span>
          </div>
        )}
      </section>
      )}

      {/* ── 2 · the basin story, cycle by cycle ─────────────────────────── */}
      {at === 'cycles' && (
      <section className="exs-lib-cycles">
        <h4 className="exs-modal-h4">
          <Layers size={12} /> Basin cycles <em>{cycles.length}</em>
        </h4>
        <p className="exs-kb-note">
          Each schematic is <b>generated from this cycle's own recorded facts</b> —
          geodynamics sets the basin shape, fill sets whether the section is subaqueous,
          lithology sets the ornament. It is an original drawing, not a reproduction, and
          it is schematic: no scale, no real geometry.
        </p>
        <div className="exs-lib-cycrow">
          {cycles.map((c) => (
            <article className="exs-lib-cyc" key={c.id}>
              <DepositionalSchematic cycle={c} />
              <header>
                <b>{c.title}</b>
                <span>{c.ageMa ? `${c.ageMa[0]}–${c.ageMa[1]} Ma` : ''}</span>
              </header>
              <dl>
                <div><dt>Stage</dt><dd>{c.stage ?? c.geodynamics ?? '—'}</dd></div>
                <div><dt>Fill</dt><dd><FillIcon fill={c.fill} />{c.fill ?? '—'}</dd></div>
                <div><dt>Lithology</dt><dd>{c.lithology ?? '—'}</dd></div>
                <div><dt>PS role</dt><dd className={'role-' + (c.dominantRole ?? '').split(' ')[0]}>
                  {(() => {
                    const Icon = ROLE_ICON[(c.dominantRole ?? '').split(' ')[0]];
                    return Icon ? <Icon size={11} /> : null;
                  })()}
                  {c.dominantRole ?? '—'}
                </dd></div>
              </dl>
              {c.units && <p className="exs-lib-units">{c.units}</p>}
              {/* 3 · petroleum-system alignment — which elements sit in this cycle */}
              {c.elements && c.elements.length > 0 && (
                <ul className="exs-lib-els">
                  {c.elements.slice(0, 5).map((e, i) => (
                    <li key={i} className={'role-' + (e.role ?? 'none')}>
                      {(() => {
                        const Icon = ROLE_ICON[e.role ?? ''];
                        return Icon ? <Icon size={9} /> : <i />;
                      })()}
                      {e.unit}
                      {e.derived && <em title="derived by rule, not evidence"> ~</em>}
                    </li>
                  ))}
                </ul>
              )}
              {c.citationStatus === 'recalled' && (
                <small className="exs-lib-flag">recalled — unverified against literature</small>
              )}
            </article>
          ))}
        </div>
      </section>
      )}

      {/* ── 5 · analogues — other basins, a different question ──────────── */}
      {at === 'analogue' && analogues && (
        <section className="exs-lib-analogues">{analogues}</section>
      )}

      {/* ── 4 · what exists but cannot be shown ─────────────────────────── */}
      {at === 'locked' && linkOnly.length > 0 && (
        <section className="exs-lib-locked">
          <h4 className="exs-modal-h4">
            <Lock size={12} /> Published but not redistributable <em>{linkOnly.length}</em>
          </h4>
          <p className="exs-kb-note">
            These are figures reproduced inside otherwise public-domain reports from
            third-party rightsholders. Citation is not a licence, so they are catalogued
            and linked rather than copied. They are frequently the most useful figures a
            basin has.
          </p>
          <div className="exs-lib-lockrow">
            {linkOnly.map((f) => {
              const href = figureSourceLink(f);
              return (
                <article className="exs-lib-lock" key={f.figure_id}>
                  <span className="exs-lib-locktype">{figureTypeLabel(f.figure_type)}</span>
                  <b>{f.caption}</b>
                  <small>{f.reviewer_notes ?? figureAttribution(f)}</small>
                  {href
                    ? <a href={href} target="_blank" rel="noreferrer noopener">
                        View at source <ExternalLink size={10} />
                      </a>
                    : <span className="exs-lib-nolink">no public link recorded</span>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

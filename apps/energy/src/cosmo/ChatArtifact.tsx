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
import { Search, Images, ExternalLink } from 'lucide-react';
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
      default:
        // An unknown key is a wiring mistake, not something to paper over with a
        // placeholder that looks like content.
        return null;
    }
  })();

  if (!body) return null;

  return (
    <div className="chat-artifact">
      <div className="ca-head"><Images size={12} strokeWidth={2.2} /><span>{str(props.name) ?? 'Figures'}</span></div>
      {body}
    </div>
  );
}

import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import {
  Bot, BookOpen, ChevronRight, Compass, Drill, GraduationCap, Layers3,
  PanelsTopLeft, Presentation, Waves, Wrench, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  TIERS, stageById, stagesForTier, tierById,
  type MaterialKind, type Stage, type StageId, type TierId,
} from './curriculum';
import { useStore } from '../store';
import './academy.css';

/**
 * Academy — the Volve training concept shell.
 *
 * One page, no page scroll: a card per lifecycle, and nothing else competing
 * with them. Each card carries its own material row — the deck, the dossier,
 * the workspace and that lifecycle's agent — so the card is the launchpad
 * rather than a description of one.
 *
 * The agent used to be a sixth card at the end of the chain. It isn't: every
 * lifecycle has its own agent, and it belongs beside the work it has to
 * reproduce, not after all of it.
 */

const ICONS: Record<StageId, LucideIcon> = {
  'exploration': Compass,
  'field-development': Layers3,
  'well-delivery': Wrench,
  'drilling': Drill,
  'reservoir-management': Waves,
};

const MAT_ICONS: Record<MaterialKind, LucideIcon> = {
  deck: Presentation,
  knowledge: BookOpen,
  workspace: PanelsTopLeft,
  agent: Bot,
};

type Modal =
  | { kind: 'stage'; id: StageId }
  | { kind: 'build' }
  | null;

export function Academy() {
  const [tier, setTier] = useState<TierId>('d1');
  const [modal, setModal] = useState<Modal>(null);
  const requestView = useStore((s) => s.requestView);

  /**
   * Route a material chip. Deck goes to Learn, which holds the day decks; the
   * dossier and workspace are the two modes of the stage's own vertical; the
   * agent chip names its lifecycle so Agents opens on that one rather than the
   * directory index.
   */
  const open = (s: Stage, kind: MaterialKind) => {
    if (kind === 'deck') requestView({ nav: 'learn' });
    else if (kind === 'agent') requestView({ nav: 'agents', sub: s.workspace });
    else requestView({ nav: s.workspace, mode: kind === 'knowledge' ? 'knowledge' : 'workspace' });
  };

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const t = tierById(tier);
  const stages = stagesForTier(tier);
  const activeCount = stages.length;

  return (
    <div className="ac-shell">
      <header className="ac-head">
        <span className="ac-mark"><GraduationCap size={16} /></span>
        <div className="ac-title">
          <b>Fieldcraft</b>
          <small>VOLVE · FULL LIFECYCLE TRAINING</small>
        </div>

        <div className="ac-tiers" role="tablist" aria-label="Course length">
          {TIERS.map((x) => (
            <button
              key={x.id} role="tab" aria-selected={x.id === tier}
              className={x.id === tier ? 'on' : ''}
              onClick={() => setTier(x.id)}
            >{x.chip}</button>
          ))}
        </div>
        <button className="ac-ghost-btn" onClick={() => setModal({ kind: 'build' })}>
          Build sheet
        </button>
      </header>

      <div className="ac-band">
        <div>
          <h1>{t.name}</h1>
          <p>{t.promise}</p>
        </div>
        <span className="ac-adds">{t.adds}</span>
        <div className="ac-stats">
          <div className="ac-stat"><b>{activeCount}</b><span>WORKSPACES</span></div>
          <div className="ac-stat"><b>{t.build.slides}</b><span>SLIDES</span></div>
          <div className="ac-stat"><b>{t.build.questions}</b><span>QUESTIONS</span></div>
          <div className="ac-stat"><b>{t.build.traps}</b><span>TRAPS</span></div>
        </div>
      </div>

      {/* The relay. Only the stages this tier covers — a shorter course reads as a
          complete story, not as a longer one with holes punched in it. */}
      <div className="ac-relay">
        {stages.map((s, i) => {
          const Icon = ICONS[s.id];
          return (
            <Fragment key={s.id}>
              {i > 0 && <div className="ac-link"><ChevronRight size={13} /></div>}
              <button
                className="ac-stage"
                style={{ '--c': s.color } as CSSProperties}
                onClick={() => setModal({ kind: 'stage', id: s.id })}
              >
                <div className="ac-stage-n">
                  <i><Icon size={13} /></i>
                  <u>{s.verb}</u>
                  <em>{s.load[tier] ?? '—'}</em>
                </div>
                <h3>{s.name}</h3>
                <q>{s.question}</q>
                {/* The material row. Each chip is a real shortcut into the app —
                    it stops propagation so it never opens the card's modal. */}
                <div className="ac-mats">
                  {s.materials.map((m) => {
                    const MIcon = MAT_ICONS[m.kind];
                    return (
                      <span
                        key={m.kind} role="button" tabIndex={0}
                        className={`ac-mat ac-mat-${m.kind}`}
                        onClick={(e) => { e.stopPropagation(); open(s, m.kind); }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault(); e.stopPropagation(); open(s, m.kind);
                        }}
                      >
                        <MIcon size={11} />{m.label}
                      </span>
                    );
                  })}
                </div>

                <div className="ac-decision">
                  <b>{s.decision}</b>
                  <div className="ac-baton">↳ <span>{s.handover}</span></div>
                </div>
              </button>
            </Fragment>
          );
        })}
      </div>

      <footer className="ac-foot">
        <span className="ac-foot-note">CONCEPT SHELL · {t.chip} · {activeCount} LIFECYCLE CARDS</span>
      </footer>

      {modal && <Overlay modal={modal} tier={tier} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ── modals ─────────────────────────────────────────────────────────────── */

function Overlay({ modal, tier, onClose }: { modal: NonNullable<Modal>; tier: TierId; onClose: () => void }) {
  return (
    <div className="ac-scrim" onClick={onClose}>
      <div className="ac-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        {modal.kind === 'stage' && <StageBody id={modal.id} tier={tier} onClose={onClose} />}
        {modal.kind === 'build' && <BuildBody tier={tier} onClose={onClose} />}
      </div>
    </div>
  );
}

function Head({ color, kicker, title, onClose }: { color: string; kicker: string; title: string; onClose: () => void }) {
  return (
    <div className="ac-modal-head" style={{ '--c': color } as CSSProperties}>
      <i><GraduationCap size={15} /></i>
      <div>
        <u>{kicker}</u>
        <b>{title}</b>
      </div>
      <button className="ac-x" onClick={onClose} aria-label="Close"><X size={14} /></button>
    </div>
  );
}

function StageBody({ id, tier, onClose }: { id: StageId; tier: TierId; onClose: () => void }) {
  const s = stageById(id);
  const Icon = ICONS[id];
  return (
    <>
      <div className="ac-modal-head" style={{ '--c': s.color } as CSSProperties}>
        <i><Icon size={15} /></i>
        <div>
          <u>{s.verb}</u>
          <b>{s.name}</b>
        </div>
        <button className="ac-x" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <div className="ac-modal-body" style={{ '--c': s.color } as CSSProperties}>
        <p className="ac-q">{s.question}</p>

        <div className="ac-grid2">
          <div className="ac-kv"><u>THE CALL THEY MUST DEFEND</u><b>{s.decision}</b></div>
          <div className="ac-kv"><u>BATON TO THE NEXT STAGE</u><b>{s.handover}</b></div>
        </div>

        <section className="ac-sec">
          <h4>WHAT THEY ACTUALLY DO · {s.load[tier] ?? 'not in this tier'}</h4>
          <ul className="ac-list">
            {s.steps.map((step, i) => <li key={step}><b>{i + 1}</b>{step}</li>)}
          </ul>
        </section>

        <section className="ac-sec">
          <h4>PLANTED TRAPS</h4>
          <ul className="ac-list trap">
            {s.traps.map((trap) => <li key={trap}><b>!</b>{trap}</li>)}
          </ul>
        </section>

        {/* The agent beat, scoped to this lifecycle — always run AFTER the
            hand-work above, or the room has no yardstick to judge it against. */}
        <section className="ac-sec ac-agent-sec">
          <h4>THE AGENT · {s.agent.name.toUpperCase()}</h4>
          <p className="ac-agent-does">{s.agent.does}</p>
          <ul className="ac-list agent">
            {s.agent.acts.map((act, i) => <li key={act}><b>{i + 1}</b>{act}</li>)}
          </ul>
        </section>

        <p className="ac-note">
          Runs in the <b>{s.workspace}</b> workspace — the real app on real Volve data, not a simulation.
        </p>
      </div>
    </>
  );
}

function BuildBody({ tier, onClose }: { tier: TierId; onClose: () => void }) {
  type BuildKey = 'slides' | 'questions' | 'missions' | 'traps' | 'rubrics' | 'scripts';
  const rows: Array<[string, BuildKey]> = [
    ['Slides · 8 per BRIEF', 'slides'],
    ['Quiz questions · 8 per DRILL', 'questions'],
    ['Missions', 'missions'],
    ['Planted traps', 'traps'],
    ['Defence rubrics', 'rubrics'],
    ['Agent demo scripts', 'scripts'],
  ];
  return (
    <>
      <Head color="#0FB5A6" kicker="AUTHORING COST" title="What actually gets built" onClose={onClose} />
      <div className="ac-modal-body">
        <ul className="ac-list">
          {rows.map(([label, key]) => (
            <li key={key} style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{label}</span>
              {TIERS.map((t) => (
                <span key={t.id} style={{
                  width: 44, textAlign: 'right', font: '700 11px var(--mono)',
                  color: t.id === tier ? 'var(--ink)' : 'var(--ink3)',
                }}>{t.build[key]}</span>
              ))}
            </li>
          ))}
          <li style={{ background: 'transparent', border: 0, paddingTop: 0 }}>
            <span style={{ flex: 1 }} />
            {TIERS.map((t) => (
              <span key={t.id} style={{
                width: 44, textAlign: 'right', font: '700 7.5px var(--mono)',
                letterSpacing: '.08em', color: t.id === tier ? 'var(--teal-ink)' : 'var(--ink3)',
              }}>{t.chip}</span>
            ))}
          </li>
        </ul>
        <p className="ac-note">
          Roughly a fifth of the total build gets a sellable 1-day course. The 1-day legs become the
          spine of the longer tiers, so nothing authored first is thrown away — the 3- and 5-day add
          siblings around it rather than replacing it.
        </p>
      </div>
    </>
  );
}

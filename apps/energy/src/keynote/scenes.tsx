// The ten scenes — the v1.0 handoff, cinematically.
//
// Text budget: under 15 words on screen per slide. Anything spoken aloud lives
// in presenter notes, not on the wall. The vision is the hero; the software
// appears once, on slide 7, and never again.
import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { Starfield } from './visuals';
import { KeynoteMap, INDONESIA, FROM_SPACE, type MapTarget } from './KeynoteMap';
import type { CockpitSelection } from '../cosmo/CockpitMap';
import { EventsChartView, TectonoStratChart } from '../tabs/exploration/BasinCharts';
import { basinDossier, type BasinDossier } from './basin-dossier';
import { CalendarRange, Layers, Droplet, Sparkles } from 'lucide-react';

import { BasinLens } from './BasinLens';
import { PerspectiveDonut, ENVIRONMENT_OF, type Mode, type EnvKey } from './PerspectiveDonut';
import { Wedges } from './Wedges';
import { DemoFrame } from './DemoFrame';
import {
  dur, fadeOut, gsap, hold, riseIn, riseLines, SETTLE, type SceneApi,
} from './timeline';

export interface Scene {
  id: string; title: string; emotion: string; punchline: string;
  notes?: string; Component: ComponentType; api: SceneApi;
}

// ═══ 1 · A Vision ══════════════════════════════════════════════ Wonder ════
//
// The one hard constraint on this slide: NOTHING may sit on top of the
// archipelago. Indonesia is wide and shallow, so the type lives in a lower-third
// band and the camera is padded upward by exactly that band's height — the
// islands are never covered, at any viewport, because the map itself is told
// where it is allowed to put them.
const TITLE_BAND = 0.34;

function S01() {
  // The descent: hold in orbit, then fall toward the archipelago.
  const [target, setTarget] = useState<MapTarget>(FROM_SPACE);
  const [pick, setPick] = useState<CockpitSelection | null>(null);
  useEffect(() => {
    const t = setTimeout(
      () => setTarget({ ...INDONESIA, pad: { bottom: TITLE_BAND } }), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="kn-full kn-landing">
      <Starfield density={760} />
      <KeynoteMap dark flyTo={target} veil="lower" onPick={setPick} />

      {/* The band. A gradient, not a panel — the globe bleeds into the type. */}
      <div className="kn-lower" data-title-block>
        <div className="kn-eyebrow" data-rise>The vision</div>
        <h1 className="kn-hero" data-rise="text">
          One Geological Legacy.<br />
          <span className="accent">Connected for the Next Generation.</span>
        </h1>
        {/* data-rise="text" is what revertSplits() looks for — without it this
            line's SplitText wrappers survive re-entering the slide and nest. */}
        <p className="kn-lede" data-rise="text" data-lede>
          The challenge is not whether the knowledge exists. It is whether it
          remains connected, accessible, and&nbsp;alive.
        </p>
        <p className="kn-vision-src" data-rise>
          An interactive proof of concept developed from open
          petroleum-assessment data.
        </p>
      </div>

      <div className="kn-hint" data-hint>
        <span className="kn-hint-dot" />
        Select a basin to begin
      </div>

      {/* Selecting a basin is not a gimmick: it is the proof that the slide is
          the system, not a picture of it. */}
      {pick && <BasinPop pick={pick} onClose={() => setPick(null)} />}
    </section>
  );
}

// ── slide 1's click-through ──────────────────────────────────────────────────
// Tapping a province opens the Knowledge Bank's own two charts — the
// petroleum-system events chart and the tectonostratigraphic column — not a
// picture of them. That is the whole argument of the deck in one interaction:
// the slide is the system.
function BasinPop({ pick, onClose }: { pick: CockpitSelection; onClose: () => void }) {
  const [dossier, setDossier] = useState<BasinDossier | null | 'loading'>('loading');
  // null means "the chart picks"; the effect below replaces it with the real
  // data extent as soon as the dossier lands, so the chart opens zoomed to
  // where the bars are rather than on the full geologic timescale.
  const [range, setRange] = useState<[number, number] | null>(null);

  // Only provinces carry a Knowledge Bank dossier; a field selection falls back
  // to its record rather than showing an empty chart frame.
  const code = pick.type.toLowerCase().includes('province') ? pick.id : null;
  useEffect(() => {
    if (!code) { setDossier(null); return; }
    let live = true;
    setDossier('loading');
    basinDossier(code).then((d) => {
      if (!live) return;
      setDossier(d);
      setRange(d?.dataSpan ?? null);
    });
    return () => { live = false; };
  }, [code]);

  const d = dossier === 'loading' ? null : dossier;
  return (
    <aside className="kn-dossier" role="dialog" aria-label={pick.name}>
      <header>
        <div className="kn-dossier-id">
          <span className="kn-pop-kind">{pick.type}</span>
          <h3 className="kn-pop-name">{pick.name}</h3>
        </div>
        <button className="kn-pop-x" onClick={onClose} aria-label="Close">×</button>
      </header>

      {dossier === 'loading' && <p className="kn-quiet">Reading the Knowledge Bank…</p>}

      {d && (
        <>
          {/* Facts the room can use, as capsules under the basin name. The
              model title and completeness grade that used to sit here were
              internal bookkeeping — "Eocene-Miocene Composite · Grade G0"
              tells a geologist nothing about the basin. Provenance is not
              dropped, only demoted: it now rides with the source line at the
              foot, where it reads as a footnote rather than a warning. */}
          <div className="kn-caps">
            <span className="kn-cap"><Layers size={13} /><b>{d.facts.fields}</b> fields</span>
            {d.facts.discovered > 0 && (
              <span className="kn-cap">
                <Droplet size={13} /><b>{Math.round(d.facts.discovered).toLocaleString()}</b> MMBOE discovered
              </span>
            )}
            {d.facts.assessed > 0 && (
              <span className="kn-cap">
                <Sparkles size={13} /><b>{Math.round(d.facts.assessed).toLocaleString()}</b> MMBOE undiscovered
              </span>
            )}
            {d.facts.firstYear && d.facts.lastYear && (
              <span className="kn-cap">
                <CalendarRange size={13} /><b>{d.facts.firstYear}–{d.facts.lastYear}</b>
              </span>
            )}
          </div>

          {d.events && (
            <section className="kn-dossier-chart">
              <h4>Petroleum system events</h4>
              <EventsChartView chart={d.events} range={range} onRange={setRange} />
            </section>
          )}

          {d.tecto.cycles.length > 0 && (
            <section className="kn-dossier-chart">
              <h4>Tectonostratigraphy · {d.cycleCount} cycles</h4>
              <TectonoStratChart
                periods={d.tecto.periods} cycles={d.tecto.cycles} elements={d.tecto.elements}
                range={range} onRange={setRange} />
            </section>
          )}

          {!d.events && !d.tecto.cycles.length && (
            <p className="kn-quiet">
              No timed petroleum-system model for this province yet — that gap is
              exactly what the framework is for.
            </p>
          )}
        </>
      )}

      {dossier === null && (
        <dl className="kn-pop-rows">
          {pick.detail.slice(0, 6).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      <span className="kn-pop-src">
        {pick.source}
        {d && d.citation !== 'cited' && <> · basin cycles {d.citation}, not yet cited</>}
      </span>
    </aside>
  );
}

/** Stars, then the planet, then the archipelago igniting — and only then type. */
const s01api: SceneApi = {
  enter: (root) => {
    const tl = gsap.timeline();
    const block = root.querySelector('[data-title-block]');
    const hint = root.querySelector('[data-hint]');
    gsap.set([block, hint], { opacity: 0 });
    hold(tl, 5.2);                                   // the descent plays alone
    tl.set(block, { opacity: 1 })
      .add(riseIn(root, '.kn-lower .kn-eyebrow'))
      .add(riseLines(root.querySelector('.kn-hero'), { stagger: 0.12, duration: 1.5 }), '-=0.5')
      .add(riseLines(root.querySelector('[data-lede]'), { duration: 1.2 }), '-=0.7')
      .fromTo(root.querySelector('.kn-vision-src'),
        { opacity: 0 }, { opacity: 1, duration: dur(1.1) }, '-=0.6')
      .to(hint, { opacity: 1, duration: dur(1.2) }, '-=0.4');
    return tl;
  },
  // A slow breath on the hint dot, so the slide never looks frozen while he
  // reads the title.
  idle: (root) => gsap.timeline({ repeat: -1, yoyo: true })
    .to(root.querySelectorAll('.kn-hint-dot'), { opacity: 0.25, duration: dur(1.6), ease: 'sine.inOut' }),
  exit: (root) => fadeOut(root),
};

// ═══ 2 · The Perspective ══════════════════════════════════ Credibility ════
//
// Not a CV. The claim this slide has to earn is that the perspective is broad
// enough to frame the problem — and breadth here means two different things at
// once: across the upstream lifecycle, AND across institutions that create and
// govern technical knowledge very differently.
//
// So the timeline answers "what, and when", and the donut answers the same
// fifteen years twice: what the work WAS, and what kind of place it happened
// in. Behind one switch rather than side by side, because they are one career
// measured two ways and two charts would let you read either alone.
//
// Ground truth: apps/hq biography.ts. Anything not in that file is not here.
const LOGOS = `${import.meta.env.BASE_URL || '/'}keynote/logos/`;

interface Stage {
  id: string;                    // keys ENVIRONMENT_OF in PerspectiveDonut
  stage: [string, string];       // exactly two lines, so the row aligns
  org: string; where?: string;
  logo: string;
  label: string;
  months: number;
  /** Cross-cutting capability rather than a post — see the band below. */
  overlay?: boolean;
}

const JOURNEY: Stage[] = [
  { id: 'itb-beng', stage: ['Petroleum', 'Geology'], org: 'ITB', where: 'B.Eng · Bandung', logo: 'itb.png', label: '2006—10', months: 48 },
  { id: 'itb-grg', stage: ['Regional', 'Geology'], org: 'ITB', where: 'Geodynamics Research Group', logo: 'itb.png', label: '2010—11', months: 12 },
  { id: 'emp', stage: ['Exploration', '& Development'], org: 'Energi Mega Persada', where: 'Jakarta', logo: 'emp.png', label: '2011—12', months: 12 },
  { id: 'ifp-total', stage: ['Petroleum', 'Geosciences'], org: 'TotalEnergies + IFP School', where: 'M.Sc · Paris', logo: 'ifp.png', label: '2012—13', months: 12 },
  { id: 'total-model', stage: ['Reservoir', 'Modeling'], org: 'TotalEnergies', where: 'Mahakam', logo: 'totalenergies.png', label: '2014—16', months: 24 },
  { id: 'total-ops', stage: ['Operations', 'Geology'], org: 'TotalEnergies', where: 'Mahakam', logo: 'totalenergies.png', label: '2016—17', months: 12 },
  { id: 'total-geophys', stage: ['Reservoir', 'Geophysics'], org: 'TotalEnergies', where: 'Mahakam', logo: 'totalenergies.png', label: '2017—18', months: 12 },
  { id: 'phm', stage: ['Well', 'Delivery'], org: 'Pertamina Hulu Mahakam', where: 'Balikpapan', logo: 'pertamina.png', label: '2018—20', months: 24 },
  { id: 'noc-fd', stage: ['Field', 'Development'], org: 'North Oil Company', where: 'Doha', logo: 'noc.png', label: '2020—22', months: 24 },
  { id: 'noc-rm', stage: ['Reservoir', 'Management'], org: 'North Oil Company', where: 'Doha', logo: 'noc.png', label: '2022—now', months: 48 },
];

/** Months per stage, keyed for the environment mix. Digital Transformation is
 *  absent on purpose: it is a capability layered over these years, not a
 *  separate one, and counting it would double-count. */
const MONTHS: Record<string, number> = Object.fromEntries(
  JOURNEY.filter((j) => !j.overlay).map((j) => [j.id, j.months]),
);

/** Where the cross-cutting band starts, as a fraction of the row. Digital
 *  Transformation began around Reservoir Management, so the band opens there
 *  and runs to the end rather than sitting as one more dot on the line. */
const DT_FROM = 8 / JOURNEY.length;

function S02() {
  const [mode, setMode] = useState<Mode>('technical');
  const [env, setEnv] = useState<EnvKey | null>(null);

  return (
    <section className="kn-scene kn-perspective">
      <div className="kn-eyebrow" data-rise>The perspective</div>
      <h2 className="kn-punch" data-rise="text">
        From basin understanding to field stewardship.
      </h2>
      <p className="kn-why" data-rise="text">
        Fifteen years across research, exploration, reservoir characterization,
        well delivery, field development, and reservoir management. Each
        environment revealed a different part of the same challenge: how
        technical knowledge is created, challenged, applied, and eventually
        transferred.
      </p>

      <div className="kn-persp-grid">
        <div className="kn-journey">
          <div className="kn-journey-row">
            {JOURNEY.map((j) => {
              // In environment mode, hovering an arc lifts the stages that
              // belong to it — the chart and the timeline are the same career.
              const dim = env !== null && ENVIRONMENT_OF[j.id] !== env;
              return (
                <article key={j.id} className={'kn-jstage' + (dim ? ' dim' : '')} data-stage>
                  <span className="kn-jlogo"><img src={LOGOS + j.logo} alt="" loading="lazy" /></span>
                  <h3 className="kn-jname">
                    <span>{j.stage[0]}</span>
                    {/* The empty second line is intentional — it holds the row. */}
                    <span>{j.stage[1] || ' '}</span>
                  </h3>
                  <span className="kn-jorg">{j.org}</span>
                  {j.where && <span className="kn-jwhere">{j.where}</span>}
                  <span className="kn-jyear">{j.label}</span>
                  <i className="kn-jtick" />
                </article>
              );
            })}
          </div>

          {/* Digital Transformation as a band, not a dot: it did not replace the
              geoscience, it became a way to connect and scale it. */}
          <div className="kn-dt" style={{ left: `${DT_FROM * 100}%` }} data-dt>
            <span className="kn-dt-line" />
            <span className="kn-dt-label">Digital Transformation</span>
            <span className="kn-dt-note">Connecting knowledge across disciplines, workflows, and decisions.</span>
          </div>
        </div>

        <div className="kn-persp-chart">
          <div className="kn-seg kn-persp-seg" role="group" aria-label="Mix">
            {(['technical', 'environment'] as Mode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''}
                onClick={() => { setMode(m); setEnv(null); }} aria-pressed={mode === m}>
                {m === 'technical' ? 'Technical mix' : 'Environment mix'}
              </button>
            ))}
          </div>
          <PerspectiveDonut mode={mode} months={MONTHS} onHover={setEnv} />
        </div>
      </div>

      <p className="kn-persp-close" data-rise>
        Different disciplines. Different institutions. One connected perspective.
      </p>
    </section>
  );
}

const s02api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root, '.kn-eyebrow, .kn-punch, .kn-why');
    tl.fromTo(root.querySelectorAll('[data-stage]'),
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: dur(0.7), stagger: dur(0.13), ease: 'power2.out' }, '-=0.4');
    // The band arrives last: a capability layered over the years, after the
    // years themselves are on screen.
    tl.fromTo(root.querySelector('[data-dt]'),
      { opacity: 0, scaleX: 0.82, transformOrigin: 'left center' },
      { opacity: 1, scaleX: 1, duration: dur(1.3), ease: SETTLE }, '-=0.3');
    tl.fromTo(root.querySelector('.kn-persp-chart'),
      { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: dur(1.1), ease: SETTLE }, '-=1.0');
    tl.add(riseLines(root.querySelector('.kn-persp-close'), { duration: 1.2 }), '-=0.4');
    return tl;
  },
  exit: (root) => fadeOut(root),
};


// ═══ 4 · The Descent, and the Idea ═══════════ Wonder → Inspiration ════════
//
// Two acts in ONE frame:
//
//   Act I   the DESCENT. ONE circle, three stops: the whole archipelago, then
//           Kutei, then a field inside it. Each stop names the wedge of work
//           that scale unlocks. There is exactly ONE circle on this slide — an
//           earlier build drew the lens AND the depth rail's rings at different
//           centres, which reads as a mistake because it is one.
//   Act II  the IDEA. At the deepest point it reverses: nothing is owned,
//           something spreads.
//
// Generosity, not possession. He is being invited, not lectured.

// The three wedges. NOT spatial scales — the three bodies of work the framework
// delivers, each one earned by looking closer. The descent stops at the field;
// well and core were a ladder for its own sake.
const SCALES = [
  {
    name: 'Petroleum Systems',
    note: 'A consistent framework for comparing petroleum basins across Indonesia.',
  },
  {
    name: 'Basin Evolution Through Time',
    note: 'Tectonostratigraphy · Kutei Basin · East Kalimantan',
  },
  {
    name: 'Fields Understood in Context',
    note: 'Geological setting, reservoir character, development history, neighbouring analogs.',
  },
  // The descent ends by reversing: everything it just looked at, joined.
  {
    name: 'A Connected View of Indonesian Petroleum Geology',
    note: 'One country. Every scale. A connected geological memory.',
  },
];

function S04() {
  // The lens owns the clock now and reports which stop it has reached. The
  // scene used to hold a `depth` float and re-render on every tick — 660
  // renders of a 200-node SVG across one fall, which is what made the descent
  // drag. This re-renders four times.
  const [at, setAt] = useState(0);

  return (
    <section className="kn-full kn-descent">
      {/* Title on top, then two equal panels: the instrument and the evidence.
          The second act — "an understanding, once shared, cannot be taken
          back", and the four shared lines — is gone. It was a second thesis on
          a slide that already had one, and it made the frame jump halfway
          through a single thought. */}
      <div className="kn-descent-grid">
        <header className="kn-descent-head">
          <div className="kn-eyebrow" data-rise>The descent</div>
          <h2 className="kn-scale" data-scale>{SCALES[at].name}</h2>
          <p className="kn-scale-note" data-scale-note>{SCALES[at].note}</p>
          <div className="kn-rungs" aria-hidden>
            {SCALES.map((sc, i) => (
              <span key={sc.name} className={'kn-rung' + (i <= at ? ' on' : '')} />
            ))}
          </div>
        </header>

        {/* The last stop has no card. It is the zoom-OUT — the whole point is
            that everything joins — and a panel of Kutei detail beside it would
            be arguing the opposite. The lens takes the frame alone. */}
        {/* The card stays MOUNTED and fades. Unmounting it at the stop
            boundary was a hard cut at exactly the moment the camera is pulling
            back, and re-mounting three charts is the last thing that frame
            needs. Grid tracks are left alone on purpose — Chrome does not
            interpolate track lists reliably, and a frozen column is worse than
            no animation at all. */}
        <div className={'kn-descent-pair' + (at === SCALES.length - 1 ? ' solo' : '')}>
          <BasinLens onStop={setAt} />
          <Wedges stop={Math.min(at, SCALES.length - 2)} />
        </div>
      </div>
    </section>
  );
}

const s04api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root, '.kn-eyebrow');
    // The two panels arrive together and then the fall runs on its own clock.
    tl.fromTo(root.querySelectorAll('.kn-lens, .kn-wedges'),
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: dur(1.2), stagger: dur(0.14), ease: SETTLE }, '-=0.6');
    return tl;
  },
  exit: (root) => fadeOut(root),
};

// ═══ 5 · Phase One, Built ═══════════════════════════════ Confidence ══════
// The demo is the point of this slide, so it gets three quarters of the wall.
// The copy is compressed into a left rail and the app is shown at a reduced
// zoom so whole screens — not fragments — are legible from the back row.
function S05() {
  return (
    <section className="kn-split">
      <div className="kn-split-copy">
        <div className="kn-eyebrow" data-rise>The first proof</div>
        <h2 className="kn-punch" data-rise="text">
          The first proof is already working.
        </h2>
        <p className="kn-quiet" data-rise="text" style={{ marginTop: 'var(--gap)' }}>
          Built independently from open data, to explore one practical question:
          can fragmented petroleum knowledge become one coherent and accessible
          geological experience?
        </p>
        <p className="kn-quiet kn-humble" data-rise style={{ marginTop: 'var(--gap)' }}>
          It is not complete, and it is not yet authoritative. It demonstrates
          that the concept is technically possible.
        </p>
      </div>
      <div className="kn-split-stage">
        <DemoFrame />
      </div>
    </section>
  );
}


// ═══ 3 · The Mission ═════════════════════════════════════════ Purpose ═════
// The old DISCOVER / UNIFY / LEGACY frame, carrying the real programme. Three
// colour worlds, a giant ghosted ordinal, and the outcome isolated at the foot
// as the payoff rather than one more line of body text.
//
// The order is the argument: you cannot ask a student to interrogate a basin
// before you have taught them how, and an interpretation nobody reads is not a
// contribution. Train, then explore, then publish.
// The order is the argument: prove it on data anyone can check, then earn the
// right to curate Indonesia's own, then hand the whole thing to the people who
// will still be using it in thirty years.
const STAGES = [
  {
    i: '01', n: 'Connect what already exists', name: 'FOUNDATION', accent: '#69D6FF',
    words: ['Integrate open datasets.', 'Establish consistent terminology and structure.', 'Build the working basin-scale foundation.'],
    out: 'Working foundation',
  },
  {
    i: '02', n: 'Challenge it with expertise', name: 'VALIDATE', accent: '#D8B15A',
    words: ['Add curated Indonesian sources.', 'Review interpretations with domain specialists.', 'Record uncertainty, disagreement, and missing evidence.'],
    out: 'Expert review',
  },
  {
    i: '03', n: 'Keep the knowledge in motion', name: 'TRANSFER', accent: '#E8ECF2',
    words: ['Publish reviewed geological layers.', 'Support education and professional development.', 'Maintain continuous feedback and revision.'],
    out: 'Living knowledge base',
  },
];

function S03() {
  return (
    <section className="kn-scene">
      <div className="kn-eyebrow" data-rise>The path forward</div>
      <h2 className="kn-punch" data-rise="text" style={{ maxWidth: '34ch' }}>
        Build the foundation. Challenge the interpretation. Pass it forward.
      </h2>
      <p className="kn-quiet" data-rise style={{ marginTop: 'var(--gap)', maxWidth: '62ch' }}>
        The objective is not one unquestionable interpretation. It is a
        transparent structure where evidence, assumptions, uncertainty, and
        alternative views can be examined together.
      </p>
      <div className="kn-stages">
        {STAGES.map((s) => (
          <article key={s.name} className="kn-stage-card" data-stage-card
            style={{ '--sa': s.accent } as CSSProperties}>
            <span className="kn-stage-i" aria-hidden>{s.i}</span>
            <span className="kn-stage-num">{s.n}</span>
            <h3 className="kn-stage-name" data-stage-name>{s.name}</h3>
            <span className="kn-stage-rule" data-stage-rule />
            <ul className="kn-stage-words">
              {s.words.map((w) => <li key={w}>{w}</li>)}
            </ul>
            <span className="kn-stage-out">{s.out}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Real parallax: the cards arrive as three places, not three columns. */
const s03api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root, '.kn-eyebrow, .kn-punch');
    tl.fromTo(root.querySelectorAll('[data-stage-card]'),
      { opacity: 0, y: 90, rotateX: -8, transformOrigin: 'center top' },
      {
        opacity: 1, y: 0, rotateX: 0,
        duration: dur(1.5), stagger: dur(0.46), ease: 'power3.out',
      }, '<0.3');
    // The rule under each name wipes out to full width after the card lands —
    // a small piece of craft that reads as "assembled", not "faded in".
    tl.fromTo(root.querySelectorAll('[data-stage-rule]'),
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: dur(1.1), stagger: dur(0.46), ease: 'power3.inOut' },
      '<0.45');
    return tl;
  },
  exit: (root) => fadeOut(root),
};

// ═══ 7 · The Ask ════════════════════════════════════════════ Reflection ═══
// Three questions he can answer from his own authority, and nothing that costs
// him a budget. The fourth — the panel — is spoken, not printed: an ask that
// appears on the wall reads as a demand, an ask made out loud is a courtesy.
const ACTS = [
  { verb: 'Challenge', note: 'Test the framework, assumptions, terminology, and interpretations.' },
  { verb: 'Contribute', note: 'Identify missing evidence, overlooked perspectives, and knowledge at risk of being lost.' },
  { verb: 'Carry forward', note: 'Help define how the knowledge should be reviewed, maintained, taught, and improved.' },
];

function S07() {
  return (
    <section className="kn-full">
      <KeynoteMap dark flyTo={{ lon: 120.8, lat: -1.0, zoom: 3.6 }} veil="left" interactive={false} />
      <div className="kn-scene-inner">
        <div style={{ maxWidth: '40ch' }}>
          {/* The ending is deliberately NOT about the person who built it.
              "I have taken this as far as one person can" put the builder at
              the centre of a slide whose whole subject is collective
              continuity. Three verbs, then the resolution. */}
          <div className="kn-eyebrow" data-rise>The next chapter</div>
          <p className="kn-final" data-closing>
            Knowledge endures when it is&nbsp;shared.
          </p>
          <ul className="kn-acts">
            {ACTS.map((a) => (
              <li key={a.verb} data-act>
                <b>{a.verb}</b>
                <span>{a.note}</span>
              </li>
            ))}
          </ul>
          <p className="kn-ask-warm" data-warm>
            The goal is not to preserve one person's interpretation. It is to
            preserve the conditions for better interpretations to&nbsp;follow.
          </p>
        </div>
      </div>
    </section>
  );
}

const s07api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root, '.kn-eyebrow');
    hold(tl, 0.7);
    tl.add(riseLines(root.querySelector('[data-closing]'), { duration: 1.9, stagger: 0.16 }));
    tl.fromTo(root.querySelectorAll('[data-act]'),
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: dur(1.0), stagger: dur(0.55), ease: 'power2.out' }, '-=0.5');
    hold(tl, 1.1);                     // the resolution lands on its own
    tl.add(riseLines(root.querySelector('[data-warm]'), { duration: 1.6, stagger: 0.14 }));
    return tl;
  },
  exit: (root) => fadeOut(root),
};

const standard: SceneApi = { enter: (root) => riseIn(root), exit: (root) => fadeOut(root) };

// ═══ registry ═══════════════════════════════════════════════════════════════
export const SCENES: Scene[] = [
  {
    id: 'vision', title: 'One Geological Legacy', emotion: 'significance',
    punchline: "Indonesia's petroleum knowledge has been built over decades — across basins, fields, institutions, reports, and generations of geoscientists.",
    notes: 'Say nothing for the first five seconds; the descent plays alone. Then: the challenge is not whether the knowledge exists. The map is LIVE — stop and select a basin.',
    Component: S01, api: s01api,
  },
  {
    id: 'perspective', title: 'The Perspective', emotion: 'credibility',
    punchline: 'From basin understanding to field stewardship — shaped across disciplines AND across very different institutional environments.',
    notes: 'Let the timeline draw first. Then switch the capsule to Environment mix: the same fifteen years, read a second way. Hovering an arc lifts the stages it belongs to.',
    Component: S02, api: s02api,
  },
  {
    id: 'descent', title: 'From the Scale of a Nation to the Detail of a Field', emotion: 'clarity',
    punchline: 'Begin with the country. Enter a basin. Follow its evolution through time. Arrive at the petroleum system and its fields.',
    notes: 'Say NOTHING through the fall; it runs on its own. Everything drawn is real geometry. Close on: one country, every scale, a connected geological memory.',
    Component: S04, api: s04api,
  },
  {
    id: 'path', title: 'The Path Forward', emotion: 'responsibility',
    punchline: 'Connect the evidence, challenge the interpretation, then transfer the reviewed knowledge.',
    notes: 'Take the three cards slowly. The closing line is the point: knowledge becomes more valuable when it can be questioned, improved, and inherited.',
    Component: S03, api: s03api,
  },
  {
    id: 'proof', title: 'The First Proof', emotion: 'feasibility',
    punchline: 'The current proof demonstrates the journey from national context to basin evolution, petroleum systems, and field-level understanding.',
    notes: 'Live app, booted dark. Toggle desktop/mobile — one body of knowledge, across screens. Say the humility line out loud; it is not hedging, it is accuracy.',
    Component: S05, api: standard,
  },
  {
    id: 'next', title: 'The Next Chapter', emotion: 'continuity',
    punchline: 'What one generation has learned should become the foundation for the next.',
    notes: 'Three verbs, then stop. The closing line is the last thing in the room — do not fill the silence, and no logo after the fade.',
    Component: S07, api: s07api,
  },
];

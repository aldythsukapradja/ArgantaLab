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
import { Wedges } from './Wedges';
import { DemoFrame } from './DemoFrame';
import {
  dur, fadeOut, gsap, hold, prefersReducedMotion, riseIn, riseLines, SETTLE, type SceneApi,
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
        <h1 className="kn-hero" data-rise="text">
          A Vision for Indonesia's <span className="accent">Geological Legacy</span>
        </h1>
        {/* data-rise="text" is what revertSplits() looks for — without it this
            line's SplitText wrappers survive re-entering the slide and nest. */}
        <p className="kn-lede" data-rise="text" data-lede>
          Proof of Concept based on the USGS World Petroleum Assessment
        </p>
      </div>

      <div className="kn-hint" data-hint>
        <span className="kn-hint-dot" />
        The map is live — tap a basin
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
      .add(riseLines(root.querySelector('.kn-hero'), { stagger: 0.12, duration: 1.5 }))
      .add(riseLines(root.querySelector('[data-lede]'), { duration: 1.2 }), '-=0.7')
      .to(hint, { opacity: 1, duration: dur(1.2) }, '-=0.4');
    return tl;
  },
  // A slow breath on the hint dot, so the slide never looks frozen while he
  // reads the title.
  idle: (root) => gsap.timeline({ repeat: -1, yoyo: true })
    .to(root.querySelectorAll('.kn-hint-dot'), { opacity: 0.25, duration: dur(1.6), ease: 'sine.inOut' }),
  exit: (root) => fadeOut(root),
};

// ═══ 2 · Why I Am Here ════════════════════════════════════ Credibility ════
// The lifecycle, with the organisation that taught each stage, on one dated
// axis. The decorative bezier this replaced carried no information — a career
// is not a sine wave — and it competed with the only thing that matters here,
// which is that every stage has a real employer behind it.
//
// Ground truth: apps/hq biography.ts (the founder's real record). Anything not
// in that file does not belong on this slide.
//
// `stage` is deliberately two lines for EVERY entry so the logos, employers,
// years and ticks align across all ten columns. A ragged first row makes the
// whole strip look assembled rather than designed.
const LOGOS = `${import.meta.env.BASE_URL || '/'}keynote/logos/`;

interface Stage {
  stage: [string, string];       // exactly two lines
  org: string; where?: string;
  /** Reversed variants: only the ink that failed a 4.5:1 contrast floor was
   *  lifted, in HLS, so hue and saturation survive. `*-light.png` beside each
   *  file is the untouched on-white master. */
  logo: string;
  label: string;
}

const JOURNEY: Stage[] = [
  { stage: ['Petroleum', 'Geology'], org: 'Institut Teknologi Bandung', where: 'B.Eng · Bandung', logo: 'itb.png', label: '2006—10' },
  { stage: ['Regional', 'Geology'], org: 'ITB', where: 'Geodynamic Research Group', logo: 'itb.png', label: '2010—11' },
  { stage: ['Exploration', 'Geology'], org: 'Energi Mega Persada', where: 'Jakarta', logo: 'emp.png', label: '2011—12' },
  { stage: ['Appraisal', ''], org: 'IFP School', where: 'Step-Out Potential · M.Sc · Paris', logo: 'ifp.png', label: '2012—13' },
  { stage: ['Reservoir', 'Modeling'], org: 'TotalEnergies', where: 'Mahakam', logo: 'totalenergies.png', label: '2014—16' },
  { stage: ['Seismic Reservoir', 'Characterization'], org: 'TotalEnergies', where: 'Mahakam', logo: 'totalenergies.png', label: '2016—18' },
  { stage: ['Well', 'Delivery'], org: 'Pertamina Hulu Mahakam', where: 'Balikpapan', logo: 'pertamina.png', label: '2018—20' },
  { stage: ['Field', 'Development'], org: 'North Oil Company', where: 'Doha', logo: 'noc.png', label: '2020—22' },
  // Both current, and held at the same time — the axis shows them overlapping
  // rather than in sequence, because that is what is true.
  { stage: ['Reservoir', 'Management'], org: 'North Oil Company', where: 'Doha', logo: 'noc.png', label: '2022—26+' },
  { stage: ['Digital', 'Transformation'], org: 'North Oil Company', where: 'Doha', logo: 'noc.png', label: '2025—26+' },
];

const AXIS = [2006, 2011, 2016, 2021, 2026];

function S02() {
  return (
    <section className="kn-scene">
      <div className="kn-eyebrow" data-rise>Why I am here</div>
      <h2 className="kn-punch" data-rise="text">
        Fifteen years across nearly the entire upstream lifecycle.
      </h2>
      <p className="kn-why" data-rise="text">
        The motive is simpler than the record: to give something back to the
        country that trained me — by preserving the understanding, so the next
        generation inherits an opportunity instead of a gap.
      </p>

      <div className="kn-journey">
        <div className="kn-journey-row">
          {JOURNEY.map((j) => (
            <article key={j.stage.join(' ') + j.label} className="kn-jstage" data-stage>
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
          ))}
        </div>

        {/* One dated axis under the whole strip. */}
        <div className="kn-jaxis" aria-hidden>
          <span className="kn-jaxis-line" data-axis />
          {AXIS.map((y, i) => (
            <span key={y} className="kn-jaxis-tick"
              style={{ left: `${(i / (AXIS.length - 1)) * 100}%` }}>
              {y === 2026 ? '2026+' : y}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const s02api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root);
    // The axis draws left to right — time passing — and the stages land on it
    // in order, so the strip assembles chronologically rather than appearing.
    const axis = root.querySelector('[data-axis]');
    if (axis) {
      tl.fromTo(axis, { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: dur(2.2), ease: 'power2.inOut' }, '<0.2');
    }
    tl.fromTo(root.querySelectorAll('[data-stage]'),
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: dur(0.75), stagger: dur(0.22), ease: 'power2.out' }, '<0.35');
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
  { name: 'Petroleum System', note: 'thirteen provinces, one framework' },
  { name: 'Tectonostratigraphy', note: 'Kutei Basin, East Kalimantan' },
  { name: 'Field Analog', note: 'one field, and its neighbours' },
  // The descent ends by reversing: everything it just looked at, joined.
  { name: 'Unified Indonesian Petroleum Geology', note: 'one knowledge base' },
];

function S04() {
  const [depth, setDepth] = useState(0);        // 0 → 1 across the three stops

  useEffect(() => {
    if (prefersReducedMotion()) { setDepth(1); return; }
    // One continuous fall. Driven by GSAP rather than a CSS animation so it
    // shares the deck's clock. Linear on purpose — the lens eases each leg
    // itself, and easing twice reads as a stutter.
    const o = { d: 0 };
    const tw = gsap.to(o, {
      d: 1, duration: 11, ease: 'none', delay: 1.1,
      onUpdate: () => setDepth(o.d),
    });
    return () => { tw.kill(); };
  }, []);

  const at = Math.min(SCALES.length - 1, Math.round(depth * (SCALES.length - 1)));

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
        <div className={'kn-descent-pair' + (at === SCALES.length - 1 ? ' solo' : '')}>
          <BasinLens depth={depth} />
          {at < SCALES.length - 1 && <Wedges stop={at} />}
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
        <div className="kn-eyebrow" data-rise>Phase one · result</div>
        <h2 className="kn-punch" data-rise="text">
          This part is not a proposal. It already runs.
        </h2>
        <p className="kn-quiet" data-rise="text" style={{ marginTop: 'var(--gap)' }}>
          Built on open data, in the evenings, by one geologist who wanted to
          see whether it could be done at all.
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
    i: '01', n: 'Phase one · proof of concept', name: 'FOUNDATION', accent: '#69D6FF',
    words: ['Open data — USGS, AAPG.', 'Schema and structure.', 'Backend and front end.'],
    out: 'A working MVP',
  },
  {
    i: '02', n: 'Phase two · scale', name: 'SHARPEN', accent: '#D8B15A',
    words: ['Indonesian curated data.', 'Knowledge unified.', 'Peer review.'],
    out: 'A national vertical',
  },
  {
    i: '03', n: 'Phase three · adoption', name: 'PUBLISH', accent: '#E8ECF2',
    words: ['Classes for students and fresh graduates.', 'Publication.', 'Feedback, upkeep, improvement.'],
    out: 'A living knowledge base',
  },
];

function S03() {
  return (
    <section className="kn-scene">
      <div className="kn-eyebrow" data-rise>The mission</div>
      <h2 className="kn-punch" data-rise="text" style={{ maxWidth: '30ch' }}>
        Unify Indonesian petroleum knowledge — then hand it on.
      </h2>
      <p className="kn-quiet" data-rise style={{ marginTop: 'var(--gap)' }}>
        Three phases. The first one already runs.
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
function S07() {
  return (
    <section className="kn-full">
      <KeynoteMap dark flyTo={{ lon: 120.8, lat: -1.0, zoom: 3.6 }} veil="left" interactive={false} />
      <div className="kn-scene-inner">
        <div style={{ maxWidth: '40ch' }}>
          {/* The ask is the last thing in the room, so it should sound like a
              person rather than a form. Numbered questions made it a
              questionnaire; a single flat line made it a challenge. What is
              actually wanted is company. */}
          <div className="kn-eyebrow" data-rise>The ask</div>
          <p className="kn-final" data-closing>
            I have taken this as far as one person&nbsp;can.
          </p>
          <p className="kn-ask-warm" data-warm>
            Tell me where I have it wrong. Tell me what you would do
            differently. And if any part of it is worth building — I would
            rather build it with&nbsp;you.
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
    hold(tl, 1.2);                       // let the admission sit before the ask
    tl.add(riseLines(root.querySelector('[data-warm]'), { duration: 1.6, stagger: 0.14 }));
    return tl;
  },
  exit: (root) => fadeOut(root),
};

const standard: SceneApi = { enter: (root) => riseIn(root), exit: (root) => fadeOut(root) };

// ═══ registry ═══════════════════════════════════════════════════════════════
export const SCENES: Scene[] = [
  {
    id: 'vision', title: "A Vision for Indonesia's Geological Legacy", emotion: 'wonder',
    punchline: 'Indonesia has spent decades discovering its subsurface. The next challenge is preserving the understanding behind those discoveries.',
    notes: 'Say nothing for the first five seconds. The descent plays alone. The map is LIVE — you can stop and tap a basin.',
    Component: S01, api: s01api,
  },
  {
    id: 'why-here', title: 'Why I Am Here', emotion: 'credibility',
    punchline: 'My perspective comes from experiencing nearly the entire upstream lifecycle.',
    notes: 'Let the axis draw before you name the stages. Ten steps, five organisations, twenty years.',
    Component: S02, api: s02api,
  },
  {
    id: 'descent', title: 'The Descent, and the Idea', emotion: 'wonder → inspiration',
    punchline: 'Every scale is the same question, asked closer — and an understanding, once shared, cannot be taken back.',
    notes: 'ONE slide, two acts. Say NOTHING through the fall; it runs nine seconds on its own. The lens holds the real Kutei polygon and its real fields.',
    Component: S04, api: s04api,
  },
  {
    id: 'mission', title: 'The Mission', emotion: 'purpose',
    punchline: 'Unify Indonesian petroleum knowledge — then hand it on, through a GeoHackathon that trains a cohort, sets each of them a basin, and ends in a publication.',
    notes: 'This is the whole proposal. Take the three phases slowly. The last line is the thesis of the deck — let it land alone.',
    Component: S03, api: s03api,
  },
  {
    id: 'phase-one', title: 'Phase One, Built', emotion: 'confidence',
    punchline: 'This part is not a proposal — it already runs, on open data, built in the evenings.',
    notes: 'Live app, booted dark so it does not punch a bright hole in the deck. Toggle desktop/mobile. Switch to Loop if the room has no wifi.',
    Component: S05, api: standard,
  },
  {
    id: 'ask', title: 'The Ask', emotion: 'reflection',
    punchline: 'I have taken this as far as one person can — tell me where I have it wrong, and if any of it is worth building, I would rather build it with you.',
    notes: 'Let the first line land and STOP for a beat before the second. Do not fill the silence afterwards. No logo after the fade.',
    Component: S07, api: s07api,
  },
];

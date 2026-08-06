// The ten scenes — the v1.0 handoff, cinematically.
//
// Text budget: under 15 words on screen per slide. Anything spoken aloud lives
// in presenter notes, not on the wall. The vision is the hero; the software
// appears once, on slide 7, and never again.
import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { Starfield, EcosystemForce } from './visuals';
import { KeynoteMap, INDONESIA, FROM_SPACE, type MapTarget } from './KeynoteMap';
import type { CockpitSelection } from '../cosmo/CockpitMap';
import { EventsChartView, TectonoStratChart } from '../tabs/exploration/BasinCharts';
import { basinDossier, type BasinDossier } from './basin-dossier';
import { ParticleField, DepthRail } from './Stage3D';
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
  const [range, setRange] = useState<[number, number] | null>(null);

  // Only provinces carry a Knowledge Bank dossier; a field selection falls back
  // to its record rather than showing an empty chart frame.
  const code = pick.type.toLowerCase().includes('province') ? pick.id : null;
  useEffect(() => {
    if (!code) { setDossier(null); return; }
    let live = true;
    setDossier('loading');
    basinDossier(code).then((d) => { if (live) setDossier(d); });
    return () => { live = false; };
  }, [code]);

  const d = dossier === 'loading' ? null : dossier;
  return (
    <aside className="kn-dossier" role="dialog" aria-label={pick.name}>
      <header>
        <div>
          <span className="kn-pop-kind">{pick.type}</span>
          <h3 className="kn-pop-name">{pick.name}</h3>
        </div>
        <button className="kn-pop-x" onClick={onClose} aria-label="Close">×</button>
      </header>

      {dossier === 'loading' && <p className="kn-quiet">Reading the Knowledge Bank…</p>}

      {d && (
        <>
          <div className="kn-dossier-meta">
            {d.modelTitle && <span title={d.modelTitle}>{d.modelTitle}</span>}
            {d.grade && <b>Grade {d.grade}</b>}
            {/* The deck's thesis is "measure it, don't claim it", so the weakest
                citation state on screen is stated, never buried. */}
            <em className={`kn-cite ${d.citation}`}>{d.citation}</em>
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
      <span className="kn-pop-src">{pick.source}</span>
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
const JOURNEY = [
  'Regional Geology', 'Exploration', 'Operations Geology', 'Well Delivery',
  'Development', 'Reservoir Management', 'Digital Transformation',
];
const PROOF = ['Mahakam', 'Sisi Nubi', 'Ruya', 'Jumelai', 'Mauddud', 'North Oil Company'];

function S02() {
  return (
    <section className="kn-scene">
      <div className="kn-eyebrow" data-rise>Why I am here</div>
      <h2 className="kn-punch" data-rise="text">Nearly the entire upstream lifecycle.</h2>
      <div className="kn-traj">
        <svg className="kn-traj-svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
          <path d="M20,168 C180,168 200,40 340,40 C480,40 500,150 640,150 C780,150 820,44 980,44"
            data-traj-path />
        </svg>
        <div className="kn-traj-stages">
          {JOURNEY.map((s) => (
            <span key={s} className="kn-traj-stage" data-stage><i /><b>{s}</b></span>
          ))}
        </div>
      </div>
      <div className="kn-proof">
        {PROOF.map((p) => <span key={p} className="kn-proof-chip" data-proof>{p}</span>)}
      </div>
    </section>
  );
}

const s02api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root);
    const path = root.querySelector<SVGPathElement>('[data-traj-path]');
    // DrawSVG rather than a dash-offset hack — it handles the taper correctly.
    if (path) tl.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur(2.8), ease: 'power1.inOut' }, '<0.2');
    tl.fromTo(root.querySelectorAll('[data-stage]'),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: dur(0.7), stagger: dur(0.3), ease: 'power2.out' }, '<0.7');
    // Chips arrive with real momentum instead of a scale tween.
    tl.fromTo(root.querySelectorAll('[data-proof]'),
      { opacity: 0, y: -40 },
      {
        opacity: 1, y: 0, duration: dur(1.1), ease: 'power3.out',
        stagger: dur(0.08),
      }, '-=1.1');
    return tl;
  },
  exit: (root) => fadeOut(root),
};

// ═══ 3 · Why Indonesia Is Different ══════════════════ National Pride ══════
const DIMENSIONS = [
  { name: 'Tectonic environments', hint: 'subduction · collision · rifting' },
  { name: 'Basin evolution', hint: 'back-arc · fore-arc · foreland' },
  { name: 'Petroleum systems', hint: 'lacustrine · deltaic · carbonate' },
  { name: 'Exploration plays', hint: 'structural · stratigraphic · shallow gas' },
];

function S03() {
  return (
    <section className="kn-full">
      <KeynoteMap dark flyTo={{ lon: 118, lat: -2.2, zoom: 4.2 }} veil="left" />
      <div className="kn-scene-inner">
        <div style={{ maxWidth: '46ch' }}>
          <div className="kn-eyebrow" data-rise>Why Indonesia is different</div>
          <div className="kn-dims">
            {DIMENSIONS.map((d) => (
              <div key={d.name} className="kn-dim" data-dim>
                <span className="kn-dim-dot" />
                <b>{d.name}</b>
                <em style={{ gridColumn: 2 }}>{d.hint}</em>
              </div>
            ))}
          </div>
          <h2 className="kn-punch" data-final-line style={{ marginTop: 'calc(var(--gap)*2.2)' }}>
            We should measure it—not merely claim it.
          </h2>
        </div>
      </div>
    </section>
  );
}

const s03api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root);
    tl.fromTo(root.querySelectorAll('[data-dim]'),
      { opacity: 0, x: -30 },
      { opacity: 1, x: 0, duration: dur(0.9), stagger: dur(0.34), ease: 'power2.out' }, '<0.3');
    tl.fromTo(root.querySelectorAll('.kn-dim-dot'),
      { scale: 0 }, { scale: 1, duration: dur(0.65), stagger: dur(0.34), ease: 'back.out(2.2)' }, '<');
    hold(tl, 0.8);
    tl.add(riseLines(root.querySelector('[data-final-line]'), { duration: 1.4 }));
    return tl;
  },
  exit: (root) => fadeOut(root),
};

/** The four ownership lines that close the scene. */
const FOUR = ['Our understanding.', 'Our framework.', 'Our language.', 'Our future.'];

// ═══ 4 · The Break, and the Answer ═══════════ Urgency → Inspiration ════════
//
// Slides 4 and 5 were two halves of one thought, and separating them cost the
// deck its only real emotional turn: the risk landed, the speaker clicked, and
// the resolution arrived as a new topic. Merged, the scene has an actual arc
// inside a single frame.
//
//   Act I   the field is whole, then it BREAKS      — "our knowledge often is not"
//   Act II  the same particles REFORM               — "a nation should own it"
//
// The particle field is the through-line: it is the same field in both acts, so
// the recovery is visibly the recovery OF the thing that broke. Nothing about
// this is decoration — if the field reset between acts, the argument would not
// land.
type Act = 'whole' | 'broken' | 'reformed';

function S04() {
  const [act, setAct] = useState<Act>('whole');
  useEffect(() => {
    if (prefersReducedMotion()) { setAct('reformed'); return; }
    const a = setTimeout(() => setAct('broken'), 3200);
    const b = setTimeout(() => setAct('reformed'), 11500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  return (
    <section className="kn-full kn-turn">
      <ParticleField
        mode={act === 'whole' ? 'connected' : act === 'broken' ? 'breaking' : 'reforming'}
        accent={act === 'reformed' ? '#D8B15A' : '#69D6FF'}
        count={760}
      />

      <div className="kn-scene-inner">
        <div className="kn-center kn-turn-stack">
          {/* Act I */}
          <div className="kn-act" data-act-1>
            <div className="kn-eyebrow" data-rise>The hidden risk</div>
            <h2 className="kn-mega" data-act1-a>Our geology is&nbsp;connected.</h2>
            <div className="kn-tear" aria-hidden>
              <svg viewBox="0 0 1200 24" preserveAspectRatio="none">
                <path d="M0,12 L262,12 L318,4 L372,20 L436,7 L512,17 L590,12 L1200,12" data-tear />
              </svg>
            </div>
            <h2 className="kn-mega kn-mega-b" data-act1-b>Our knowledge often is&nbsp;not.</h2>
          </div>

          {/* Act II — stacked in the same grid cell, so the turn happens in
              place instead of the frame jumping to a new layout. */}
          <div className="kn-act" data-act-2>
            <div className="kn-eyebrow kn-eyebrow-gold" data-act2-eyebrow>The answer</div>
            <h2 className="kn-mega" data-act2-line>
              A nation should own the understanding of its&nbsp;resources.
            </h2>
            <div className="kn-four">
              {FOUR.map((t) => <span key={t} className="kn-four-line" data-four>{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Sang Saka Merah-Putih: RED above WHITE. A band along the floor, below
          everything — never a wash across the type. */}
      <div className="kn-flagband" data-flag aria-hidden><i /><i /></div>
    </section>
  );
}

const s04api: SceneApi = {
  enter: (root) => {
    const tl = gsap.timeline();
    const q = (s: string) => root.querySelector(s);
    const act1 = q('[data-act-1]'), act2 = q('[data-act-2]');
    const tear = root.querySelector<SVGPathElement>('[data-tear]');
    gsap.set(act2, { opacity: 0, y: 34 });
    gsap.set(q('[data-flag]'), { scaleX: 0, transformOrigin: 'left center' });

    // ── Act I ────────────────────────────────────────────────────────────────
    tl.add(riseIn(root, '[data-act-1] .kn-eyebrow'))
      .add(riseLines(q('[data-act1-a]'), { duration: 1.35 }), '-=0.5');
    hold(tl, 1.1);                                   // let the claim stand alone

    if (tear) {
      tl.set(tear, { opacity: 1 })
        .fromTo(tear, { drawSVG: '50% 50%' },
          { drawSVG: '0% 100%', duration: dur(0.9), ease: 'power4.out' });
    }
    tl.add(riseLines(q('[data-act1-b]'), { duration: 1.35 }), '-=0.45');
    tl.fromTo(q('[data-act1-b]'), { x: 0 },
      { x: 14, duration: dur(0.5), ease: 'power4.out', yoyo: true, repeat: 1 }, '-=1.2');
    hold(tl, 2.4);                                   // the silence is the point

    // ── the turn ─────────────────────────────────────────────────────────────
    // Act I recedes rather than cutting: it is still true, it is just no longer
    // the subject.
    tl.to(act1, { opacity: 0, y: -30, filter: 'blur(9px)', duration: dur(1.3), ease: 'power2.inOut' });
    tl.to(act2, { opacity: 1, y: 0, duration: dur(1.4), ease: SETTLE }, '-=0.7')
      .add(riseLines(q('[data-act2-line]'), { duration: 1.5, stagger: 0.11 }), '-=1.0');
    tl.fromTo(root.querySelectorAll('[data-four]'),
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: dur(1.0), stagger: dur(0.5), ease: 'power2.out' }, '-=0.6');
    // The flag unfurls last, along the floor, under the finished sentence.
    tl.to(q('[data-flag]'), { scaleX: 1, duration: dur(2.1), ease: 'power3.inOut' }, '-=1.4');
    return tl;
  },
  exit: (root) => fadeOut(root),
};

// ═══ 6 · Our Common Geological Language ══════════════════════ Clarity ═════
const CHAIN = ['Plate', 'Province', 'Basin', 'Evolution', 'Stratigraphy', 'Petroleum System', 'Play', 'Field', 'Well'];

function S06() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    // The camera dollies through nine depth planes: one continuous move.
    const o = { p: 0 };
    const tw = gsap.to(o, {
      p: 1, duration: dur(11), ease: 'none', delay: dur(0.8),
      onUpdate: () => setProgress(o.p),
    });
    return () => { tw.kill(); };
  }, []);
  const active = Math.round(progress * (CHAIN.length - 1));
  return (
    <section className="kn-full">
      <DepthRail steps={CHAIN.length} progress={progress} />
      <div className="kn-scene-inner">
        <div className="kn-center">
          <div className="kn-eyebrow" data-rise>Our common geological language</div>
          <h2 className="kn-hero" style={{ fontSize: 'calc(var(--u)*3.4)' }}>
            {CHAIN[active]}
          </h2>
          <p className="kn-quiet" style={{ marginTop: 'var(--gap)' }}>
            {active + 1} / {CHAIN.length}
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══ 7 · One Possible Implementation ═════════════════════ Confidence ══════
// The demo is the point of this slide, so it gets three quarters of the wall.
// The copy is compressed into a left rail and the app is shown at a reduced
// zoom so whole screens — not fragments — are legible from the back row.
function S07() {
  return (
    <section className="kn-split">
      <div className="kn-split-copy">
        <div className="kn-eyebrow" data-rise>One possible implementation</div>
        <h2 className="kn-punch" data-rise="text">
          Technology is not the vision.
        </h2>
        <p className="kn-quiet" data-rise="text" style={{ marginTop: 'var(--gap)' }}>
          It makes the vision usable.
        </p>
      </div>
      <div className="kn-split-stage">
        <DemoFrame />
      </div>
    </section>
  );
}

// ═══ 8 · Three Stages ═══════════════════════════════════════ Momentum ═════
// "Blue, gold, white — three worlds" (presenter note). Each card owns a hue and
// a giant ordinal; the outcome is the payoff, so it sits alone below a rule
// rather than as one more line of body text.
const STAGES = [
  {
    i: '01', n: 'Stage one', name: 'DISCOVER', accent: '#69D6FF',
    words: ['Listen.', 'Collect.', 'Measure.'], out: 'Shared Understanding',
  },
  {
    i: '02', n: 'Stage two', name: 'UNIFY', accent: '#D8B15A',
    words: ['Classify.', 'Framework.', 'Relationships.'], out: 'Shared Framework',
  },
  {
    i: '03', n: 'Stage three', name: 'LEGACY', accent: '#E8ECF2',
    words: ['Transfer.', 'Teach.', 'Community.'], out: 'Shared Legacy',
  },
];

function S08() {
  return (
    <section className="kn-scene">
      <div className="kn-eyebrow" data-rise>Three stages</div>
      <h2 className="kn-punch" data-rise="text" style={{ maxWidth: '26ch' }}>
        It grows in stages.
      </h2>
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
const s08api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root);
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

// ═══ 9 · Beyond One Person ══════════════════════════════ Collaboration ════
function S09() {
  return (
    <section className="kn-full">
      <EcosystemForce />
      <div className="kn-scene-inner">
        <div className="kn-panel kn-eco-copy">
          <div className="kn-eyebrow" data-rise>Beyond one person</div>
          <h2 className="kn-punch" data-rise="text" style={{ maxWidth: '18ch' }}>
            An Indonesian Geological Legacy Initiative?
          </h2>
        </div>
      </div>
    </section>
  );
}

// ═══ 10 · The Ask ═══════════════════════════════════════════ Reflection ═══
const QUESTIONS = [
  'Is this a problem worth solving?',
  'Which datasets should become the foundation?',
  'Who should shape the first pilot?',
];

function S10() {
  return (
    <section className="kn-full">
      <KeynoteMap dark={false} flyTo={{ lon: 120.8, lat: -1.0, zoom: 3.6 }} veil="left" interactive={false} />
      <div className="kn-scene-inner">
        <div style={{ maxWidth: '40ch' }}>
          <div className="kn-eyebrow" data-rise>The ask</div>
          <div className="kn-questions">
            {QUESTIONS.map((q, i) => (
              <div className="kn-question" key={q} data-question>
                <span className="kn-question-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="kn-question-text">{q}</span>
              </div>
            ))}
          </div>
          <p className="kn-final" data-closing>
            They should inherit the way Indonesia understands its geology.
          </p>
        </div>
      </div>
    </section>
  );
}

const s10api: SceneApi = {
  enter: (root) => {
    const tl = riseIn(root);
    tl.fromTo(root.querySelectorAll('[data-question]'),
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: dur(1.2), stagger: dur(1.2), ease: 'power2.out' }, '<0.4');
    hold(tl, 1.1);
    tl.add(riseLines(root.querySelector('[data-closing]'), { duration: 1.9, stagger: 0.16 }));
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
    notes: 'Let the line draw before you name the stages. Do not read the chips aloud.',
    Component: S02, api: s02api,
  },
  {
    id: 'why-indonesia', title: 'Why Indonesia Is Different', emotion: 'national pride',
    punchline: 'We should measure it—not merely claim it.',
    notes: 'The four dimensions settle, then the sentence lands alone.',
    Component: S03, api: s03api,
  },
  {
    id: 'turn', title: 'The Break, and the Answer', emotion: 'urgency → inspiration',
    punchline: 'Our geology is connected. Our knowledge often is not — and a nation should own the understanding of its resources.',
    notes: 'ONE slide, two acts. Stop talking after the tear and count to three. The same particles that broke are the ones that reform; do not click through the middle.',
    Component: S04, api: s04api,
  },
  {
    id: 'language', title: 'Our Common Geological Language', emotion: 'clarity',
    punchline: 'Build one framework.',
    notes: 'One camera move through nine planes. Let it run; do not narrate every step.',
    Component: S06, api: standard,
  },
  {
    id: 'implementation', title: 'One Possible Implementation', emotion: 'confidence',
    punchline: 'Technology is not the vision. Technology simply makes the vision usable.',
    notes: 'Live app. Toggle desktop/mobile. Switch to Loop if the room has no wifi.',
    Component: S07, api: standard,
  },
  {
    id: 'stages', title: 'Three Stages', emotion: 'momentum',
    punchline: 'A national capability cannot be built overnight. It grows in stages.',
    notes: 'Blue, gold, white — three worlds.',
    Component: S08, api: s08api,
  },
  {
    id: 'beyond', title: 'Beyond One Person', emotion: 'collaboration',
    punchline: 'Could this become an Indonesian Geological Legacy Initiative?',
    notes: 'The graph keeps moving while you ask. Let it.',
    Component: S09, api: standard,
  },
  {
    id: 'ask', title: 'The Ask', emotion: 'reflection',
    punchline: 'Future generations should inherit more than data. They should inherit the way Indonesia understands its geology.',
    notes: 'No logo after the fade. The sentence is the last thing in the room.',
    Component: S10, api: s10api,
  },
];

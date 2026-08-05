import type {
  CourseDay, Material, MaterialDoc, MaterialSection, QuestionScope, Session, SlideBlock,
} from './types';
import { VOLVE_DAYS } from './catalog';
import { getDeck } from './content-store';
import { questionsFor } from './questions';
import { MISSIONS, missionsForDay } from './missions';
import { RUBRIC_MAX } from './types';

export const COURSE_VERSION = '1.0';
const COURSE_NAME = 'The Volve Mission · From Discovery to Decision';

/**
 * Delivery materials are COMPILED, never re-typed.
 *
 * Every material is a projection of content that already exists somewhere
 * authoritative — the slides, the run of show, the mission steps, the question
 * bank. Editing a slide therefore updates the facilitator guide that quotes it,
 * and an answer key can never drift from the exam it belongs to.
 */

const dayScope = (n: number): QuestionScope => `day${n}` as QuestionScope;

/**
 * Slides come from the content store, not the catalog, so a deck edited on the
 * web or re-imported from PowerPoint flows straight through into every material
 * that quotes it. The catalog only seeds revision 1.
 */
export function liveSlides(day: CourseDay): SlideBlock[] {
  const deck = day.materials.map((m) => (m.kind === 'Presentation' ? getDeck(m.id) : undefined)).find(Boolean);
  if (deck) return deck.slides;
  return day.slides.map((s, i) => ({
    id: `d${day.number}s${String(i + 1).padStart(2, '0')}`,
    kind: 'structured' as const,
    layout: s.layout,
    eyebrow: s.eyebrow, title: s.title, body: s.body, bullets: s.bullets, note: s.note,
  }));
}

function presentation(day: CourseDay): MaterialSection[] {
  return liveSlides(day).map((s, i) => ({
    heading: `Slide ${i + 1} · ${s.title ?? s.opaqueLabel ?? 'PowerPoint-only slide'}`,
    kind: 'prose',
    body: s.kind === 'opaque' ? 'This slide is authored in PowerPoint and preserved as-is.' : s.body,
    items: s.bullets,
    note: s.note,
  }));
}

function instructorGuide(day: CourseDay): MaterialSection[] {
  const sections: MaterialSection[] = [
    {
      heading: 'Run of show',
      kind: 'table',
      rows: day.schedule.map((s) => [`${s.time} · ${s.mode}`, `${s.label} — ${s.detail}`]),
    },
    {
      heading: 'Framing question',
      kind: 'prose',
      body: day.question,
    },
    {
      heading: 'Speaker notes',
      kind: 'table',
      rows: liveSlides(day).map((s, i) => [
        `Slide ${i + 1} · ${s.title ?? s.opaqueLabel ?? 'PowerPoint-only'}`,
        s.note ?? '—',
      ] as [string, string]),
    },
  ];

  const missions = missionsForDay(day.id);
  if (missions.length) {
    sections.push({
      heading: 'Guided app missions',
      kind: 'table',
      rows: missions.flatMap((m) => [
        [m.title, `${m.scope} — produces ${m.output}`] as [string, string],
        ...m.steps.map((s, i) => [`  ${i + 1}. ${s.title}`, s.detail] as [string, string]),
      ]),
    });
  }

  const questions = day.number <= 4 ? questionsFor(dayScope(day.number)) : [];
  if (questions.length) {
    sections.push({
      heading: 'Answer key — instructor copy',
      kind: 'qa',
      instructorOnly: true,
      qa: questions.map((q) => ({
        q: q.stem,
        a: `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`,
        why: q.explanation,
      })),
    });
  }
  return sections;
}

function learnerWorkbook(day: CourseDay): MaterialSection[] {
  const missions = missionsForDay(day.id);
  const sections: MaterialSection[] = [
    { heading: 'Today’s question', kind: 'prose', body: day.question },
  ];
  missions.forEach((m) => {
    sections.push({
      heading: `Mission · ${m.title}`,
      kind: 'steps',
      body: `${m.brief}\nScope: ${m.scope}`,
      steps: m.steps.map((s) => ({ title: s.title, detail: s.detail, capture: s.evidence })),
    });
  });
  sections.push({
    heading: `Decision card — ${day.outcome}`,
    kind: 'list',
    items: [
      'Decision (choose one of the day’s three options)',
      'Evidence reference 1',
      'Evidence reference 2',
      'Evidence reference 3',
      'The one material gap',
      'Next best action, with an owner',
    ],
  });
  return sections;
}

function challengePack(day: CourseDay): MaterialSection[] {
  return [
    { heading: 'Team brief', kind: 'prose', body: day.question },
    { heading: 'Required output', kind: 'prose', body: day.outcome },
    {
      heading: 'Scoring rubric',
      kind: 'table',
      rows: [
        ['Technical workflow', `${RUBRIC_MAX.workflow} pts — method chosen and executed correctly`],
        ['Evidence quality', `${RUBRIC_MAX.evidence} pts — traceable, truth-classed, gaps declared`],
        ['Decision rationale', `${RUBRIC_MAX.decision} pts — the call follows from the evidence`],
        ['Quiz and team', `${RUBRIC_MAX.quiz} pts — knowledge check and contribution`],
      ],
    },
    {
      heading: 'Facilitation timing',
      kind: 'list',
      items: [
        '45 minutes build — teams work in the lifecycle workspace',
        '3 minutes present — one decision, three evidence references',
        '2 minutes challenge — panel presses on the weakest link',
        'Speed earns no points; an unsupported call scores zero on rationale',
      ],
    },
  ];
}

function assessmentDoc(): MaterialSection[] {
  const questions = questionsFor('final');
  const mix = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.competency] = (acc[q.competency] ?? 0) + 1;
    return acc;
  }, {});
  return [
    {
      heading: 'Blueprint',
      kind: 'table',
      rows: Object.entries(mix).map(([k, n]) => [k, `${n} questions`]),
    },
    {
      heading: 'Conditions',
      kind: 'list',
      items: ['75 minutes', '80% to pass', 'Two attempts after remediation', 'Instructor unlock required'],
    },
    {
      heading: 'Question bank — instructor copy',
      kind: 'qa',
      instructorOnly: true,
      qa: questions.map((q) => ({
        q: q.stem,
        a: `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`,
        why: q.explanation,
      })),
    },
  ];
}

export function buildMaterialDoc(material: Material, day: CourseDay): MaterialDoc {
  let sections: MaterialSection[];
  switch (material.kind) {
    case 'Presentation': sections = presentation(day); break;
    case 'Instructor guide': sections = instructorGuide(day); break;
    case 'Learner workbook': sections = learnerWorkbook(day); break;
    case 'Challenge pack': sections = challengePack(day); break;
    case 'Assessment': sections = assessmentDoc(); break;
    default: sections = [{ heading: 'Contents', kind: 'prose', body: material.meta }];
  }
  return {
    title: material.title,
    subtitle: `Day ${day.number} · ${day.verb} — ${day.title}`,
    kind: material.kind,
    version: COURSE_VERSION,
    sections,
  };
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export function docToMarkdown(doc: MaterialDoc): string {
  const out: string[] = [
    `# ${doc.title}`,
    '',
    `**${COURSE_NAME}**`,
    `${doc.subtitle} · ${doc.kind} · course version ${doc.version}`,
    '',
  ];
  doc.sections.forEach((s) => {
    out.push(`## ${s.heading}${s.instructorOnly ? ' *(instructor only)*' : ''}`, '');
    if (s.body) out.push(...s.body.split('\n'), '');
    if (s.items?.length) { s.items.forEach((i) => out.push(`- ${i}`)); out.push(''); }
    if (s.rows?.length) {
      out.push('| | |', '| --- | --- |');
      s.rows.forEach(([a, b]) => out.push(`| ${a} | ${b} |`));
      out.push('');
    }
    if (s.steps?.length) {
      s.steps.forEach((st, i) => {
        out.push(`${i + 1}. **${st.title}** — ${st.detail}`, `   - Capture: ${st.capture}`, '');
      });
    }
    if (s.qa?.length) {
      s.qa.forEach((item, i) => {
        out.push(`${i + 1}. ${item.q}`, `   - **Answer:** ${item.a}`, `   - ${item.why}`, '');
      });
    }
    if (s.note) out.push(`> Facilitator note. ${s.note}`, '');
  });
  return out.join('\n');
}

/** Every material in the course, compiled — the offline pack. */
export function buildOfflinePack(): string {
  const out: string[] = [
    `# ${COURSE_NAME}`,
    '',
    `Offline delivery pack · course version ${COURSE_VERSION}`,
    '',
    '---',
    '',
  ];
  VOLVE_DAYS.forEach((day) => {
    day.materials.forEach((m) => {
      out.push(docToMarkdown(buildMaterialDoc(m, day)), '', '---', '');
    });
  });
  return out.join('\n');
}

/**
 * The learner's verifiable record: what they sat, what they built, and the
 * evidence they captured along the way — not just a score.
 */
export function buildLearnerRecord(session: Session): string {
  const out: string[] = [
    '# Fieldcraft Passport — learner record',
    '',
    `**${COURSE_NAME}**`,
    `${session.cohort} · course version ${COURSE_VERSION}`,
    '',
    '## Assessments',
    '',
  ];
  if (!session.attempts.length) out.push('_No assessments submitted._', '');
  session.attempts.forEach((a) => {
    const pct = Math.round((a.correct / a.total) * 100);
    out.push(`- **${a.scope}** — ${a.correct}/${a.total} (${pct}%) · ${a.passed ? 'PASSED' : 'not passed'}`);
  });
  out.push('', '## Guided app missions', '');
  const done = MISSIONS.filter((m) => session.missions[m.id]?.completedAt);
  if (!done.length) out.push('_No missions completed._', '');
  done.forEach((m) => {
    out.push(`### ${m.title}`, `Day ${m.dayNumber} · ${m.scope} · produces ${m.output}`, '');
    m.steps.forEach((s, i) => {
      const captured = session.missions[m.id]?.steps[s.id] ?? '';
      out.push(`${i + 1}. **${s.title}** — ${captured || '_(no evidence captured)_'}`);
    });
    out.push('');
  });
  out.push('## Team scoring', '');
  session.teams.forEach((t) => {
    const total = Object.values(t.scores).reduce((s, d) => s + d.workflow + d.evidence + d.decision + d.quiz, 0);
    out.push(`- ${t.name}: ${total} pts`);
  });
  out.push('', `_Generated from the live session. Every line above is traceable to a submitted attempt or a captured mission step._`);
  return out.join('\n');
}

/** Browser download of generated text — no network, no dependency. */
export function downloadText(filename: string, text: string, type = 'text/markdown') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

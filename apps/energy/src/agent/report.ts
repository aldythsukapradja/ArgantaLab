// agent/report.ts — a workflow run, rendered as one self-contained HTML file.
//
// The rule that makes this safe is the same one that governs every card: NOTHING
// is written here that was not on a card the user already saw. No summarising
// model, no interpolated narrative, no "key takeaway" invented to fill a slide.
// A report generator that paraphrases is a second, unaudited voice describing
// evidence it did not gather — and it is exactly where a screening deck starts
// asserting things the data never said.
//
// So this is a TYPESETTER, not an author. It takes the cards a chain produced —
// their facts, their sources, their absences — and lays them out. Where a step
// refused, the report says so in the same weight as a step that succeeded,
// because a reader deciding on a basin needs to know what was not available at
// least as much as what was.
//
// Self-contained by construction: one file, inline CSS, inline SVG. No CDN, no
// webfont, no external image. It has to survive being emailed.

import type { AnswerCard } from './types.ts';

export interface ReportStep {
  title: string;
  why: string;
  card: AnswerCard;
  summary: string;
  skipped: boolean;
}

export interface ReportInput {
  workflow: string;
  subject: string;
  steps: ReportStep[];
  /** ISO string. Passed in rather than read here so the output is a pure
   *  function of its input — the same run renders identically. */
  generatedAt: string;
}

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Geometric marks, drawn here rather than pulled from an icon font. No emoji:
 *  a screening document that decorates its own uncertainty with a cartoon is
 *  not one anybody will circulate. */
const ICON = {
  check: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  minus: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  dot: '<svg viewBox="0 0 16 16" width="7" height="7" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="currentColor"/></svg>',
};

function factsTable(card: AnswerCard): string {
  const rows = (card.facts ?? []).filter((f) => f.value && f.value !== '—');
  if (!rows.length) return '';
  return `<table class="facts">${rows.map((f) => `
    <tr>
      <th>${esc(f.label)}</th>
      <td>${esc(f.value)}</td>
      <td class="src">${f.source ? esc(f.source) : '<span class="derived">derived</span>'}</td>
    </tr>${f.note ? `<tr class="note"><td colspan="3">${esc(f.note)}</td></tr>` : ''}`).join('')}</table>`;
}

function section(step: ReportStep, i: number): string {
  const side = i % 2 === 0 ? 'left' : 'right';
  const body = step.skipped
    ? `<p class="absence">${esc(step.card.body || step.card.subhead || 'No data on file for this step.')}</p>`
    : `${step.summary ? `<p class="lede">${esc(step.summary)}</p>` : ''}${factsTable(step.card)}`;

  return `
  <section class="step ${side} ${step.skipped ? 'is-skipped' : ''}">
    <div class="step-aside">
      <span class="step-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="step-state">${step.skipped ? ICON.minus : ICON.check}${step.skipped ? 'no data' : 'on file'}</span>
    </div>
    <div class="step-main">
      <h2>${esc(step.title)}</h2>
      <p class="why">${esc(step.why)}</p>
      <h3>${esc(step.card.headline)}${step.card.subhead ? ` <em>${esc(step.card.subhead)}</em>` : ''}</h3>
      ${body}
      ${(step.card.provenance ?? []).length
    ? `<p class="prov">${(step.card.provenance ?? []).map((s) => `<span>${esc(s)}</span>`).join('')}</p>` : ''}
    </div>
  </section>`;
}

export function buildReport(input: ReportInput): string {
  const ran = input.steps.filter((s) => !s.skipped).length;
  const sources = [...new Set(input.steps.flatMap((s) => s.card.provenance ?? []))];

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.subject)} — ${esc(input.workflow)}</title>
<style>
  :root{
    --ink:#0b0d10; --dim:#5b636e; --line:#e3e6ea; --bg:#fff; --panel:#f7f8fa;
    --accent:#0071e3; --warn:#a2621a;
    --sans:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Inter,system-ui,sans-serif;
  }
  @media (prefers-color-scheme:dark){
    :root{ --ink:#f2f4f7; --dim:#98a1ad; --line:#252a31; --bg:#0b0d10; --panel:#12161c; --accent:#2f9bff; --warn:#e0a458; }
  }
  *{ box-sizing:border-box }
  body{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans);
        -webkit-font-smoothing:antialiased; line-height:1.55; }
  .wrap{ max-width:940px; margin:0 auto; padding:0 28px 96px }

  header{ padding:120px 0 72px; border-bottom:1px solid var(--line) }
  header .eyebrow{ font-size:13px; letter-spacing:.09em; text-transform:uppercase; color:var(--dim); margin:0 0 18px }
  header h1{ margin:0; font-size:clamp(40px,7vw,76px); line-height:1.03; letter-spacing:-.035em; font-weight:640 }
  header .sub{ margin:20px 0 0; font-size:clamp(17px,2.2vw,21px); color:var(--dim); max-width:62ch }
  header .meta{ margin:40px 0 0; display:flex; flex-wrap:wrap; gap:28px; font-size:13px; color:var(--dim) }
  header .meta b{ color:var(--ink); font-weight:600 }

  .step{ display:grid; grid-template-columns:132px 1fr; gap:36px; padding:64px 0; border-bottom:1px solid var(--line) }
  /* Alternating sides: the eye gets a rhythm, and a long screening document
     stops reading as one undifferentiated column. */
  .step.right{ grid-template-columns:1fr 132px }
  .step.right .step-aside{ order:2; text-align:right }
  .step.right .step-main{ order:1 }
  .step-aside{ display:flex; flex-direction:column; gap:10px; position:sticky; top:32px; align-self:start }
  .step-n{ font-size:34px; font-weight:600; letter-spacing:-.03em; color:var(--line) }
  .step-state{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; letter-spacing:.05em;
               text-transform:uppercase; color:var(--dim) }
  .step.right .step-state{ justify-content:flex-end }
  .step.is-skipped .step-state{ color:var(--warn) }

  .step-main h2{ margin:0 0 6px; font-size:clamp(26px,3.6vw,38px); letter-spacing:-.028em; font-weight:620; line-height:1.12 }
  .step-main .why{ margin:0 0 26px; color:var(--dim); font-size:16px; max-width:60ch }
  .step-main h3{ margin:0 0 14px; font-size:15px; font-weight:620; letter-spacing:-.005em }
  .step-main h3 em{ font-style:normal; font-weight:400; color:var(--dim) }
  .lede{ margin:0 0 22px; font-size:17px; max-width:66ch }
  .absence{ margin:0; padding:16px 18px; background:var(--panel); border-left:2px solid var(--warn);
            border-radius:0 8px 8px 0; color:var(--dim); font-size:15px; max-width:66ch }

  table.facts{ width:100%; border-collapse:collapse; margin:0 0 6px; font-size:14.5px }
  table.facts th{ text-align:left; font-weight:500; color:var(--dim); padding:11px 16px 11px 0;
                  border-top:1px solid var(--line); width:34%; vertical-align:top }
  table.facts td{ padding:11px 0; border-top:1px solid var(--line); vertical-align:top }
  table.facts td.src{ text-align:right; color:var(--dim); font-size:12px; white-space:nowrap; width:24% }
  table.facts .derived{ color:var(--warn) }
  table.facts tr.note td{ border-top:0; padding:0 0 12px; color:var(--dim); font-size:12.5px }

  .prov{ margin:20px 0 0; display:flex; flex-wrap:wrap; gap:7px }
  .prov span{ font-size:11px; color:var(--dim); border:1px solid var(--line); border-radius:999px; padding:3px 10px }

  footer{ padding:56px 0 0; color:var(--dim); font-size:13px }
  footer p{ margin:0 0 10px; max-width:72ch }
  @media print{ .step{ break-inside:avoid } .step-aside{ position:static } }
  @media (max-width:720px){
    .step, .step.right{ grid-template-columns:1fr; gap:14px }
    .step.right .step-aside{ order:1; text-align:left }
    .step.right .step-main{ order:2 }
    .step-aside{ position:static; flex-direction:row; align-items:center; gap:14px }
    header{ padding:64px 0 40px }
  }
</style>
</head><body><div class="wrap">

<header>
  <p class="eyebrow">${esc(input.workflow)}</p>
  <h1>${esc(input.subject)}</h1>
  <p class="sub">Every figure below was produced by a capability that measured its own data first. Steps with nothing on file are shown, not omitted.</p>
  <div class="meta">
    <span><b>${ran}</b> of <b>${input.steps.length}</b> steps returned data</span>
    <span>${sources.length ? `Sources: <b>${esc(sources.join(', '))}</b>` : 'No sources declared'}</span>
    <span>Generated <b>${esc(input.generatedAt)}</b></span>
  </div>
</header>

${input.steps.map(section).join('')}

<footer>
  <p>${ICON.dot} This document is a typeset record of a deterministic workflow run. It contains no generated prose: every value, source and caveat is reproduced from the answer cards the run produced.</p>
  <p>Absent steps are reported rather than dropped. A screening decision needs to know what was unavailable at least as much as what was found.</p>
</footer>

</div></body></html>`;
}

// Extracts DEPARTMENTS, FOLDERS, PR_META, CLS_META, CORPUS + cnote() verbatim from
// public/cosmo/index.html (the founder's COSMO source) and re-serves them as real JSON
// (via a sandboxed vm eval — same object literals, no hand-transcription) into
// src/cosmo/report-data.json, so the Report zone renders the exact corpus 1:1.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('public/cosmo/index.html', 'utf8');
const grab = (reStart, reEnd) => {
  const s = src.search(reStart);
  if (s < 0) throw new Error('start not found: ' + reStart);
  const e = src.indexOf(reEnd, s);
  if (e < 0) throw new Error('end not found: ' + reEnd);
  return src.slice(s, e + reEnd.length);
};

const departments = grab(/const DEPARTMENTS = \[/, '\n];');
const folders = grab(/const FOLDERS = \{/, '\n};');
const prMeta = grab(/const PR_META = \{/, '};');
const clsMeta = grab(/const CLS_META = \{/, '};');
const cnoteFn = grab(/function cnote\(o\)\{/, '\n}');
const corpus = grab(/const CORPUS = \[/, '\n];');
const reportTree = grab(/const REPORT_TREE = \[/, '\n];');

const script = `
${departments}
${folders}
${prMeta}
${clsMeta}
${cnoteFn}
${corpus}
${reportTree}
const FILES = CORPUS.map(c=>({name:c.name, cls:c.cls, theme:c.theme, dept:c.dept, by:c.by, fmt:c.fmt, pr:c.pr, upd:c.upd, md:cnote(c), title:c.title, stageLabel:c.stageLabel}));
const ALL_REPORTS = REPORT_TREE.flatMap(g => (g.kpi?[g.kpi]:[]).concat(g.reports));
result = { DEPARTMENTS, FOLDERS, PR_META, CLS_META, FILES, REPORT_TREE, ALL_REPORTS };
`;
const ctx = { result: null };
vm.createContext(ctx);
vm.runInContext(script, ctx);

writeFileSync('src/cosmo/report-data.json', JSON.stringify(ctx.result, null, 2));
console.log('wrote src/cosmo/report-data.json ·', ctx.result.FILES.length, 'files ·', ctx.result.DEPARTMENTS.length, 'departments');

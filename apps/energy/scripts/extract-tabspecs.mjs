// Extracts the founder's TAB_SPECS + LIFECYCLE_TECH + TWIN_BRAIN_MD + tabSpecMd()
// VERBATIM from public/cosmo/index.html (a sandboxed vm eval — same source objects,
// no hand-transcription) and re-serves them as real JSON into
// src/cosmo/tabspec-data.json, so every lifecycle sub-tab can render the founder's
// exact acceptance spec 1:1 (same pattern as extract-corpus.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('public/cosmo/index.html', 'utf8').replace(/\r\n/g, '\n');
const grab = (reStart, reEnd) => {
  const s = src.search(reStart);
  if (s < 0) throw new Error('start not found: ' + reStart);
  const e = src.indexOf(reEnd, s);
  if (e < 0) throw new Error('end not found: ' + reEnd);
  return src.slice(s, e + reEnd.length);
};

const verticals = grab(/const VERTICALS = \[/, '\n];');
const tabSpecs = grab(/const TAB_SPECS = \{/, '}};') + ';';
const lifecycleTech = grab(/const LIFECYCLE_TECH=\{/, '\n};');
const twinBrain = grab(/const TWIN_BRAIN_MD=`/, '`;');
const tabSpecMdFn = grab(/function tabSpecMd\(v,tab\)\{/, '`;\n}');

const script = `
${verticals}
${tabSpecs}
${lifecycleTech}
${twinBrain}
${tabSpecMdFn}
// build { lifecycleId: { tab: renderedMd } } for every lifecycle + tab, plus the
// raw structured spec arrays so viewers can consume the bullet lists directly.
const md = {};
const specs = {};
for (const v of VERTICALS) {
  const tabs = TAB_SPECS[v.id];
  if (!tabs) continue;
  md[v.id] = {};
  specs[v.id] = {};
  for (const tab of Object.keys(tabs)) {
    md[v.id][tab] = tabSpecMd(v, tab);
    const [title, purpose, contains, sources, flow, visual] = tabs[tab];
    specs[v.id][tab] = { title, purpose, contains, sources, flow, visual };
  }
}
result = { verticals: VERTICALS, tech: LIFECYCLE_TECH, specs, md };
`;
const ctx = { result: null };
vm.createContext(ctx);
vm.runInContext(script, ctx);

writeFileSync('src/cosmo/tabspec-data.json', JSON.stringify(ctx.result, null, 2));
const lc = Object.keys(ctx.result.md);
console.log('wrote src/cosmo/tabspec-data.json ·', lc.length, 'lifecycles ·',
  'exploration tabs:', Object.keys(ctx.result.specs.exploration).join(', '));

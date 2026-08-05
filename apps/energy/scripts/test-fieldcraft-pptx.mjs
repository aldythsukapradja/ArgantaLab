/**
 * PPTX package validation.
 *
 * PowerPoint reports every structural fault as the same opaque "found a problem
 * with content" repair prompt, so this asserts the invariants that prompt is
 * actually complaining about: every part declared, every relationship resolved,
 * every reference reachable, every byte of XML well formed.
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(here, '../src/fieldcraft/officegen/pptx-writer.ts');

let failures = 0;
const fail = (m) => { console.error(`  x ${m}`); failures += 1; };
const pass = (m) => console.log(`  + ${m}`);

/* ── Minimal well-formedness scanner (no DOM available in Node) ─────────── */

function checkWellFormed(xml, label) {
  const stack = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) break;
    if (xml.startsWith('<?', lt)) { i = xml.indexOf('?>', lt) + 2; continue; }
    if (xml.startsWith('<!--', lt)) { i = xml.indexOf('-->', lt) + 3; continue; }
    if (xml.startsWith('<![CDATA[', lt)) { i = xml.indexOf(']]>', lt) + 3; continue; }

    // Find the closing '>' that is not inside an attribute value.
    let j = lt + 1;
    let quote = null;
    while (j < xml.length) {
      const c = xml[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j += 1;
    }
    if (j >= xml.length) { fail(`${label}: unterminated tag at ${lt}`); return false; }

    const raw = xml.slice(lt + 1, j).trim();
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const top = stack.pop();
      if (top !== name) { fail(`${label}: </${name}> closes <${top ?? 'nothing'}>`); return false; }
    } else if (!raw.endsWith('/')) {
      stack.push(raw.split(/[\s>]/)[0]);
    }
    i = j + 1;
  }
  if (stack.length) { fail(`${label}: unclosed <${stack[stack.length - 1]}>`); return false; }
  // XML 1.0 forbids these outright; they are the classic silent corrupter.
  for (const ch of xml) {
    const c = ch.codePointAt(0);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) {
      fail(`${label}: illegal control character U+${c.toString(16).padStart(4, '0')}`);
      return false;
    }
  }
  return true;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const attr = (xml, tag, name) => {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
};

function relsOf(xml) {
  return [...xml.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => ({
    id: /Id="([^"]*)"/.exec(m[0])?.[1],
    type: /Type="([^"]*)"/.exec(m[0])?.[1],
    target: /Target="([^"]*)"/.exec(m[0])?.[1],
  }));
}

function resolveRel(base, target) {
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/* ── Run ────────────────────────────────────────────────────────────────── */

console.log('\n[fieldcraft] pptx package');

const dir = await mkdtemp(join(tmpdir(), 'fc-pptx-'));
let mod;
try {
  const out = join(dir, 'writer.mjs');
  // jszip is bundled in rather than left external: the output lives in a temp
  // directory that cannot resolve back to the project's node_modules.
  await build({
    entryPoints: [SRC], outfile: out, bundle: true, format: 'esm',
    platform: 'node', absWorkingDir: pathResolve(here, '..'), logLevel: 'silent',
  });
  mod = await import(pathToFileURL(out).href);
} catch (e) {
  console.error(`\n[fieldcraft] FAILED to bundle the writer: ${e.message}\n`);
  await rm(dir, { recursive: true, force: true });
  process.exit(1);
}

const deck = {
  materialId: 'd1-deck',
  dayId: 'discover',
  slides: [
    { id: 'd1s01', kind: 'structured', eyebrow: 'DAY 01 - DISCOVER', title: 'A field begins as a question', body: 'Before a model, there is evidence.', bullets: ['One field', 'One evidence trail'], note: 'Open with the mission.' },
    { id: 'd1s02', kind: 'structured', title: 'Ampersands & "quotes" <tags>', body: 'Escaping must survive.', note: 'Note with <angle> & ampersand.' },
    { id: 'd1s03', kind: 'opaque', opaqueRef: 'op:d1-deck:d1s03', opaqueLabel: 'Trainer SmartArt' },
  ],
};

const opaque = {
  'op:d1-deck:d1s03': {
    slideXml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="whatever"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="9" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId7"/></p:blipFill><p:spPr/></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
    rels: [
      { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', target: '../slideLayouts/slideLayout7.xml' },
      { id: 'rId7', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/image3.png' },
    ],
    media: [{ target: '../media/image3.png', base64: 'iVBORw0KGgo=', extension: 'png' }],
  },
};

const manifest = {
  courseId: 'volve-mission', materialId: 'd1-deck', baseRevision: 'rev-4',
  exportedAt: 1700000000000, title: 'Day 1 - Discover presentation',
};

const input = { deck, manifest, accent: '#22d3ee', dayLabel: 'Day 1', opaque };
const zip = mod.buildPptx(input);
const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir);

/* 1 - required parts */
const required = [
  '[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml',
  'docProps/custom.xml', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
  'ppt/presProps.xml', 'ppt/theme/theme1.xml',
  'ppt/slideMasters/slideMaster1.xml', 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
  'ppt/slideLayouts/slideLayout1.xml', 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
  'ppt/notesMasters/notesMaster1.xml',
];
const missing = required.filter((r) => !files.includes(r));
if (missing.length) fail(`missing required parts: ${missing.join(', ')}`);
else pass(`${files.length} parts written, all required scaffolding present`);

/* 2 - XML well formed everywhere */
const texts = {};
let xmlOk = true;
for (const f of files) {
  if (!/\.(xml|rels)$/.test(f)) continue;
  texts[f] = await zip.file(f).async('string');
  if (!checkWellFormed(texts[f], f)) xmlOk = false;
}
if (xmlOk) pass(`${Object.keys(texts).length} XML parts well formed, no illegal characters`);

/* 3 - content types cover every part */
const ct = texts['[Content_Types].xml'];
const defaults = new Set(attr(ct, 'Default', 'Extension').map((e) => e.toLowerCase()));
const overrides = new Set(attr(ct, 'Override', 'PartName'));
const uncovered = files.filter((f) => {
  if (overrides.has(`/${f}`)) return false;
  const ext = (f.split('.').pop() ?? '').toLowerCase();
  return !defaults.has(ext);
});
if (uncovered.length) fail(`parts with no content type: ${uncovered.join(', ')}`);
else pass('every part is declared in [Content_Types].xml');

/* 4 - every relationship target exists */
let relCount = 0;
let relBad = 0;
for (const f of files.filter((x) => x.endsWith('.rels'))) {
  const base = f.replace('_rels/', '').replace(/\.rels$/, '');
  for (const r of relsOf(texts[f])) {
    if (!r.target || /^https?:/i.test(r.target)) continue;
    relCount += 1;
    const target = resolveRel(base, r.target);
    if (!files.includes(target)) { fail(`${f}: relationship ${r.id} -> ${r.target} resolves to missing ${target}`); relBad += 1; }
  }
}
if (!relBad) pass(`${relCount} relationships all resolve to real parts`);

/* 5 - presentation r:id references exist */
const presRelIds = new Set(relsOf(texts['ppt/_rels/presentation.xml.rels']).map((r) => r.id));
const referenced = [
  ...attr(texts['ppt/presentation.xml'], 'p:sldId', 'r:id'),
  ...attr(texts['ppt/presentation.xml'], 'p:sldMasterId', 'r:id'),
  ...attr(texts['ppt/presentation.xml'], 'p:notesMasterId', 'r:id'),
];
const dangling = referenced.filter((id) => !presRelIds.has(id));
if (dangling.length) fail(`presentation.xml references unknown r:id ${dangling.join(', ')}`);
else pass(`${referenced.length} presentation references bound to relationships`);

/* 6 - slide identity survives, including on the preserved slide */
const ids = [];
for (let i = 1; i <= deck.slides.length; i += 1) {
  const x = texts[`ppt/slides/slide${i}.xml`];
  if (!x) { fail(`slide${i}.xml missing`); continue; }
  ids.push(/<p:cSld[^>]*\bname="fc:([^"]+)"/.exec(x)?.[1]);
}
const wanted = deck.slides.map((s) => s.id);
if (JSON.stringify(ids) !== JSON.stringify(wanted)) fail(`slide identities ${JSON.stringify(ids)} != ${JSON.stringify(wanted)}`);
else pass(`slide identities stamped in order: ${ids.join(', ')}`);

/* 7 - manifest round-trips */
const custom = texts['docProps/custom.xml'];
const props = Object.fromEntries([...custom.matchAll(/name="([^"]+)"><vt:lpwstr>([^<]*)<\/vt:lpwstr>/g)].map((m) => [m[1], m[2]]));
if (props.FieldcraftMaterial !== 'd1-deck' || props.FieldcraftBaseRevision !== 'rev-4') {
  fail(`manifest wrong: ${JSON.stringify(props)}`);
} else pass(`manifest carries material ${props.FieldcraftMaterial} @ ${props.FieldcraftBaseRevision}`);

/* 8 - XML escaping actually happened */
const s2 = texts['ppt/slides/slide2.xml'];
if (!s2.includes('&amp;') || !s2.includes('&lt;tags&gt;')) fail('special characters were not escaped in slide 2');
else pass('ampersands and angle brackets escaped in slide text');

/* 9 - preserved slide kept verbatim, with media and rels remapped */
const s3 = texts['ppt/slides/slide3.xml'];
const s3rels = relsOf(texts['ppt/slides/_rels/slide3.xml.rels']);
const imageRel = s3rels.find((r) => r.type.endsWith('/image'));
if (!s3.includes('<p:pic>')) fail('preserved slide lost its picture shape');
else if (!imageRel) fail('preserved slide lost its image relationship');
else if (!s3.includes(`r:embed="${imageRel.id}"`)) fail(`preserved slide embed not remapped to ${imageRel.id}`);
else if (!files.includes(resolveRel('ppt/slides/slide3.xml', imageRel.target))) fail('remapped media file was not written');
else if (s3rels.some((r) => r.target.includes('slideLayout7'))) fail('preserved slide still points at a layout that does not exist');
else pass('preserved slide re-emitted verbatim, media and layout remapped into this package');

/* 10 - notes wiring */
const notesFiles = files.filter((f) => /notesSlides\/notesSlide\d+\.xml$/.test(f));
const withNotes = deck.slides.filter((s) => s.note).length;
if (notesFiles.length !== withNotes) fail(`expected ${withNotes} notes slides, found ${notesFiles.length}`);
else pass(`${notesFiles.length} notes slides written and linked`);

/* 11 - deterministic output */
const a = await mod.buildPptx(input).generateAsync({ type: 'base64' });
const b = await mod.buildPptx(input).generateAsync({ type: 'base64' });
if (a !== b) fail('build is not deterministic; two runs produced different bytes');
else pass('two builds produce byte-identical packages');

await writeFile(join(dir, 'sample.pptx'), await zip.generateAsync({ type: 'nodebuffer' }));
await rm(dir, { recursive: true, force: true });

if (failures) {
  console.error(`\n[fieldcraft] pptx FAILED with ${failures} problem(s)\n`);
  process.exit(1);
}
console.log(`\n[fieldcraft] pptx package OK - ${files.length} parts, ${deck.slides.length} slides\n`);

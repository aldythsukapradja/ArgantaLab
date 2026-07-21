// Client-side, deterministic office-doc extraction. Heavy parsers (pdfjs / xlsx / jszip)
// are LAZY-loaded via dynamic import — only when the Extraction Studio actually runs —
// to keep the base bundle lean (spec §5). No LLM anywhere; parsing is pure structure.
import type { DocKind, ExtractedBlock, ExtractedDoc, ExtractionCandidate } from './types';
import type { EntityIndex } from './tag';
import { tagBlock, toMatchedEntities } from './tag';

export function detectKind(fileName: string): DocKind {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'docx') return 'docx';
  if (ext === 'csv') return 'csv';
  if (ext === 'txt' || ext === 'md') return 'txt';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  return 'unknown';
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── PDF: pdfjs getTextContent per page ──
async function parsePdf(buf: ArrayBuffer): Promise<ExtractedBlock[]> {
  const pdfjs = await import('pdfjs-dist');
  // worker registered via ?url so Vite bundles it as an asset
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  const blocks: ExtractedBlock[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const text = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ kind: 'paragraph', text, locator: `page ${p}` });
  }
  return blocks;
}

// ── XLSX/CSV: SheetJS sheet_to_json per sheet → real table reconstruction ──
async function parseSheets(buf: ArrayBuffer, kind: DocKind): Promise<ExtractedBlock[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  const blocks: ExtractedBlock[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: false, defval: null });
    if (!aoa.length) continue;
    const columns = (aoa[0] ?? []).map((c, i) => (c == null || c === '' ? `col${i + 1}` : String(c)));
    const rows = aoa.slice(1, 201).map((r) => columns.map((_, i) => (r[i] ?? null)));
    const locator = kind === 'csv' ? 'sheet CSV' : `sheet ${name}`;
    blocks.push({ kind: 'table', table: { columns, rows }, locator });
  }
  return blocks;
}

// ── DOCX / PPTX: jszip + DOMParser (slides sorted NUMERICALLY) ──
async function parseOoxml(buf: ArrayBuffer, kind: DocKind): Promise<ExtractedBlock[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const parser = new DOMParser();
  const blocks: ExtractedBlock[] = [];
  const textOf = (xml: string): string[] => {
    const dom = parser.parseFromString(xml, 'application/xml');
    // a:t (drawingml) + w:t (wordml) both carry runs of text
    const nodes = [...dom.getElementsByTagName('a:t'), ...dom.getElementsByTagName('w:t')];
    return nodes.map((n) => n.textContent ?? '').filter(Boolean);
  };
  if (kind === 'docx') {
    const f = zip.file('word/document.xml');
    if (f) {
      const xml = await f.async('string');
      // split into paragraphs on <w:p> boundaries for locators
      const paras = xml.split(/<w:p[ >]/).slice(1);
      paras.forEach((p, i) => {
        const t = textOf('<w:p ' + p).join('').trim();
        if (t) blocks.push({ kind: 'paragraph', text: t, locator: `paragraph ${i + 1}` });
      });
    }
  } else {
    // pptx: ppt/slides/slideN.xml sorted by N numerically
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => (parseInt(a.match(/slide(\d+)/)![1]) - parseInt(b.match(/slide(\d+)/)![1])));
    for (const name of slideFiles) {
      const n = parseInt(name.match(/slide(\d+)/)![1]);
      const xml = await zip.files[name].async('string');
      const t = textOf(xml).join(' ').replace(/\s+/g, ' ').trim();
      if (t) blocks.push({ kind: 'paragraph', text: t, locator: `slide ${n}` });
    }
  }
  return blocks;
}

// ── TXT: paragraphs ──
async function parseTxt(buf: ArrayBuffer): Promise<ExtractedBlock[]> {
  const text = new TextDecoder().decode(buf);
  return text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .map((t, i) => ({ kind: 'paragraph' as const, text: t, locator: `paragraph ${i + 1}` }));
}

export async function extractDoc(file: File): Promise<ExtractedDoc> {
  const buf = await file.arrayBuffer();
  const kind = detectKind(file.name);
  const sha = await sha256Hex(buf);
  let blocks: ExtractedBlock[] = [];
  try {
    if (kind === 'pdf') blocks = await parsePdf(buf);
    else if (kind === 'xlsx' || kind === 'csv') blocks = await parseSheets(buf, kind);
    else if (kind === 'docx' || kind === 'pptx') blocks = await parseOoxml(buf, kind);
    else if (kind === 'txt') blocks = await parseTxt(buf);
    else blocks = [{ kind: 'paragraph', text: `Unsupported format (${kind}). Only text + tables are extracted in v1.`, locator: 'file' }];
  } catch (err) {
    blocks = [{ kind: 'paragraph', text: `Parse error: ${(err as Error).message}`, locator: 'file' }];
  }
  return {
    docId: 'xd-' + sha.slice(0, 12),
    fileName: file.name,
    kind,
    sha256: sha,
    bytes: buf.byteLength,
    extractedAt: new Date().toISOString(),
    blocks,
    meta: {},
  };
}

// ── Candidate synthesis: 1 doc-note + 1 claim per high-signal kv + 1 table per sheet ──
export function buildCandidates(doc: ExtractedDoc, idx: EntityIndex): ExtractionCandidate[] {
  const cands: ExtractionCandidate[] = [];
  let n = 0;
  const cid = () => `xc-${doc.docId}-${n++}`;

  // aggregate entity hits across text blocks for the doc-note
  const allHits: ReturnType<typeof tagBlock>['hits'] = [];
  for (const b of doc.blocks) {
    if (b.kind !== 'table' && b.text) {
      const { hits, claims } = tagBlock(b.text, b.locator, idx);
      allHits.push(...hits);
      for (const c of claims) {
        cands.push({
          candId: cid(), docId: doc.docId, locator: b.locator, kind: 'claim',
          title: `${c.claim.predicate.replace(/_/g, ' ')} — ${c.claim.object}`,
          claim: c.claim,
          matchedEntities: [],
          status: 'proposed',
          body_md: c.evidence.join('\n\n'),
        });
      }
    }
    if (b.kind === 'table' && b.table) {
      cands.push({
        candId: cid(), docId: doc.docId, locator: b.locator, kind: 'table',
        title: `Table — ${b.locator} (${b.table.columns.length}×${b.table.rows.length})`,
        matchedEntities: [],
        status: 'proposed',
        body_md: renderTableMd(b.table),
      });
    }
  }

  // de-dupe entity hits by (kind+entity)
  const uniq = new Map<string, (typeof allHits)[number]>();
  for (const h of allHits) { const k = h.kind + ':' + (h.noteId ?? h.entity.toLowerCase()); if (!uniq.has(k)) uniq.set(k, h); }
  const hits = [...uniq.values()];
  const resolved = hits.filter((h) => h.noteId);

  // document note candidate (summary + coverage)
  const coverage = hits.length
    ? hits.map((h) => (h.noteId ? `[[${entityTitle(h)}]]` : `\`${h.entity}\` _(unresolved)_`)).join(', ')
    : '_(no ontology entities matched)_';
  const summary = doc.blocks.filter((b) => b.text).slice(0, 3).map((b) => b.text).join(' ').slice(0, 400);
  cands.unshift({
    candId: cid(), docId: doc.docId, locator: 'document',
    kind: 'note',
    title: doc.fileName.replace(/\.[^.]+$/, ''),
    matchedEntities: toMatchedEntities(hits),
    status: 'proposed',
    body_md:
      `> Extracted from **${doc.fileName}** · \`${doc.kind}\` · sha256 \`${doc.sha256.slice(0, 16)}…\`\n\n` +
      `**Entity coverage** (${resolved.length} resolved / ${hits.length} matched): ${coverage}\n\n` +
      (summary ? `**Summary**\n\n${summary}${summary.length >= 400 ? '…' : ''}\n` : ''),
  });

  return cands;
}

function entityTitle(h: { entity: string; noteId: string | null }): string {
  return h.entity;
}

function renderTableMd(t: { columns: string[]; rows: (string | number | null)[][] }): string {
  const head = '| ' + t.columns.join(' | ') + ' |';
  const sep = '| ' + t.columns.map(() => '---').join(' | ') + ' |';
  const body = t.rows.slice(0, 20).map((r) => '| ' + r.map((c) => (c == null ? '' : String(c))).join(' | ') + ' |').join('\n');
  return [head, sep, body].join('\n');
}

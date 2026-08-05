import JSZip from 'jszip';
import type { SlideBlock } from '../types';
import type { OpaqueBundle, PptxManifest } from './pptx-writer';
import { EYEBROW_SHAPE, SLIDE_NAME_PREFIX } from './pptx-writer';
import { REL, Rel } from './pptx-parts';

/**
 * Fieldcraft PPTX reader.
 *
 * The contract is deliberately conservative: a slide is only treated as
 * structured if it looks like something this app could have written and could
 * write again. Anything else — extra shapes, pictures, SmartArt, charts — is
 * captured whole as an opaque bundle so re-export is lossless. We would rather
 * mark a slide "PowerPoint-only" than quietly discard a trainer's diagram.
 */

export type ReadSlide = {
  slide: SlideBlock;
  bundle?: OpaqueBundle;
};

export type ReadResult = {
  manifest: Partial<PptxManifest> & { schema?: string };
  slides: ReadSlide[];
  /** True when the file carries no Fieldcraft manifest at all. */
  foreign: boolean;
  warnings: string[];
};

/* ── Tiny XML access ────────────────────────────────────────────────────── */

type XmlDoc = { root: Element };

function parseXml(text: string, what: string): XmlDoc {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`Could not parse ${what}: ${err.textContent?.slice(0, 160)}`);
  return { root: doc.documentElement };
}

/** Namespace-agnostic descendant lookup — files in the wild vary on prefixes. */
function byLocal(el: Element | Document, local: string): Element[] {
  const out: Element[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === local) out.push(child);
      walk(child);
    }
  };
  walk((el as Document).documentElement ?? (el as Element));
  return out;
}

function firstLocal(el: Element, local: string): Element | undefined {
  return byLocal(el, local)[0];
}

/** Concatenate the a:t runs of a text body, one string per a:p. */
function paragraphs(txBody: Element): Array<{ text: string; lvl: number }> {
  return byLocal(txBody, 'p').map((p) => {
    const text = byLocal(p, 't').map((t) => t.textContent ?? '').join('');
    const pPr = Array.from(p.children).find((c) => c.localName === 'pPr');
    const lvl = Number(pPr?.getAttribute('lvl') ?? '0') || 0;
    return { text, lvl };
  });
}

/* ── Manifest ───────────────────────────────────────────────────────────── */

function readManifest(xml: string | undefined): ReadResult['manifest'] {
  if (!xml) return {};
  const doc = parseXml(xml, 'docProps/custom.xml');
  const out: Record<string, string> = {};
  byLocal(doc.root, 'property').forEach((p) => {
    const name = p.getAttribute('name') ?? '';
    out[name] = (p.textContent ?? '').trim();
  });
  return {
    schema: out.FieldcraftSchema,
    courseId: out.FieldcraftCourse,
    materialId: out.FieldcraftMaterial,
    baseRevision: out.FieldcraftBaseRevision,
    exportedAt: out.FieldcraftExportedAt ? Number(out.FieldcraftExportedAt) : undefined,
  };
}

/* ── Slide classification ───────────────────────────────────────────────── */

const MAPPABLE_SHAPES = new Set(['sp']);

/**
 * A slide round-trips as structured only when every shape is a plain text shape
 * we recognise: the title placeholder, the body placeholder, or our eyebrow box.
 */
function classify(spTree: Element): { structured: boolean; reason?: string } {
  for (const child of Array.from(spTree.children)) {
    const local = child.localName;
    if (local === 'nvGrpSpPr' || local === 'grpSpPr') continue;
    if (!MAPPABLE_SHAPES.has(local)) {
      return { structured: false, reason: `contains <${local}>` };
    }
    const nvPr = firstLocal(child, 'nvPr');
    const ph = nvPr ? Array.from(nvPr.children).find((c) => c.localName === 'ph') : undefined;
    const name = firstLocal(child, 'cNvPr')?.getAttribute('name') ?? '';
    const phType = ph?.getAttribute('type') ?? '';
    const known = phType === 'title' || phType === 'ctrTitle' || phType === 'body' || phType === 'subTitle' || name === EYEBROW_SHAPE;
    if (!known) return { structured: false, reason: `unrecognised shape "${name || phType || local}"` };
    // A recognised text shape that also carries a picture fill or embedded
    // object is not something we can regenerate faithfully.
    if (byLocal(child, 'blip').length) return { structured: false, reason: 'shape carries an image' };
  }
  return { structured: true };
}

function extractStructured(spTree: Element, id: string, note: string | undefined): SlideBlock {
  const block: SlideBlock = { id, kind: 'structured' };
  for (const sp of Array.from(spTree.children).filter((c) => c.localName === 'sp')) {
    const txBody = firstLocal(sp, 'txBody');
    if (!txBody) continue;
    const name = firstLocal(sp, 'cNvPr')?.getAttribute('name') ?? '';
    const nvPr = firstLocal(sp, 'nvPr');
    const ph = nvPr ? Array.from(nvPr.children).find((c) => c.localName === 'ph') : undefined;
    const phType = ph?.getAttribute('type') ?? '';
    const paras = paragraphs(txBody).filter((p) => p.text.trim().length);

    if (name === EYEBROW_SHAPE) {
      block.eyebrow = paras.map((p) => p.text).join(' ').trim() || undefined;
    } else if (phType === 'title' || phType === 'ctrTitle') {
      block.title = paras.map((p) => p.text).join(' ').trim();
    } else if (phType === 'body' || phType === 'subTitle') {
      // Level 0 is the body paragraph; anything indented is a bullet. If the
      // trainer left everything at level 0, the first line is the body and the
      // rest become bullets — which matches how people actually type.
      const lvl0 = paras.filter((p) => p.lvl === 0);
      const deeper = paras.filter((p) => p.lvl > 0);
      if (deeper.length) {
        block.body = lvl0.map((p) => p.text).join('\n').trim() || undefined;
        block.bullets = deeper.map((p) => p.text);
      } else if (lvl0.length) {
        block.body = lvl0[0].text;
        if (lvl0.length > 1) block.bullets = lvl0.slice(1).map((p) => p.text);
      }
    }
  }
  if (note) block.note = note;
  return block;
}

/* ── Package walk ───────────────────────────────────────────────────────── */

async function readRels(zip: JSZip, path: string): Promise<Rel[]> {
  const file = zip.file(path);
  if (!file) return [];
  const doc = parseXml(await file.async('string'), path);
  return byLocal(doc.root, 'Relationship').map((r) => ({
    id: r.getAttribute('Id') ?? '',
    type: r.getAttribute('Type') ?? '',
    target: r.getAttribute('Target') ?? '',
  }));
}

/** Slide order comes from presentation.xml, not from filename numbering. */
async function slideOrder(zip: JSZip): Promise<string[]> {
  const presFile = zip.file('ppt/presentation.xml');
  const rels = await readRels(zip, 'ppt/_rels/presentation.xml.rels');
  if (!presFile) return [];
  const doc = parseXml(await presFile.async('string'), 'ppt/presentation.xml');
  const byId = new Map(rels.map((r) => [r.id, r.target]));
  return byLocal(doc.root, 'sldId')
    .map((s) => {
      const rid = Array.from(s.attributes).find((a) => a.localName === 'id' && a.name !== 'id')?.value
        ?? s.getAttribute('r:id') ?? '';
      const target = byId.get(rid);
      return target ? `ppt/${target.replace(/^\.\//, '')}` : '';
    })
    .filter(Boolean);
}

function resolve(base: string, target: string): string {
  if (/^https?:/i.test(target)) return target;
  const parts = base.split('/').slice(0, -1);
  target.split('/').forEach((seg) => {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  });
  return parts.join('/');
}

export async function readPptx(data: ArrayBuffer | Uint8Array | Blob): Promise<ReadResult> {
  const zip = await JSZip.loadAsync(data as never);
  const warnings: string[] = [];

  const customFile = zip.file('docProps/custom.xml');
  const manifest = readManifest(customFile ? await customFile.async('string') : undefined);
  const foreign = !manifest.materialId;

  let paths = await slideOrder(zip);
  if (!paths.length) {
    paths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => Number(a.match(/(\d+)/)![1]) - Number(b.match(/(\d+)/)![1]));
    if (paths.length) warnings.push('Slide order was taken from filenames; presentation.xml was unreadable.');
  }

  const slides: ReadSlide[] = [];

  for (let i = 0; i < paths.length; i += 1) {
    const path = paths[i];
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async('string');
    const doc = parseXml(xml, path);
    const cSld = firstLocal(doc.root, 'cSld');
    const spTree = cSld ? firstLocal(cSld, 'spTree') : undefined;
    if (!spTree) continue;

    // Identity and teaching layout share the cSld name: fc:<id>|<layout>.
    const rawName = cSld?.getAttribute('name') ?? '';
    const tagged = rawName.startsWith(SLIDE_NAME_PREFIX) ? rawName.slice(SLIDE_NAME_PREFIX.length) : '';
    const [taggedId, taggedLayout] = tagged.split('|');
    const id = taggedId || `new-${i + 1}-${Math.abs(hash(path + rawName)).toString(36)}`;
    const layout = (taggedLayout || undefined) as SlideBlock['layout'];

    const relsPath = path.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const rels = await readRels(zip, relsPath);

    // Speaker notes, if the slide has any.
    let note: string | undefined;
    const notesRel = rels.find((r) => r.type === REL.notesSlide);
    let notesXml: string | undefined;
    if (notesRel) {
      const notesPath = resolve(path, notesRel.target);
      const notesFile = zip.file(notesPath);
      if (notesFile) {
        notesXml = await notesFile.async('string');
        const nDoc = parseXml(notesXml, notesPath);
        const bodies = byLocal(nDoc.root, 'txBody');
        const texts = bodies.map((b) => paragraphs(b).map((p) => p.text).join('\n').trim()).filter(Boolean);
        // The notes page also holds a slide-image placeholder and page number;
        // the longest text body is reliably the actual note.
        note = texts.sort((a, b) => b.length - a.length)[0] || undefined;
      }
    }

    const verdict = classify(spTree);
    if (verdict.structured) {
      slides.push({ slide: { ...extractStructured(spTree, id, note), layout } });
      continue;
    }

    const media: OpaqueBundle['media'] = [];
    for (const r of rels) {
      if (r.type !== REL.image) continue;
      const mediaPath = resolve(path, r.target);
      const mf = zip.file(mediaPath);
      if (!mf) continue;
      media.push({
        target: r.target,
        base64: await mf.async('base64'),
        extension: (mediaPath.split('.').pop() ?? 'png').toLowerCase(),
      });
    }

    const label = byLocal(spTree, 't').map((t) => t.textContent ?? '').join(' ').trim().slice(0, 80);
    warnings.push(`Slide ${i + 1} kept as PowerPoint-only (${verdict.reason}).`);
    slides.push({
      slide: {
        id,
        kind: 'opaque',
        layout,
        opaqueRef: `op:${manifest.materialId ?? 'deck'}:${id}`,
        opaqueLabel: label || `PowerPoint slide ${i + 1}`,
        note,
      },
      bundle: { slideXml: xml, rels, media, notesXml },
    });
  }

  return { manifest, slides, foreign, warnings };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

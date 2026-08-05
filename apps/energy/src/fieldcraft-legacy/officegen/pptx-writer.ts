import JSZip from 'jszip';
import type { DeckDoc, SlideBlock } from '../types';
import { esc, srgb, XML_DECL } from './xml';
import {
  BOX, CT, contentTypesXml, GROUP_HEAD_XML, NS_A, NS_P, NS_R, notesMasterXml, presPropsXml,
  REL, Rel, relsXml, SLIDE_H, SLIDE_W, slideLayoutXml, slideMasterXml, themeXml,
} from './pptx-parts';

/**
 * Fieldcraft PPTX writer.
 *
 * Two kinds of slide are emitted:
 *
 *  - **structured** — generated from the content model into real PowerPoint
 *    placeholders, so a trainer edits them exactly like any other deck and the
 *    reader can map them back field-for-field.
 *  - **opaque** — a slide the trainer built with PowerPoint features the web
 *    cannot represent (SmartArt, animation, video). Its original XML, its
 *    relationships and its media are re-emitted verbatim, so the round trip is
 *    lossless even though the web can only show a label for it.
 *
 * Each slide carries its Fieldcraft identity in `p:cSld/@name`, and the package
 * carries course/material/base-revision in docProps/custom.xml. Import is then
 * an exact match rather than a guess, and a stale base revision is detectable.
 */

export const PPTX_SCHEMA_VERSION = '1';
export const SLIDE_NAME_PREFIX = 'fc:';
export const EYEBROW_SHAPE = 'fc:eyebrow';

/** A preserved PowerPoint-authored slide, captured on import. */
export type OpaqueBundle = {
  slideXml: string;
  rels: Rel[];
  media: Array<{ target: string; base64: string; extension: string }>;
  notesXml?: string;
};

export type PptxManifest = {
  courseId: string;
  materialId: string;
  baseRevision: string;
  exportedAt: number;
  title: string;
};

export type PptxBuildInput = {
  deck: DeckDoc;
  manifest: PptxManifest;
  accent: string;
  dayLabel: string;
  /** opaqueRef → preserved bundle, for slides the web cannot author. */
  opaque?: Record<string, OpaqueBundle>;
};

/* ── Text helpers ───────────────────────────────────────────────────────── */

function run(text: string, attrs = 'lang="en-GB" dirty="0"'): string {
  return `<a:r><a:rPr ${attrs}/><a:t>${esc(text)}</a:t></a:r>`;
}

function para(text: string, lvl: number, attrs?: string): string {
  const pPr = lvl > 0 ? `<a:pPr lvl="${lvl}"/>` : '<a:pPr/>';
  return `<a:p>${pPr}${run(text, attrs)}</a:p>`;
}

/* ── Slide generation ───────────────────────────────────────────────────── */

function eyebrowShape(text: string, accent: string): string {
  const b = BOX.eyebrow;
  return (
    '<p:sp><p:nvSpPr>' +
    `<p:cNvPr id="4" name="${EYEBROW_SHAPE}"/>` +
    '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    `<p:spPr><a:xfrm><a:off x="${b.x}" y="${b.y}"/><a:ext cx="${b.cx}" cy="${b.cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
    '<p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>' +
    `<a:p><a:pPr/><a:r><a:rPr lang="en-GB" sz="1100" b="1" spc="300" dirty="0"><a:solidFill><a:srgbClr val="${accent}"/></a:solidFill></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p>` +
    '</p:txBody></p:sp>'
  );
}

function structuredSlideXml(slide: SlideBlock, accent: string): string {
  const shapes: string[] = [];

  if (slide.eyebrow) shapes.push(eyebrowShape(slide.eyebrow, accent));

  const t = BOX.title;
  shapes.push(
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
    `<p:spPr><a:xfrm><a:off x="${t.x}" y="${t.y}"/><a:ext cx="${t.cx}" cy="${t.cy}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:lstStyle/>${para(slide.title ?? '', 0)}</p:txBody></p:sp>`,
  );

  // One content placeholder holds the body paragraph at level 0 and each bullet
  // at level 1. That reads as a normal PowerPoint content box to the trainer and
  // stays unambiguous to parse back.
  const paragraphs: string[] = [];
  if (slide.body) paragraphs.push(para(slide.body, 0));
  (slide.bullets ?? []).forEach((b) => paragraphs.push(para(b, 1)));
  if (!paragraphs.length) paragraphs.push('<a:p><a:endParaRPr lang="en-GB"/></a:p>');

  const b = BOX.body;
  shapes.push(
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
    `<p:spPr><a:xfrm><a:off x="${b.x}" y="${b.y}"/><a:ext cx="${b.cx}" cy="${b.cy}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs.join('')}</p:txBody></p:sp>`,
  );

  return (
    `${XML_DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld name="${esc(slideName(slide))}"><p:spTree>${GROUP_HEAD_XML}${shapes.join('')}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
  );
}

function notesSlideXml(note: string): string {
  return (
    `${XML_DECL}<p:notes xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld><p:spTree>${GROUP_HEAD_XML}` +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${para(note, 0)}</p:txBody></p:sp>` +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>'
  );
}

/**
 * Slide identity, with the teaching layout appended after a pipe so it survives
 * a PowerPoint round trip. PowerPoint preserves this attribute and never shows
 * it to the trainer, which makes it the right place for both.
 */
export function slideName(slide: Pick<SlideBlock, 'id' | 'layout'>): string {
  return SLIDE_NAME_PREFIX + slide.id + (slide.layout ? `|${slide.layout}` : '');
}

/**
 * Force a preserved slide to carry its Fieldcraft identity even if PowerPoint
 * rewrote or dropped the `name` attribute while the trainer was editing.
 */
function stampIdentity(slideXml: string, id: string): string {
  const name = SLIDE_NAME_PREFIX + id;
  if (/<p:cSld[^>]*\sname="/.test(slideXml)) {
    return slideXml.replace(/(<p:cSld[^>]*\sname=")[^"]*(")/, `$1${esc(name)}$2`);
  }
  return slideXml.replace(/<p:cSld(\s|>)/, `<p:cSld name="${esc(name)}"$1`);
}

/* ── Package metadata ───────────────────────────────────────────────────── */

function corePropsXml(m: PptxManifest): string {
  const iso = new Date(m.exportedAt).toISOString().replace(/\.\d+Z$/, 'Z');
  return (
    `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(m.title)}</dc:title><dc:creator>ArgantaEnergy</dc:creator>` +
    `<cp:lastModifiedBy>ArgantaEnergy</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

function appPropsXml(slideCount: number): string {
  return (
    `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>Arganta Fieldcraft</Application>' +
    `<Slides>${slideCount}</Slides><Company>ArgantaEnergy</Company>` +
    '</Properties>'
  );
}

/** The identity manifest that makes import exact rather than heuristic. */
export function customPropsXml(m: PptxManifest): string {
  const props: Array<[string, string]> = [
    ['FieldcraftSchema', PPTX_SCHEMA_VERSION],
    ['FieldcraftCourse', m.courseId],
    ['FieldcraftMaterial', m.materialId],
    ['FieldcraftBaseRevision', m.baseRevision],
    ['FieldcraftExportedAt', String(m.exportedAt)],
  ];
  const body = props
    .map(([name, value], i) =>
      `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${i + 2}" name="${esc(name)}">` +
      `<vt:lpwstr>${esc(value)}</vt:lpwstr></property>`)
    .join('');
  return (
    `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${body}</Properties>`
  );
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  emf: 'image/x-emf', wmf: 'image/x-wmf', svg: 'image/svg+xml', bmp: 'image/bmp',
  tiff: 'image/tiff', mp4: 'video/mp4', wav: 'audio/wav', mp3: 'audio/mpeg',
};

export function buildPptx(input: PptxBuildInput): JSZip {
  const { deck, manifest, dayLabel } = input;
  const accent = srgb(input.accent);
  const zip = new JSZip();
  const slides = deck.slides;

  const overrides: Array<[string, string]> = [
    ['/ppt/presentation.xml', CT.presentation],
    ['/ppt/slideMasters/slideMaster1.xml', CT.slideMaster],
    ['/ppt/slideLayouts/slideLayout1.xml', CT.slideLayout],
    ['/ppt/notesMasters/notesMaster1.xml', CT.notesMaster],
    ['/ppt/theme/theme1.xml', CT.theme],
    ['/ppt/presProps.xml', CT.presProps],
    ['/docProps/core.xml', CT.core],
    ['/docProps/app.xml', CT.app],
    ['/docProps/custom.xml', CT.custom],
  ];
  const extensions = new Set<string>(['rels', 'xml']);
  const presRels: Rel[] = [{ id: 'rId1', type: REL.slideMaster, target: 'slideMasters/slideMaster1.xml' }];
  const sldIds: string[] = [];

  slides.forEach((slide, i) => {
    const n = i + 1;
    const bundle = slide.kind === 'opaque' && slide.opaqueRef ? input.opaque?.[slide.opaqueRef] : undefined;
    const slideRels: Rel[] = [{ id: 'rId1', type: REL.slideLayout, target: '../slideLayouts/slideLayout1.xml' }];
    let slideXml: string;

    if (bundle) {
      // Re-emit the trainer's slide untouched, but re-point its layout at ours
      // and give its media collision-free names inside this package.
      slideXml = stampIdentity(bundle.slideXml, slide.id);
      let relId = 2;
      bundle.rels.forEach((r) => {
        if (r.type === REL.slideLayout || r.type === REL.notesSlide) return;
        const media = bundle.media.find((mm) => mm.target === r.target);
        if (media) {
          const name = `op${n}_${relId}.${media.extension}`;
          extensions.add(media.extension);
          zip.file(`ppt/media/${name}`, media.base64, { base64: true, date: new Date(0) });
          slideRels.push({ id: `rId${relId}`, type: REL.image, target: `../media/${name}` });
        } else {
          slideRels.push({ id: `rId${relId}`, type: r.type, target: r.target });
        }
        slideXml = slideXml.replace(new RegExp(`r:(embed|id|link)="${r.id}"`, 'g'), `r:$1="rId${relId}"`);
        relId += 1;
      });
    } else {
      slideXml = structuredSlideXml(slide, accent);
    }

    const note = bundle?.notesXml ? undefined : slide.note;
    if (note || bundle?.notesXml) {
      const notesPath = `ppt/notesSlides/notesSlide${n}.xml`;
      zip.file(notesPath, bundle?.notesXml ?? notesSlideXml(note ?? ''), { date: new Date(0) });
      zip.file(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, relsXml([
        { id: 'rId1', type: REL.notesMaster, target: '../notesMasters/notesMaster1.xml' },
        { id: 'rId2', type: REL.slide, target: `../slides/slide${n}.xml` },
      ]), { date: new Date(0) });
      overrides.push([`/${notesPath}`, CT.notesSlide]);
      slideRels.push({ id: `rId${slideRels.length + 1}`, type: REL.notesSlide, target: `../notesSlides/notesSlide${n}.xml` });
    }

    zip.file(`ppt/slides/slide${n}.xml`, slideXml, { date: new Date(0) });
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, relsXml(slideRels), { date: new Date(0) });
    overrides.push([`/ppt/slides/slide${n}.xml`, CT.slide]);

    const rid = `rId${100 + n}`;
    presRels.push({ id: rid, type: REL.slide, target: `slides/slide${n}.xml` });
    sldIds.push(`<p:sldId id="${255 + n}" r:id="${rid}"/>`);
  });

  presRels.push(
    { id: 'rId900', type: REL.notesMaster, target: 'notesMasters/notesMaster1.xml' },
    { id: 'rId901', type: REL.presProps, target: 'presProps.xml' },
    { id: 'rId902', type: REL.theme, target: 'theme/theme1.xml' },
  );

  const presentationXml =
    `${XML_DECL}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:notesMasterIdLst><p:notesMasterId r:id="rId900"/></p:notesMasterIdLst>' +
    `<p:sldIdLst>${sldIds.join('')}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="6858000" cy="9144000"/>` +
    '</p:presentation>';

  const defaults: Array<[string, string]> = [
    ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
    ['xml', 'application/xml'],
  ];
  [...extensions].forEach((ext) => {
    if (ext === 'rels' || ext === 'xml') return;
    defaults.push([ext, MEDIA_TYPES[ext] ?? 'application/octet-stream']);
  });

  const D = { date: new Date(0) };
  zip.file('[Content_Types].xml', contentTypesXml({ defaults, overrides }), D);
  zip.file('_rels/.rels', relsXml([
    { id: 'rId1', type: REL.officeDocument, target: 'ppt/presentation.xml' },
    { id: 'rId2', type: REL.coreProps, target: 'docProps/core.xml' },
    { id: 'rId3', type: REL.extProps, target: 'docProps/app.xml' },
    { id: 'rId4', type: REL.customProps, target: 'docProps/custom.xml' },
  ]), D);
  zip.file('docProps/core.xml', corePropsXml(manifest), D);
  zip.file('docProps/app.xml', appPropsXml(slides.length), D);
  zip.file('docProps/custom.xml', customPropsXml(manifest), D);
  zip.file('ppt/presentation.xml', presentationXml, D);
  zip.file('ppt/_rels/presentation.xml.rels', relsXml(presRels), D);
  zip.file('ppt/presProps.xml', presPropsXml(), D);
  zip.file('ppt/theme/theme1.xml', themeXml(accent), D);
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml(), D);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', relsXml([
    { id: 'rId1', type: REL.slideLayout, target: '../slideLayouts/slideLayout1.xml' },
    { id: 'rId2', type: REL.theme, target: '../theme/theme1.xml' },
  ]), D);
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml(), D);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', relsXml([
    { id: 'rId1', type: REL.slideMaster, target: '../slideMasters/slideMaster1.xml' },
  ]), D);
  zip.file('ppt/notesMasters/notesMaster1.xml', notesMasterXml(), D);
  zip.file('ppt/notesMasters/_rels/notesMaster1.xml.rels', relsXml([
    { id: 'rId1', type: REL.theme, target: '../theme/theme1.xml' },
  ]), D);

  void dayLabel;
  return zip;
}

export async function pptxBlob(input: PptxBuildInput): Promise<Blob> {
  return buildPptx(input).generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  });
}

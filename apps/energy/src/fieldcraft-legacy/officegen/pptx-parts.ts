import { esc, XML_DECL } from './xml';

/**
 * Static OOXML parts for a Fieldcraft deck.
 *
 * Everything here is fixed scaffolding: theme, master, layout and the package
 * plumbing PowerPoint requires before it will open a file at all. The parts
 * that vary per deck (slides, notes, manifest) live in pptx-writer.ts.
 */

export const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** 16:9 at 13.333in x 7.5in. */
export const SLIDE_W = 12192000;
export const SLIDE_H = 6858000;

export const CT = {
  slide: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
  slideLayout: 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml',
  slideMaster: 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml',
  notesSlide: 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml',
  notesMaster: 'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml',
  presentation: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  presProps: 'application/vnd.openxmlformats-officedocument.presentationml.presProps+xml',
  theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
  core: 'application/vnd.openxmlformats-package.core-properties+xml',
  app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  custom: 'application/vnd.openxmlformats-officedocument.custom-properties+xml',
};

export const REL = {
  officeDocument: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  coreProps: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  customProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties',
  slide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
  slideMaster: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
  slideLayout: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
  notesSlide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',
  notesMaster: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster',
  theme: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
  presProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
};

export type Rel = { id: string; type: string; target: string };

export function relsXml(rels: Rel[]): string {
  const body = rels
    .map((r) => `<Relationship Id="${esc(r.id)}" Type="${esc(r.type)}" Target="${esc(r.target)}"/>`)
    .join('');
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

export function contentTypesXml(entries: { defaults: Array<[string, string]>; overrides: Array<[string, string]> }): string {
  const defaults = entries.defaults
    .map(([ext, type]) => `<Default Extension="${esc(ext)}" ContentType="${esc(type)}"/>`)
    .join('');
  const overrides = entries.overrides
    .map(([part, type]) => `<Override PartName="${esc(part)}" ContentType="${esc(type)}"/>`)
    .join('');
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}${overrides}</Types>`;
}

/* ── Theme ──────────────────────────────────────────────────────────────── */

const FONT = 'Inter';

function fillStyles(): string {
  return (
    '<a:fillStyleLst>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"><a:tint val="60000"/></a:schemeClr></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"><a:shade val="80000"/></a:schemeClr></a:solidFill>' +
    '</a:fillStyleLst>'
  );
}

function lineStyles(): string {
  const ln = (w: number) =>
    `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>`;
  return `<a:lnStyleLst>${ln(6350)}${ln(12700)}${ln(19050)}</a:lnStyleLst>`;
}

export function themeXml(accent: string): string {
  return (
    `${XML_DECL}<a:theme xmlns:a="${NS_A}" name="Arganta Fieldcraft">` +
    '<a:themeElements>' +
    '<a:clrScheme name="Fieldcraft">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="071A22"/></a:dk2>' +
    '<a:lt2><a:srgbClr val="F4F7F9"/></a:lt2>' +
    `<a:accent1><a:srgbClr val="${accent}"/></a:accent1>` +
    '<a:accent2><a:srgbClr val="0FB5A6"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="22D3EE"/></a:accent3>' +
    '<a:accent4><a:srgbClr val="F59E0B"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="7C3AED"/></a:accent5>' +
    '<a:accent6><a:srgbClr val="E11D74"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="087A70"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="5B6B80"/></a:folHlink>' +
    '</a:clrScheme>' +
    `<a:fontScheme name="Fieldcraft"><a:majorFont><a:latin typeface="${FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Fieldcraft">${fillStyles()}${lineStyles()}` +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    `${fillStyles().replace('fillStyleLst', 'bgFillStyleLst').replace('</a:fillStyleLst>', '</a:bgFillStyleLst>')}` +
    '</a:fmtScheme>' +
    '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
  );
}

/* ── Master and layout ──────────────────────────────────────────────────── */

const GROUP_HEAD =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const CLR_MAP =
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

/** Geometry shared by master, layout and every generated slide. */
export const BOX = {
  eyebrow: { x: 838200, y: 685800, cx: 10515600, cy: 400000 },
  title: { x: 838200, y: 1143000, cx: 10515600, cy: 1600200 },
  body: { x: 838200, y: 2895600, cx: 10515600, cy: 2743200 },
};

function ph(type: string, idx?: number): string {
  return `<p:ph type="${type}"${idx === undefined ? '' : ` idx="${idx}"`}/>`;
}

function placeholderShape(id: number, name: string, phXml: string, box: { x: number; y: number; cx: number; cy: number }, prompt: string): string {
  return (
    '<p:sp><p:nvSpPr>' +
    `<p:cNvPr id="${id}" name="${esc(name)}"/>` +
    '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    `<p:nvPr>${phXml}</p:nvPr>` +
    '</p:nvSpPr>' +
    `<p:spPr><a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.cx}" cy="${box.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB" dirty="0"/><a:t>${esc(prompt)}</a:t></a:r></a:p></p:txBody>` +
    '</p:sp>'
  );
}

export function slideMasterXml(): string {
  const shapes =
    placeholderShape(2, 'Title Placeholder 1', ph('title'), BOX.title, 'Click to edit Master title style') +
    placeholderShape(3, 'Text Placeholder 2', ph('body', 1), BOX.body, 'Click to edit Master text styles');
  const txStyles =
    '<p:txStyles>' +
    '<p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3600" b="1"><a:solidFill><a:schemeClr val="dk2"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle>' +
    '<p:bodyStyle><a:lvl1pPr marL="0" indent="0" algn="l"><a:buNone/><a:defRPr sz="1600"><a:solidFill><a:schemeClr val="dk2"/></a:solidFill></a:defRPr></a:lvl1pPr>' +
    '<a:lvl2pPr marL="342900" indent="-342900"><a:buChar char="&#8226;"/><a:defRPr sz="1400"><a:solidFill><a:schemeClr val="dk2"/></a:solidFill></a:defRPr></a:lvl2pPr></p:bodyStyle>' +
    '<p:otherStyle><a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr></p:otherStyle>' +
    '</p:txStyles>';
  return (
    `${XML_DECL}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    `<p:spTree>${GROUP_HEAD}${shapes}</p:spTree></p:cSld>` +
    CLR_MAP +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    txStyles +
    '</p:sldMaster>'
  );
}

export function slideLayoutXml(): string {
  const shapes =
    placeholderShape(2, 'Title 1', ph('title'), BOX.title, 'Click to edit title') +
    placeholderShape(3, 'Content Placeholder 2', ph('body', 1), BOX.body, 'Click to edit text');
  return (
    `${XML_DECL}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="obj" preserve="1">` +
    `<p:cSld name="Fieldcraft Slide"><p:spTree>${GROUP_HEAD}${shapes}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sldLayout>'
  );
}

export function notesMasterXml(): string {
  const body =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    `<p:nvPr>${ph('body', 1)}</p:nvPr></p:nvSpPr>` +
    '<p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody></p:sp>';
  return (
    `${XML_DECL}<p:notesMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld><p:spTree>${GROUP_HEAD}${body}</p:spTree></p:cSld>` +
    CLR_MAP +
    '<p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle>' +
    '</p:notesMaster>'
  );
}

export function presPropsXml(): string {
  return `${XML_DECL}<p:presentationPr xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"/>`;
}

export const GROUP_HEAD_XML = GROUP_HEAD;

import JSZip from 'jszip';
import type { MaterialDoc } from '../types';
import { esc, XML_DECL } from './xml';

/**
 * DOCX writer for the document-shaped materials.
 *
 * Facilitator guides and learner workbooks are prose and tables, not slides, so
 * they go to Word rather than being forced into a deck. This is one-way by
 * design: those documents are *compiled* from the slides, run of show, missions
 * and question bank, so importing an edited copy back would mean two sources of
 * truth for the same sentence. Edit the deck, and the guide follows.
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const STYLE = {
  title: 'FcTitle', heading: 'FcHeading', body: 'FcBody',
  meta: 'FcMeta', bullet: 'FcBullet', note: 'FcNote',
};

function p(text: string, style: string, opts: { bold?: boolean } = {}): string {
  const runProps = opts.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return (
    `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>` +
    `<w:r>${runProps}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
  );
}

function tableRow(a: string, b: string): string {
  const cell = (text: string, w: number, bold: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${p(text, STYLE.body, { bold })}</w:tc>`;
  return `<w:tr>${cell(a, 3200, true)}${cell(b, 6300, false)}</w:tr>`;
}

function table(rows: Array<[string, string]>): string {
  const props =
    '<w:tblPr><w:tblW w:w="9500" w:type="dxa"/>' +
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="D8E0E6"/>`)
      .join('') +
    '</w:tblBorders></w:tblPr>';
  return `<w:tbl>${props}${rows.map(([a, b]) => tableRow(a, b)).join('')}</w:tbl>${p('', STYLE.body)}`;
}

function stylesXml(): string {
  const style = (id: string, name: string, size: number, opts: { bold?: boolean; color?: string; before?: number; italic?: boolean } = {}) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:pPr><w:spacing w:before="${opts.before ?? 60}" w:after="80" w:line="276" w:lineRule="auto"/></w:pPr>` +
    `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="${size}"/>` +
    `${opts.bold ? '<w:b/>' : ''}${opts.italic ? '<w:i/>' : ''}` +
    `${opts.color ? `<w:color w:val="${opts.color}"/>` : ''}</w:rPr></w:style>`;
  return (
    `${XML_DECL}<w:styles xmlns:w="${W_NS}">` +
    style(STYLE.title, 'Fieldcraft Title', 44, { bold: true, color: '071A22' }) +
    style(STYLE.heading, 'Fieldcraft Heading', 28, { bold: true, color: '087A70', before: 280 }) +
    style(STYLE.body, 'Fieldcraft Body', 21) +
    style(STYLE.meta, 'Fieldcraft Meta', 18, { color: '5B6B80' }) +
    style(STYLE.bullet, 'Fieldcraft Bullet', 21) +
    style(STYLE.note, 'Fieldcraft Note', 19, { italic: true, color: '5B6B80' }) +
    '</w:styles>'
  );
}

function numberingXml(): string {
  return (
    `${XML_DECL}<w:numbering xmlns:w="${W_NS}">` +
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/>' +
    '<w:lvlText w:val="&#8226;"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    '</w:numbering>'
  );
}

function bullet(text: string): string {
  return (
    `<w:p><w:pPr><w:pStyle w:val="${STYLE.bullet}"/>` +
    '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' +
    `<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
  );
}

export function buildDocx(doc: MaterialDoc, courseName: string): JSZip {
  const zip = new JSZip();
  const D = { date: new Date(0) };
  const parts: string[] = [
    p(doc.title, STYLE.title),
    p(courseName, STYLE.meta),
    p(`${doc.subtitle} · ${doc.kind} · course version ${doc.version}`, STYLE.meta),
  ];

  doc.sections.forEach((s) => {
    parts.push(p(s.instructorOnly ? `${s.heading} — instructor only` : s.heading, STYLE.heading));
    if (s.body) s.body.split('\n').forEach((line) => parts.push(p(line, STYLE.body)));
    (s.items ?? []).forEach((i) => parts.push(bullet(i)));
    if (s.rows?.length) parts.push(table(s.rows));
    (s.steps ?? []).forEach((st, i) => {
      parts.push(p(`${i + 1}. ${st.title}`, STYLE.body, { bold: true }));
      parts.push(p(st.detail, STYLE.body));
      parts.push(p(`Capture: ${st.capture}`, STYLE.note));
    });
    (s.qa ?? []).forEach((item, i) => {
      parts.push(p(`${i + 1}. ${item.q}`, STYLE.body));
      parts.push(p(`Answer: ${item.a}`, STYLE.body, { bold: true }));
      parts.push(p(item.why, STYLE.note));
    });
    if (s.note) parts.push(p(`Facilitator note. ${s.note}`, STYLE.note));
  });

  const documentXml =
    `${XML_DECL}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>${parts.join('')}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709"/>' +
    '</w:sectPr></w:body></w:document>';

  zip.file('[Content_Types].xml',
    `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>', D);

  zip.file('_rels/.rels',
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="word/document.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '</Relationships>', D);

  zip.file('word/_rels/document.xml.rels',
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${R_NS}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${R_NS}/numbering" Target="numbering.xml"/>` +
    '</Relationships>', D);

  zip.file('docProps/core.xml',
    `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<dc:title>${esc(doc.title)}</dc:title><dc:creator>ArgantaEnergy</dc:creator>` +
    '</cp:coreProperties>', D);

  zip.file('word/document.xml', documentXml, D);
  zip.file('word/styles.xml', stylesXml(), D);
  zip.file('word/numbering.xml', numberingXml(), D);
  return zip;
}

export async function docxBlob(doc: MaterialDoc, courseName: string): Promise<Blob> {
  return buildDocx(doc, courseName).generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

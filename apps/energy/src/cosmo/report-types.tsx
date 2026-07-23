// Shared types + small verbatim helpers for the Report zone (Manager/Report/Document/
// Presentation), all reproduced 1:1 from COSMO_Final.html. Data itself (DEPARTMENTS,
// FOLDERS, CORPUS→FILES, REPORT_TREE→ALL_REPORTS) is extracted verbatim by
// scripts/extract-corpus.mjs into report-data.json — see that script before hand-editing.
import reportData from './report-data.json';

export type FileRow = {
  name: string; cls: 'standard' | 'generated'; theme: string; dept: string; by: string;
  fmt: string; pr: 'P1' | 'P2' | 'P3'; upd: string; md: string; title: string; stageLabel: string;
};
export type Department = { id: string; name: string; icon: string; c: string };
export type ReportNode = {
  id: string; name: string; icon: string; c: string; owner: string; freq: string;
  kind: 'scorecard' | 'exec' | 'kpi' | 'doc' | 'daily';
  desc: string; kpis: Array<[string, string, string]>;
};
export type ReportGroup = { group: string; c: string; icon: string; kpi?: ReportNode; reports: ReportNode[] };

export const DEPARTMENTS = reportData.DEPARTMENTS as Department[];
export const FOLDERS = reportData.FOLDERS as Record<string, string[]>;
export const PR_META = reportData.PR_META as unknown as Record<string, [string, string]>;
export const CLS_META = reportData.CLS_META as unknown as Record<string, [string, string, string]>;
export const FILES = reportData.FILES as FileRow[];
export const REPORT_TREE = reportData.REPORT_TREE as unknown as ReportGroup[];
export const ALL_REPORTS = reportData.ALL_REPORTS as unknown as ReportNode[];

export const GEN_TYPE_ICON: Record<string, [string, string]> = {
  Report: ['file-text', '#2563eb'], Presentation: ['monitor-play', '#d24726'],
  Word: ['file-text', '#2563eb'], Dataset: ['database', '#1e7145'], Dashboard: ['layout-dashboard', '#0a8a7f'],
};
export function fileIcon(f: FileRow): [string, string] {
  return f.cls === 'standard' ? ['book-marked', '#0FB5A6'] : (GEN_TYPE_ICON[f.fmt] || ['sparkles', '#7c3aed']);
}
export const KIND_BADGE: Record<string, [string, string]> = {
  scorecard: ['NORTH STAR', '#0FB5A6'], exec: ['EXECUTIVE', '#2563eb'], kpi: ['KPI', '#7c3aed'],
  doc: ['REPORT', '#0a8a7f'], daily: ['DAILY', '#f59e0b'],
};

export const PAGE_SIZES: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 8.27, h: 11.69, label: 'A4' }, Letter: { w: 8.5, h: 11, label: 'Letter' }, Legal: { w: 8.5, h: 14, label: 'Legal' },
  A3: { w: 11.69, h: 16.54, label: 'A3' }, Tabloid: { w: 11, h: 17, label: 'Tabloid' }, A5: { w: 5.83, h: 8.27, label: 'A5' },
};
export const MARGINS: Record<string, number> = { Normal: 1, Narrow: 0.5, Moderate: 0.75, Wide: 1.5 };
export const PAGE_TITLES = ['Geological Synthesis Report', 'Method & Data', 'Results & Recommendations', 'Appendix — Evidence Log'];

export const SLIDE_SIZES: Record<string, { r: number; label: string }> = {
  '16:9': { r: 16 / 9, label: 'Widescreen 16:9' }, '4:3': { r: 4 / 3, label: 'Standard 4:3' },
  '16:10': { r: 16 / 10, label: '16:10' }, A4: { r: 1.414, label: 'A4 paper' }, '1:1': { r: 1, label: 'Square 1:1' },
};
export const LAYOUTS = ['Title', 'Title + Content', 'Two Content', 'Section', 'Comparison', 'Chart', 'Table', 'Picture', 'Blank'];
export const THEMES: Array<[string, string]> = [['dark', 'Midnight'], ['light', 'Paper'], ['teal', 'Teal'], ['violet', 'Violet']];
export const TRANSITIONS = ['None', 'Fade', 'Push', 'Wipe', 'Morph', 'Zoom'];

// the 5 lifecycle verticals — used by the ReportManager scorecard breakdown row
export const VERTICAL_NAMES = ['Exploration', 'Field Development', 'Well Delivery', 'Reservoir Management', 'Drilling'];
export const ORG_STAGES = [
  { id: 'corporate', name: 'Corporate', c: '#0a8a7f', icon: 'sparkles' },
  { id: 'exploration', name: 'Exploration', c: '#22d3ee', icon: 'compass' },
  { id: 'field-development', name: 'Field Development', c: '#0FB5A6', icon: 'layers' },
  { id: 'well-delivery', name: 'Well Delivery', c: '#f59e0b', icon: 'drill' },
  { id: 'reservoir-management', name: 'Reservoir Management', c: '#7c3aed', icon: 'gauge' },
  { id: 'drilling-sequence', name: 'Drilling', c: '#e11d74', icon: 'calendar-clock' },
];

// minimal markdown → HTML (headings · bullets · bold · code · callouts · wikilinks)
// — shared with CosmoChat's mdToHtml, reproduced here to keep the Report zone standalone.
export function mdToHtml(md: string) {
  const src = String(md || '');
  const lines = src.split('\n');
  const out: string[] = [];
  let inList = false;
  const close = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = (s: string) => s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a class="wl">$2</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="wl">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^> \[!(\w+)\]\s*(.*)$/))) { close(); out.push(`<div class="cal cal-${m[1].toLowerCase()}"><b>${inline(m[2] || m[1])}</b></div>`); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { close(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (line.startsWith('---')) { continue; } // strip frontmatter fences
    close(); out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join('');
}
export function MdBody({ md }: { md: string }) {
  // frontmatter block (--- ... ---) is stripped from the rendered body — same behavior
  // as the source's cnote() output feeding straight into marked.parse.
  const body = md.replace(/^---[\s\S]*?---\n*/, '');
  return <div className="obs-body" dangerouslySetInnerHTML={{ __html: mdToHtml(body) }} />;
}

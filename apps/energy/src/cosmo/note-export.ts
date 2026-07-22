// note-export.ts — serialize knowledge-base notes to STANDARD Obsidian markdown files
// (YAML frontmatter + [[wikilinks]] + flat type-folders) and download them, single or as
// a bulk vault ZIP (via fflate). Drops into Obsidian plug-and-play: filename = title so
// [[Title]] resolves; aliases + tags + relations live in frontmatter.
import { zipSync, strToU8 } from 'fflate';
import type { KNode } from './knowledge-model';

// Obsidian-illegal filename chars → dash. Titles keep · () which Obsidian allows.
const safeName = (t: string) => t.replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' ').trim();

function yamlScalar(v: string): string {
  // quote if it contains yaml-significant chars (wikilinks [[..]], colon, etc.)
  return /[:#\[\]{}"',&*?|<>=!%@`]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}
function yamlValue(v: string | string[], indent = ''): string {
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return '\n' + v.map((x) => `${indent}  - ${yamlScalar(x)}`).join('\n');
  }
  return yamlScalar(v);
}

/** One KNode → a full Obsidian note (frontmatter + body). */
export function noteToMarkdown(n: KNode, created: string): string {
  const fm: Array<[string, string | string[]]> = [
    ['title', n.title],
    ['type', n.type],
  ];
  if (n.field) fm.push(['field', n.field]);
  if (n.aliases?.length) fm.push(['aliases', n.aliases]);
  fm.push(['tags', n.tags.map((t) => t.replace(/^#/, ''))]);
  fm.push(['uid', n.id]);
  if (n.provenance) fm.push(['provenance', n.provenance]);
  if (n.source) fm.push(['source', n.source]);
  fm.push(['created', created]);
  fm.push(['version', '1']);
  for (const [k, v] of Object.entries(n.fm || {})) fm.push([k, v]);

  const yaml = fm.map(([k, v]) => `${k}:${Array.isArray(v) ? yamlValue(v) : ' ' + yamlValue(v)}`).join('\n');
  return `---\n${yaml}\n---\n\n${n.body.trim()}\n`;
}

const today = () => { try { return new Date().toISOString().slice(0, 10); } catch { return '2026-07-22'; } };

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a single note as <Title>.md */
export function downloadNote(n: KNode) {
  const md = noteToMarkdown(n, today());
  triggerDownload(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${safeName(n.title)}.md`);
}

/** Bulk-export every note as an Obsidian vault ZIP, folders preserved. */
export function exportVault(nodes: KNode[], vaultName = 'ArgantaEnergy-Knowledge-Base') {
  const created = today();
  const files: Record<string, Uint8Array> = {};
  const seen = new Set<string>();
  for (const n of nodes) {
    let path = `${n.folder}/${safeName(n.title)}.md`;
    let i = 2; while (seen.has(path)) { path = `${n.folder}/${safeName(n.title)} (${i++}).md`; }
    seen.add(path);
    files[path] = strToU8(noteToMarkdown(n, created));
  }
  // a vault README so the ZIP is self-describing in Obsidian
  files['00_Home/README.md'] = strToU8(
    `---\ntitle: ${vaultName}\ntype: home\ntags:\n  - home\ncreated: ${created}\n---\n\n# ${vaultName}\n\nAn evidence-native subsurface knowledge base — data ↔ knowledge as one connected graph.\nOpen this folder as an Obsidian vault; every \`[[wikilink]]\` resolves. ${nodes.length} notes.\n\n## Structure\n- \`01_Fields\` … \`11_Decisions\` — type-prefixed folders\n- Every note carries YAML frontmatter (\`type\`, \`provenance\`, \`source\`, relations)\n- Foreign keys are wikilinks: data ↔ asset ↔ lifecycle\n`,
  );
  const zipped = zipSync(files, { level: 6 });
  triggerDownload(new Blob([zipped as BlobPart], { type: 'application/zip' }), `${vaultName}.zip`);
}

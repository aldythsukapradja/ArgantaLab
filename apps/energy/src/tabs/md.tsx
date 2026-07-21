import type { ReactNode } from 'react';
import type { VaultNote } from '../knowledge/types';
import { linkKey } from '../knowledge/links';

// Lightweight, dependency-free markdown renderer — enough for the vault notes.
// Wikilinks resolve against an optional note set: hit → clickable .wikilink,
// miss → .wikilink.dead (never a silent no-op). Blockquote `>` → callout.

export interface MdCtx { notes?: VaultNote[]; onOpenNote?: (id: string) => void }

function titleIndex(notes?: VaultNote[]): Map<string, string> {
  const idx = new Map<string, string>();
  if (notes) for (const n of notes) { const k = n.title.toLowerCase(); if (!idx.has(k)) idx.set(k, n.id); }
  return idx;
}

function inline(text: string, keyBase: string, ctx: MdCtx, idx: Map<string, string>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))|(_[^_]+_)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) out.push(<code key={keyBase + i} className="mono" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 2, padding: '1px 4px', fontSize: 11.5, color: 'var(--teal)' }}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) out.push(<strong key={keyBase + i} style={{ color: 'var(--text)' }}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('[[')) {
      const raw = tok.slice(2, -2);
      const label = raw.split('|')[1]?.trim() || raw.split('#')[0].split('|')[0].trim();
      const id = idx.get(linkKey(raw));
      if (id && ctx.onOpenNote) {
        out.push(<a key={keyBase + i} className="wikilink" onClick={(e) => { e.preventDefault(); ctx.onOpenNote!(id); }} href="#" role="link">{label}</a>);
      } else if (id) {
        out.push(<span key={keyBase + i} className="wikilink">{label}</span>);
      } else {
        out.push(<span key={keyBase + i} className="wikilink dead" title="Dead link — no note with this title">{label}</span>);
      }
    }
    else if (tok.startsWith('_')) out.push(<em key={keyBase + i} style={{ color: 'var(--muted)' }}>{tok.slice(1, -1)}</em>);
    else { const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/); out.push(<span key={keyBase + i} style={{ color: 'var(--blue)' }}>{mm?.[1]}</span>); }
    last = m.index + tok.length; i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ body, notes, onOpenNote }: { body: string } & MdCtx) {
  const ctx: MdCtx = { notes, onOpenNote };
  const idx = titleIndex(notes);
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={key++} className="mono" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, padding: 12, fontSize: 11, overflow: 'auto', margin: '10px 0' }}>{buf.join('\n')}</pre>);
      continue;
    }
    // blockquote callout (consumes consecutive > lines)
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push(
        <blockquote key={key++} style={{ margin: '10px 0', padding: '8px 12px', borderLeft: '3px solid var(--teal)', background: 'var(--panel-2)', borderRadius: 3, fontSize: 12.5, color: 'var(--muted)' }}>
          {buf.map((b, bi) => <div key={bi}>{inline(b, `bq${key}${bi}`, ctx, idx)}</div>)}
        </blockquote>
      );
      continue;
    }
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const head = line.split('|').map((s) => s.trim()).filter(Boolean);
      i += 2; const body2: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) { body2.push(lines[i].split('|').map((s) => s.trim()).filter(Boolean)); i++; }
      blocks.push(
        <table key={key++} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, margin: '10px 0' }}>
          <thead><tr>{head.map((h, hi) => <th key={hi} style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 600 }}>{inline(h, `th${key}${hi}`, ctx, idx)}</th>)}</tr></thead>
          <tbody>{body2.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="mono" style={{ padding: '5px 8px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>{inline(c, `td${key}${ri}${ci}`, ctx, idx)}</td>)}</tr>)}</tbody>
        </table>
      );
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      const lvl = line.match(/^#+/)![0].length;
      const txt = line.replace(/^#+\s/, '');
      const size = [0, 20, 16, 13.5, 12][lvl];
      blocks.push(<div key={key++} style={{ fontSize: size, fontWeight: 650, marginTop: lvl <= 2 ? 16 : 12, marginBottom: 6, color: lvl === 1 ? 'var(--teal)' : 'var(--text)' }}>{inline(txt, 'h' + key, ctx, idx)}</div>);
      i++; continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s/, '')); i++; }
      blocks.push(<ul key={key++} style={{ margin: '6px 0', paddingLeft: 18 }}>{items.map((it, ii) => <li key={ii} style={{ fontSize: 12.5, marginBottom: 3, color: 'var(--muted)' }}>{inline(it, `li${key}${ii}`, ctx, idx)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === '---') { blocks.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    blocks.push(<p key={key++} style={{ fontSize: 12.5, margin: '6px 0', color: 'var(--muted)', lineHeight: 1.55 }}>{inline(line, 'p' + key, ctx, idx)}</p>);
    i++;
  }
  return <div>{blocks}</div>;
}

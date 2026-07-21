import type { ReactNode } from 'react';

// Lightweight, dependency-free markdown renderer — enough for the vault notes.
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // order: code, bold, wikilink, link, italic
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) out.push(<code key={keyBase + i} className="mono" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 2, padding: '1px 4px', fontSize: 11.5, color: 'var(--teal)' }}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) out.push(<strong key={keyBase + i} style={{ color: 'var(--text)' }}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('[[')) out.push(<span key={keyBase + i} style={{ color: 'var(--violet)' }}>[[{tok.slice(2, -2)}]]</span>);
    else { const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/); out.push(<span key={keyBase + i} style={{ color: 'var(--blue)' }}>{mm?.[1]}</span>); }
    last = m.index + tok.length; i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ body }: { body: string }) {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    if (line.startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={key++} className="mono" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, padding: 12, fontSize: 11, overflow: 'auto', margin: '10px 0' }}>{buf.join('\n')}</pre>);
      continue;
    }
    // table
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const head = line.split('|').map((s) => s.trim()).filter(Boolean);
      i += 2; const body2: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) { body2.push(lines[i].split('|').map((s) => s.trim()).filter(Boolean)); i++; }
      blocks.push(
        <table key={key++} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, margin: '10px 0' }}>
          <thead><tr>{head.map((h, hi) => <th key={hi} style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 600 }}>{inline(h, `th${key}${hi}`)}</th>)}</tr></thead>
          <tbody>{body2.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="mono" style={{ padding: '5px 8px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>{inline(c, `td${key}${ri}${ci}`)}</td>)}</tr>)}</tbody>
        </table>
      );
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      const lvl = line.match(/^#+/)![0].length;
      const txt = line.replace(/^#+\s/, '');
      const size = [0, 20, 16, 13.5, 12][lvl];
      blocks.push(<div key={key++} style={{ fontSize: size, fontWeight: 650, marginTop: lvl <= 2 ? 16 : 12, marginBottom: 6, color: lvl === 1 ? 'var(--teal)' : 'var(--text)' }}>{inline(txt, 'h' + key)}</div>);
      i++; continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s/, '')); i++; }
      blocks.push(<ul key={key++} style={{ margin: '6px 0', paddingLeft: 18 }}>{items.map((it, ii) => <li key={ii} style={{ fontSize: 12.5, marginBottom: 3, color: 'var(--muted)' }}>{inline(it, `li${key}${ii}`)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === '---') { blocks.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    blocks.push(<p key={key++} style={{ fontSize: 12.5, margin: '6px 0', color: 'var(--muted)', lineHeight: 1.55 }}>{inline(line, 'p' + key)}</p>);
    i++;
  }
  return <div>{blocks}</div>;
}

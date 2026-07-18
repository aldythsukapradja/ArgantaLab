// Tiny, dependency-free Markdown renderer for chat replies. Covers the subset
// the models actually emit — headings, **bold**, *italic*, `code`, fenced code
// blocks, bullet/numbered lists, blockquotes, links and paragraphs — with no
// external package (keeps the surface embeddable + CSP-clean). Not a full
// CommonMark engine; it deliberately handles the common cases well and degrades
// to plain text for anything exotic.
import { Fragment, type ReactNode } from 'react'

/** Inline pass: **bold**, *italic* / _italic_, `code`, and [text](url). */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  // Order matters: code first (so * inside `code` is literal), then links,
  // then bold, then italic. Single regex with alternation keeps one scan.
  const re = /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</Fragment>)
    const tok = m[0]
    if (tok.startsWith('`')) {
      out.push(<code key={`${keyBase}-c${i}`} className="md-code">{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!
      out.push(<a key={`${keyBase}-l${i}`} className="md-link" href={lm[2]} target="_blank" rel="noreferrer">{lm[1]}</a>)
    } else if (tok.startsWith('**')) {
      out.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>)
    } else {
      out.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
    i++
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last)}</Fragment>)
  return out
}

type Block =
  | { kind: 'code'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string }

/** Group raw lines into block-level structures. */
function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Fenced code block
    if (/^\s*```/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++ // closing fence
      blocks.push({ kind: 'code', text: buf.join('\n') })
      continue
    }
    // Blank line
    if (!line.trim()) { i++; continue }
    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) { blocks.push({ kind: 'heading', level: h[1].length, text: h[2] }); i++; continue }
    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++ }
      blocks.push({ kind: 'quote', lines: buf })
      continue
    }
    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++ }
      blocks.push({ kind: 'ul', items })
      continue
    }
    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
      blocks.push({ kind: 'ol', items })
      continue
    }
    // Paragraph — gather consecutive non-blank, non-structural lines
    const buf: string[] = []
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*```/.test(lines[i]) && !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])
    ) { buf.push(lines[i]); i++ }
    blocks.push({ kind: 'p', text: buf.join('\n') })
  }
  return blocks
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text || '')
  return (
    <div className={'md' + (className ? ' ' + className : '')}>
      {blocks.map((b, k) => {
        switch (b.kind) {
          case 'code':
            return <pre key={k} className="md-pre"><code>{b.text}</code></pre>
          case 'heading': {
            const Tag = (`h${Math.min(b.level + 2, 6)}`) as 'h3'
            return <Tag key={k} className={`md-h md-h${b.level}`}>{renderInline(b.text, `h${k}`)}</Tag>
          }
          case 'quote':
            return <blockquote key={k} className="md-quote">{renderInline(b.lines.join('\n'), `q${k}`)}</blockquote>
          case 'ul':
            return <ul key={k} className="md-ul">{b.items.map((it, j) => <li key={j}>{renderInline(it, `u${k}-${j}`)}</li>)}</ul>
          case 'ol':
            return <ol key={k} className="md-ol">{b.items.map((it, j) => <li key={j}>{renderInline(it, `o${k}-${j}`)}</li>)}</ol>
          case 'p':
            return <p key={k} className="md-p">{renderInline(b.text, `p${k}`)}</p>
        }
      })}
    </div>
  )
}

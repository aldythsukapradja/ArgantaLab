// HQ Vault — reading view. Renders the tokenized markdown to React with live
// wikilinks: resolved links navigate, broken links offer to create the note.

import { memo, useMemo } from 'react'
import { tokenizeBlocks, tokenizeInline, type Block, type Inline } from '../markdown'
import { resolveWikiLink } from '../markdown'
import { useVault, openByTarget } from '../store'

function InlineRun({ nodes }: { nodes: Inline[] }) {
  const notes = useVault(s => s.notes)
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case 'text': return <span key={i}>{n.text}</span>
          case 'br': return <br key={i} />
          case 'bold': return <strong key={i}><InlineRun nodes={n.children} /></strong>
          case 'italic': return <em key={i}><InlineRun nodes={n.children} /></em>
          case 'strike': return <del key={i}><InlineRun nodes={n.children} /></del>
          case 'code': return <code key={i} className="v-icode">{n.text}</code>
          case 'tag': return <span key={i} className="v-tag">#{n.tag}</span>
          case 'link':
            return <a key={i} className="v-extlink" href={n.href} target="_blank" rel="noreferrer">{n.text}</a>
          case 'wiki': {
            const resolved = resolveWikiLink(n.target, notes)
            const label = n.alias || n.target
            return (
              <button key={i}
                className={'v-wikilink' + (resolved ? '' : ' broken')}
                title={resolved ? 'Open ' + n.target : 'Not created yet — click to create "' + n.target + '"'}
                onClick={() => {
                  if (resolved) openByTarget(n.target)
                  else if (window.confirm(`"${n.target}" doesn't exist yet. Create it?`)) openByTarget(n.target, true)
                }}>
                {label}
              </button>
            )
          }
        }
      })}
    </>
  )
}

const Inl = ({ text }: { text: string }) => <InlineRun nodes={tokenizeInline(text)} />

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'h': {
      const Tag = (`h${Math.min(6, b.level)}`) as 'h1'
      return <Tag className={'v-h v-h' + b.level}><Inl text={b.text} /></Tag>
    }
    case 'p': return <p className="v-p"><Inl text={b.text} /></p>
    case 'hr': return <hr className="v-hr" />
    case 'quote':
      return <blockquote className="v-quote">{b.lines.map((l, i) => <p key={i}><Inl text={l} /></p>)}</blockquote>
    case 'callout': {
      const label = b.title || (b.variant.charAt(0).toUpperCase() + b.variant.slice(1))
      const body = b.lines.filter(l => l.trim())
      return (
        <div className={'v-callout v-callout-' + b.variant}>
          <div className="v-callout-h"><Inl text={label} /></div>
          {body.length > 0 && (
            <div className="v-callout-body">{body.map((l, i) => <p key={i}><Inl text={l} /></p>)}</div>
          )}
        </div>
      )
    }
    case 'code':
      return (
        <pre className="v-pre">
          {b.lang && <span className="v-pre-lang">{b.lang}</span>}
          <code>{b.code}</code>
        </pre>
      )
    case 'ul':
      return (
        <ul className="v-ul">
          {b.items.map((it, i) => (
            <li key={i} style={{ marginLeft: it.depth * 18 }} className={it.task ? 'v-task' : ''}>
              {it.task && (
                <span className={'v-check' + (it.task === 'done' ? ' done' : '')} aria-hidden>
                  {it.task === 'done' ? '✓' : ''}
                </span>
              )}
              <span className={it.task === 'done' ? 'v-done' : ''}><Inl text={it.text} /></span>
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="v-ol">
          {b.items.map((it, i) => <li key={i} style={{ marginLeft: it.depth * 18 }}><Inl text={it.text} /></li>)}
        </ol>
      )
    case 'table':
      return (
        <div className="v-tblwrap">
          <table className="v-tbl">
            <thead><tr>{b.header.map((h, i) => <th key={i}><Inl text={h} /></th>)}</tr></thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{b.header.map((_, j) => <td key={j}>{r[j] !== undefined ? <Inl text={r[j]} /> : null}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export const Preview = memo(function Preview({ body, title }: { body: string; title?: string }) {
  const blocks = useMemo(() => tokenizeBlocks(body), [body])
  const hasH1 = blocks[0]?.kind === 'h' && (blocks[0] as { level: number }).level === 1
  return (
    <div className="v-preview">
      {title && !hasH1 && <h1 className="v-h v-h1">{title}</h1>}
      {blocks.map((b, i) => <BlockView key={i} b={b} />)}
      {blocks.length === 0 && <p className="v-p v-dim">Nothing here yet — switch to edit mode and start writing.</p>}
    </div>
  )
})

/** Tiny renderer for canvas text cards / previews (inline markdown only). */
export function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((ln, i) => (
        <p key={i} className="v-p" style={{ margin: '0 0 4px' }}><Inl text={ln} /></p>
      ))}
    </>
  )
}

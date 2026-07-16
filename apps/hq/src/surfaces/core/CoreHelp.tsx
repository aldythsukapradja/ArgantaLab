// Arganta Core — live help / field guide. Renders the Obsidian-format Markdown
// files in ./docs/*.md (frontmatter + [[wikilinks]]) into a browsable panel.
// The docs are plain .md files: edit them and this updates (HMR in dev). Reuses
// the Vault's dependency-free markdown tokenizers so we don't reinvent parsing,
// but resolves wikilinks against THESE docs (navigating within the panel), not
// the Vault store — so it stays fully self-contained.
import { useMemo, useState } from 'react'
import { tokenizeBlocks, tokenizeInline, parseFrontmatter, type Block, type Inline } from '../../vault/markdown'
import './coreHelp.css'

// Vite: load every doc as a raw string at build time. Editing a .md file
// hot-reloads here — the "live documentation" contract.
const RAW = import.meta.glob('./docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

interface Doc { slug: string; title: string; updated: string | null; body: string; order: number }

// Reading order for the nav (anything not listed falls to the end, alphabetical).
const ORDER = ['Home', 'Capabilities', 'Suggested-Prompts', 'Agents-and-Offices', 'Memory-and-Vault', 'Models-and-Cost', 'Publishing', 'How-It-Works', 'Changelog']

const slugOf = (path: string) => path.split('/').pop()!.replace(/\.md$/, '')
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-')

const DOCS: Doc[] = Object.entries(RAW)
  .map(([path, raw]) => {
    const slug = slugOf(path)
    const { fm, body } = parseFrontmatter(raw)
    const title = (typeof fm.title === 'string' && fm.title) || slug.replace(/-/g, ' ')
    const updated = typeof (fm as any).updated === 'string' ? (fm as any).updated : null
    const idx = ORDER.indexOf(slug)
    return { slug, title, updated, body, order: idx < 0 ? ORDER.length : idx }
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

/** Resolve a wikilink target to a doc slug: match title or slug, case/space-insensitive. */
function resolveDoc(target: string): Doc | null {
  const t = norm(target)
  return DOCS.find(d => norm(d.title) === t || norm(d.slug) === t) || null
}

function InlineRun({ nodes, onNavigate }: { nodes: Inline[]; onNavigate: (slug: string) => void }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case 'text': return <span key={i}>{n.text}</span>
          case 'br': return <br key={i} />
          case 'bold': return <strong key={i}><InlineRun nodes={n.children} onNavigate={onNavigate} /></strong>
          case 'italic': return <em key={i}><InlineRun nodes={n.children} onNavigate={onNavigate} /></em>
          case 'strike': return <del key={i}><InlineRun nodes={n.children} onNavigate={onNavigate} /></del>
          case 'code': return <code key={i} className="cdoc-icode">{n.text}</code>
          case 'tag': return <span key={i} className="cdoc-tag">#{n.tag}</span>
          case 'link': return <a key={i} className="cdoc-extlink" href={n.href} target="_blank" rel="noreferrer">{n.text}</a>
          case 'wiki': {
            const doc = resolveDoc(n.target)
            const label = n.alias || n.target
            return (
              <button key={i}
                className={'cdoc-wikilink' + (doc ? '' : ' broken')}
                title={doc ? 'Open ' + doc.title : 'No page named "' + n.target + '" yet'}
                onClick={() => doc && onNavigate(doc.slug)}
                disabled={!doc}>
                {label}
              </button>
            )
          }
        }
      })}
    </>
  )
}

function BlockView({ b, onNavigate }: { b: Block; onNavigate: (slug: string) => void }) {
  const Inl = ({ text }: { text: string }) => <InlineRun nodes={tokenizeInline(text)} onNavigate={onNavigate} />
  switch (b.kind) {
    case 'h': {
      const Tag = (`h${Math.min(6, b.level)}`) as 'h1'
      return <Tag className={'cdoc-h cdoc-h' + b.level}><Inl text={b.text} /></Tag>
    }
    case 'p': return <p className="cdoc-p"><Inl text={b.text} /></p>
    case 'hr': return <hr className="cdoc-hr" />
    case 'quote':
      return <blockquote className="cdoc-quote">{b.lines.map((l, i) => <p key={i}><Inl text={l} /></p>)}</blockquote>
    case 'callout': {
      const label = b.title || (b.variant.charAt(0).toUpperCase() + b.variant.slice(1))
      const body = b.lines.filter(l => l.trim())
      return (
        <div className={'cdoc-callout cdoc-callout-' + b.variant}>
          <div className="cdoc-callout-h"><Inl text={label} /></div>
          {body.length > 0 && <div className="cdoc-callout-body">{body.map((l, i) => <p key={i}><Inl text={l} /></p>)}</div>}
        </div>
      )
    }
    case 'code':
      return <pre className="cdoc-pre">{b.lang && <span className="cdoc-pre-lang">{b.lang}</span>}<code>{b.code}</code></pre>
    case 'ul':
      return (
        <ul className="cdoc-ul">
          {b.items.map((it, i) => (
            <li key={i} style={{ marginLeft: it.depth * 18 }} className={it.task ? 'cdoc-task' : ''}>
              {it.task && <span className={'cdoc-check' + (it.task === 'done' ? ' done' : '')} aria-hidden>{it.task === 'done' ? '✓' : ''}</span>}
              <span className={it.task === 'done' ? 'cdoc-done' : ''}><Inl text={it.text} /></span>
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return <ol className="cdoc-ol">{b.items.map((it, i) => <li key={i} style={{ marginLeft: it.depth * 18 }}><Inl text={it.text} /></li>)}</ol>
    case 'table':
      return (
        <div className="cdoc-tblwrap">
          <table className="cdoc-tbl">
            <thead><tr>{b.header.map((h, i) => <th key={i}><Inl text={h} /></th>)}</tr></thead>
            <tbody>
              {b.rows.map((r, i) => <tr key={i}>{b.header.map((_, j) => <td key={j}>{r[j] !== undefined ? <Inl text={r[j]} /> : null}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )
  }
}

function DocView({ doc, onNavigate }: { doc: Doc; onNavigate: (slug: string) => void }) {
  const blocks = useMemo(() => tokenizeBlocks(doc.body), [doc.body])
  return <div className="cdoc-read">{blocks.map((b, i) => <BlockView key={i} b={b} onNavigate={onNavigate} />)}</div>
}

export function CoreHelp({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState<string>(DOCS[0]?.slug ?? 'Home')
  const doc = DOCS.find(d => d.slug === slug) ?? DOCS[0]

  return (
    <div className="cdoc-overlay" onClick={onClose}>
      <div className="cdoc-modal" onClick={e => e.stopPropagation()}>
        <aside className="cdoc-nav">
          <div className="cdoc-nav-head">
            <span className="cdoc-nav-title">Field Guide</span>
            <button className="cdoc-close" onClick={onClose} aria-label="Close help">
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M3 3 L12 12 M12 3 L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <nav className="cdoc-nav-list">
            {DOCS.map(d => (
              <button key={d.slug} className={'cdoc-nav-item' + (d.slug === slug ? ' active' : '')} onClick={() => setSlug(d.slug)}>
                {d.title}
              </button>
            ))}
          </nav>
        </aside>
        <main className="cdoc-main">
          {doc && <DocView doc={doc} onNavigate={setSlug} />}
          {doc?.updated && <div className="cdoc-updated mono">updated {doc.updated}</div>}
        </main>
      </div>
    </div>
  )
}

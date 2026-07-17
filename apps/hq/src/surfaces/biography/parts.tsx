/**
 * Shared primitives for Biography Studio.
 *
 * Editable — click-to-edit in place. contentEditable is used rather than an
 * input swap so the text never reflows or jumps between read and edit mode; the
 * DOM is the draft and the store only hears about it on commit (blur / Enter).
 * React must NOT re-render the node while it is focused or the caret jumps to
 * position 0 on every keystroke — hence the ref-seeded, uncontrolled body and
 * `key`-free updates.
 *
 * LogoChip — a real logo if the file is there, a brand-tinted monogram if not.
 * The founder has the real assets; dropping `noc.png` into public/biography/logos
 * upgrades every surface at once with no code change. The monogram is designed
 * to look intentional, not like a broken image.
 */
import { useEffect, useRef, useState } from 'react'

export function Editable({
  value, onCommit, className = '', placeholder = '', multiline = false, as: Tag = 'div',
}: {
  value: string
  onCommit: (v: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
  as?: any
}) {
  const ref = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState(false)

  // Seed the DOM from the store only while NOT editing — otherwise every commit
  // would rewrite the node under the caret.
  useEffect(() => {
    if (!editing && ref.current && ref.current.textContent !== value) ref.current.textContent = value
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const next = (ref.current?.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (next !== value) onCommit(next)
    if (ref.current && !next) ref.current.textContent = ''
  }

  return (
    <Tag
      ref={ref}
      className={`bio-ed ${className}${!value ? ' bio-ed-empty' : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-ph={placeholder}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); (e.target as HTMLElement).blur() }
        if (e.key === 'Escape') {
          if (ref.current) ref.current.textContent = value
          setEditing(false); (e.target as HTMLElement).blur()
        }
      }}
      onPaste={(e: React.ClipboardEvent) => {
        // Paste as plain text — pasted HTML would smuggle foreign styles into the page.
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
    />
  )
}

const monogram = (name: string) =>
  name.replace(/[^A-Za-z\s×]/g, ' ').split(/\s+/).filter(w => w && w !== '×' && !/^(the|a|an|of|and)$/i.test(w))
    .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·'

/**
 * Does this logo file actually exist?
 *
 * `onError` is not enough on its own: a dev server (and most static SPA hosts)
 * answer a missing /biography/logos/noc.png with index.html and a **200**, so
 * the <img> never errors — it just sits there broken forever. So probe the
 * content-type once per URL and only render an <img> for a real image.
 * Result is cached per session: the chip appears in dozens of places.
 */
const probes = new Map<string, Promise<boolean>>()
const probe = (url: string) => {
  let p = probes.get(url)
  if (!p) {
    p = fetch(url, { method: 'GET' })
      .then(r => r.ok && (r.headers.get('content-type') ?? '').startsWith('image/'))
      .catch(() => false)
    probes.set(url, p)
  }
  return p
}

export function LogoChip({ src, name, brand = '#0E4C92', size = 26, mono = false }: {
  src?: string; name: string; brand?: string; size?: number; mono?: boolean
}) {
  const [ok, setOk] = useState<boolean | null>(null)
  const px = { width: size, height: size }

  useEffect(() => {
    if (!src) return
    let live = true
    probe(src).then(v => { if (live) setOk(v) })
    return () => { live = false }
  }, [src])

  // Until the probe answers, show the monogram — never a broken image frame.
  if (!src || !ok) {
    return (
      <span
        className={'bio-chip' + (mono ? ' bio-chip-mono' : '')}
        style={{ ...px, '--chip': brand, fontSize: size * 0.36 } as React.CSSProperties}
        aria-label={name}
        title={name}
      >{monogram(name)}</span>
    )
  }
  return (
    <span className="bio-chip bio-chip-img" style={px} title={name}>
      <img src={src} alt="" onError={() => setOk(false)} loading="lazy" />
    </span>
  )
}

/** Hover-revealed row controls (add / delete / star). */
export function RowTools({ children }: { children: React.ReactNode }) {
  return <span className="bio-tools">{children}</span>
}

export function ToolBtn({ label, onClick, danger = false, on = false, children }: {
  label: string; onClick: () => void; danger?: boolean; on?: boolean; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={'bio-tool' + (danger ? ' bio-tool-danger' : '') + (on ? ' on' : '')}
      onClick={onClick} title={label} aria-label={label}
    >{children}</button>
  )
}

// C5-B4 · The preview pane — "the browser on the right".
//
// Two jobs the chat couldn't do before:
//  1. An artifact (website/app/deck) opens BESIDE the conversation instead of
//     in a 220px-tall inline frame, with its code and version history.
//  2. A URL bar, so any deployed app/game/staging site can be previewed next to
//     the chat — the previewer the founder asked for.
//
// Honesty rule: an iframe cannot tell us cross-origin whether a site refused to
// frame us (X-Frame-Options/CSP). We never claim a site "failed" — we say we
// can't tell what rendered, and always offer "Open in new tab", which works
// regardless.
import { useEffect, useRef, useState } from 'react'
import { listVersions, getArtifact, type StoredVersion } from '../../builder-core/persist'
import { subscribePreview, normalizeUrl, type PreviewTarget } from './previewBus'

type Tab = 'preview' | 'code' | 'versions'

export function PreviewPane({ target, onTarget, onClose }: {
  target: PreviewTarget
  onTarget: (t: PreviewTarget) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('preview')
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const isUrl = target.kind === 'url'

  useEffect(() => {
    setTab('preview')
    setUrlDraft(target.kind === 'url' ? target.url : '')
  }, [target])

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const url = normalizeUrl(urlDraft)
    if (!url) { setUrlError('That doesn’t look like a web address.'); return }
    setUrlError(null)
    onTarget({ kind: 'url', title: new URL(url).host, url })
  }

  const openExternally = () => {
    if (target.kind === 'url') { window.open(target.url, '_blank', 'noopener'); return }
    // A generated artifact has no URL until it's published — open its HTML as a
    // blob so "open in a real tab" works for unpublished drafts too.
    const blob = new Blob([target.html], { type: 'text/html' })
    const href = URL.createObjectURL(blob)
    window.open(href, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(href), 30_000)
  }

  return (
    <aside className="core-preview" aria-label="Preview pane">
      <div className="core-preview-bar">
        <div className="core-preview-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'preview'} className={'core-preview-tab' + (tab === 'preview' ? ' is-on' : '')} onClick={() => setTab('preview')}>Preview</button>
          {!isUrl && <button role="tab" aria-selected={tab === 'code'} className={'core-preview-tab' + (tab === 'code' ? ' is-on' : '')} onClick={() => setTab('code')}>Code</button>}
          {!isUrl && target.artifactId && <button role="tab" aria-selected={tab === 'versions'} className={'core-preview-tab' + (tab === 'versions' ? ' is-on' : '')} onClick={() => setTab('versions')}>Versions</button>}
        </div>
        <div className="core-preview-acts">
          <button className="core-preview-icon" onClick={openExternally} title="Open in a new tab" aria-label="Open in a new tab">↗</button>
          <button className="core-preview-icon" onClick={onClose} title="Close preview" aria-label="Close preview">✕</button>
        </div>
      </div>

      <form className="core-preview-urlbar" onSubmit={go}>
        <input
          className="core-preview-url mono" value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
          placeholder="Preview any URL — localhost:5185, arganta.app…" aria-label="URL to preview" spellCheck={false}
        />
        <button className="core-preview-go" type="submit">Go</button>
      </form>
      {urlError && <div className="core-preview-urlerr">{urlError}</div>}

      <div className="core-preview-body">
        {tab === 'preview' && <PreviewFrame target={target} />}
        {tab === 'code' && !isUrl && <CodeView html={(target as any).html} />}
        {tab === 'versions' && !isUrl && target.artifactId && <VersionsView artifactId={target.artifactId} onRestorePreview={(html, v) => onTarget({ kind: 'artifact', title: `${target.title} · v${v}`, html, artifactId: target.artifactId })} />}
      </div>
      <div className="core-preview-foot mono">{isUrl ? (target as any).url : target.title}</div>
    </aside>
  )
}

function PreviewFrame({ target }: { target: PreviewTarget }) {
  const [slow, setSlow] = useState(false)
  const loadedRef = useRef(false)

  // We can't read a cross-origin frame's result. If nothing has loaded after a
  // few seconds, say honestly that we can't tell — never assert "blocked".
  useEffect(() => {
    loadedRef.current = false
    setSlow(false)
    if (target.kind !== 'url') return
    const id = setTimeout(() => { if (!loadedRef.current) setSlow(true) }, 4000)
    return () => clearTimeout(id)
  }, [target])

  if (target.kind === 'artifact') {
    // Our own generated HTML: same sandbox the inline card already uses.
    return <iframe className="core-preview-frame" srcDoc={target.html} sandbox="allow-scripts allow-same-origin" title={`${target.title} preview`} />
  }
  return (
    <>
      <iframe
        className="core-preview-frame" src={target.url} title={`${target.title} preview`}
        onLoad={() => { loadedRef.current = true; setSlow(false) }}
        // Third-party content: no allow-same-origin, so it can never touch HQ's
        // storage/session. Scripts + forms stay on so real apps and games run.
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
        referrerPolicy="no-referrer"
      />
      {slow && (
        <div className="core-preview-hint">
          Nothing has rendered yet. Some sites refuse to load inside another page — I can’t tell from here whether that’s what happened. <b>↗ Open in a new tab</b> always works.
        </div>
      )}
    </>
  )
}

function CodeView({ html }: { html: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked — button just won't confirm */ }
  }
  return (
    <div className="core-preview-code">
      <button className="core-preview-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      <pre className="mono">{html}</pre>
    </div>
  )
}

function VersionsView({ artifactId, onRestorePreview }: { artifactId: string; onRestorePreview: (html: string, v: number) => void }) {
  const [rows, setRows] = useState<StoredVersion[] | null>(null)
  const [current, setCurrent] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([listVersions(artifactId), getArtifact(artifactId)]).then(([vs, a]) => {
      if (!live) return
      setRows(vs)
      setCurrent(a?.currentVersion ?? null)
    })
    return () => { live = false }
  }, [artifactId])

  if (!rows) return <div className="core-preview-empty">Loading history…</div>
  if (!rows.length) return <div className="core-preview-empty">No saved versions — this artifact isn’t persisted (Supabase offline, or it was never saved).</div>
  return (
    <div className="core-preview-versions">
      {rows.map(v => (
        <div key={v.id} className={'core-version-row' + (v.versionNumber === current ? ' is-current' : '')}>
          <div className="core-version-main">
            <b>v{v.versionNumber}{v.versionNumber === current ? ' · current' : ''}</b>
            <span className="core-version-note">{v.instruction || 'initial generation'}</span>
          </div>
          <div className="core-version-meta mono">
            {v.model || v.provider || 'deterministic'}{v.costUsd > 0 ? ` · $${v.costUsd.toFixed(4)}` : ''} · {new Date(v.createdAt).toLocaleDateString()}
          </div>
          {/* Preview-only: this shows the old version in the pane, it does NOT
              restore it. Restoring is a real mutation with its own tool
              (restore_version) and shouldn't happen from a history browser. */}
          <button className="core-version-view" onClick={() => onRestorePreview(v.html, v.versionNumber)}>View</button>
        </div>
      ))}
    </div>
  )
}

/** Owns the pane's target + subscription, so each mount mode adds one element. */
export function usePreviewTarget() {
  const [target, setTarget] = useState<PreviewTarget | null>(null)
  useEffect(() => subscribePreview(setTarget), [])
  return { target, setTarget, close: () => setTarget(null) }
}

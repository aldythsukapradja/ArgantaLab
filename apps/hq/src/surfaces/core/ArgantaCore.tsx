// C4b · Arganta Core — the chat surface. Implements the ARGANTA_CORE_PROP_KEYS
// contract from @arganta/agent/embed.js so this component can later mount
// standalone (panel/embed) exactly as it mounts here (inline, as an HQ
// surface). Design frozen at docs/arganta-core/C4a-Design-Language.md.
import { useEffect, useState } from 'react'
import { MOUNT_MODES, resolveMountMode, Z_LAYERS } from '@arganta/agent'

type MountMode = 'fullscreen' | 'panel' | 'inline'
import { ThreadsRail } from './ThreadsRail'
import { Conversation } from './Conversation'
import { CortexPanel } from './CortexPanel'
import { CoreHelp } from './CoreHelp'
import { StartersButton } from './StarterMenu'
import { PreviewPane, usePreviewTarget } from './PreviewPane'
import { openPreview, type PreviewTarget } from './previewBus'
import './core.css'

/** C5-B4 — opens the pane with nothing loaded yet, so the URL bar is reachable
 * without an artifact to click first (the "just show me localhost:5185" case). */
function PreviewButton() {
  return (
    <button
      className="core-preview-open"
      onClick={() => openPreview({ kind: 'url', title: 'Preview', url: 'about:blank' })}
      aria-label="Open preview pane" title="Preview pane — view any app, game or site beside the chat"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.5 5.6 H14.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span>Preview</span>
    </button>
  )
}

/** The "?" affordance that opens the live Field Guide. Same look everywhere. */
function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="core-help-btn" onClick={onClick} aria-label="Open Arganta Core field guide" title="Field guide — what Core can do">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="6.25" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.7 5.5a1.8 1.8 0 0 1 3.4.8c0 1.2-1.6 1.4-1.6 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7.5" cy="11" r=".8" fill="currentColor" />
      </svg>
    </button>
  )
}

export interface ArgantaCoreProps {
  threadId?: string
  mountMode?: MountMode
  embed?: boolean
  maxCostClass?: number
  apiBase?: string
  onArtifact?: (a: { assetId: string; kind: string }) => void
  onClose?: () => void
}

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return w
}

export function ArgantaCore({ threadId: initialThreadId, mountMode, embed = false, maxCostClass = 1, onArtifact, onClose }: ArgantaCoreProps) {
  const viewportWidth = useViewportWidth()
  const effectiveMode = resolveMountMode({ viewportWidth, requested: mountMode })
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null)
  const [cortexOpen, setCortexOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const [threadsRefresh, setThreadsRefresh] = useState(0)
  const [hasThreads, setHasThreads] = useState(false)
  // C5-B7 — starter pills live in the topbar (all mount modes) but the draft
  // lives in Conversation, so the pick travels down as a nonce-carrying seed.
  const [seed, setSeed] = useState<{ text: string; n: number } | undefined>(undefined)
  const pickStarter = (text: string) => setSeed(s => ({ text, n: (s?.n ?? 0) + 1 }))
  const { target: previewTarget, setTarget: setPreviewTarget, close: closePreview } = usePreviewTarget()
  const bumpThreadsRefresh = () => setThreadsRefresh(n => n + 1)
  const selectThread = (id: string) => { setThreadId(id); bumpThreadsRefresh() }
  // New session = reset to the fresh empty state; the first message persists a
  // real thread (same as ChatGPT's "new chat"). No blank row is pre-created.
  const newThread = () => { setThreadId(null); bumpThreadsRefresh() }

  if (effectiveMode === MOUNT_MODES.FULLSCREEN) {
    return (
      <FullscreenCore
        threadId={threadId} onSelectThread={selectThread} onNewThread={newThread} embed={embed}
        maxCostClass={maxCostClass} onArtifact={onArtifact} onClose={onClose}
        threadsRefresh={threadsRefresh} bumpThreadsRefresh={bumpThreadsRefresh}
        hasThreads={hasThreads} onThreadsLoaded={(n) => setHasThreads(n > 0)}
        seed={seed} onPickStarter={pickStarter}
        previewTarget={previewTarget} setPreviewTarget={setPreviewTarget} closePreview={closePreview}
      />
    )
  }

  if (effectiveMode === MOUNT_MODES.PANEL) {
    return (
      <div className="core-panel-overlay" onClick={onClose}>
        <div className="core core-panel" onClick={e => e.stopPropagation()}>
          <div className="core-panel-topbar">
            <span className="core-panel-title">Arganta Core</span>
            <div className="core-topbar-actions">
              <PreviewButton />
              <StartersButton onPick={pickStarter} />
              <button className="core-fs-new" onClick={newThread} aria-label="New thread" title="New thread">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M11.5 2.6 L15.4 6.5 L7 14.9 L3 15.9 L4 11.9 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M10.6 3.5 L14.5 7.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
              <HelpButton onClick={() => setHelpOpen(true)} />
              <button className="core-panel-close" onClick={onClose} aria-label="Close Arganta Core">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 3 L12 12 M12 3 L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
          <Conversation threadId={threadId} onThreadCreated={selectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} compact hasThreads={hasThreads} seed={seed} />
          {/* Panel/fullscreen have no room for a side column, so the pane covers
              the mount instead. Same component, same behaviour — only placement
              changes, which is the responsive rule the rest of Core follows. */}
          {previewTarget && (
            <div className="core-preview-cover">
              <PreviewPane target={previewTarget} onTarget={setPreviewTarget} onClose={closePreview} />
            </div>
          )}
          {helpOpen && <CoreHelp onClose={() => setHelpOpen(false)} />}
        </div>
      </div>
    )
  }

  // inline — the HQ surface. Panes: rail | conversation | (preview) | cortex.
  // The preview pane REPLACES the cortex column while open rather than adding a
  // fourth: at this width a 4-column chat is unreadable, and when you're looking
  // at an artifact the conversation is what you want beside it, not telemetry.
  return (
    <div className="core core-inline" data-preview={previewTarget ? 'on' : undefined}>
      <ThreadsRail
        activeThreadId={threadId} onSelectThread={selectThread}
        open={railOpen} onToggle={() => setRailOpen(o => !o)}
        refreshKey={threadsRefresh} onThreadsLoaded={(n) => setHasThreads(n > 0)}
      />
      <div className="core-center">
        <div className="core-center-actions">
          <PreviewButton />
          <StartersButton onPick={pickStarter} />
          <HelpButton onClick={() => setHelpOpen(true)} />
        </div>
        <Conversation threadId={threadId} onThreadCreated={selectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} hasThreads={hasThreads} seed={seed} />
      </div>
      {previewTarget
        ? <PreviewPane target={previewTarget} onTarget={setPreviewTarget} onClose={closePreview} />
        : <CortexPanel open={cortexOpen} onToggle={() => setCortexOpen(o => !o)} />}
      {helpOpen && <CoreHelp onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function FullscreenCore({ threadId, onSelectThread, onNewThread, embed, maxCostClass, onArtifact, onClose, threadsRefresh, bumpThreadsRefresh, hasThreads, onThreadsLoaded, seed, onPickStarter, previewTarget, setPreviewTarget, closePreview }: {
  threadId: string | null
  onSelectThread: (id: string) => void
  onNewThread: () => void
  embed: boolean
  maxCostClass: number
  onArtifact?: (a: { assetId: string; kind: string }) => void
  onClose?: () => void
  threadsRefresh: number
  bumpThreadsRefresh: () => void
  hasThreads: boolean
  onThreadsLoaded: (count: number) => void
  seed?: { text: string; n: number }
  onPickStarter: (text: string) => void
  previewTarget: PreviewTarget | null
  setPreviewTarget: (t: PreviewTarget) => void
  closePreview: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div className="core core-fullscreen" data-embed={embed || undefined} style={{ zIndex: Z_LAYERS.CORE_FULLSCREEN }}>
      <div className="core-fs-topbar">
        <button className="core-fs-title" onClick={() => setSheetOpen(true)} aria-label="Arganta Core — open threads">
          Arganta Core
          <svg className="core-fs-title-caret" width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden><path d="M3 4.5 L5.5 7 L8 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="core-fs-actions">
          <PreviewButton />
          <StartersButton onPick={onPickStarter} />
          <button className="core-fs-new" onClick={onNewThread} aria-label="New thread" title="New thread">
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M11.5 2.6 L15.4 6.5 L7 14.9 L3 15.9 L4 11.9 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M10.6 3.5 L14.5 7.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
          <HelpButton onClick={() => setHelpOpen(true)} />
          <button className="core-fs-close" onClick={onClose} aria-label="Close and go back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      {helpOpen && <CoreHelp onClose={() => setHelpOpen(false)} />}
      <Conversation threadId={threadId} onThreadCreated={(id) => { onSelectThread(id); bumpThreadsRefresh() }} maxCostClass={maxCostClass} onArtifact={onArtifact} compact hasThreads={hasThreads} seed={seed} />
      {previewTarget && (
        <div className="core-preview-cover">
          <PreviewPane target={previewTarget} onTarget={setPreviewTarget} onClose={closePreview} />
        </div>
      )}
      {sheetOpen && (
        <div className="core-fs-sheet-overlay" style={{ zIndex: Z_LAYERS.CORE_FULLSCREEN + 1 }} onClick={() => setSheetOpen(false)}>
          <div className="core-fs-sheet" onClick={e => e.stopPropagation()}>
            <ThreadsRail
              activeThreadId={threadId}
              onSelectThread={(id) => { onSelectThread(id); setSheetOpen(false) }}
              open onToggle={() => setSheetOpen(false)} sheet
              refreshKey={threadsRefresh} onThreadsLoaded={onThreadsLoaded}
            />
          </div>
        </div>
      )}
    </div>
  )
}

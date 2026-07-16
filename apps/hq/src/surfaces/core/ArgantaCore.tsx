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
import './core.css'

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
  const bumpThreadsRefresh = () => setThreadsRefresh(n => n + 1)
  const selectThread = (id: string) => { setThreadId(id); bumpThreadsRefresh() }

  if (effectiveMode === MOUNT_MODES.FULLSCREEN) {
    return (
      <FullscreenCore
        threadId={threadId} onSelectThread={selectThread} embed={embed}
        maxCostClass={maxCostClass} onArtifact={onArtifact} onClose={onClose}
        threadsRefresh={threadsRefresh} bumpThreadsRefresh={bumpThreadsRefresh}
        hasThreads={hasThreads} onThreadsLoaded={(n) => setHasThreads(n > 0)}
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
              <HelpButton onClick={() => setHelpOpen(true)} />
              <button className="core-panel-close" onClick={onClose} aria-label="Close Arganta Core">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 3 L12 12 M12 3 L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
          <Conversation threadId={threadId} onThreadCreated={selectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} compact hasThreads={hasThreads} />
          {helpOpen && <CoreHelp onClose={() => setHelpOpen(false)} />}
        </div>
      </div>
    )
  }

  // inline — the HQ surface, three panes.
  return (
    <div className="core core-inline">
      <ThreadsRail
        activeThreadId={threadId} onSelectThread={selectThread}
        open={railOpen} onToggle={() => setRailOpen(o => !o)}
        refreshKey={threadsRefresh} onThreadsLoaded={(n) => setHasThreads(n > 0)}
      />
      <div className="core-center">
        <div className="core-center-actions"><HelpButton onClick={() => setHelpOpen(true)} /></div>
        <Conversation threadId={threadId} onThreadCreated={selectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} hasThreads={hasThreads} />
      </div>
      <CortexPanel open={cortexOpen} onToggle={() => setCortexOpen(o => !o)} />
      {helpOpen && <CoreHelp onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function FullscreenCore({ threadId, onSelectThread, embed, maxCostClass, onArtifact, onClose, threadsRefresh, bumpThreadsRefresh, hasThreads, onThreadsLoaded }: {
  threadId: string | null
  onSelectThread: (id: string) => void
  embed: boolean
  maxCostClass: number
  onArtifact?: (a: { assetId: string; kind: string }) => void
  onClose?: () => void
  threadsRefresh: number
  bumpThreadsRefresh: () => void
  hasThreads: boolean
  onThreadsLoaded: (count: number) => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div className="core core-fullscreen" data-embed={embed || undefined} style={{ zIndex: Z_LAYERS.CORE_FULLSCREEN }}>
      <div className="core-fs-topbar">
        <button className="core-fs-title" onClick={() => setSheetOpen(true)}>Arganta Core</button>
        <div className="core-fs-actions">
          <HelpButton onClick={() => setHelpOpen(true)} />
          <button className="core-fs-close" onClick={onClose} aria-label="Close and go back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      {helpOpen && <CoreHelp onClose={() => setHelpOpen(false)} />}
      <Conversation threadId={threadId} onThreadCreated={(id) => { onSelectThread(id); bumpThreadsRefresh() }} maxCostClass={maxCostClass} onArtifact={onArtifact} compact hasThreads={hasThreads} />
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

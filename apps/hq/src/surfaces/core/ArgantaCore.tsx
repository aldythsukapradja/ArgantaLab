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
import './core.css'

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
      <div className="core core-panel">
        <Conversation threadId={threadId} onThreadCreated={selectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} compact hasThreads={hasThreads} />
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
        <Conversation threadId={threadId} onThreadCreated={selectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} hasThreads={hasThreads} />
      </div>
      <CortexPanel open={cortexOpen} onToggle={() => setCortexOpen(o => !o)} />
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
  return (
    <div className="core core-fullscreen" data-embed={embed || undefined} style={{ zIndex: Z_LAYERS.CORE_FULLSCREEN }}>
      <div className="core-fs-topbar">
        <button className="core-fs-back" onClick={onClose} aria-label="Close Arganta Core">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 3 L5 9 L11 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="core-fs-title" onClick={() => setSheetOpen(true)}>Arganta Core</button>
        <button className="core-fs-menu" aria-label="Thread menu">⋯</button>
      </div>
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

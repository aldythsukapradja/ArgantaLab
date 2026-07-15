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

  if (effectiveMode === MOUNT_MODES.FULLSCREEN) {
    return (
      <FullscreenCore
        threadId={threadId} onSelectThread={setThreadId} embed={embed}
        maxCostClass={maxCostClass} onArtifact={onArtifact} onClose={onClose}
      />
    )
  }

  if (effectiveMode === MOUNT_MODES.PANEL) {
    return (
      <div className="core core-panel">
        <Conversation threadId={threadId} onThreadCreated={setThreadId} maxCostClass={maxCostClass} onArtifact={onArtifact} compact />
      </div>
    )
  }

  // inline — the HQ surface, three panes.
  return (
    <div className="core core-inline">
      <ThreadsRail
        activeThreadId={threadId} onSelectThread={setThreadId}
        open={railOpen} onToggle={() => setRailOpen(o => !o)}
      />
      <div className="core-center">
        <Conversation threadId={threadId} onThreadCreated={setThreadId} maxCostClass={maxCostClass} onArtifact={onArtifact} />
      </div>
      <CortexPanel open={cortexOpen} onToggle={() => setCortexOpen(o => !o)} />
    </div>
  )
}

function FullscreenCore({ threadId, onSelectThread, embed, maxCostClass, onArtifact, onClose }: {
  threadId: string | null
  onSelectThread: (id: string) => void
  embed: boolean
  maxCostClass: number
  onArtifact?: (a: { assetId: string; kind: string }) => void
  onClose?: () => void
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
      <Conversation threadId={threadId} onThreadCreated={onSelectThread} maxCostClass={maxCostClass} onArtifact={onArtifact} compact />
      {sheetOpen && (
        <div className="core-fs-sheet-overlay" style={{ zIndex: Z_LAYERS.CORE_FULLSCREEN + 1 }} onClick={() => setSheetOpen(false)}>
          <div className="core-fs-sheet" onClick={e => e.stopPropagation()}>
            <ThreadsRail
              activeThreadId={threadId}
              onSelectThread={(id) => { onSelectThread(id); setSheetOpen(false) }}
              open onToggle={() => setSheetOpen(false)} sheet
            />
          </div>
        </div>
      )}
    </div>
  )
}

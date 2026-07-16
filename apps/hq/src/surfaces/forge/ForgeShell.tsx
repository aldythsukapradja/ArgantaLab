// GB-3 · The Forge — one shell, two builders (App + Game), single fixed page.
//
// Replaces the legacy Catalogue/Studio/Analytics wizard as the default builder
// experience; that wizard is untouched behind the Legacy tab. `surface` is the
// only difference between the App Forge and the Game Forge — every pane is
// shared and reads its specifics from forgeConfig.ts.
import { lazy, Suspense, useState } from 'react'
import { PanelLeft, PanelRight, Sparkles, RefreshCw } from 'lucide-react'
import { useHQ } from '../../shell/store'
import { useBuilderData } from '../builders/useBuilderData'
import { forgeConfig, GENRE_LABEL, KIND_LABEL, type ForgeSurface, type ForgeConfig } from './forgeConfig'
import { useForge, type ForgeState } from './useForge'
import type { ForgeTab } from '../../shell/store'
import { ChatRail } from './ChatRail'
import { ForgeCanvas, type DeviceMode } from './ForgeCanvas'
import { Inspector } from './Inspector'
import { StarterGallery } from './StarterGallery'
import type { ArtifactKind } from '../../builder-core/generate'
import './forge.css'

// The legacy wizard loads only if the founder actually opens the Legacy tab —
// it drags in the whole Catalogue/Studio/Analytics tree.
const LegacyBuilder = lazy(() => import('../builders/BuilderShell').then((m) => ({ default: m.BuilderShell })))

export function ForgeShell({ surface }: { surface: ForgeSurface }) {
  const cfg = forgeConfig(surface)
  const { forgeTab, setForgeTab, forgeArtifactId, setForgeArtifact } = useHQ()
  const [kind, setKind] = useState<ArtifactKind>(cfg.defaultKind)
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [landscape, setLandscape] = useState(false)
  const [nonce, setNonce] = useState(0)
  // Below the CSS breakpoints these panes become absolute OVERLAYS (forge.css),
  // so defaulting both open on a narrow screen would bury the canvas under them.
  // Chat wins the small screen — this is a chat-driven builder — and the header
  // toggles reveal the canvas and inspector on demand.
  const [railOpen, setRailOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > 1100)

  const data = useBuilderData(surface === 'game' ? 'game' : 'app')
  const forge = useForge(surface, cfg.defaultKind, forgeArtifactId)
  const { state, turns, busy, versions, send, build, setHtml, checkpoint, applyVersion, reset, refreshVersions } = forge

  const hasArtifact = !!state.html
  const reload = () => setNonce((n) => n + 1)

  const startOver = () => {
    if (hasArtifact && !confirm('Start over? The current artifact stays saved in your history, but the canvas clears.')) return
    setForgeArtifact(null)
    reset(kind)
  }

  const switchKind = (k: ArtifactKind) => {
    if (hasArtifact) {
      if (!confirm(`Switch to ${KIND_LABEL[k]}? This clears the canvas — your current work stays saved in history.`)) return
      setForgeArtifact(null)
      reset(k)
    }
    setKind(k)
  }

  if (forgeTab === 'legacy') {
    return (
      <div className="forge">
        <ForgeHeader
          surface={surface} cfg={cfg} kind={kind} state={state} forgeTab={forgeTab} setForgeTab={setForgeTab}
          onKind={switchKind} onStartOver={startOver} onTitle={() => {}} hasArtifact={false}
          railOpen={railOpen} setRailOpen={setRailOpen} inspectorOpen={inspectorOpen} setInspectorOpen={setInspectorOpen}
          legacy
        />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
          <Suspense fallback={<div className="auth-wrap" role="status" aria-label="Loading the legacy builder"><div className="spin" /></div>}>
            <LegacyBuilder kind={surface === 'game' ? 'game' : 'app'} />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="forge">
      <ForgeHeader
        surface={surface} cfg={cfg} kind={kind} state={state} forgeTab={forgeTab} setForgeTab={setForgeTab}
        onKind={switchKind} onStartOver={startOver} hasArtifact={hasArtifact}
        onTitle={(title) => forge.setState((s) => ({ ...s, title }))}
        railOpen={railOpen} setRailOpen={setRailOpen} inspectorOpen={inspectorOpen} setInspectorOpen={setInspectorOpen}
      />

      {!hasArtifact ? (
        <StarterGallery cfg={cfg} kind={kind} busy={busy} onBuild={build} />
      ) : (
        <div className={'forge-body' + (inspectorOpen ? '' : ' no-inspector')}>
          {railOpen && (
            <ChatRail
              turns={turns} busy={busy} hasArtifact={hasArtifact}
              placeholder={cfg.promptPlaceholder} onSend={(t) => send(t, { kind })}
            />
          )}
          <ForgeCanvas
            kind={state.kind} title={state.title} html={state.html}
            device={device} landscape={landscape} onDevice={setDevice} onLandscape={setLandscape}
            circle={null} user={data.user} nonce={nonce} onReload={reload}
          />
          {inspectorOpen && (
            <Inspector
              state={state} versions={versions} circles={data.circles}
              onHtml={setHtml} onApplyVersion={applyVersion}
              onCheckpoint={checkpoint} onRefreshVersions={refreshVersions}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── header ────────────────────────────────────────────────────────────────
interface HeaderProps {
  surface: ForgeSurface
  cfg: ForgeConfig
  kind: ArtifactKind
  state: ForgeState
  forgeTab: ForgeTab
  setForgeTab: (t: ForgeTab) => void
  onKind: (k: ArtifactKind) => void
  onStartOver: () => void
  onTitle: (title: string) => void
  hasArtifact: boolean
  railOpen: boolean
  setRailOpen: (v: boolean) => void
  inspectorOpen: boolean
  setInspectorOpen: (v: boolean) => void
  legacy?: boolean
}

function ForgeHeader({
  cfg, kind, state, forgeTab, setForgeTab, onKind, onStartOver, onTitle, hasArtifact,
  railOpen, setRailOpen, inspectorOpen, setInspectorOpen, legacy = false,
}: HeaderProps) {
  const stage0 = state.stage === 0
  const v = state.validation

  return (
    <div className="forge-head">
      <div className="forge-title">
        {!legacy && hasArtifact && (
          <button className="forge-btn" onClick={() => setRailOpen(!railOpen)} title={railOpen ? 'Hide the chat' : 'Show the chat'} style={{ padding: '5px 7px' }}>
            <PanelLeft size={13} />
          </button>
        )}
        {hasArtifact && !legacy ? (
          <>
            <input
              className="forge-name"
              value={state.title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder={`Name this ${cfg.noun.toLowerCase()}…`}
              aria-label={`${cfg.noun} name`}
              style={{ width: `${Math.min(34, Math.max(10, (state.title || '').length + 2))}ch` }}
            />
            <span className="forge-pill">{KIND_LABEL[state.kind]}</span>
            {state.genre && <span className="forge-pill">{GENRE_LABEL[state.genre] ?? state.genre}</span>}
            <span className="forge-pill on">v{state.version}</span>
            {stage0 && <span className="forge-pill warn" title="AI generation wasn't reachable — this is the deterministic engine's output">Template</span>}
            {v && (v.ok
              ? <span className="forge-pill ok" title="Passes every safety and structure check">Valid</span>
              : <span className="forge-pill bad" title={v.errors.map((e: any) => e.message).join('\n')}>{v.errors.length} issue{v.errors.length === 1 ? '' : 's'}</span>
            )}
            {!state.persisted && <span className="forge-pill warn" title="Supabase is unreachable — this artifact lives only in this tab">Unsaved</span>}
          </>
        ) : (
          <span className="row" style={{ gap: 7 }}>
            <Sparkles size={14} style={{ color: 'var(--acc)' }} />
            <b style={{ fontSize: 13.5 }}>{cfg.noun} Forge</b>
          </span>
        )}
      </div>

      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        {!legacy && cfg.modes.length > 1 && (
          <div className="forge-seg">
            {cfg.modes.map((m) => (
              <button key={m.kind} className={kind === m.kind ? 'on' : ''} onClick={() => onKind(m.kind)} title={m.hint}>
                <m.Icon size={12} /> {m.label}
              </button>
            ))}
          </div>
        )}
        {!legacy && hasArtifact && (
          <>
            <button className="forge-btn" onClick={onStartOver} title="Clear the canvas and start a new one">
              <RefreshCw size={12} /> New
            </button>
            <button className="forge-btn" onClick={() => setInspectorOpen(!inspectorOpen)} title={inspectorOpen ? 'Hide the inspector' : 'Show the inspector'} style={{ padding: '5px 7px' }}>
              <PanelRight size={13} />
            </button>
          </>
        )}
        <div className="forge-seg">
          <button className={forgeTab === 'forge' ? 'on' : ''} onClick={() => setForgeTab('forge')}>Forge</button>
          <button className={forgeTab === 'legacy' ? 'on' : ''} onClick={() => setForgeTab('legacy')} title="The original wizard — catalogue, studio and analytics">Legacy</button>
        </div>
      </div>
    </div>
  )
}

export function GameForge() { return <ForgeShell surface="game" /> }
export function AppForge() { return <ForgeShell surface="app" /> }

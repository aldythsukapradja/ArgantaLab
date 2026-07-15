// C4b Step 4 — CoreOrb, the conversation avatar. Wraps CoreSlot per C4a §2;
// does NOT invent a new avatar system.
//
// Constraint discovered building this: CoreSlot's 2D renderer (Core2D) draws
// the full reactor cockpit — THINK/KNOW/DO arcs, five orbiting product pods,
// a dark radial cockpit background — a scene built for the CEO Orb landing,
// not a 32px icon repeated next to every chat message at scroll-fps. Mounting
// it there would render illegible cockpit noise, not an avatar.
// Resolution: hero size (96px, one instance, empty-state only) mounts the
// REAL CoreSlot exactly as the spec asks — that's what Core2D was built for.
// Avatar size (32px, one per message) uses a small token-driven visual that
// speaks the same design language (the --stage gradient, the state ring
// colors below) without instantiating the cockpit scene — this is the "thin
// wrapper" staying honest about what CoreSlot can actually render that small.
import { useEffect, useMemo, useState } from 'react'
import { CoreSlot } from '../../reactor/CoreSlot'
import { IDLE_SCENE, type SceneState } from '../../reactor/contract'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'thinking-long' | 'tool-running' | 'speaking' | 'blocked' | 'error'
export type ToolCategory = 'media' | 'data' | 'office'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** C4a §2 mapping: orbState -> CoreSlot's SceneState.state, for the hero mount. */
const SCENE_STATE_FOR: Record<OrbState, SceneState['state']> = {
  idle: 'idle', listening: 'listening', thinking: 'think', 'thinking-long': 'think',
  'tool-running': 'do', speaking: 'jarvis-speaking', blocked: 'idle', error: 'idle',
}

export function CoreOrb({ state, size = 'avatar', toolCategory }: {
  state: OrbState
  size?: 'avatar' | 'hero'
  toolCategory?: ToolCategory
}) {
  const reducedMotion = useReducedMotion()

  if (size === 'hero') {
    const useR3F = !reducedMotion && typeof window !== 'undefined' && window.innerWidth > 640
    const scene: SceneState = useMemo(() => ({
      ...IDLE_SCENE, state: SCENE_STATE_FOR[state], reducedMotion,
      intensity: state === 'thinking' || state === 'thinking-long' ? 0.7 : state === 'speaking' ? 0.9 : 0.32,
    }), [state, reducedMotion])
    return (
      <div className="core-orb core-orb-hero">
        <CoreSlot renderer={useR3F ? 'r3f' : '2d'} state={scene} />
      </div>
    )
  }

  return (
    <div
      className={'core-orb core-orb-avatar' + (reducedMotion ? ' core-orb-static' : '')}
      data-orb-state={state}
      data-tool-category={state === 'tool-running' ? (toolCategory ?? 'media') : undefined}
      aria-hidden="true"
    >
      <span className="core-orb-ring" />
      {state === 'thinking-long' && <span className="core-orb-satellite" />}
    </div>
  )
}

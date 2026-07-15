// CoreSlot — WS2's reactor plugs in here. P0 ships the 'legacy' fallback: a light
// presentational placeholder that visibly reflects CoreState on the audio clock.
// When WS2 lands, set RENDERERS.core = 'ws2' and render its module in the branch below.
import type { CoreSlotProps, CoreState } from '../contract'
import { RENDERERS } from '../registry'
import { ReactorCoreSlot } from '../../reactor/CinemaReactor'

const LABEL: Record<CoreState, string> = {
  offline: 'OFFLINE', booting: 'IGNITION', idle: 'UNIFIED CORE', listening: 'LISTENING',
  'jarvis-speaking': 'JARVIS', 'specialist-speaking': 'SPECIALIST',
  think: 'THINK', know: 'KNOW', do: 'DO',
  'product-focus': 'PRODUCT FOCUS', 'popup-open': 'PRODUCT DETAIL',
  'vault-entry': 'VAULT ENTRY', 'architecture-unfold': 'ARCHITECTURE', return: 'RECOMBINING',
}
const TINT: Partial<Record<CoreState, string>> = {
  think: '#45e8ff', know: '#9d77ff', do: '#f6b94f',
  'vault-entry': '#8f7bff', 'architecture-unfold': '#8f7bff', booting: '#45e8ff',
}

function LegacyCore({ state, progress, reducedMotion }: CoreSlotProps) {
  const tint = TINT[state] ?? '#45e8ff'
  const triad = state === 'think' || state === 'know' || state === 'do'
  // audio-reactive shimmer on top of the always-on CSS breathing
  const pulse = reducedMotion ? 1 : 1 + Math.sin(progress * Math.PI * 2) * 0.03
  return (
    <div className={'cin-core' + (reducedMotion ? ' still' : '')} data-state={state} style={{ ['--tint' as string]: tint }}>
      <div className="cin-core-orb" style={{ transform: `scale(${pulse})` }}>
        <div className="cin-core-halo" />
        <div className={'cin-core-ring r1' + (reducedMotion ? ' still' : '')} />
        <div className={'cin-core-ring r2' + (reducedMotion ? ' still' : '')} />
        <div className={'cin-core-ring r3' + (reducedMotion ? ' still' : '')} />
        <div className="cin-core-nucleus">
          <span className="cin-core-glint" />
        </div>
        {triad && <div className="cin-core-triad" data-active={state} />}
      </div>
      <div className="cin-core-label">{LABEL[state]}</div>
      <div className="cin-core-fallback">renderer: legacy · swap to WS2 reactor</div>
    </div>
  )
}

export function CoreSlot(props: CoreSlotProps) {
  const renderer = props.renderer ?? RENDERERS.core
  if (renderer === 'ws2') {
    return <ReactorCoreSlot state={props.state} product={props.product} progress={props.progress}
      reducedMotion={props.reducedMotion} quality={props.quality}
      interactive={props.interactive} centered={props.centered} />
  }
  // if (renderer === 'media') return <HiggsfieldCore {...props} />
  return <LegacyCore {...props} />
}

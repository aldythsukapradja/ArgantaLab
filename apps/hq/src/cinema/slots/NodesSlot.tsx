// NodesSlot — WS3's 3D knowledge nodes plug in here. The 'placeholder' fallback
// is a simple spine of the Founder→…→Products path that lights up as the
// storyline traces it; RENDERERS.nodes = 'ws3' renders the real Cognitive Cortex.
import type { NodesSlotProps } from '../contract'
import { RENDERERS } from '../registry'
import { KnowledgeCinemaSlot } from '../../knowledge/CinemaBridge'

const SPINE = ['Founder', 'Jarvis', 'Command', 'Vault', 'Data', 'Architecture', 'Agents', 'Products']

function PlaceholderNodes({ state }: NodesSlotProps) {
  if (!state.visible) return null
  const litCount = state.path?.length ?? 0
  return (
    <div className="cin-nodes">
      <div className="cin-nodes-head">
        {state.tour ? `AUTO TOUR ${state.tour}` : 'ARCHITECTURE'}
        <span>2D placeholder · swap to WS3 3D nodes</span>
      </div>
      <div className="cin-nodes-spine">
        {SPINE.map((n, i) => (
          <div key={n} className="cin-node" data-lit={i < litCount || n === state.focusNode}>
            <i /><span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NodesSlot(props: NodesSlotProps) {
  const renderer = props.renderer ?? RENDERERS.nodes
  if (renderer === 'ws3') return <KnowledgeCinemaSlot {...props} />
  return <PlaceholderNodes {...props} />
}

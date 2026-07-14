// Pure mapping: a Scene + playback context → the semantic SceneState WS2/WS3 read.
// This is the storyline choreography from the WS1 spec, in one testable place.
import type { CoreState, NodesState, SceneState, Mode, StageDirection } from './contract'
import type { Scene } from './scenario'

// Founder → Jarvis → Command → Vault → Data → Architecture → Agents → Products
const CORE_PATH = ['Founder', 'Jarvis', 'Command', 'Vault', 'Data', 'Architecture', 'Agents', 'Products']

function coreFor(s: Scene): CoreState {
  switch (s.act) {
    case 1:
      if (s.id === '1.1') return 'booting'
      if (s.id === '1.2') return 'listening'
      return 'idle'
    case 2:
      return 'jarvis-speaking'
    case 3: {
      if (s.beat === 'intro' || s.beat === 'close') return 'product-focus'
      if (s.beat === 'overview' || s.beat === 'demo' || s.beat === 'summary') return 'popup-open'
      return 'product-focus'
    }
    case 4:
      if (s.id === '4.2') return 'think'
      if (s.id === '4.3') return 'know'
      if (s.id === '4.4') return 'do'
      return 'architecture-unfold' // 4.1 the unfold
    case 5:
      return 'vault-entry'
    case 6:
      return 'architecture-unfold'
    case 7:
      return s.id === '7.1' ? 'return' : 'idle'
  }
}

function nodesFor(s: Scene): NodesState {
  if (s.act === 5) {
    // reveal the spine progressively across 5.1–5.4
    const step = { '5.1': 3, '5.2': 5, '5.3': 8, '5.4': 8 }[s.id] ?? 0
    return { visible: true, path: CORE_PATH.slice(0, step), tour: 'A' }
  }
  if (s.act === 6) {
    return { visible: true, tour: 'C', focusNode: 'Activation' }
  }
  return { visible: false }
}

function instrumentFor(s: Scene): string | undefined {
  if (s.act === 2) return s.id === '2.1' ? 'reach' : s.id === '2.2' ? 'products' : 'all'
  if (s.act === 3) return 'products'
  return undefined
}

// The default choreography per scene — which instruments react, and how. The
// Cinema Director can override this per scene; this is the baseline story.
// Act I ignites (cockpit recedes), Act II tours the six instruments, Act III
// spotlights products, Acts IV–VI are reactor/graph beats (cockpit recedes),
// Act VII returns to the live cockpit.
function stageFor(s: Scene, progress: number): StageDirection[] {
  switch (s.act) {
    case 2: {
      // Act II names three instruments per clip — spotlight each ONE in turn as
      // it's spoken: it pops toward centre + enlarges while the rest recede.
      const third = (a: StageDirection['target'], b: StageDirection['target'], c: StageDirection['target']): StageDirection[] =>
        [{ target: progress < 0.34 ? a : progress < 0.67 ? b : c, effect: 'enlarge' }]
      if (s.id === '2.1') return third('reach', 'engaged', 'valuation')
      if (s.id === '2.2') return third('products', 'access', 'rhythm')
      return [{ target: 'all', effect: 'glow' }] // 2.3 truth policy — all steady
    }
    case 7:
      return s.id === '7.2' ? [{ target: 'all', effect: 'glow' }] : [] // return to the cockpit
    default:
      // Act I ignition, Act III (the product popup is the star), Acts IV–VI
      // (reactor/graph) → the cockpit recedes.
      return []
  }
}

export function deriveState(s: Scene, mode: Mode, progress: number): SceneState {
  return {
    id: s.id,
    act: s.act,
    mode,
    voice: s.voice,
    product: s.product,
    core: coreFor(s),
    nodes: nodesFor(s),
    focusInstrument: instrumentFor(s),
    stage: stageFor(s, progress),
    progress,
  }
}

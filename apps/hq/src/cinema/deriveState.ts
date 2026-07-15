// Pure mapping: a Scene + playback context → the semantic SceneState WS2/WS3 read.
// This is the storyline choreography from the WS1 spec, in one testable place.
import type { CoreState, NodesState, SceneState, Mode, StageDirection, SceneActionDirective } from './contract'
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
  // The brain IS the THINK · KNOW · DO organ, so the deep-dive begins at 4.2 —
  // the reactor "unfolds" at 4.1, then dissolves into the cortex to explain each
  // lobe (core state think/know/do drives the region activation), and stays
  // through Acts V (architecture) and VI (the proof).
  if (s.act === 4 && s.id !== '4.1') return { visible: true }
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
    // Deep-dive (brain) beats — surface the ONE instrument card the beat's brain
    // region is about, floating it over the cortex so the mind "opens across" the
    // six cards, one in context at a time. THINK→Valuation (worth/decisions),
    // KNOW→Weekly Engaged (the north-star evidence), DO→Products (execution).
    case 4: {
      const card = ({ '4.2': 'valuation', '4.3': 'engaged', '4.4': 'products' } as const)[s.id]
      return card ? [{ target: card, effect: 'enlarge' }] : [] // 4.1 stays on the reactor unfold
    }
    case 5: {
      const card = ({ '5.1': 'valuation', '5.2': 'engaged', '5.3': 'products', '5.4': 'access' } as const)[s.id]
      return card ? [{ target: card, effect: 'enlarge' }] : []
    }
    case 6: {
      // the "why is activation weak?" proof lives in the engagement/attention cards
      const card = ({ '6.1': 'rhythm', '6.2': 'rhythm', '6.3': 'access', '6.4': 'access', '6.5': 'products' } as const)[s.id]
      return card ? [{ target: card, effect: 'enlarge' }] : []
    }
    case 7:
      return s.id === '7.2' ? [{ target: 'all', effect: 'glow' }] : [] // return to the cockpit
    default:
      return [] // Act I ignition, Act III (the product popup is the star)
  }
}

// ── Action selector (founder-facing authoring layer, additive) ────────────
// The baseline narrative verb per scene — the same act/scene logic as coreFor,
// phrased in the founder's vocabulary. This is a DESCRIPTIVE default (what the
// scene is already doing); it does not change today's playback. An explicit
// founder override (Cinema Director store) is resolved through coreForAction()
// by the caller (CinemaDev.tsx), which then REPLACES the derived `core` for
// that one scene — one dropdown drives both the reactor and the WS3 brain
// (whose region activation keys off `core`), so they never drift apart.
export function actionFor(s: Scene): SceneActionDirective {
  switch (s.act) {
    case 1: return s.id === '1.1' ? { action: 'ignite' } : { action: 'hold' }
    case 2: return { action: 'focus', target: 'all' }
    case 3: {
      if (s.beat === 'intro') return { action: 'open', target: s.product }
      if (s.beat === 'close') return { action: 'close', target: s.product }
      return { action: 'focus', target: s.product }
    }
    case 4: {
      if (s.id === '4.1') return { action: 'open', target: 'architecture' }
      const t = ({ '4.2': 'think', '4.3': 'know', '4.4': 'do' } as const)[s.id]
      return t ? { action: 'open', target: t } : { action: 'hold' }
    }
    case 5: return { action: 'reveal', target: 'architecture' }
    case 6: return { action: 'reveal', target: 'know' }
    case 7: return s.id === '7.1' ? { action: 'return' } : { action: 'hold' }
    default: return { action: 'hold' }
  }
}

/** Maps a founder-authored action+target to the CoreState it drives — the
 *  single place the "one dropdown, two systems" promise is kept. */
export function coreForAction(a: SceneActionDirective): CoreState {
  switch (a.action) {
    case 'ignite': return 'booting'
    case 'open':
      if (a.target === 'think' || a.target === 'know' || a.target === 'do') return a.target
      if (a.target === 'vault') return 'vault-entry'
      if (a.target === 'architecture' || a.target === 'all' || !a.target) return 'architecture-unfold'
      return 'product-focus' // a product id
    case 'focus': return a.target && a.target !== 'all' ? 'popup-open' : 'listening'
    case 'reveal': return 'architecture-unfold'
    case 'close': return 'popup-open'
    case 'return': return 'return'
    case 'hold': return 'idle'
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

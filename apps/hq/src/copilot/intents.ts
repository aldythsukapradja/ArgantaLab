// Voice copilot — the command contract + pure phrase→action router. No DOM,
// no browser APIs, no LLM. Deterministic substring match against a
// lowercased, punctuation-stripped transcript. This is the part that has to
// be bulletproof; the adapters (useVoice/useGesture) are thin and disposable.
//
// A command is DATA: (category, label, phrases, reply, actionKind + arg). The
// hardcoded SEED_INTENTS below is the offline fallback; the DB registry
// (registry.ts) produces the SAME IntentSpec shape from hq_voice_command rows.
// Everything downstream — matcher, cheat-sheet, spoken replies, HUD — reads
// this one shape, so adding a command is a row insert, never a code change.

import type { SurfaceId, CommandTab, DataTab, BuilderSub } from '../shell/store'
import type { ProductId, InspectorView } from '../surfaces/Portfolio'

export interface CopilotActions {
  go: (s: SurfaceId) => void
  openPalette: () => void
  toggleTheme: () => void
  toggleAgent: () => void
  refresh: () => void
  disarm: () => void
  /** Start the reactor cinematic (topbar clapperboard). Trigger word: "activate". */
  playCinema: () => void
  /** Close whatever's open — cinema → popup → agent → palette, in priority order. */
  close: () => void
  /** Open a product's detail popup. */
  openProduct: (id: ProductId) => void
  /** Open the voice/gesture cheat-sheet. */
  help: () => void
  /** Jump into Command at a given office (or 'lobby'). */
  goOffice: (tab: CommandTab) => void
  /** Open the Data surface at a given tab. */
  openDataTab: (tab: DataTab) => void
  /** Open a builder surface at a given sub-tab (catalogue/studio/analytics). */
  openBuilderSub: (surfaceId: 'game' | 'app', sub: BuilderSub) => void
  /** Switch the open product popup's inspector view. Contextual — a no-op
   *  unless a popup is actually open (Landing injects the real handler). */
  setProductView: (view: InspectorView) => void
}

export type CommandCategory = 'navigate' | 'product' | 'control' | 'system'

/**
 * The closed set of actions a command may bind to. The DB stores an
 * `actionKind` + optional `actionArg` string — NEVER executable code — so a
 * row can only ever remap to an action the app already exposes. This is the
 * instruction-source boundary: data configures which safe action runs, it
 * cannot introduce new behaviour.
 */
export type ActionKind =
  | 'go' | 'openProduct' | 'openPalette' | 'toggleTheme' | 'toggleAgent'
  | 'playCinema' | 'close' | 'refresh' | 'disarm' | 'help'
  | 'goOffice' | 'openDataTab' | 'openBuilderSub' | 'setProductView'

export interface IntentSpec {
  id: string
  category: CommandCategory
  /** Human label for the cheat-sheet + command flash, e.g. "Open Lashira Bloom". */
  label: string
  /** All phrases that trigger this intent; matched as substrings. */
  phrases: string[]
  /** What Jarvis says back on success, e.g. "Opening Lashira Bloom". */
  reply: string
  run: (actions: CopilotActions) => void
}

/** Build a runnable action from a DB-safe (kind, arg) pair. */
export function actionFor(kind: ActionKind, arg?: string | null): (a: CopilotActions) => void {
  switch (kind) {
    case 'go': return a => a.go((arg ?? 'home') as SurfaceId)
    case 'openProduct': return a => a.openProduct((arg ?? 'arganta') as ProductId)
    case 'openPalette': return a => a.openPalette()
    case 'toggleTheme': return a => a.toggleTheme()
    case 'toggleAgent': return a => a.toggleAgent()
    case 'playCinema': return a => a.playCinema()
    case 'close': return a => a.close()
    case 'refresh': return a => a.refresh()
    case 'disarm': return a => a.disarm()
    case 'help': return a => a.help()
    case 'goOffice': return a => a.goOffice((arg ?? 'lobby') as CommandTab)
    case 'openDataTab': return a => a.openDataTab((arg ?? 'schema') as DataTab)
    case 'openBuilderSub': return a => {
      const [surfaceId, sub] = (arg ?? 'game:catalogue').split(':')
      a.openBuilderSub(surfaceId as 'game' | 'app', (sub as BuilderSub) ?? 'catalogue')
    }
    case 'setProductView': return a => a.setProductView((arg ?? 'overview') as InspectorView)
  }
}

/** A DB row (or seed entry) in its data form — the registry's wire shape. */
export interface CommandRow {
  id: string
  category: CommandCategory
  label: string
  phrases: string[]
  reply: string
  actionKind: ActionKind
  actionArg?: string | null
}

export function specFromRow(row: CommandRow): IntentSpec {
  return {
    id: row.id, category: row.category, label: row.label,
    phrases: row.phrases, reply: row.reply,
    run: actionFor(row.actionKind, row.actionArg),
  }
}

// ── Seed / offline fallback ────────────────────────────────────────────────
// The canonical command set. Mirrored into hq_voice_command by the migration's
// seed INSERT; used verbatim when cloud is disabled or the registry is empty.
export const SEED_ROWS: CommandRow[] = [
  { id: 'wake', category: 'system', label: 'Wake Jarvis', phrases: ['hey arganta', 'hey jarvis'], reply: 'Yes?', actionKind: 'toggleAgent' },
  { id: 'help', category: 'system', label: 'Show commands', phrases: ['help', 'what can i say', 'show commands'], reply: 'Here is what you can say.', actionKind: 'help' },
  { id: 'open-portfolio', category: 'navigate', label: 'Open Portfolio', phrases: ['open portfolio'], reply: 'Opening Portfolio.', actionKind: 'go', actionArg: 'portfolio' },
  { id: 'open-growth', category: 'navigate', label: 'Open Analytics', phrases: ['open growth', 'open analytics'], reply: 'Opening Analytics.', actionKind: 'go', actionArg: 'growth' },
  { id: 'open-command', category: 'navigate', label: 'Open Command', phrases: ['open command'], reply: 'Opening Command.', actionKind: 'go', actionArg: 'command' },
  { id: 'open-build', category: 'navigate', label: 'Open Build', phrases: ['open build', 'open game builder'], reply: 'Opening Build.', actionKind: 'go', actionArg: 'game' },
  { id: 'open-media', category: 'navigate', label: 'Open Media Center', phrases: ['open media center', 'open media'], reply: 'Opening Media Center.', actionKind: 'go', actionArg: 'media' },
  { id: 'open-vault', category: 'navigate', label: 'Open Vault', phrases: ['open vault'], reply: 'Opening the Vault.', actionKind: 'go', actionArg: 'vault' },
  { id: 'open-menu', category: 'system', label: 'Open menu', phrases: ['open menu', 'search'], reply: 'Menu.', actionKind: 'openPalette' },
  { id: 'theme', category: 'control', label: 'Switch theme', phrases: ['dark mode', 'light mode', 'switch theme'], reply: 'Switching theme.', actionKind: 'toggleTheme' },
  { id: 'refresh', category: 'control', label: 'Refresh signals', phrases: ['refresh signals', 'refresh'], reply: 'Refreshing signals.', actionKind: 'refresh' },
  { id: 'play-cinema', category: 'control', label: 'Play cinematic', phrases: ['activate'], reply: 'Activating.', actionKind: 'playCinema' },
  { id: 'close', category: 'control', label: 'Close', phrases: ['close this', 'close it', 'close', 'go back'], reply: 'Closing.', actionKind: 'close' },
  { id: 'stop', category: 'control', label: 'Stop listening', phrases: ['stop listening', 'cancel'], reply: 'Standing by.', actionKind: 'disarm' },
  { id: 'open-product-lashira', category: 'product', label: 'Open Lashira Bloom', phrases: ['open lashirabloom', 'open lashira'], reply: 'Opening Lashira Bloom.', actionKind: 'openProduct', actionArg: 'lashira' },
  { id: 'open-product-kinetik', category: 'product', label: 'Open KinetikCircle', phrases: ['open kinetikcircle', 'open kinetik'], reply: 'Opening KinetikCircle.', actionKind: 'openProduct', actionArg: 'kinetik' },
  { id: 'open-product-hq', category: 'product', label: 'Open HQ', phrases: ['open hq'], reply: 'Opening HQ.', actionKind: 'openProduct', actionArg: 'hq' },
  { id: 'open-product-landing', category: 'product', label: 'Open Landing', phrases: ['open landing'], reply: 'Opening Landing.', actionKind: 'openProduct', actionArg: 'landing' },
  { id: 'open-product-arganta', category: 'product', label: 'Open ArgantaLab', phrases: ['open argantalab', 'open arganta'], reply: 'Opening ArgantaLab.', actionKind: 'openProduct', actionArg: 'arganta' },

  // ── Full surface map (the other 17 destinations) ──────────────────────────
  { id: 'go-home', category: 'navigate', label: 'Go home', phrases: ['go home', 'go to the orb', 'show the orb'], reply: 'Heading home.', actionKind: 'go', actionArg: 'home' },
  { id: 'open-data', category: 'navigate', label: 'Open Data', phrases: ['open data'], reply: 'Opening Data.', actionKind: 'go', actionArg: 'data' },
  { id: 'open-content', category: 'navigate', label: 'Open Learn Builder', phrases: ['open learn builder', 'open learn'], reply: 'Opening Learn Builder.', actionKind: 'go', actionArg: 'content' },
  { id: 'open-app', category: 'navigate', label: 'Open App Builder', phrases: ['open app builder'], reply: 'Opening App Builder.', actionKind: 'go', actionArg: 'app' },
  { id: 'open-agents', category: 'navigate', label: 'Open Agent Studio', phrases: ['open agent studio', 'open agent builder', 'open agents'], reply: 'Opening Agent Studio.', actionKind: 'go', actionArg: 'agents' },
  { id: 'open-broadcast', category: 'navigate', label: 'Open Content Builder', phrases: ['open content builder'], reply: 'Opening Content Builder.', actionKind: 'go', actionArg: 'broadcast' },
  { id: 'open-pixel', category: 'navigate', label: 'Open Pixel Vault', phrases: ['open pixel vault', 'open pixel'], reply: 'Opening Pixel Vault.', actionKind: 'go', actionArg: 'pixel' },
  { id: 'open-architecture', category: 'navigate', label: 'Open Architecture', phrases: ['open architecture'], reply: 'Opening Architecture.', actionKind: 'go', actionArg: 'architecture' },
  { id: 'open-battle', category: 'navigate', label: 'Open Battle Builder', phrases: ['open battle builder', 'open battle'], reply: 'Opening Battle Builder.', actionKind: 'go', actionArg: 'battle' },
  { id: 'open-character', category: 'navigate', label: 'Open Character Forge', phrases: ['open character forge', 'open character'], reply: 'Opening Character Forge.', actionKind: 'go', actionArg: 'character' },
  { id: 'open-world', category: 'navigate', label: 'Open Openworld Builder', phrases: ['open openworld builder', 'open world builder', 'open world'], reply: 'Opening Openworld Builder.', actionKind: 'go', actionArg: 'world' },
  { id: 'open-music', category: 'navigate', label: 'Open Music Builder', phrases: ['open music builder', 'open music'], reply: 'Opening Music Builder.', actionKind: 'go', actionArg: 'music' },
  { id: 'open-video', category: 'navigate', label: 'Open Video Builder', phrases: ['open video builder', 'open video'], reply: 'Opening Video Builder.', actionKind: 'go', actionArg: 'video' },
  { id: 'open-knowledge', category: 'navigate', label: 'Open Knowledge', phrases: ['open knowledge'], reply: 'Opening Knowledge.', actionKind: 'go', actionArg: 'knowledge' },
  { id: 'open-cinema-surface', category: 'navigate', label: 'Open Cinema Editor', phrases: ['open cinema editor', 'open cinema builder'], reply: 'Opening the Cinema editor.', actionKind: 'go', actionArg: 'cinema' },
  { id: 'open-reactor', category: 'navigate', label: 'Open Reactor Builder', phrases: ['open reactor builder', 'open reactor'], reply: 'Opening Reactor Builder.', actionKind: 'go', actionArg: 'reactor' },
  { id: 'open-rack', category: 'navigate', label: 'Open Model Rack', phrases: ['open model rack', 'open rack'], reply: 'Opening Model Rack.', actionKind: 'go', actionArg: 'rack' },

  // ── Sub-nav switching (the "switching things" gap) ─────────────────────────
  { id: 'office-bridge', category: 'control', label: 'Command · Bridge', phrases: ['open bridge office', 'open bridge'], reply: 'Bridge office.', actionKind: 'goOffice', actionArg: 'bridge' },
  { id: 'office-operations', category: 'control', label: 'Command · Operations', phrases: ['open operations office', 'open operations'], reply: 'Operations office.', actionKind: 'goOffice', actionArg: 'operations' },
  { id: 'office-technology', category: 'control', label: 'Command · Technology', phrases: ['open technology office', 'open technology'], reply: 'Technology office.', actionKind: 'goOffice', actionArg: 'technology' },
  { id: 'office-treasury', category: 'control', label: 'Command · Treasury', phrases: ['open treasury office', 'open treasury'], reply: 'Treasury office.', actionKind: 'goOffice', actionArg: 'treasury' },
  { id: 'office-legal', category: 'control', label: 'Command · Legal', phrases: ['open legal office', 'open legal'], reply: 'Legal office.', actionKind: 'goOffice', actionArg: 'legal' },
  { id: 'office-roster', category: 'control', label: 'Command · Roster', phrases: ['open roster', 'show roster'], reply: 'Roster.', actionKind: 'goOffice', actionArg: 'roster' },

  { id: 'data-schema', category: 'control', label: 'Data · Schema', phrases: ['show schema', 'open schema'], reply: 'Schema.', actionKind: 'openDataTab', actionArg: 'schema' },
  { id: 'data-tables', category: 'control', label: 'Data · Tables', phrases: ['show tables', 'open tables'], reply: 'Tables.', actionKind: 'openDataTab', actionArg: 'tables' },
  { id: 'data-ontology', category: 'control', label: 'Data · Ontology', phrases: ['show ontology', 'open ontology'], reply: 'Ontology.', actionKind: 'openDataTab', actionArg: 'ontology' },

  { id: 'game-studio', category: 'control', label: 'Game Builder · Studio', phrases: ['open game studio', 'show game studio'], reply: 'Game studio.', actionKind: 'openBuilderSub', actionArg: 'game:studio' },
  { id: 'game-analytics', category: 'control', label: 'Game Builder · Analytics', phrases: ['show game analytics', 'open game analytics'], reply: 'Game analytics.', actionKind: 'openBuilderSub', actionArg: 'game:analytics' },
  { id: 'app-studio', category: 'control', label: 'App Builder · Studio', phrases: ['open app studio', 'show app studio'], reply: 'App studio.', actionKind: 'openBuilderSub', actionArg: 'app:studio' },
  { id: 'app-analytics', category: 'control', label: 'App Builder · Analytics', phrases: ['show app analytics', 'open app analytics'], reply: 'App analytics.', actionKind: 'openBuilderSub', actionArg: 'app:analytics' },

  { id: 'view-overview', category: 'control', label: 'Product view · Overview', phrases: ['show overview'], reply: 'Overview.', actionKind: 'setProductView', actionArg: 'overview' },
  { id: 'view-desktop', category: 'control', label: 'Product view · Desktop', phrases: ['show desktop'], reply: 'Desktop.', actionKind: 'setProductView', actionArg: 'desktop' },
  { id: 'view-mobile', category: 'control', label: 'Product view · Mobile', phrases: ['show mobile'], reply: 'Mobile.', actionKind: 'setProductView', actionArg: 'mobile' },
]

export const SEED_INTENTS: IntentSpec[] = SEED_ROWS.map(specFromRow)

/** Normalize a raw SpeechRecognition transcript for matching. */
export function normalizeTranscript(raw: string): string {
  return raw.toLowerCase().trim().replace(/[.,!?]/g, '')
}

/**
 * Match a normalized transcript against a command list. Longer phrases win so
 * "open media center" isn't shadowed by "open media", and "open lashirabloom"
 * beats "open lashira".
 */
export function matchIntent(transcript: string, intents: IntentSpec[]): IntentSpec | null {
  const text = normalizeTranscript(transcript)
  if (!text) return null
  let best: { spec: IntentSpec; phrase: string } | null = null
  for (const spec of intents) {
    for (const phrase of spec.phrases) {
      if (text.includes(phrase) && (!best || phrase.length > best.phrase.length)) {
        best = { spec, phrase }
      }
    }
  }
  return best?.spec ?? null
}

export function runTranscript(raw: string, actions: CopilotActions, intents: IntentSpec[]): IntentSpec | null {
  const spec = matchIntent(raw, intents)
  if (spec) spec.run(actions)
  return spec
}

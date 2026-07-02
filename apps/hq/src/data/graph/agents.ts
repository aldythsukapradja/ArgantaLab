// The six offices — the C-level owners. The existing 27-agent roster (data/
// agents.ts) reconciles UNDER these via an `office` field. Command is the single
// source of truth; the Build-group Agent Builder is authoring-only.

import type { AgentDef, OfficeId } from './types'

export const OFFICES: AgentDef[] = [
  { id: 'bridge', office: 'The Bridge', chief: 'CEO', pairedHuman: 'you',
    slice: 'The whole W2F — synthesises the six chiefs into one call.',
    ownsKinds: ['northstar'], issues: ['STRATEGY', 'RESOLVE'],
    sla: [{ key: 'resolve_latency', label: 'Conflicts resolved', target: 1, source: 'placeholder' }] },
  { id: 'operations', office: 'Operations', chief: 'COO', pairedHuman: null,
    slice: 'Depth + frequency — the two retention hooks across the value stages.',
    ownsKinds: ['app', 'tab', 'subtab', 'component'], ownsLevers: ['depth', 'frequency'],
    ownsStages: ['stage.learn', 'stage.parentlock', 'stage.kinetiklock', 'stage.expansion'],
    issues: ['DEEPEN', 'PRUNE', 'RETAIN', 'POLISH', 'CUT'],
    sla: [{ key: 'curr', label: 'CURR (current families)', target: 0.45, source: 'partial' }] },
  { id: 'technology', office: 'Technology', chief: 'CTO', pairedHuman: null,
    slice: 'Efficiency (activation) + instrumentation coverage — the enabler.',
    ownsKinds: ['event', 'signal', 'metric', 'architecture', 'scaleModel'], ownsLevers: ['efficiency'],
    issues: ['FIX', 'INSTRUMENT', 'INNOVATE'],
    sla: [{ key: 'coverage', label: 'Instrumentation coverage', target: 0.8, source: 'partial' }] },
  { id: 'treasury', office: 'Treasury', chief: 'CFO', pairedHuman: null,
    slice: '③ Payment + the money lens on every lever.',
    ownsKinds: ['ledger', 'metric'], ownsStages: ['stage.pay'],
    issues: ['MONETIZE'],
    sla: [{ key: 'contribution', label: 'Contribution / active', target: 0.1, source: 'simulated' }] },
  { id: 'legal', office: 'Legal', chief: 'GC', pairedHuman: null,
    slice: 'Trust — the guardrail across the whole value ladder.',
    ownsKinds: ['ip', 'risk'], issues: ['FLAG', 'HOLD'],
    sla: [{ key: 'open_holds', label: 'Open holds', target: 0, source: 'placeholder' }] },
  { id: 'roster', office: 'The Guild', chief: 'Guildmaster', pairedHuman: null,
    slice: 'The agent workforce that runs every office — and its ROI.',
    ownsKinds: ['office'], issues: ['IMPROVE', 'REPLACE'],
    cost: { source: 'placeholder' },
    sla: [{ key: 'agent_roi', label: 'Lowest-ROI agent', target: 1, source: 'placeholder' }] },
]

export const officeById = (id: OfficeId): AgentDef => OFFICES.find(o => o.id === id)!

// Ordered for the sub-tab bar / lobby cards.
export const OFFICE_ORDER: OfficeId[] = ['bridge', 'operations', 'technology', 'treasury', 'legal', 'roster']

// ---- per-office agent-chat config (brief + key daily questions) ------------
export interface OfficeChat {
  brief: string                         // auto-brief on open (words before numbers)
  chips: { label: string; q: string }[] // key daily questions
}
export const OFFICE_CHAT: Record<OfficeId, OfficeChat> = {
  bridge: {
    brief: 'Reading the North Star and the six chiefs — I stack their headlines and surface what needs your Bridge to resolve.',
    chips: [
      { label: '📋 Daily brief', q: 'Give me the org daily brief' },
      { label: '🧭 North Star', q: 'How is the North Star moving?' },
      { label: '⚖️ Resolve queue', q: 'What is waiting on me to resolve?' },
      { label: '🙋 Who needs me?', q: 'Which chief needs a decision?' },
    ],
  },
  operations: {
    brief: 'CURR state and the two hooks — I watch which rung of the value ladder is leaking and what to deepen or cut.',
    chips: [
      { label: '🔁 CURR state', q: 'Show the CURR state machine' },
      { label: '🪝 Two-hook health', q: 'How many families have both hooks?' },
      { label: '📚 Content depth', q: 'Where is content depth concentrating?' },
      { label: '📅 Family utility', q: 'Is the parent calendar hook sticking?' },
      { label: '✂️ Cut / deepen?', q: 'What should we cut or deepen?' },
    ],
  },
  technology: {
    brief: 'Coverage → 80% and activation — I keep the honest x-ray of what we fly blind on, and own the infra cost line.',
    chips: [
      { label: '📡 What are we blind on?', q: 'What surfaces are we blind on?' },
      { label: '⚡ Activation funnel', q: 'Show the activation funnel' },
      { label: '🩺 Signal health', q: 'Which guardrails are red?' },
      { label: '💸 Infra cost impact', q: 'What is infra doing to the break-even?' },
      { label: '🔌 Wire this event', q: 'What event should we wire next?' },
    ],
  },
  treasury: {
    brief: 'Unit economics and cashflow — I run the Growth-Lab⨯Treasury model: drag any assumption, watch break-even and NPV move.',
    chips: [
      { label: '💰 Cash-positive?', q: 'Are we cashflow positive?' },
      { label: '📊 P&L', q: 'Show the P&L' },
      { label: '💎 Economy', q: 'Diamond economy health' },
      { label: '🔻 Biggest drag', q: 'What is the biggest drag on profit?' },
      { label: '📈 Model a change', q: 'Model a change to the assumptions' },
      { label: '🗓️ Runway & NPV', q: 'What is our runway and NPV?' },
    ],
  },
  legal: {
    brief: 'Trust and holds — I guard consent, UGC and IP, and flag anything that could freeze revenue before it does.',
    chips: [
      { label: '🚦 Open holds', q: 'What holds are open?' },
      { label: '🛡️ Consent coverage', q: 'How is consent coverage?' },
      { label: '⚠️ UGC risk', q: 'Any UGC risk to review?' },
      { label: '📜 IP register', q: 'Show the IP register' },
    ],
  },
  roster: {
    brief: 'The Guild — who is on the bench, who is lit by live data, and which agent earns its token budget.',
    chips: [
      { label: '🗂️ Roster', q: 'Show the agent roster by office' },
      { label: '📈 Agent ROI', q: 'Which agent has the lowest ROI?' },
      { label: '🪙 Token economics', q: 'What does the agent OS cost?' },
      { label: '🔧 Improve / replace?', q: 'Which agent should we improve or replace?' },
    ],
  },
}

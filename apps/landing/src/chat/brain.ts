// The brain — Tier-0 router made concrete, GROUNDED-ONLY (G1 audit, 2026-07-18).
//
// Three pillars, three data sources, zero fabrication:
//   calendar  → kinetik_events + kinetik_routines  (KinetikCircle, circle-scoped)
//   kids      → circle_members → child_profiles → kid_dashboard RPC (ArgantaLab)
//   posting   → composeWeeklyWin over the SAME real fetchers → arganta-publish
//
// The grounding law (same spirit as HQ's provenance badges): every number a
// parent sees comes from a real row. When a source is empty or unreachable the
// answer SAYS so — "nothing on the calendar", "couldn't reach your data" — and
// never substitutes an invented example. There is no sample branch left in this
// file; anything not yet wired answers honestly that it isn't wired.

export type Provenance = 'measured'

export type Answer =
  | { kind: 'text'; lead: string; chips?: string[] }
  | { kind: 'calendar'; lead: string; scope: string[]; view: 'board' | 'month'; chips?: string[] }
  | { kind: 'today'; lead: string; scope: string[]; name: string; chips?: string[] }
  | { kind: 'chart'; lead: string; bars: { label: string; value: number; today?: boolean }[]; chips?: string[] }
  | { kind: 'kids'; lead: string; kids: { name: string; pct: number; streak: number; trend: string }[]; chips?: string[] }
  | { kind: 'pulse'; lead: string; scope: string[]; chips?: string[] }
  | { kind: 'publish'; lead: string; draft: import('./storyCompose').StoryDraft }
  | { kind: 'error'; lead: string }

export interface AskCtx { scope: string[]; label: string; spanning: boolean; name?: string }

export type Intent = 'week' | 'today' | 'busiest' | 'kids' | 'kid_one' | 'pulse' | 'share' | 'capability' | 'privacy' | 'unwired' | 'unknown'

// ── 1 · intent match (F3 vocabulary, trimmed to the three pillars) ──
const RULES: { intent: Intent; any: string[] }[] = [
  { intent: 'share', any: ['post', 'publish', 'instagram', 'share this', 'share our', 'share a', 'share it', 'share the week', 'weekly win', 'buffer'] },
  { intent: 'busiest', any: ['busiest', 'busy day', 'crunch'] },
  { intent: 'pulse', any: ['pulse', 'full report', 'full picture', 'deep dive', 'progress report'] },
  { intent: 'kids', any: ['kids', 'children', 'how are the'] },
  { intent: 'kid_one', any: ['how is', 'streak', 'practice', 'practicing', 'best at', 'struggling', 'improving', 'doing in'] },
  { intent: 'today', any: ['today', 'tonight', 'this morning', 'right now'] },
  { intent: 'week', any: ['week', 'weekend', 'calendar', 'schedule', 'coming up', "what's on", 'whats on', 'happening', 'picture', 'month'] },
  { intent: 'capability', any: ['what can you do', 'who are you', 'what are you', 'what do you do'] },
  { intent: 'privacy', any: ['private', 'privacy', 'my data', 'safe', 'secure'] },
  // recognized but deliberately not wired — answer honestly, never fake
  { intent: 'unwired', any: ['budget', 'spend', 'money', 'dinner', 'meal', 'recipe', 'grocery', 'trip', 'story', 'bedtime', 'add ', 'remind me', 'create ', 'set a'] },
]

export function classify(qRaw: string): Intent {
  const q = qRaw.toLowerCase()
  for (const r of RULES) if (r.any.some(k => q.includes(k))) return r.intent
  return 'unknown'
}

const CANT_REACH = `I couldn't reach your family's data just now. Mind trying again?`

// ── 2 · answer shaping — real fetch or honest refusal, nothing else ──
export async function answer(q: string, ctx?: AskCtx): Promise<Answer> {
  const intent = classify(q)
  const scope = ctx?.scope ?? []
  const where = ctx ? (ctx.spanning ? ' across your circles' : ` in ${ctx.label}`) : ''

  switch (intent) {
    case 'busiest': {
      if (!scope.length) return { kind: 'error', lead: `I don't see a circle to look at yet — pick one at the top.` }
      try {
        const { fetchWeek } = await import('./data')
        const wk = await fetchWeek(scope)
        if (!wk) return { kind: 'error', lead: CANT_REACH }
        const bars = wk.days.map(d => ({ label: d.dow, value: d.events.length, today: d.today }))
        if (wk.count === 0) return { kind: 'chart', bars, lead: `Nothing on this week${where}, so no crunch to warn you about.`, chips: ['This week'] }
        const b = [...wk.days].sort((a, c) => c.events.length - a.events.length)[0]
        return { kind: 'chart', bars,
          lead: `${dayName(b.dow)}'s your crunch${where} — ${b.events.length} thing${b.events.length === 1 ? '' : 's'} on. Here's the whole week at a glance.`,
          chips: ['This week', 'The kids'] }
      } catch { return { kind: 'error', lead: CANT_REACH } }
    }

    case 'today': {
      if (!scope.length) return { kind: 'error', lead: `I don't see a circle to look at yet — pick one at the top.` }
      return { kind: 'today', scope, name: ctx?.name || 'there', lead: '', chips: ['This week', 'The kids'] }
    }

    case 'week': {
      if (!scope.length) return { kind: 'error', lead: `I don't see a circle to look at yet — pick one at the top.` }
      const wantsMonth = /month|whole month|this month/.test(q.toLowerCase())
      const view: 'board' | 'month' = wantsMonth ? 'month' : 'board'
      try {
        const { fetchWeek } = await import('./data')
        const wk = await fetchWeek(scope)
        if (!wk) return { kind: 'error', lead: CANT_REACH }
        const lead = wk.count === 0 ? `The week's wide open${where} — nothing on the calendar yet.` : `${wk.count} thing${wk.count === 1 ? '' : 's'} on the calendar this week${where}.`
        return { kind: 'calendar', scope, view, lead, chips: ['Month view', 'Busiest day?', 'The kids'] }
      } catch { return { kind: 'error', lead: CANT_REACH } }
    }

    case 'pulse': {
      if (!scope.length) return { kind: 'error', lead: `I don't see a circle to look at yet — pick one at the top.` }
      return { kind: 'pulse', scope, lead: '', chips: ['This week', 'Share a win'] }
    }

    case 'kids':
    case 'kid_one': {
      if (!scope.length) return { kind: 'error', lead: `I don't see a circle to look at yet — pick one at the top.` }
      try {
        const { fetchKidReports } = await import('./data')
        const reps = await fetchKidReports(scope)
        if (reps === null) return { kind: 'error', lead: CANT_REACH }
        if (!reps.length) return { kind: 'text', lead: `I don't see any kids linked${where} yet. Add them in KinetikCircle and their learning shows up here.` }
        const named = reps.find(r => q.toLowerCase().includes(r.name.toLowerCase()))
        const show = named ? [named] : reps
        const kids = show.map(r => ({ name: r.name, pct: r.pct, streak: r.streak, trend: r.trend }))
        const anyData = show.some(r => r.hasData)
        let lead: string
        if (!anyData) {
          lead = show.length === 1
            ? `${show[0].name} hasn't practised yet${where} — once they do, their streak and progress show up here.`
            : `No practice logged yet${where}. When the kids start, you'll see streaks and progress right here.`
        } else if (show.length === 1) {
          const r = show[0]
          lead = `${r.name} is at ${r.pct}% right lately${r.streak ? ` with a ${r.streak}-day streak going` : ''}.`
        } else {
          const top = [...show].sort((a, b) => b.streak - a.streak)[0]
          lead = top.streak
            ? `${ctx?.spanning ? 'Across your circles, the' : 'The'} kids are at it — ${top.name}'s on a ${top.streak}-day streak, worth a high five.`
            : `Here's where the kids are right now${where}.`
        }
        return { kind: 'kids', kids, lead, chips: ['Full pulse', 'This week', 'Share a win'] }
      } catch { return { kind: 'error', lead: CANT_REACH } }
    }

    case 'share': {
      const { composeWeeklyWin } = await import('./storyCompose')
      const draft = await composeWeeklyWin(ctx)
      if (!draft) return { kind: 'text', lead: `Nothing real to share yet — once there's practice or a week on the calendar, I'll shape it into a post. I never invent a win.`, chips: ['This week', 'The kids'] }
      return { kind: 'publish', lead: '', draft }
    }

    case 'capability':
      return { kind: 'text', lead: `I'm Arganta — I keep up with your family's calendar and the kids' learning, and I can turn a real week into an Instagram post. Everything I show comes straight from your KinetikCircle and ArgantaLab data.`, chips: ['This week', 'The kids', 'Share this week'] }

    case 'privacy':
      return { kind: 'text', lead: `Your family's information stays in your family's account. I only look at what you've put into Arganta apps — and only when you ask. Nothing is shared or sold, ever.` }

    case 'unwired':
      return { kind: 'text', lead: `That part of the house isn't connected yet — right now I'm grounded in your calendar and the kids' learning, and I can post a real win to Instagram. More rooms open soon.`, chips: ['This week', 'The kids'] }

    default:
      return { kind: 'error', lead: `I couldn't quite catch that. I'm best with your calendar, the kids' learning, and sharing a win.` }
  }
}

const dayName = (dow: string) => ({ Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' } as Record<string, string>)[dow] ?? dow

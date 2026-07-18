// The brain — Tier-0 router made concrete. It reads a parent's plain question,
// picks the right response component (F2 manifest), and shapes the data for it.
//
// TWO LAYERS, ONE SEAM:
//   1. intent match  — deterministic keyword→intent from the F3 question map.
//      This is the "component selection" the LLM-hierarchy doc's Tier 0 owns; it
//      never guesses (ambiguous → picker), mirroring the C5-B1 anti-wrong-chart law.
//   2. answer shaping — turns the matched intent into an Answer. Where the real
//      family data + Tier-1 LLM prose belong, this returns SAMPLE data marked
//      `provenance:'sample'` so the whole UX is live and honest today. Wiring the
//      live router (@arganta/ai selectModel → edge proxy) and the Kinetik/Arganta
//      Supabase fetchers is the one remaining O3-deep slot — see LIVE_SLOT below.
//
// Nothing here ever presents sample data as measured (repo law): components read
// `provenance` and label a sample answer.

export type Provenance = 'measured' | 'sample'

export type Answer =
  | { kind: 'text'; lead: string; chips?: string[]; provenance: Provenance }
  | { kind: 'week'; lead: string; days: WeekDay[]; chips?: string[]; provenance: Provenance }
  | { kind: 'kids'; lead: string; kids: KidStat[]; chips?: string[]; provenance: Provenance }
  | { kind: 'story'; lead: string; title: string; body: string[]; chips?: string[]; provenance: Provenance }
  | { kind: 'budget'; lead: string; spent: number; budget: number; cats: { label: string; amount: number }[]; chips?: string[]; provenance: Provenance }
  | { kind: 'chart'; lead: string; title: string; bars: { label: string; value: number }[]; chips?: string[]; provenance: Provenance }
  | { kind: 'publish'; lead: string; draft: import('./storyCompose').StoryDraft }
  | { kind: 'picker'; lead: string; options: { label: string; send: string }[] }
  | { kind: 'error'; lead: string }

export interface WeekDay { dow: string; date: number; today?: boolean; events: string[] }
export interface KidStat { name: string; pct: number; streak: number; trend: string }

export type Intent =
  | 'week' | 'today' | 'kids' | 'kid_one' | 'story' | 'budget' | 'busiest'
  | 'meals' | 'trip' | 'capability' | 'privacy' | 'notyet' | 'help' | 'share' | 'unknown'

// ── 1 · intent match (F3 vocabulary) ──
const RULES: { intent: Intent; any: string[] }[] = [
  { intent: 'share', any: ['post', 'publish', 'instagram', 'share this', 'share our', 'share the week', 'weekly win', 'buffer'] },
  { intent: 'story', any: ['story', 'bedtime', 'tale', 'fairy'] },
  { intent: 'budget', any: ['budget', 'spend', 'spent', 'money', 'expense', 'subscription', 'cost'] },
  { intent: 'busiest', any: ['busiest', 'busy day', 'crunch'] },
  { intent: 'kids', any: ['kids', 'children', 'how are the'] },
  { intent: 'kid_one', any: ['how is', 'streak', 'practice', 'practicing', 'best at', 'struggling', 'improving', 'doing in'] },
  { intent: 'today', any: ['today', 'tonight', 'this morning', 'right now'] },
  { intent: 'week', any: ['week', 'weekend', 'calendar', 'schedule', 'coming up', 'what\'s on', 'whats on', 'happening'] },
  { intent: 'meals', any: ['dinner', 'meal', 'eat', 'eating', 'recipe', 'cook', 'lunch', 'grocery', 'groceries'] },
  { intent: 'trip', any: ['trip', 'travel', 'holiday', 'vacation', 'pack'] },
  { intent: 'capability', any: ['what can you do', 'who are you', 'what are you', 'help me with', 'what do you do'] },
  { intent: 'privacy', any: ['private', 'privacy', 'my data', 'safe', 'secure'] },
  { intent: 'notyet', any: ['add ', 'remind me', 'create ', 'set a', 'schedule a', 'buy '] },
]

export function classify(qRaw: string): Intent {
  const q = qRaw.toLowerCase()
  for (const r of RULES) if (r.any.some(k => q.includes(k))) return r.intent
  if (q.split(/\s+/).length <= 6 && /\?$/.test(qRaw.trim()) === false && !/[a-z]/.test(q)) return 'unknown'
  return 'help' // everyday-help floor (F3 §G) — a generic capable answer
}

// ── sample data (stands in for the Kinetik/Arganta fetchers until LIVE_SLOT) ──
function sampleWeek(): WeekDay[] {
  const now = new Date(); const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const events: Record<number, string[]> = { 1: ['Swim · 4pm'], 2: ['Groceries'], 3: ['Padel · 6pm', 'Recital'], 5: ['Family movie'] }
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return { dow: dow[d.getDay()], date: d.getDate(), today: d.toDateString() === now.toDateString(), events: events[i] || [] }
  })
}
const SAMPLE_KIDS: KidStat[] = [
  { name: 'Baginda', pct: 82, streak: 6, trend: 'up 4 pts from last week' },
  { name: 'Lashira', pct: 74, streak: 3, trend: 'steady' },
]

// The grounding a question is answered against: which circle(s), and a friendly
// label for prose. `scope` is the list of circle_ids downstream fetchers filter
// by (one circle, or all of the user's circles when spanning).
export interface AskCtx { scope: string[]; label: string; spanning: boolean }

// ── 2 · answer shaping ──
export async function answer(q: string, ctx?: AskCtx): Promise<Answer> {
  // LIVE_SLOT ── when the live router + fetchers are wired, this is where an
  // await routeThroughArgantaAI(q, intent, familyData, ctx) replaces the sample
  // branches below — ctx.scope filters the family data by circle. The component
  // contracts do not change.
  const intent = classify(q)

  if (intent === 'share') {
    const { composeWeeklyWin } = await import('./storyCompose')
    const draft = await composeWeeklyWin(ctx)
    return { kind: 'publish', lead: '', draft }
  }

  // A light touch of grounding so prose reflects the chosen circle. When spanning
  // all circles, answers speak in aggregate ("across your circles").
  const where = ctx ? (ctx.spanning ? ' across your circles' : ` in ${ctx.label}`) : ''

  // ── real data first (circle-scoped), sample as the honest fallback ──
  if ((intent === 'week' || intent === 'today') && ctx?.scope?.length) {
    try {
      const { fetchWeek } = await import('./data')
      const wk = await fetchWeek(ctx.scope)
      if (wk) {
        if (intent === 'today') {
          const t = wk.days.find(d => d.today); const evs = t?.events ?? []
          return { kind: 'week', provenance: 'measured', days: wk.days,
            lead: evs.length ? `Today${where}: ${evs.join(', ')}.` : `Today's wide open${where} — nothing on the calendar.`,
            chips: ['Tomorrow', 'This week'] }
        }
        const lead = wk.count === 0
          ? `The week's wide open${where} — nothing on the calendar yet.`
          : `${wk.count} thing${wk.count === 1 ? '' : 's'} on the calendar this week${where}.`
        return { kind: 'week', provenance: 'measured', days: wk.days, lead, chips: ['Next week', 'Just weekends', 'Busiest day?'] }
      }
    } catch { /* fall through to sample */ }
  }

  if ((intent === 'kids' || intent === 'kid_one') && ctx?.scope?.length) {
    try {
      const { fetchKidReports } = await import('./data')
      const reps = await fetchKidReports(ctx.scope)
      if (reps && reps.length) {
        // a named kid filters to that one; otherwise the whole roster
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
          lead = `${r.name} is doing well${where} — ${r.pct}% right lately${r.streak ? ` and a ${r.streak}-day streak going` : ''}.`
        } else {
          const top = [...show].sort((a, b) => b.streak - a.streak)[0]
          lead = ctx.spanning
            ? `Across your circles, the kids are active this week${top.streak ? ` — ${top.name} leads with a ${top.streak}-day streak` : ''}.`
            : `The kids are active this week${top.streak ? ` — ${top.name}'s on a ${top.streak}-day streak, worth a high five` : ''}.`
        }
        return { kind: 'kids', provenance: 'measured', kids, lead, chips: ['This month', 'Compare kids', 'What to work on?'] }
      }
    } catch { /* fall through to sample */ }
  }
  switch (intent) {
    case 'week': {
      const days = sampleWeek()
      const n = days.reduce((s, d) => s + d.events.length, 0)
      return { kind: 'week', provenance: 'sample', days,
        lead: ctx?.spanning
          ? `A gentle week across your circles — ${n} things on the shared calendar. Thursday's the busy one.`
          : `A gentle week${where} — ${n} things, all after school. Thursday's the busy one.`,
        chips: ['Next week', 'Just weekends', 'Busiest day?'] }
    }
    case 'today': {
      const days = sampleWeek(); const t = days.find(d => d.today)
      const evs = t?.events || []
      return { kind: 'week', provenance: 'sample', days,
        lead: evs.length ? `Today: ${evs.join(', ')}.` : `Today's wide open — nothing on the calendar yet.`,
        chips: ['Tomorrow', 'This week'] }
    }
    case 'busiest':
      return { kind: 'chart', provenance: 'sample', title: 'Things on, by day',
        lead: `Thursday's your crunch — two things back to back. The rest of the week is calm.`,
        bars: [{ label: 'Mon', value: 1 }, { label: 'Tue', value: 1 }, { label: 'Wed', value: 0 }, { label: 'Thu', value: 2 }, { label: 'Fri', value: 1 }, { label: 'Sat', value: 0 }, { label: 'Sun', value: 0 }],
        chips: ['This month', 'When are we free?'] }
    case 'kids':
    case 'kid_one': {
      const one = /baginda/i.test(q) ? [SAMPLE_KIDS[0]] : /lashira/i.test(q) ? [SAMPLE_KIDS[1]] : SAMPLE_KIDS
      const lead = ctx?.spanning
        ? `Looking across your circles, the kids are steady this week — Baginda's 6-day streak leads the pack.`
        : one.length === 1
          ? `${one[0].name} is doing well${where} — ${one[0].pct}% lately and a ${one[0].streak}-day streak going.`
          : `Both kids are steady this week${where}. Baginda's on a 6-day streak — worth a high five.`
      return { kind: 'kids', provenance: 'sample', kids: one, lead, chips: ['This month', 'Compare kids', 'What to work on?'] }
    }
    case 'story':
      return { kind: 'story', provenance: 'sample', title: 'The Lantern Fox',
        lead: `Here's a short one for tonight.`,
        body: [
          'Once, on the edge of a sleeping town, a small fox carried a lantern that never went out.',
          'Every night she lit the path for travellers who had lost their way — and every morning, she left a single warm coal on their doorstep, so they would always find their way home.',
          'And that is why, they say, the kindest houses always smell faintly of woodsmoke and morning.',
        ],
        chips: ['Shorter', 'About dragons', 'Read it to us'] }
    case 'budget':
      return { kind: 'budget', provenance: 'sample', spent: 1840, budget: 2400,
        lead: `You're comfortably on track this month — about three-quarters through the budget with a week to go.`,
        cats: [{ label: 'Groceries', amount: 620 }, { label: 'Kids & school', amount: 430 }, { label: 'Subscriptions', amount: 190 }, { label: 'Everything else', amount: 600 }],
        chips: ['Just groceries', 'Biggest expense', 'Subscriptions'] }
    case 'meals':
      return { kind: 'text', provenance: 'sample',
        lead: `This week's plan leans easy: pasta tonight, then tacos, a soup, and a roast on Sunday. The grocery run is set for tomorrow.`,
        chips: ['Full week', 'Grocery list', 'Something new?'] }
    case 'trip':
      return { kind: 'text', provenance: 'sample',
        lead: `Nothing booked just yet. When a trip's on the calendar I'll keep the plan, the packing list and the spend all in one place.`,
        chips: ['Plan a weekend', 'Ideas for us'] }
    case 'capability':
      return { kind: 'text', provenance: 'measured',
        lead: `I'm Arganta — I keep up with your family's calendar, the kids' learning, meals, trips and the budget, and I'm handy with stories, notes and everyday questions. Tap a card, or just ask the way you'd ask a friend.`,
        chips: ['This week', 'The kids', 'A bedtime story'] }
    case 'privacy':
      return { kind: 'text', provenance: 'measured',
        lead: `Your family's information stays in your family's account. I only look at what you've put into Arganta apps — and only when you ask. Nothing is shared or sold, ever.` }
    case 'notyet':
      return { kind: 'text', provenance: 'measured',
        lead: `I can't add or change things on the calendar just yet — that's coming soon. I can show you what's already there, though.`,
        chips: ['This week', 'Today'] }
    case 'help':
      return { kind: 'text', provenance: 'measured',
        lead: `Happy to help with that. (In this preview I answer family questions with sample data — ask about your week, the kids, meals, money or a bedtime story to see it come alive.)`,
        chips: ['What can you do?', 'A bedtime story'] }
    default:
      return { kind: 'error', lead: `I couldn't quite catch that. I'm best with your calendar, the kids, meals, money and stories.` }
  }
}

// =========================================================
//  Native KinetikCircle apps — Supabase data layer.
//  Every row is scoped to a circle (circle_id) and attributed to the
//  signed-in user (created_by defaults to auth.uid() in the DB). Tables +
//  RLS live in supabase/kinetik/08_apps.sql.
// =========================================================
import { supabase } from '@lib/supabase'

const rows = <T>(data: unknown): T[] => (data ?? []) as T[]

/** One-line live snippet per app for the launcher cards (count-only, cheap). */
export async function appSnippets(circleId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const count = async (table: string, q?: (b: any) => any): Promise<number> => {
    try { let b = supabase.from(table).select('id', { count: 'exact', head: true }).eq('circle_id', circleId); if (q) b = q(b); const { count } = await b; return count ?? 0 } catch { return 0 }
  }
  const [trips, sessions, dinners, docs] = await Promise.all([
    count('kinetik_trip'),
    count('kinetik_padel_session'),
    count('kinetik_meal_plan', b => b.not('recipe_id', 'is', null)),
    count('kinetik_vault_doc'),
  ])
  out.travel = trips ? `${trips} trip${trips === 1 ? '' : 's'} planned` : 'Plan a trip'
  out.padel = sessions ? 'Session ready · tap to play' : 'Set up a session'
  out.kitchen = dinners ? `${dinners} dinner${dinners === 1 ? '' : 's'} planned` : 'Plan the week'
  out.vault = docs ? `${docs} document${docs === 1 ? '' : 's'} stored` : 'Secure your docs'
  return out
}
async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data
}

/* ───────────── Travel Planner ───────────── */
export interface Trip {
  id: string; title: string; emoji: string; destination: string | null
  startDate: string | null; endDate: string | null; status: string; travelers: string[]
}
export interface Activity { id: string; tripId: string; dayDate: string | null; atTime: string | null; emoji: string; name: string; note: string | null; sort: number }
export interface PackItem { id: string; tripId: string; category: string; name: string; person: string | null; checked: boolean }
export interface TripExpense { id: string; tripId: string; category: string; name: string | null; icon: string; amount: number }

const mapTrip = (r: any): Trip => ({ id: r.id, title: r.title, emoji: r.emoji || '✈️', destination: r.destination ?? null, startDate: r.start_date ?? null, endDate: r.end_date ?? null, status: r.status || 'planning', travelers: r.travelers ?? [] })

export const travel = {
  async trips(circleId: string): Promise<Trip[]> {
    const d = await ok(supabase.from('kinetik_trip').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(mapTrip)
  },
  async createTrip(circleId: string, t: Partial<Trip>): Promise<Trip> {
    const d = await ok(supabase.from('kinetik_trip').insert({ circle_id: circleId, title: t.title, emoji: t.emoji ?? '✈️', destination: t.destination ?? null, start_date: t.startDate ?? null, end_date: t.endDate ?? null, status: t.status ?? 'planning', travelers: t.travelers ?? [] }).select().single())
    return mapTrip(d)
  },
  async updateTrip(id: string, p: Partial<Trip>): Promise<void> {
    const row: Record<string, unknown> = {}
    if (p.title !== undefined) row.title = p.title
    if (p.emoji !== undefined) row.emoji = p.emoji
    if (p.destination !== undefined) row.destination = p.destination
    if (p.startDate !== undefined) row.start_date = p.startDate
    if (p.endDate !== undefined) row.end_date = p.endDate
    if (p.status !== undefined) row.status = p.status
    if (p.travelers !== undefined) row.travelers = p.travelers
    await ok(supabase.from('kinetik_trip').update(row).eq('id', id).select())
  },
  async deleteTrip(id: string): Promise<void> { await ok(supabase.from('kinetik_trip').delete().eq('id', id).select()) },

  async activities(tripId: string): Promise<Activity[]> {
    const d = await ok(supabase.from('kinetik_trip_activity').select('*').eq('trip_id', tripId).order('day_date').order('sort'))
    return rows<any>(d).map(r => ({ id: r.id, tripId: r.trip_id, dayDate: r.day_date ?? null, atTime: r.at_time ?? null, emoji: r.emoji || '📍', name: r.name, note: r.note ?? null, sort: r.sort ?? 0 }))
  },
  async addActivity(circleId: string, tripId: string, a: Partial<Activity>): Promise<void> {
    await ok(supabase.from('kinetik_trip_activity').insert({ circle_id: circleId, trip_id: tripId, day_date: a.dayDate ?? null, at_time: a.atTime ?? null, emoji: a.emoji ?? '📍', name: a.name, note: a.note ?? null, sort: a.sort ?? 0 }).select())
  },
  async delActivity(id: string): Promise<void> { await ok(supabase.from('kinetik_trip_activity').delete().eq('id', id).select()) },

  async packItems(tripId: string): Promise<PackItem[]> {
    const d = await ok(supabase.from('kinetik_pack_item').select('*').eq('trip_id', tripId).order('category').order('created_at'))
    return rows<any>(d).map(r => ({ id: r.id, tripId: r.trip_id, category: r.category || 'General', name: r.name, person: r.person ?? null, checked: !!r.checked }))
  },
  async addPack(circleId: string, tripId: string, items: Partial<PackItem>[]): Promise<void> {
    await ok(supabase.from('kinetik_pack_item').insert(items.map(i => ({ circle_id: circleId, trip_id: tripId, category: i.category ?? 'General', name: i.name, person: i.person ?? null, checked: i.checked ?? false }))).select())
  },
  async togglePack(id: string, checked: boolean): Promise<void> { await ok(supabase.from('kinetik_pack_item').update({ checked }).eq('id', id).select()) },
  async delPack(id: string): Promise<void> { await ok(supabase.from('kinetik_pack_item').delete().eq('id', id).select()) },

  async expenses(tripId: string): Promise<TripExpense[]> {
    const d = await ok(supabase.from('kinetik_trip_expense').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }))
    return rows<any>(d).map(r => ({ id: r.id, tripId: r.trip_id, category: r.category || 'Other', name: r.name ?? null, icon: r.icon || '💸', amount: Number(r.amount) || 0 }))
  },
  async addExpense(circleId: string, tripId: string, e: Partial<TripExpense>): Promise<void> {
    await ok(supabase.from('kinetik_trip_expense').insert({ circle_id: circleId, trip_id: tripId, category: e.category ?? 'Other', name: e.name ?? null, icon: e.icon ?? '💸', amount: e.amount ?? 0 }).select())
  },
  async delExpense(id: string): Promise<void> { await ok(supabase.from('kinetik_trip_expense').delete().eq('id', id).select()) },
}

/* ───────────── Padel Matchday ───────────── */
export interface PadelSession {
  id: string; format: string; points: number; courts: number; status: string
  eventName: string | null; venue: string | null; duration: number; pace: string
  americanoMode: string; mexicanoFirst: string; selectedCourts: number[]
}
export interface PadelPlayer { id: string; sessionId: string; name: string; memberId: string | null; sort: number }
export interface PadelBatch { id: string; sessionId: string; number: number; kind: string; label: string | null; sitouts: string[] }
export interface PadelMatch { id: string; sessionId: string; batchId: string | null; court: number; matchNo: number; teamA: string[]; teamB: string[]; scoreA: number | null; scoreB: number | null; status: string }

const mapSession = (r: any): PadelSession => ({
  id: r.id, format: r.format || 'americano', points: r.points ?? 24, courts: r.courts ?? 1, status: r.status || 'setup',
  eventName: r.event_name ?? null, venue: r.venue ?? null, duration: r.duration ?? 90, pace: r.pace || 'normal',
  americanoMode: r.americano_mode || 'duration', mexicanoFirst: r.mexicano_first || 'roster',
  selectedCourts: Array.isArray(r.selected_courts) && r.selected_courts.length ? r.selected_courts : [1],
})
const mapBatch = (r: any): PadelBatch => ({ id: r.id, sessionId: r.session_id, number: r.number ?? 1, kind: r.kind || 'americano', label: r.label ?? null, sitouts: r.sitouts ?? [] })

export const padel = {
  async sessions(circleId: string): Promise<PadelSession[]> {
    const d = await ok(supabase.from('kinetik_padel_session').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(mapSession)
  },
  async createSession(circleId: string, s: Partial<PadelSession>): Promise<PadelSession> {
    const d = await ok(supabase.from('kinetik_padel_session').insert({ circle_id: circleId, format: s.format ?? 'americano', points: s.points ?? 24, courts: s.courts ?? 1, status: s.status ?? 'setup' }).select().single())
    return mapSession(d)
  },
  async updateSession(id: string, p: Partial<PadelSession>): Promise<void> {
    const row: Record<string, unknown> = {}
    if (p.format !== undefined) row.format = p.format
    if (p.points !== undefined) row.points = p.points
    if (p.courts !== undefined) row.courts = p.courts
    if (p.status !== undefined) row.status = p.status
    if (p.eventName !== undefined) row.event_name = p.eventName
    if (p.venue !== undefined) row.venue = p.venue
    if (p.duration !== undefined) row.duration = p.duration
    if (p.pace !== undefined) row.pace = p.pace
    if (p.americanoMode !== undefined) row.americano_mode = p.americanoMode
    if (p.mexicanoFirst !== undefined) row.mexicano_first = p.mexicanoFirst
    if (p.selectedCourts !== undefined) row.selected_courts = p.selectedCourts
    await ok(supabase.from('kinetik_padel_session').update(row).eq('id', id).select())
  },
  async deleteSession(id: string): Promise<void> { await ok(supabase.from('kinetik_padel_session').delete().eq('id', id).select()) },

  async batches(sessionId: string): Promise<PadelBatch[]> {
    const d = await ok(supabase.from('kinetik_padel_batch').select('*').eq('session_id', sessionId).order('number'))
    return rows<any>(d).map(mapBatch)
  },
  async addBatch(circleId: string, sessionId: string, b: { number: number; kind: string; label: string; sitouts?: string[] }): Promise<PadelBatch> {
    const d = await ok(supabase.from('kinetik_padel_batch').insert({ circle_id: circleId, session_id: sessionId, number: b.number, kind: b.kind, label: b.label, sitouts: b.sitouts ?? [] }).select().single())
    return mapBatch(d)
  },
  async resetBatches(sessionId: string): Promise<void> {
    // matches cascade off batch delete (FK on delete cascade)
    await ok(supabase.from('kinetik_padel_batch').delete().eq('session_id', sessionId).select())
    await ok(supabase.from('kinetik_padel_match').delete().eq('session_id', sessionId).select())
  },

  async players(sessionId: string): Promise<PadelPlayer[]> {
    const d = await ok(supabase.from('kinetik_padel_player').select('*').eq('session_id', sessionId).order('sort').order('created_at'))
    return rows<any>(d).map(r => ({ id: r.id, sessionId: r.session_id, name: r.name, memberId: r.member_id ?? null, sort: r.sort ?? 0 }))
  },
  async addPlayers(circleId: string, sessionId: string, ps: { name: string; memberId?: string | null }[]): Promise<void> {
    await ok(supabase.from('kinetik_padel_player').insert(ps.map((p, i) => ({ circle_id: circleId, session_id: sessionId, name: p.name, member_id: p.memberId ?? null, sort: i }))).select())
  },
  async delPlayer(id: string): Promise<void> { await ok(supabase.from('kinetik_padel_player').delete().eq('id', id).select()) },

  async matches(sessionId: string): Promise<PadelMatch[]> {
    const d = await ok(supabase.from('kinetik_padel_match').select('*').eq('session_id', sessionId).order('match_no'))
    return rows<any>(d).map(r => ({ id: r.id, sessionId: r.session_id, batchId: r.batch_id ?? null, court: r.court ?? 1, matchNo: r.match_no ?? 1, teamA: r.team_a ?? [], teamB: r.team_b ?? [], scoreA: r.score_a ?? null, scoreB: r.score_b ?? null, status: r.status || 'pending' }))
  },
  async addMatches(circleId: string, sessionId: string, batchId: string, ms: { court: number; matchNo: number; teamA: string[]; teamB: string[] }[]): Promise<void> {
    if (!ms.length) return
    await ok(supabase.from('kinetik_padel_match').insert(ms.map(m => ({ circle_id: circleId, session_id: sessionId, batch_id: batchId, court: m.court, match_no: m.matchNo, team_a: m.teamA, team_b: m.teamB }))).select())
  },
  async saveScore(id: string, scoreA: number, scoreB: number): Promise<void> {
    await ok(supabase.from('kinetik_padel_match').update({ score_a: scoreA, score_b: scoreB, status: 'done' }).eq('id', id).select())
  },
  async clearScore(id: string): Promise<void> {
    await ok(supabase.from('kinetik_padel_match').update({ score_a: null, score_b: null, status: 'pending' }).eq('id', id).select())
  },
}

/* ───────────── Kitchen ───────────── */
export interface Ingredient { name: string; qty?: string; aisle?: string }
export interface Recipe { id: string; emoji: string; name: string; category: string; minutes: number; servings: number; ingredients: Ingredient[]; steps: string[] }
export interface MealPlan { id: string; planDate: string; recipeId: string | null; note: string | null }
export interface ShopItem { id: string; name: string; aisle: string; qty: string | null; done: boolean }
export interface GroceryBasket { id: string; title: string; items: { name: string; aisle: string }[] }
export interface GroceryRun { id: string; title: string | null; itemCount: number; createdAt: string }

const mapRecipe = (r: any): Recipe => ({ id: r.id, emoji: r.emoji || '🍽️', name: r.name, category: r.category || 'Mains', minutes: r.minutes ?? 30, servings: r.servings ?? 4, ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], steps: Array.isArray(r.steps) ? r.steps : [] })

export const kitchen = {
  async recipes(circleId: string): Promise<Recipe[]> {
    const d = await ok(supabase.from('kinetik_recipe').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(mapRecipe)
  },
  async createRecipe(circleId: string, r: Partial<Recipe>): Promise<Recipe> {
    const d = await ok(supabase.from('kinetik_recipe').insert({ circle_id: circleId, emoji: r.emoji ?? '🍽️', name: r.name, category: r.category ?? 'Mains', minutes: r.minutes ?? 30, servings: r.servings ?? 4, ingredients: r.ingredients ?? [], steps: r.steps ?? [] }).select().single())
    return mapRecipe(d)
  },
  async deleteRecipe(id: string): Promise<void> { await ok(supabase.from('kinetik_recipe').delete().eq('id', id).select()) },

  async plan(circleId: string): Promise<MealPlan[]> {
    const d = await ok(supabase.from('kinetik_meal_plan').select('*').eq('circle_id', circleId).order('plan_date'))
    return rows<any>(d).map(r => ({ id: r.id, planDate: r.plan_date, recipeId: r.recipe_id ?? null, note: r.note ?? null }))
  },
  async setPlan(circleId: string, planDate: string, recipeId: string | null): Promise<void> {
    await ok(supabase.from('kinetik_meal_plan').upsert({ circle_id: circleId, plan_date: planDate, recipe_id: recipeId }, { onConflict: 'circle_id,plan_date' }).select())
  },

  async shop(circleId: string): Promise<ShopItem[]> {
    const d = await ok(supabase.from('kinetik_shop_item').select('*').eq('circle_id', circleId).order('aisle').order('created_at'))
    return rows<any>(d).map(r => ({ id: r.id, name: r.name, aisle: r.aisle || 'Other', qty: r.qty ?? null, done: !!r.done }))
  },
  async addShop(circleId: string, items: { name: string; aisle?: string; qty?: string }[]): Promise<void> {
    await ok(supabase.from('kinetik_shop_item').insert(items.map(i => ({ circle_id: circleId, name: i.name, aisle: i.aisle ?? 'Other', qty: i.qty ?? null }))).select())
  },
  async toggleShop(id: string, done: boolean): Promise<void> { await ok(supabase.from('kinetik_shop_item').update({ done }).eq('id', id).select()) },
  async delShop(id: string): Promise<void> { await ok(supabase.from('kinetik_shop_item').delete().eq('id', id).select()) },
  async clearDone(circleId: string): Promise<void> { await ok(supabase.from('kinetik_shop_item').delete().eq('circle_id', circleId).eq('done', true).select()) },
}

/* ───────────── Grocery (folded into Kitchen) ───────────── */
export const grocery = {
  async baskets(circleId: string): Promise<GroceryBasket[]> {
    const d = await ok(supabase.from('kinetik_grocery_basket').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(r => ({ id: r.id, title: r.title, items: Array.isArray(r.items) ? r.items : [] }))
  },
  async addBasket(circleId: string, title: string, items: { name: string; aisle: string }[]): Promise<void> {
    await ok(supabase.from('kinetik_grocery_basket').insert({ circle_id: circleId, title, items }).select())
  },
  async delBasket(id: string): Promise<void> { await ok(supabase.from('kinetik_grocery_basket').delete().eq('id', id).select()) },

  async runs(circleId: string): Promise<GroceryRun[]> {
    const d = await ok(supabase.from('kinetik_grocery_run').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(r => ({ id: r.id, title: r.title ?? null, itemCount: r.item_count ?? 0, createdAt: r.created_at }))
  },
  async logRun(circleId: string, title: string | null, itemCount: number): Promise<void> {
    await ok(supabase.from('kinetik_grocery_run').insert({ circle_id: circleId, title, item_count: itemCount }).select())
  },
}

/* ───────────── Family Vault ───────────── */
export interface VaultField { k: string; v: string }
export interface VaultDoc { id: string; category: string; name: string; icon: string; fields: VaultField[]; expiry: string | null; filePath: string | null; createdAt: string }
export interface VaultBudget { id: string; category: string; icon: string; monthly: number }
export interface VaultExpense { id: string; descr: string | null; category: string; icon: string; amount: number; spentAt: string; paidBy: string | null }
export interface VaultSub { id: string; name: string; icon: string; amount: number; period: string; billingDay: number | null; category: string }

export const vault = {
  async docs(circleId: string): Promise<VaultDoc[]> {
    const d = await ok(supabase.from('kinetik_vault_doc').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(r => ({ id: r.id, category: r.category || 'Documents', name: r.name, icon: r.icon || '📄', fields: Array.isArray(r.fields) ? r.fields : [], expiry: r.expiry ?? null, filePath: r.file_path ?? null, createdAt: r.created_at }))
  },
  async addDoc(circleId: string, doc: Partial<VaultDoc>): Promise<void> {
    await ok(supabase.from('kinetik_vault_doc').insert({ circle_id: circleId, category: doc.category ?? 'Documents', name: doc.name, icon: doc.icon ?? '📄', fields: doc.fields ?? [], expiry: doc.expiry ?? null, file_path: doc.filePath ?? null }).select())
  },
  async delDoc(id: string): Promise<void> { await ok(supabase.from('kinetik_vault_doc').delete().eq('id', id).select()) },

  async budgets(circleId: string): Promise<VaultBudget[]> {
    const d = await ok(supabase.from('kinetik_vault_budget').select('*').eq('circle_id', circleId).order('category'))
    return rows<any>(d).map(r => ({ id: r.id, category: r.category, icon: r.icon || '💵', monthly: Number(r.monthly) || 0 }))
  },
  async setBudget(circleId: string, category: string, icon: string, monthly: number): Promise<void> {
    await ok(supabase.from('kinetik_vault_budget').upsert({ circle_id: circleId, category, icon, monthly }, { onConflict: 'circle_id,category' }).select())
  },

  async expenses(circleId: string): Promise<VaultExpense[]> {
    const d = await ok(supabase.from('kinetik_vault_expense').select('*').eq('circle_id', circleId).order('spent_at', { ascending: false }))
    return rows<any>(d).map(r => ({ id: r.id, descr: r.descr ?? null, category: r.category || 'Other', icon: r.icon || '🧾', amount: Number(r.amount) || 0, spentAt: r.spent_at, paidBy: r.paid_by ?? null }))
  },
  async addExpense(circleId: string, e: Partial<VaultExpense>): Promise<void> {
    await ok(supabase.from('kinetik_vault_expense').insert({ circle_id: circleId, descr: e.descr ?? null, category: e.category ?? 'Other', icon: e.icon ?? '🧾', amount: e.amount ?? 0, spent_at: e.spentAt ?? new Date().toISOString().slice(0, 10), paid_by: e.paidBy ?? null }).select())
  },
  async delExpense(id: string): Promise<void> { await ok(supabase.from('kinetik_vault_expense').delete().eq('id', id).select()) },

  async subs(circleId: string): Promise<VaultSub[]> {
    const d = await ok(supabase.from('kinetik_vault_sub').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }))
    return rows<any>(d).map(r => ({ id: r.id, name: r.name, icon: r.icon || '📺', amount: Number(r.amount) || 0, period: r.period || 'month', billingDay: r.billing_day ?? null, category: r.category || 'Other' }))
  },
  async addSub(circleId: string, s: Partial<VaultSub>): Promise<void> {
    await ok(supabase.from('kinetik_vault_sub').insert({ circle_id: circleId, name: s.name, icon: s.icon ?? '📺', amount: s.amount ?? 0, period: s.period ?? 'month', billing_day: s.billingDay ?? null, category: s.category ?? 'Other' }).select())
  },
  async delSub(id: string): Promise<void> { await ok(supabase.from('kinetik_vault_sub').delete().eq('id', id).select()) },
}

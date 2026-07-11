// @arganta/usage — the ecosystem's time-on-page tracker.
//
// Every app calls startUsageTracker() once at boot. The tracker ticks a
// 5-second clock; a tick counts ONLY when the tab is visible and the person
// touched the page (pointer/key/scroll/touch) within the last 2 minutes —
// so parked tabs and idle screens never inflate the numbers. Counted seconds
// accumulate per page and flush to `app_usage_beats` every ~20s and on
// tab-hide, attributed to the signed-in user when there is one and to a
// stable anonymous client id otherwise.
//
// Zero dependencies; the host app passes its own Supabase client. Every
// failure path is swallowed — analytics must never break the product.

const TICK_MS = 5_000
const FLUSH_MS = 20_000
const IDLE_MS = 120_000
const MAX_BEAT_SECS = 300 // matches the DB check constraint

function safeStorage() {
  try { return window.localStorage } catch { return null }
}

function clientId() {
  const store = safeStorage()
  const KEY = 'arganta_usage_cid'
  let id = store?.getItem(KEY)
  if (!id) {
    id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    store?.setItem(KEY, id)
  }
  return id
}

/**
 * Start the usage tracker. Returns a stop() function.
 * @param {object}   opts
 * @param {object}   opts.supabase  the app's Supabase client (null → no-op)
 * @param {string}   opts.app       app key: 'arganta' | 'kinetik' | 'lashira' | 'hq' | 'landing' | …
 * @param {() => string} [opts.getPage]  returns the current page/tab/scene key
 */
export function startUsageTracker({ supabase, app, getPage }) {
  if (!supabase || !app || typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const cid = clientId()
  const sessionId = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  const page = () => {
    try { return String(getPage?.() || 'home').slice(0, 80) } catch { return 'home' }
  }

  let lastInput = Date.now()
  let buckets = new Map()          // page -> seconds counted, not yet flushed
  let stopped = false
  let flushing = false

  const onInput = () => { lastInput = Date.now() }
  const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']
  for (const ev of INPUT_EVENTS) window.addEventListener(ev, onInput, { passive: true, capture: true })

  const tick = setInterval(() => {
    if (stopped) return
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastInput > IDLE_MS) return
    const p = page()
    buckets.set(p, (buckets.get(p) || 0) + TICK_MS / 1000)
  }, TICK_MS)

  async function flush() {
    if (flushing) return
    const snapshot = buckets
    buckets = new Map()
    if (snapshot.size === 0) return
    flushing = true
    try {
      const { data } = await supabase.auth.getSession()
      const userId = data?.session?.user?.id ?? null
      const now = new Date()
      const rows = []
      for (const [p, secs] of snapshot) {
        const s = Math.min(MAX_BEAT_SECS, Math.round(secs))
        if (s < 1) continue
        rows.push({
          app, page: p, secs: s,
          user_id: userId, client_id: cid, session_id: sessionId,
          local_hour: now.getHours(), local_dow: now.getDay(),
        })
      }
      if (rows.length) {
        const { error } = await supabase.from('app_usage_beats').insert(rows)
        // table not migrated yet / offline — put the seconds back and retry later
        if (error) for (const r of rows) buckets.set(r.page, (buckets.get(r.page) || 0) + r.secs)
      }
    } catch {
      /* analytics never throws */
    } finally {
      flushing = false
    }
  }

  const flusher = setInterval(flush, FLUSH_MS)
  const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onHide)

  return function stop() {
    stopped = true
    clearInterval(tick)
    clearInterval(flusher)
    for (const ev of INPUT_EVENTS) window.removeEventListener(ev, onInput, { capture: true })
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onHide)
    void flush()
  }
}

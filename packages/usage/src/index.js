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
// v2 sensors (all coarse, first-party, kid-safe — no GPS/IP, no fingerprints):
//   tz (IANA timezone → region), locale, device class, viewport bucket,
//   clicks per beat window, session-entry flag, referrer host (has value on
//   the landing page; empty for direct/app navigation).
// If the DB still has the v1 table (no sensor columns), the insert falls back
// to the legacy shape automatically.
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

function sensors() {
  const s = { tz: null, locale: null, device: null, vw: null, ref: null }
  try { s.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { /* old engines */ }
  try { s.locale = navigator.language || null } catch { /* ignore */ }
  try {
    const w = window.innerWidth || 0
    s.vw = Math.min(32000, Math.round(w / 10) * 10)
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 1
    s.device = w < 700 ? 'mobile' : touch && w < 1100 ? 'tablet' : 'desktop'
  } catch { /* ignore */ }
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname
      if (host && host !== window.location.hostname) s.ref = host.slice(0, 80)
    }
  } catch { /* ignore */ }
  return s
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
  const sense = sensors()
  const page = () => {
    try { return String(getPage?.() || 'home').slice(0, 80) } catch { return 'home' }
  }

  let lastInput = Date.now()
  let buckets = new Map()          // page -> { secs, clicks } counted, not yet flushed
  let stopped = false
  let flushing = false
  let sentEntry = false
  let legacyShape = false          // v1 table without sensor columns

  const bump = (p, secs, clicks) => {
    const b = buckets.get(p) || { secs: 0, clicks: 0 }
    b.secs += secs
    b.clicks += clicks
    buckets.set(p, b)
  }

  const onInput = () => { lastInput = Date.now() }
  const onClick = () => { lastInput = Date.now(); bump(page(), 0, 1) }
  const INPUT_EVENTS = ['pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']
  for (const ev of INPUT_EVENTS) window.addEventListener(ev, onInput, { passive: true, capture: true })
  window.addEventListener('pointerdown', onClick, { passive: true, capture: true })

  const tick = setInterval(() => {
    if (stopped) return
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastInput > IDLE_MS) return
    bump(page(), TICK_MS / 1000, 0)
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
      for (const [p, b] of snapshot) {
        const s = Math.min(MAX_BEAT_SECS, Math.round(b.secs))
        if (s < 1) continue
        const row = {
          app, page: p, secs: s,
          user_id: userId, client_id: cid, session_id: sessionId,
          local_hour: now.getHours(), local_dow: now.getDay(),
        }
        if (!legacyShape) {
          row.tz = sense.tz
          row.locale = sense.locale
          row.device = sense.device
          row.vw = sense.vw
          row.clicks = Math.min(30000, b.clicks)
          row.entry = !sentEntry
          row.ref = sense.ref
        }
        rows.push(row)
      }
      if (rows.length) {
        let { error } = await supabase.from('app_usage_beats').insert(rows)
        if (error && !legacyShape && /column/i.test(error.message || '')) {
          // v1 table — retry once with the legacy shape, then stay legacy
          legacyShape = true
          const legacyRows = rows.map(({ app, page, secs, user_id, client_id, session_id, local_hour, local_dow }) =>
            ({ app, page, secs, user_id, client_id, session_id, local_hour, local_dow }))
          ;({ error } = await supabase.from('app_usage_beats').insert(legacyRows))
        }
        if (error) {
          // table missing / offline — put the seconds back and retry later
          for (const r of rows) bump(r.page, r.secs, r.clicks || 0)
        } else {
          sentEntry = true
        }
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
    window.removeEventListener('pointerdown', onClick, { capture: true })
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onHide)
    void flush()
  }
}

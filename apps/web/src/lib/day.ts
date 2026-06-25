// ============================================================
//  LOCAL-DAY HELPERS
//  The day boundary that matters for streaks, daily quests, and the daily
//  activity rings is the KID'S LOCAL midnight — NOT UTC. Computing "today" with
//  toISOString() (UTC) rolls the day at, e.g., 3 AM in Qatar (UTC+3), so after
//  local midnight yesterday's progress lingered until 3 AM. These helpers use
//  the browser's local calendar (getFullYear/Month/Date are already local).
// ============================================================

/** Minutes to ADD to a UTC instant to get local wall-clock time (UTC+3 → +180).
 *  Passed to server RPCs so the cloud can compute the same local-day window. */
export function tzOffsetMin(): number {
  return -new Date().getTimezoneOffset()
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Local 'YYYY-MM-DD' for 24h ago — used by streaks to detect "played yesterday". */
export function localYesterday(): string {
  return localDay(new Date(Date.now() - 864e5))
}

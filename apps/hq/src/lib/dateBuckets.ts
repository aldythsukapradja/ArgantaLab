// Date buckets — the Today / Yesterday / This week grouping Claude and ChatGPT
// use for history lists. Shared so the Post Library timeline and any other
// chronological list agree on where a given day belongs.
//
// Bucketing is by CALENDAR DAY, not elapsed hours: something posted at 11pm last
// night belongs under "Yesterday" at 1am, not "2h ago" filed under Today. Hour
// maths gets this wrong in exactly the case people notice.

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const DAY = 86_400_000

export function dateBucket(iso: string, now = new Date()): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return 'Undated'
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days <= 7) return 'This week'
  if (days <= 30) return 'This month'
  return t.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

/**
 * Group an already-sorted (newest-first) list into buckets, preserving order.
 * Insertion order gives the right bucket order for free — no bucket ranking to
 * keep in sync with dateBucket().
 */
export function groupByDate<T>(rows: T[], iso: (r: T) => string, now = new Date()): { label: string; rows: T[] }[] {
  const out: { label: string; rows: T[] }[] = []
  for (const r of rows) {
    const label = dateBucket(iso(r), now)
    const g = out.find(x => x.label === label)
    if (g) g.rows.push(r); else out.push({ label, rows: [r] })
  }
  return out
}

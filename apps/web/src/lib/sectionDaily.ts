import { pkey } from './player'
import { localDay } from './day'
import { memStore } from './memStore'

// ============================================================
//  PER-SECTION DAILY ACTIVITY  (drives the "not done today" dots)
//  A world's sub-tabs (Journey / Drills / Openworld) each show a nudge dot until
//  the kid has done that section TODAY. The Journey reads its own per-node daily
//  state (learnProgress.nodeDoneToday); Drills and Openworld are repeatable with
//  no node state, so we record one timestamp per (world, section) here. Same
//  per-kid namespace + local-day boundary as the rest of the daily logic.
// ============================================================

const KEY = 'argantalab_section_daily_v1'
type Store = Record<string, string>  // `${world}/${section}` → local 'YYYY-MM-DD'

function load(): Store {
  try { return JSON.parse(memStore.getItem(pkey(KEY)) || '{}') } catch { return {} }
}
function save(s: Store) { try { memStore.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ } }

/** Record that the kid completed a round of this section today. */
export function markSectionToday(world: string, section: 'drills' | 'openworld') {
  const s = load()
  s[`${world}/${section}`] = localDay()
  save(s)
}

/** Has the kid done this section TODAY? (false → the sub-tab shows a nudge dot.) */
export function sectionDoneToday(world: string, section: 'drills' | 'openworld'): boolean {
  return load()[`${world}/${section}`] === localDay()
}

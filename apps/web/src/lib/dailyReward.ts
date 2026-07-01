// Daily "all six rings" reward — when a kid fills every Home ring in a day they
// can claim a one-time diamond bonus. Claim state is per-kid (pkey) and keyed to
// the kid's LOCAL day, so it resets every midnight. The diamonds themselves are
// minted through the server wallet (ledger truth); this only guards the once/day.
import { pkey } from './player'
import { localDay } from './day'

const KEY = 'argantalab_ringgift_v1'
const CELEB_KEY = 'argantalab_ringceleb_v1'
export const DAILY_RING_REWARD = 100

/** Has today's reward already been claimed on this device? */
export function ringRewardClaimedToday(): boolean {
  try { return localStorage.getItem(pkey(KEY)) === localDay() } catch { return false }
}

/** Mark today's reward claimed. Returns false if it was already claimed. */
export function claimRingReward(): boolean {
  if (ringRewardClaimedToday()) return false
  try { localStorage.setItem(pkey(KEY), localDay()) } catch { /* ignore */ }
  return true
}

/** Has today's "North Star complete" celebration already popped? */
export function celebrationSeenToday(): boolean {
  try { return localStorage.getItem(pkey(CELEB_KEY)) === localDay() } catch { return false }
}
/** Mark the celebration as seen so it only auto-pops once per day. */
export function markCelebrationSeen(): void {
  try { localStorage.setItem(pkey(CELEB_KEY), localDay()) } catch { /* ignore */ }
}

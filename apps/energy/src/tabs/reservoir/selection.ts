// selection.ts — the Reservoir-Management focus selection (de-identified port of the
// reference's global WLN_SELECTION + event). The explorer sets a focused well/pattern;
// every canvas tab reads it to draw a grey "cohort" of all wells with the selected
// members highlighted as "focus". A tiny external store + useSyncExternalStore hook.
import { useSyncExternalStore } from 'react';

export interface RMSelection { well: string | null; pattern: string | null }
let state: RMSelection = { well: null, pattern: null };
const subs = new Set<() => void>();

export function setSelection(patch: Partial<RMSelection>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
export function getSelection(): RMSelection { return state; }
function subscribe(fn: () => void) { subs.add(fn); return () => subs.delete(fn); }

export function useSelection(): RMSelection {
  return useSyncExternalStore(subscribe, getSelection, getSelection);
}

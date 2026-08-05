// use-view-mode.ts — let a cross-surface shortcut land on the right view.
//
// `requestView({ nav, mode })` already carried a knowledge/workspace mode, but
// no vertical read it: CosmoShell consumed `nav` and the mode was dropped, so
// every shortcut landed on whatever the shell defaults to. This is the missing
// reader, shared by all five verticals so they cannot drift.
//
// Deliberately keyed on `seq`, matching the store's contract: intents are never
// consumed centrally, so each reader takes the part it owns and re-fires when
// the sequence advances — including on a repeat of an identical request.
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { useStore } from '../store';

/**
 * Takes the setter directly so `M` infers from the vertical's own mode union
 * rather than having to be spelled at every call site. The cast is safe by
 * construction: `ViewIntent.mode` is 'knowledge' | 'workspace', and every
 * vertical's mode union contains both.
 */
export function useViewMode<M>(nav: string, setMode: Dispatch<SetStateAction<M>>) {
  const viewIntent = useStore((s) => s.viewIntent);
  useEffect(() => {
    if (viewIntent?.nav !== nav || !viewIntent.mode) return;
    setMode(viewIntent.mode as M);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewIntent?.seq]);
}

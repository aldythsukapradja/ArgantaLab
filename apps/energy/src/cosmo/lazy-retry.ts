// lazy-retry.ts — React.lazy, but a transient import failure doesn't brick the surface.
//
// THE PROBLEM: React.lazy caches the result of its factory, INCLUDING a rejection. If the
// dynamic import fails once — a module fetched while the dev server was mid-write, Vite's
// "504 Outdated Optimize Dep" after a dependency change, or a dropped chunk request on a
// flaky network in production — that surface throws the same cached error forever.
// Remounting does not help (the cache lives on the lazy object, not the component), so the
// only recovery is a full page reload. One hiccup, one dead tab.
//
// THE FIX: retry INSIDE the factory. React only ever observes a rejection if every attempt
// failed, so a surface that was briefly unavailable simply loads on the next attempt.
import { lazy, type ComponentType } from 'react';

/** Lazily load a surface, retrying a failed dynamic import before giving up.
 *  `any` mirrors React.lazy's own constraint — narrowing it breaks prop inference. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  attempts = 3,
  delayMs = 350,
) {
  return lazy(async () => {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await factory();
      } catch (err) {
        last = err;
        // back off a little so a dev server that is still writing/optimising can finish
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw last;
  });
}

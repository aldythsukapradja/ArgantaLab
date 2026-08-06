// agent/useAgentCockpit.ts — the browser half of the local agent cockpit.
//
// Publishes what the operator is looking at, and accepts commands back. Both
// halves are DEV ONLY: the whole hook short-circuits under
// import.meta.env.DEV === false, and the routes it talks to exist only in the
// Vite dev server (see vite-plugin-agent-cockpit.ts).
//
// WHY STATE AND NOT SCREENSHOTS. A screenshot forces an agent to infer "which
// well is selected" from pixels, and it will sometimes infer wrong with total
// confidence. The app already KNOWS. Publishing the real values means the agent
// reads `{ well: "F-11 A" }` rather than guessing at a label it half-recognises.
//
// WHY THE EXISTING BUS AND NOT SYNTHETIC CLICKS. Incoming commands go through
// the same store actions the in-app agent uses. Nothing here can reach into the
// DOM, invent an interaction, or perform an operation the UI does not offer —
// the four ops ARE the vocabulary. Driving the app from outside is therefore
// bounded by a decision already made when the bus was written, rather than by
// how carefully this file behaves.

import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { AgentCommand } from './types.ts';

const POLL_MS = 1000;
const PUBLISH_DEBOUNCE_MS = 250;

/** Only these reach the store. The dev server filters too — this is the second
 *  gate, because the browser must not trust a file it did not write. */
const ALLOWED = new Set(['scope', 'view', 'map', 'clear']);

export interface CockpitState {
  /** What the operator is looking at, in the app's own vocabulary. */
  nav: string | null;
  mode?: string | null;
  scope: Record<string, string | null>;
  breadcrumb: string;
  /** ISO. Lets a reader tell live state from a stale file left by a dead run. */
  at: string;
}

export function useAgentCockpit(extra: { nav?: string | null; mode?: string | null; breadcrumb?: string } = {}) {
  const scope = useStore((s) => s.scope);
  const setScope = useStore((s) => s.setScope);
  const requestView = useStore((s) => s.requestView);
  const requestMap = useStore((s) => s.requestMap);
  const clearScopeLevel = useStore((s) => s.clearScopeLevel);
  const lastSent = useRef('');

  // ── publish ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const t = setTimeout(() => {
      const flat: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(scope ?? {})) {
        // Scope levels hold refs; the agent wants the NAME it would type back.
        flat[k] = v && typeof v === 'object' && 'name' in (v as object)
          ? String((v as { name?: unknown }).name ?? '')
          : (typeof v === 'string' ? v : null);
      }
      const body: CockpitState = {
        nav: extra.nav ?? null,
        mode: extra.mode ?? null,
        scope: flat,
        breadcrumb: extra.breadcrumb ?? '',
        at: new Date().toISOString(),
      };
      const json = JSON.stringify(body);
      // Identical state is not news. Rewriting the file on every render would
      // make `at` churn and make a watching agent think something changed.
      if (json.replace(/"at":"[^"]*"/, '') === lastSent.current) return;
      lastSent.current = json.replace(/"at":"[^"]*"/, '');
      void fetch('/__agent/state', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: json,
      }).catch(() => { /* dev route absent — nothing to do, and nothing to say */ });
    }, PUBLISH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [scope, extra.nav, extra.mode, extra.breadcrumb]);

  // ── steer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/__agent/commands');
        if (!res.ok) return;
        const queued: AgentCommand[] = await res.json();
        if (!alive || !Array.isArray(queued) || !queued.length) return;
        for (const c of queued) {
          if (!ALLOWED.has(c.op)) continue;
          if (c.op === 'scope') setScope(c.patch, { autofill: c.autofill, reroot: c.reroot });
          else if (c.op === 'view') requestView(c.view);
          else if (c.op === 'map') requestMap(c.map);
          else if (c.op === 'clear' && c.level) clearScopeLevel(c.level);
        }
        // eslint-disable-next-line no-console
        console.info(`[cockpit] applied ${queued.length} command(s) from .agent/commands.json`);
      } catch { /* dev route absent */ }
    };
    const iv = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [setScope, requestView, requestMap, clearScopeLevel]);
}

// agent/bridge/useBridge.ts — the React seam onto the Arganta Bridge.
//
// One connection, one place. The event HANDLER is stored in a ref rather than a
// dependency, so the caller (CosmoChat) can pass a fresh closure every render —
// the common "latest callback" pattern — without `connect` needing to be
// recreated or the socket needing to be re-opened.
//
// Deliberately thin: no mission history, no replay, no Supabase persistence.
// Those are HQ features (apps/hq/src/lib/missions.ts) backed by HQ's own
// Supabase project; apps/energy has none of that, so this hook is a live
// console only — exactly what a first pass needs.

import { useCallback, useEffect, useRef, useState } from 'react';
import { BridgeClient, type BridgeEvent, type BridgeStatus } from './client.ts';

export type BridgeEngine = 'claude' | 'codex';

export interface UseBridge {
  status: BridgeStatus;
  /** Register the event sink. Safe to call every render — it only updates a ref. */
  onEvent: (handler: (e: BridgeEvent) => void) => void;
  connect: (token: string, url?: string) => Promise<void>;
  disconnect: () => void;
  startMission: (prompt: string, opts?: { cwd?: string; missionId?: string; model?: string; engine?: BridgeEngine }) => string | undefined;
  respondApproval: (approvalId: string, approved: boolean, input?: unknown) => void;
}

export function useBridge(): UseBridge {
  const clientRef = useRef<BridgeClient | null>(null);
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const handlerRef = useRef<(e: BridgeEvent) => void>(() => {});

  const onEvent = useCallback((handler: (e: BridgeEvent) => void) => { handlerRef.current = handler; }, []);

  const connect = useCallback((token: string, url?: string): Promise<void> => {
    clientRef.current?.close();
    const client = new BridgeClient({ token, url: url || undefined });
    client.onStatus = setStatus;
    client.onEvent = (e) => handlerRef.current(e);
    clientRef.current = client;
    return client.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
  }, []);

  const startMission = useCallback((prompt: string, opts?: { cwd?: string; missionId?: string; model?: string; engine?: BridgeEngine }) =>
    clientRef.current?.startMission(prompt, opts), []);

  const respondApproval = useCallback((approvalId: string, approved: boolean, input?: unknown) =>
    clientRef.current?.respondApproval(approvalId, approved, input), []);

  // Close the socket if the console unmounts (nav away) rather than leaking it.
  useEffect(() => () => { clientRef.current?.close(); }, []);

  return { status, onEvent, connect, disconnect, startMission, respondApproval };
}

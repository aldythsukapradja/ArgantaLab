"use client";

// ─── useRunner ───────────────────────────────────────────────────────────────
//
// Live view of the durable run ledger for the Library surface. Recording itself
// happens centrally inside fabric.generateImage (create → attach → complete/
// failed), so this hook is a pure reader that re-lists whenever the store emits
// a change. Refresh-safe: the ledger lives in the store (Supabase or
// localStorage), so a mid-generation refresh leaves a 'pending' row, not a loss.

import { useState, useEffect, useCallback } from 'react';
import { listRuns, subscribe, storeBackend } from './store.js';

export function useRunner() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setRuns(await listRuns());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return { runs, loading, refresh, backend: storeBackend() };
}

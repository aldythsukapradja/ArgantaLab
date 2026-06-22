// ============================================================
//  IN-MEMORY STORE  — the cloud is the single source of truth.
//  Progress, mastery, and games live here ONLY for the current
//  session (so the sync gameplay code stays fast & synchronous);
//  nothing is written to localStorage, so devices never diverge.
//  CloudSync clears this on user switch and rehydrates from cloud.
// ============================================================
const mem = new Map<string, string>()

export const memStore = {
  getItem(key: string): string | null { return mem.has(key) ? mem.get(key)! : null },
  setItem(key: string, value: string): void { mem.set(key, value) },
  removeItem(key: string): void { mem.delete(key) },
  clear(): void { mem.clear() },
}

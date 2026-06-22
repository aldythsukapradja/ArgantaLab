// ============================================================
//  PARENT GATE  — the passcode that protects the grown-up area
//  A kid must NEVER be able to reach parent reports/controls by
//  tapping "Grown-up". This passcode (kids don't know it) gates
//  entry, replacing the old "solve a sum" math gate.
//  Stored hashed locally for now; moves to cloud auth later.
// ============================================================

const KEY = 'argantalab_parent_gate_v1'

// djb2 — light obfuscation so the code isn't sitting in plain text.
// (Not real crypto; the cloud version will use a proper password hash.)
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function hasPasscode(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

export function setPasscode(code: string) {
  try { localStorage.setItem(KEY, hash(code)) } catch { /* ignore */ }
}

export function verifyPasscode(code: string): boolean {
  try { return localStorage.getItem(KEY) === hash(code) } catch { return false }
}

export function clearPasscode() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

import { pkey } from './player'

// The kid pins ONE shop item (a cosmetic or a mount) as their saving-up goal. A
// progress bar toward it (diamonds ÷ price) gives a clear "keep learning to get
// that" target — the core retention loop. Per-kid (pkey); fires a window event
// so any open goal banner refreshes instantly.
export interface Wish { id: string; name: string; price: number; kind: 'cosmetic' | 'mount'; tint?: string }
const KEY = 'argantalab_wish_v1'

export function getWish(): Wish | null {
  try { return JSON.parse(localStorage.getItem(pkey(KEY)) || 'null') } catch { return null }
}
export function setWish(w: Wish | null) {
  try { if (w) localStorage.setItem(pkey(KEY), JSON.stringify(w)); else localStorage.removeItem(pkey(KEY)) } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('alab:wish')) } catch { /* ignore */ }
}

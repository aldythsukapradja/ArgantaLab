import { useEffect, useState } from 'react'
import { CATALOGUE } from '../../data/pixel/catalogue'
import { PALETTES } from '../../data/pixel/palettes'
import { loadVaultFromCloud } from '../../data/pixel/cloud'
import type { VaultItem, Palette } from '../../data/pixel/types'

export interface VaultData { items: VaultItem[]; palettes: Palette[]; source: 'seed' | 'cloud'; loading: boolean }

// Loads the vault from Supabase when signed in; always falls back to the seed so
// the tab renders offline and never breaks. The seed is the instant first paint.
export function useVault(): VaultData {
  const [data, setData] = useState<VaultData>({ items: CATALOGUE, palettes: PALETTES, source: 'seed', loading: true })
  useEffect(() => {
    let alive = true
    loadVaultFromCloud()
      .then(res => {
        if (!alive) return
        if (res && res.items.length) setData({ items: res.items, palettes: res.palettes.length ? res.palettes : PALETTES, source: 'cloud', loading: false })
        else setData(d => ({ ...d, loading: false }))
      })
      .catch(() => { if (alive) setData(d => ({ ...d, loading: false })) })
    return () => { alive = false }
  }, [])
  return data
}

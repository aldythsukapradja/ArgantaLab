// ============================================================
//  ARGANTALAB · WishlistGoal — the "next goal" progress pin
//  Shows the item the kid is saving for + a progress bar (diamonds ÷ price) and
//  "N 💎 to go". Tapping opens the right shop. The dopamine driver: a concrete,
//  visible target that keeps them learning to earn. Renders nothing if unpinned.
// ============================================================

import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { getWish, type Wish } from '@lib/wishlist'

export default function WishlistGoal({ onOpen }: { onOpen: (kind: 'cosmetic' | 'mount') => void }) {
  const diamonds = useAppStore(s => s.diamonds)
  const [wish, setWish] = useState<Wish | null>(getWish())

  useEffect(() => {
    const h = () => setWish(getWish())
    window.addEventListener('alab:wish', h)
    return () => window.removeEventListener('alab:wish', h)
  }, [])

  if (!wish) return null
  const pct = Math.min(100, Math.round((diamonds / Math.max(1, wish.price)) * 100))
  const toGo = Math.max(0, wish.price - diamonds)
  const ready = toGo === 0

  return (
    <button className={`wish-goal${ready ? ' ready' : ''}`} style={{ ['--wt' as string]: wish.tint ?? '#f59e0b' }} onClick={() => onOpen(wish.kind)}>
      <div className="wish-top">
        <b>🎯 Saving for {wish.name}</b>
        <span>{ready ? 'Ready — go get it! 🎉' : `${toGo.toLocaleString()} 💎 to go`}</span>
      </div>
      <div className="wish-bar"><i style={{ width: `${pct}%` }} /></div>
    </button>
  )
}

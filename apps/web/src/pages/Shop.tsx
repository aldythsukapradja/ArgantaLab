import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { shopItems, type Opt } from '@/data/wizard'

const RARITY: Record<string, { label: string; cls: string }> = {
  rare: { label: 'RARE', cls: 'rare' },
  epic: { label: 'EPIC', cls: 'epic' },
  legendary: { label: 'LEGENDARY', cls: 'legendary' },
}

export default function Shop() {
  const { diamonds, unlocks, buyItem, go } = useAppStore()
  const [filter, setFilter] = useState<'all' | 'character' | 'world'>('all')
  const items = shopItems().filter(i => filter === 'all' || i.kind === filter)
  const owned = items.filter(i => unlocks.includes(i.opt.key)).length

  return (
    <div className="shop">
      <div className="shop-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Diamond Shop</div>
          <h1 className="shop-title">Spend your 💎</h1>
          <p className="lead">Unlock special characters and worlds — then use them in the Game Wizard.</p>
        </div>
        <div className="shop-bal">
          <span className="shop-bal-n">💎 {diamonds}</span>
          <span className="shop-bal-l">your diamonds</span>
        </div>
      </div>

      <div className="shop-tabs">
        {(['all', 'character', 'world'] as const).map(t => (
          <button key={t} className={`shop-tab${filter === t ? ' on' : ''}`} onClick={() => setFilter(t)}>
            {t === 'all' ? 'Everything' : t === 'character' ? '✨ Characters' : '🌍 Worlds'}
          </button>
        ))}
        <span className="shop-owned">{owned}/{items.length} owned</span>
      </div>

      <div className="shop-grid">
        {items.map(({ opt }) => <ShopCard key={opt.key} opt={opt} owned={unlocks.includes(opt.key)}
          canAfford={diamonds >= (opt.price ?? 0)} onBuy={() => buyItem(opt.key, opt.price ?? 0, opt.label)} />)}
      </div>

      <div className="shop-foot">
        <span>Want more diamonds? Finish lessons and publish games.</span>
        <div className="shop-foot-btns">
          <button className="btn btn-ghost" onClick={() => go({ tab: 'web' })}>📚 Earn by learning</button>
          <button className="btn btn-primary" onClick={() => go({ tab: 'studio' })}>🎮 Use in Wizard</button>
        </div>
      </div>
    </div>
  )
}

function ShopCard({ opt, owned, canAfford, onBuy }: { opt: Opt; owned: boolean; canAfford: boolean; onBuy: () => void }) {
  const r = opt.rarity ? RARITY[opt.rarity] : null
  return (
    <div className={`shop-card${owned ? ' owned' : ''}${r ? ' ' + r.cls : ''}`}>
      {r && <span className="shop-rarity">{r.label}</span>}
      <div className="shop-emoji">{opt.emoji}</div>
      <h3>{opt.label}</h3>
      {owned
        ? <div className="shop-owned-tag">✓ Owned</div>
        : <button className={`shop-buy${canAfford ? '' : ' short'}`} onClick={onBuy}>💎 {opt.price}</button>}
    </div>
  )
}

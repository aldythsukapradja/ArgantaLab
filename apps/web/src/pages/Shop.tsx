import { useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { COSMETICS, SLOTS, RARITY_META, resolveOutfit, type Slot, type Cosmetic } from '@/data/cosmetics'
import { setWish } from '@lib/wishlist'
import Buddy from '@components/avatar/Buddy'

type Filter = 'all' | Slot

// The Diamond Shop: browse 80+ cosmetics, try any on the live avatar, buy with
// diamonds, then wear instantly. Roblox-style catalog.
export default function Shop() {
  const { diamonds, outfit, ownsCosmetic, buyCosmetic, equipCosmetic, go, addToast } = useAppStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [preview, setPreview] = useState<Cosmetic | null>(null)

  const list = useMemo(() => COSMETICS.filter(c => filter === 'all' || c.slot === filter), [filter])
  const featured = useMemo(() => COSMETICS.filter(c => c.rarity === 'legendary' || c.rarity === 'epic').slice(0, 6), [])
  const ownedCount = COSMETICS.filter(c => ownsCosmetic(c.id)).length

  // The avatar preview = your saved look, with the hovered item tried on top.
  const shown = useMemo(() => {
    const base = { ...outfit }
    if (preview) base[preview.slot] = preview.id
    return resolveOutfit(base)
  }, [outfit, preview])

  const buy = (c: Cosmetic) => {
    if (buyCosmetic(c.id)) equipCosmetic(c.slot, c.id)
  }
  const wear = (c: Cosmetic) => equipCosmetic(c.slot, c.id)

  return (
    <div className="screen shop2" style={{ justifyContent: 'flex-start' }}>
      <div className="shop2-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Diamond Shop</div>
          <h1 className="shop2-title">Dress up your <span className="g">buddy</span></h1>
        </div>
        <div className="shop2-head-r">
          <button className="mtshop-link" onClick={() => go({ tab: 'mounts' })}>🐎 Mount Stable →</button>
          <div className="shop2-bal"><b>💎 {diamonds}</b><span>{ownedCount}/{COSMETICS.length} owned</span></div>
        </div>
      </div>

      <div className="shop2-body">
        {/* sticky avatar preview */}
        <aside className="shop2-preview">
          <div className="shop2-preview-stage">
            <Buddy mood="happy" size={150} outfit={shown} showBg bob />
          </div>
          {preview ? (
            <div className="shop2-preview-info">
              <span className="shop2-pi-rarity" style={{ color: RARITY_META[preview.rarity].color }}>{RARITY_META[preview.rarity].label}</span>
              <b>{preview.name}</b>
              {ownsCosmetic(preview.id)
                ? <button className="shop2-pi-btn wear" onClick={() => wear(preview)}>Wear it</button>
                : <>
                  <button className="shop2-pi-btn buy" onClick={() => buy(preview)}>Buy · 💎 {preview.price}</button>
                  <button className="shop2-pi-goal" onClick={() => { setWish({ id: preview.id, name: preview.name, price: preview.price, kind: 'cosmetic', tint: RARITY_META[preview.rarity].color }); addToast(`Saving for ${preview.name} 🎯`, '⭐') }}>⭐ Set as my goal</button>
                </>}
            </div>
          ) : (
            <p className="shop2-preview-hint">Tap an item to try it on ✨</p>
          )}
        </aside>

        {/* catalog */}
        <div className="shop2-catalog">
          <div className="shop2-tabs">
            <button className={`shop2-tab${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>✨ All</button>
            {SLOTS.map(s => (
              <button key={s.key} className={`shop2-tab${filter === s.key ? ' on' : ''}`} onClick={() => setFilter(s.key)}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          {filter === 'all' && (
            <>
              <div className="section-label">⭐ Featured</div>
              <div className="shop2-feat">
                {featured.map(c => (
                  <button key={c.id} className="shop2-feat-card" onClick={() => setPreview(c)}
                    style={{ borderColor: RARITY_META[c.rarity].color }}>
                    <div className="shop2-feat-art"><Buddy mood="idle" size={64} bob={false}
                      outfit={(c.slot === 'bg' ? { bg: { render: c.render, color: c.color } } : { [c.slot]: { render: c.render, color: c.color } }) as never} showBg={c.slot === 'bg'} /></div>
                    <b>{c.name}</b>
                    <span style={{ color: RARITY_META[c.rarity].color }}>💎 {c.price}</span>
                  </button>
                ))}
              </div>
              <div className="section-label">Everything</div>
            </>
          )}

          <div className="shop2-grid">
            {list.map(c => {
              const owned = ownsCosmetic(c.id)
              const wearing = outfit[c.slot] === c.id
              const r = RARITY_META[c.rarity]
              return (
                <button key={c.id} className={`shop2-card${preview?.id === c.id ? ' sel' : ''}${owned ? ' owned' : ''}`}
                  onClick={() => setPreview(c)}>
                  <span className="shop2-card-r" style={{ background: r.color }}>{r.label}</span>
                  <div className="shop2-card-art">
                    {c.slot === 'bg'
                      ? <span className="shop2-bg-swatch" style={{ background: c.color }} />
                      : <Buddy mood="idle" size={58} bob={false}
                        outfit={{ [c.slot]: { render: c.render, color: c.color } } as never} />}
                  </div>
                  <b>{c.name}</b>
                  {wearing
                    ? <span className="shop2-card-tag wearing">Wearing</span>
                    : owned
                      ? <span className="shop2-card-tag own" onClick={e => { e.stopPropagation(); wear(c) }}>Wear</span>
                      : <span className="shop2-card-tag price">💎 {c.price}</span>}
                </button>
              )
            })}
          </div>

          <div className="shop2-foot">
            <span>Earn diamonds by finishing lessons and quests.</span>
            <button className="btn btn-primary" onClick={() => go({ tab: 'learn' })}>📚 Earn 💎</button>
          </div>
        </div>
      </div>
    </div>
  )
}

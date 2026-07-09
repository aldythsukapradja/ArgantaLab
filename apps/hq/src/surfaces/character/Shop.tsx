import { useEffect, useMemo, useState } from 'react'
import { PartThumb } from './PartBrowser'
import { useCategoryData } from './composer'
import { loadShopCatalog, loadOwnedCosmetics, buyCosmeticItem, getMyDiamondBalance, type ShopItem } from './heroData'

// 🛍️ Shop — the curated cosmetic catalog (docs/CHARACTER-FORGE-SHOP-CONCEPT.md):
// 4 categories capped at 10 items each, 2,000-10,000 💎, stats scale with price.
// Buys spend the signed-in operator's OWN diamonds (mirrors the mount shop's
// self-referential design) and unlock the item back in the Lab's picker.

const CAT_ORDER = ['helmet', 'coat', 'sword', 'shield']
const CAT_ICON: Record<string, string> = { helmet: '⛑', coat: '🧥', sword: '⚔', shield: '🛡' }

export function Shop() {
  const [catalog, setCatalog] = useState<ShopItem[]>([])
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const meta = useCategoryData(CAT_ORDER)

  async function refresh() {
    setLoading(true)
    const [cat, own, bal] = await Promise.all([loadShopCatalog(), loadOwnedCosmetics(), getMyDiamondBalance()])
    setCatalog(cat); setOwned(own); setBalance(bal); setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const groups = useMemo(() => {
    const m = new Map<string, ShopItem[]>()
    for (const it of catalog) { if (!m.has(it.cat)) m.set(it.cat, []); m.get(it.cat)!.push(it) }
    return CAT_ORDER.filter(c => m.has(c)).map(c => [c, m.get(c)!.sort((a, b) => a.price - b.price)] as const)
  }, [catalog])

  async function buy(item: ShopItem) {
    if (owned.has(item.itemKey) || buying) return
    setBuying(item.itemKey); setMsg(null)
    const r = await buyCosmeticItem(item.itemKey)
    setMsg({ ok: r.ok, text: r.message })
    if (r.ok) { setOwned(o => new Set(o).add(item.itemKey)); if (r.balance != null) setBalance(r.balance) }
    setBuying(null)
  }

  const statLine = (it: ShopItem) => [
    it.atk ? `⚔ +${it.atk} ATK` : null,
    it.def ? `🛡 +${it.def} DEF` : null,
    it.hp ? `❤ +${it.hp} HP` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="forge-shop">
      <div className="shop-head">
        <h3>🛍️ Shop</h3>
        <span className="shop-balance">💎 {balance.toLocaleString()}</span>
      </div>
      <p className="shop-note">
        Diamonds unlock a curated cosmetic piece — real ATK/DEF/HP, scaled with price but
        capped under the top Blacksmith tiers, so buying never beats crafting at the ceiling.
        Purchases apply to <b>your own signed-in account</b> and unlock back in the Lab.
      </p>
      {msg && <div className="f-npc-msg" style={{ color: msg.ok ? 'var(--ok, #16a34a)' : '#e0603a' }}>{msg.text}</div>}
      {loading ? (
        <div className="f-empty">Loading catalog…</div>
      ) : !groups.length ? (
        <div className="f-empty">Shop catalog not deployed yet — run migration_character_shop.sql.</div>
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="shop-group">
            <h4>{CAT_ICON[cat]} {items[0]?.setLabel || cat}</h4>
            <div className="shop-grid">
              {items.map(it => {
                const isOwned = owned.has(it.itemKey)
                const part = meta[it.cat]?.byId?.[it.partId]
                const afford = balance >= it.price
                return (
                  <div key={it.itemKey} className={'shop-cell' + (isOwned ? ' owned' : '')}>
                    {part ? <PartThumb cat={it.cat} part={part} /> : <div className="f-thumbc" style={{ width: 64, height: 64 }} />}
                    <div className="shop-stat">{statLine(it)}</div>
                    <div className="shop-price">{isOwned ? 'Owned ✓' : `💎 ${it.price.toLocaleString()}`}</div>
                    {!isOwned && (
                      <button className="f-gbtn" disabled={!afford || buying === it.itemKey} onClick={() => buy(it)}>
                        {buying === it.itemKey ? 'Buying…' : afford ? 'Buy' : 'Need more 💎'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

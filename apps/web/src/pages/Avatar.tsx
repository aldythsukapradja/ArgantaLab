import { useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { SLOTS, RARITY_META, cosmeticsForSlot, resolveOutfit, type Slot, type Cosmetic } from '@/data/cosmetics'
import Buddy from '@components/avatar/Buddy'

// The Roblox-style dressing room: pick a slot, tap items to try them on the
// big live avatar, then Save (or Buy any locked items you previewed).
export default function Avatar() {
  const { learnerName, setLearnerName, diamonds, outfit, ownsCosmetic, buyCosmetic, addToast } = useAppStore()
  const [slot, setSlot] = useState<Slot>('hat')
  // draft = the look you're previewing; starts from your saved outfit.
  const [draft, setDraft] = useState<Record<Slot, string>>({ ...outfit })

  const resolved = useMemo(() => resolveOutfit(draft), [draft])
  const items = cosmeticsForSlot(slot)

  // Items in the draft you don't own yet (must buy before saving).
  const lockedInDraft = useMemo(
    () => (Object.values(draft).filter(Boolean) as string[]).filter(id => !ownsCosmetic(id)),
    [draft, ownsCosmetic],
  )
  const totalLockedCost = lockedInDraft.reduce((sum, id) => sum + (costFor(id) ?? 0), 0)
  const dirty = (Object.keys(draft) as Slot[]).some(s => draft[s] !== outfit[s])

  const tryOn = (it: Cosmetic) => {
    setDraft(d => {
      const isOn = d[it.slot] === it.id
      // skin & bg always keep a value; others toggle off when re-tapped
      const next = isOn && it.slot !== 'skin' && it.slot !== 'bg' ? '' : it.id
      return { ...d, [it.slot]: next }
    })
  }

  const saveLook = () => {
    if (lockedInDraft.length) {
      // buy each locked item, then commit
      let ok = true
      for (const id of lockedInDraft) if (!buyCosmetic(id)) ok = false
      if (!ok) return
    }
    useAppStore.setState({ outfit: { ...draft } })
    addToast('Look saved! 😎', '✨')
  }

  const reset = () => setDraft({ ...outfit })

  const editName = () => {
    const n = prompt('Your avatar name:', learnerName)
    if (n && n.trim()) setLearnerName(n.trim())
  }

  return (
    <div className="screen rbx" style={{ justifyContent: 'flex-start' }}>
      {/* ── live preview stage ── */}
      <div className="rbx-stage">
        <div className="rbx-stage-glow" />
        <div className="rbx-avatar">
          <Buddy mood="happy" size={230} outfit={resolved} showBg bob />
        </div>
        <div className="rbx-platform" />
        <button className="rbx-name" onClick={editName}>{learnerName} <span>✏️</span></button>
        <div className="rbx-bal">💎 {diamonds}</div>
      </div>

      {/* ── slot selector ── */}
      <div className="rbx-slots">
        {SLOTS.map(s => (
          <button key={s.key} className={`rbx-slot${slot === s.key ? ' on' : ''}`} onClick={() => setSlot(s.key)}>
            <span className="rbx-slot-ic">{s.emoji}</span>
            <span className="rbx-slot-lb">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── item grid ── */}
      <div className="rbx-grid">
        {items.map(it => {
          const owned = ownsCosmetic(it.id)
          const wearing = draft[it.slot] === it.id
          const r = RARITY_META[it.rarity]
          const previewOutfit = it.slot === 'bg'
            ? { bg: { render: it.render, color: it.color } }
            : { skin: it.slot === 'skin' ? { render: it.render, color: it.color } : { render: 'default', color: '#8b5cf6' }, [it.slot]: { render: it.render, color: it.color } }
          return (
            <button key={it.id} className={`rbx-card${wearing ? ' on' : ''}${!owned ? ' locked' : ''}`}
              style={wearing ? { borderColor: r.color } : undefined} onClick={() => tryOn(it)}>
              <span className="rbx-rarity" style={{ background: r.color }}>{r.label}</span>
              <div className="rbx-card-art" style={{ background: it.slot === 'bg' ? it.color : undefined }}>
                {it.slot === 'bg'
                  ? <span className="rbx-bg-dot" style={{ background: it.color }} />
                  : <Buddy mood="idle" size={66} bob={false} outfit={previewOutfit as never} />}
              </div>
              <b>{it.name}</b>
              {wearing
                ? <span className="rbx-tag wearing">Wearing ✓</span>
                : owned
                  ? <span className="rbx-tag own">Owned</span>
                  : <span className="rbx-tag price">💎 {it.price}</span>}
            </button>
          )
        })}
      </div>

      {/* ── action bar ── */}
      <div className="rbx-actions">
        {dirty && <button className="rbx-btn ghost" onClick={reset}>↩ Reset</button>}
        {lockedInDraft.length > 0
          ? <button className="rbx-btn buy" onClick={saveLook}>🛒 Buy &amp; wear · 💎 {totalLockedCost}</button>
          : <button className="rbx-btn save" disabled={!dirty} onClick={saveLook}>{dirty ? '💾 Save look' : '✓ Looking good'}</button>}
      </div>
    </div>
  )
}

function costFor(id: string): number | undefined {
  const slot = id.split(':')[0] as Slot
  return cosmeticsForSlot(slot).find(c => c.id === id)?.price
}

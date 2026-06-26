import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { MOUNTS, type MountDef } from '@/data/openworld/mounts'
import { RARITY_META } from '@/data/cosmetics'
import { myMounts, buyMount, equipMount } from '@lib/mounts'
import { setWish } from '@lib/wishlist'
import AvatarSprite from '@components/openworld/AvatarSprite'
import MountSprite from '@components/openworld/MountSprite'

// The Mount Shop: browse rides, try any on your live avatar, buy with diamonds
// (server-authoritative), and equip the one you'll ride into every Openworld.
// Diamonds buy cosmetics/mounts only — a mount's perk is a gentle helper, never
// a way to buy learning progress.

const GATE_LABEL: Record<string, string> = { none: '', swim: '🌊 Swim world', flier: '🕊️ Flier world' }
const PERK_LABEL: Record<string, string> = {
  energyStart: '+Energy on your first correct answer',
  guardOnce: 'Shrug off the first hit each battle',
  captureBoost: 'Befriend kin far more easily',
  comboKeep: 'Keep your combo through one slip',
}

export default function MountShop() {
  const { diamonds, addToast, go } = useAppStore()
  const [owned, setOwned] = useState<string[]>([])
  const [equipped, setEquipped] = useState<string | null>(null)
  const [preview, setPreview] = useState<MountDef>(MOUNTS[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => { myMounts().then(m => { setOwned(m.owned); setEquipped(m.equipped) }) }, [])

  const isOwned = (m: MountDef) => owned.includes(m.id)
  const isEquipped = (m: MountDef) => equipped === m.id

  const buy = async (m: MountDef) => {
    if (busy) return
    if (isOwned(m)) return wear(m)
    if (diamonds < m.price) { addToast(`Need 💎 ${m.price} — keep learning to earn more!`, '💎'); return }
    setBusy(true)
    const r = await buyMount(m.id)
    setBusy(false)
    if (!r.ok) { addToast(r.error === 'insufficient' ? 'Not enough diamonds yet' : 'Could not buy — try again', '⚠️'); return }
    setOwned(o => o.includes(m.id) ? o : [...o, m.id])
    addToast(`${m.name} is yours! 🎉`, '🐎')
    wear(m) // auto-equip a fresh buy
  }

  const wear = async (m: MountDef) => {
    setEquipped(m.id)                 // optimistic
    const ok = await equipMount(m.id)
    if (ok) addToast(`Riding ${m.name}`, '🐎')
    else { setEquipped(equipped); addToast('Could not equip', '⚠️') }
  }

  const unequip = async () => {
    const prev = equipped
    setEquipped(null)
    if (!(await equipMount(null))) setEquipped(prev)
  }

  // The stage shows your avatar riding the previewed mount (or the equipped one).
  const ridden = preview?.render ?? (equipped ? equipped : undefined)

  return (
    <div className="screen shop2" style={{ justifyContent: 'flex-start' }}>
      <div className="shop2-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Mount Stable</div>
          <h1 className="shop2-title">Pick your <span className="g">ride</span></h1>
        </div>
        <div className="shop2-bal"><b>💎 {diamonds}</b><span>{owned.length}/{MOUNTS.length} owned</span></div>
      </div>

      <div className="shop2-body">
        <aside className="shop2-preview">
          <div className="shop2-preview-stage mtshop-stage">
            <AvatarSprite mood="happy" size={170} mount={ridden} bob />
          </div>
          {preview && (
            <div className="shop2-preview-info">
              <span className="shop2-pi-rarity" style={{ color: RARITY_META[preview.rarity].color }}>{RARITY_META[preview.rarity].label}</span>
              <b>{preview.name}</b>
              <small className="mtshop-perk">{PERK_LABEL[preview.perk]}</small>
              {GATE_LABEL[preview.gate] && <small className="mtshop-gate">{GATE_LABEL[preview.gate]}</small>}
              {isEquipped(preview)
                ? <button className="shop2-pi-btn wear" onClick={unequip}>✓ Riding · tap to dismount</button>
                : isOwned(preview)
                  ? <button className="shop2-pi-btn wear" onClick={() => wear(preview)}>Ride it</button>
                  : <>
                    <button className="shop2-pi-btn buy" disabled={busy} onClick={() => buy(preview)}>Buy · 💎 {preview.price}</button>
                    <button className="shop2-pi-goal" onClick={() => { setWish({ id: preview.id, name: preview.name, price: preview.price, kind: 'mount', tint: preview.color }); addToast(`Saving for ${preview.name} 🎯`, '⭐') }}>⭐ Set as my goal</button>
                  </>}
            </div>
          )}
          <button className="mtshop-link" onClick={() => go({ tab: 'shop' })}>👕 Cosmetics shop →</button>
        </aside>

        <div className="shop2-grid mtshop-grid">
          {MOUNTS.map(m => (
            <button key={m.id} className={`shop2-card mtshop-card${preview?.id === m.id ? ' sel' : ''}${isOwned(m) ? ' owned' : ''}`}
              style={{ ['--rc' as string]: RARITY_META[m.rarity].color }}
              onClick={() => setPreview(m)}>
              <span className="mtshop-card-art"><MountSprite render={m.render} color={m.color} size={86} /></span>
              <b className="mtshop-card-name">{m.name}</b>
              <span className="mtshop-card-foot">
                {isEquipped(m) ? <em className="mtshop-eq">Riding</em>
                  : isOwned(m) ? <em className="mtshop-own">Owned</em>
                  : <em>💎 {m.price}</em>}
              </span>
              {m.gate !== 'none' && <span className="mtshop-gatepill" title={GATE_LABEL[m.gate]}>{m.gate === 'swim' ? '🌊' : '🕊️'}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

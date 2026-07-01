import { useState } from 'react'
import { createPortal } from 'react-dom'
import Avatar from '@/pages/Avatar'
import Shop from '@/pages/Shop'
import MountShop from '@/pages/MountShop'

// One wardrobe: Style · Shop · Mounts in a single bottom sheet, opened by the
// floating hanger button on Home. Replaces the old Me/Style/Shop tab strip and
// folds the Mount Stable in, so all cosmetics live in one place.
export default function StyleShop({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'style' | 'shop' | 'mounts'>('style')
  return createPortal(
    <div className="ss-wrap" onClick={onClose}>
      <div className="ss-sheet" onClick={e => e.stopPropagation()}>
        <div className="ss-head">
          <div className="ss-tabs">
            <button className={`ss-tab${tab === 'style' ? ' on' : ''}`} onClick={() => setTab('style')}>👕 Style</button>
            <button className={`ss-tab${tab === 'shop' ? ' on' : ''}`} onClick={() => setTab('shop')}>🛍️ Shop</button>
            <button className={`ss-tab${tab === 'mounts' ? ' on' : ''}`} onClick={() => setTab('mounts')}>🐎 Mounts</button>
          </div>
          <button className="ss-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="ss-body">
          {tab === 'style' && <Avatar />}
          {tab === 'shop' && <Shop />}
          {tab === 'mounts' && <MountShop />}
        </div>
      </div>
    </div>,
    document.body,
  )
}

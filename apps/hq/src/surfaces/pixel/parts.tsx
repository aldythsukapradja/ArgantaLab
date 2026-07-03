import { useEffect, useRef, useState } from 'react'
import { TIERS } from '../../data/pixel/engine'
import { signedThumb } from '../../data/pixel/cloud'
import type { Tier, VaultItem } from '../../data/pixel/types'

// Deterministic PRNG so a given id always renders the same motif (no flicker,
// no fake "real sprite" — this is an honest metadata stand-in from the swatch).
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed: number) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1000) / 1000 } }

// Real art when we have it (thumbUrl → owned/CC0/synced), otherwise a generated
// stand-in drawn from the swatch colors (honest: never the copyrighted pixels).
export function Swatch({ item, px = 84 }: { item: VaultItem; px?: number }) {
  // real art: a local/absolute thumbUrl, else a lazily-signed private-bucket path
  const [signed, setSigned] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!item.form.thumbUrl && item.form.storagePath) signedThumb(item.form.storagePath).then(u => { if (alive) setSigned(u) })
    return () => { alive = false }
  }, [item.form.thumbUrl, item.form.storagePath])
  const url = item.form.thumbUrl ?? signed
  if (url) {
    return <img src={url} alt={item.name} width={px} height={px} loading="lazy"
      style={{ width: px, height: px, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 6, background: 'repeating-conic-gradient(var(--bg3) 0% 25%, transparent 0% 50%) 0 0/12px 12px' }} />
  }
  return <SwatchStandIn item={item} px={px} />
}

function SwatchStandIn({ item, px }: { item: VaultItem; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    const cols = item.form.swatch?.length ? item.form.swatch : ['#6b7aa8', '#3a4466', '#c0cbdc']
    const n = 8, cell = px / n
    const tiley = item.curated.kind === 'tile' || item.curated.kind === 'tileset' || item.curated.kind === 'background'
    const r = rng(hash(item.id))
    ctx.clearRect(0, 0, px, px)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < (tiley ? n : Math.ceil(n / 2)); x++) {
        const roll = r()
        if (!tiley && roll < 0.35) continue                  // transparency for sprites
        const col = cols[Math.floor(r() * cols.length)]
        ctx.fillStyle = col
        ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5)
        if (!tiley) ctx.fillRect((n - 1 - x) * cell, y * cell, cell + 0.5, cell + 0.5)  // mirror
      }
    }
  }, [item, px])
  return <canvas ref={ref} width={px} height={px} style={{ width: px, height: px, imageRendering: 'pixelated', borderRadius: 6, background: 'repeating-conic-gradient(var(--bg3) 0% 25%, transparent 0% 50%) 0 0/12px 12px' }} />
}

export function TierChip({ tier, small }: { tier: Tier; small?: boolean }) {
  const t = TIERS[tier]
  return (
    <span title={t.rule} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: small ? 9.5 : 11, fontWeight: 700, color: t.color, border: `1px solid ${t.color}`, borderRadius: 999, padding: small ? '1px 6px' : '2px 8px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.color }} /> {tier} · {t.label}
    </span>
  )
}

export function AnimBadge({ item }: { item: VaultItem }) {
  if (!item.animations.length) return null
  const frames = item.animations.reduce((a, b) => a + b.frames, 0)
  return <span className="pill pill-mut" style={{ fontSize: 9.5 }} title={item.animations.map(a => `${a.name} ${a.frames}f×${a.directions}dir`).join(', ')}>▶ {item.animations.length} anim · {frames}f</span>
}

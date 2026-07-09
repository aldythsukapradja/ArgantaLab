import { useEffect, useMemo, useRef, useState } from 'react'
import { data } from '@arganta/heroes-engine'

// PartBrowser — the "browse collection" pop-up, ported from Kingdom's Character
// Lab. Shows sprite thumbnails in a grid grouped by set; only the open group's
// sheets load, so browsing 800+ parts stays fast. Draws each part's idle-south
// frame onto a small canvas from the same sheets the compositor uses.

type Entry = { key: string; cat: string; part: any; label: string; group: string }

export function PartThumb({ cat, part, size = 64 }: { cat: string; part: any; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const sheet = await data.loadImage(data.sheetUrl(cat, part))
        if (!live || !ref.current) return
        const anim = part.animations?.NormalStandBySouth || part.animations?.WeaponStandBySouth
          || Object.values(part.animations || {}).find((a: any) => a?.length)
        const fi = anim?.[0]?.frame ?? 0
        const fm = part.frames[fi] || part.frames.find(Boolean)
        if (!fm) return
        const ctx = ref.current.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, size, size)
        const s = Math.min(2, Math.min(size / Math.max(1, fm.w), size / Math.max(1, fm.h)))
        ctx.drawImage(sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h,
          (size - fm.w * s) / 2, (size - fm.h * s) / 2, fm.w * s, fm.h * s)
      } catch { /* sheet missing */ }
    })()
    return () => { live = false }
  }, [cat, part.id])
  return <canvas ref={ref} width={size} height={size} className="f-thumbc" />
}

export function PartBrowser({ title, entries, value, onPick, onClose, lockedKeys, onLocked }: {
  title: string; entries: Entry[]; value: string | null;
  onPick: (e: Entry) => void; onClose: () => void
  // Shop-gated cosmetics: keys in `lockedKeys` (e.g. 'helmet:15') render 🔒'd instead
  // of picking — clicking calls onLocked so the caller can point at the Shop tab.
  // Optional: everything not in the shop catalog stays exactly as free as before.
  lockedKeys?: Set<string>; onLocked?: (e: Entry) => void
}) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>()
    const needle = q.trim().toLowerCase()
    for (const e of entries) {
      if (needle && !e.label.toLowerCase().includes(needle) && !e.group.toLowerCase().includes(needle)) continue
      if (!map.has(e.group)) map.set(e.group, [])
      map.get(e.group)!.push(e)
    }
    return [...map.entries()]
  }, [entries, q])
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  useEffect(() => {
    if (groups.length && (openGroup == null || !groups.some(([g]) => g === openGroup))) setOpenGroup(groups[0][0])
  }, [groups])

  const current = groups.find(([g]) => g === openGroup)?.[1] || []
  return (
    <div className="f-browser-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="f-browser">
        <div className="f-browser-head">
          <b>{title}</b>
          <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <button className="f-closex" onClick={onClose}>✕</button>
        </div>
        <div className="f-browser-body">
          <div className="f-browser-groups">
            {groups.map(([g, items]) => (
              <button key={g} className={g === openGroup ? 'on' : ''} onClick={() => setOpenGroup(g)}>
                {g} <small>{items.length}</small>
              </button>
            ))}
          </div>
          <div className="f-browser-grid">
            {current.map(e => {
              const locked = lockedKeys?.has(e.key)
              return (
                <button key={e.key} className={'f-bcell' + (e.key === value ? ' sel' : '') + (locked ? ' locked' : '')}
                  onClick={() => { if (locked) onLocked?.(e); else { onPick(e); onClose() } }}>
                  <PartThumb cat={e.cat} part={e.part} />
                  {locked && <span className="f-lock">🔒</span>}
                  <small>{e.label}</small>
                </button>
              )
            })}
            {!current.length && <div className="f-browser-empty">no matches</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

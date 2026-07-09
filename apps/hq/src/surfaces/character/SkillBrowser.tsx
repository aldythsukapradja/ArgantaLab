import { useEffect, useMemo, useRef, useState } from 'react'
import { data } from '@arganta/heroes-engine'

// SkillBrowser — grouped effect picker for composer skill slots, ported from
// Kingdom's Character Lab. The right panel renders one autoplaying live preview of
// whichever effect is highlighted; rows themselves never animate (keeps a 648-entry
// list fast to browse).

function effectLabel(e: any) { return `effect #${String(e?.id ?? 0).padStart(3, '0')}` }
function effectGroup(e: any) { const start = Math.floor((e?.id ?? 0) / 50) * 50; return `Effects ${String(start).padStart(3, '0')}-${String(start + 49).padStart(3, '0')}` }

function EffectLivePreview({ effect, size = 200 }: { effect: any; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true, raf = 0
    ;(async () => {
      const canvas = ref.current
      if (!canvas || !effect?.sheet || !effect?.animation?.length) return
      const ctx = canvas.getContext('2d')!
      const sheet = await data.loadImage(data.effectSheetUrl(effect))
      if (!live) return
      const total = effect.animation.reduce((sum: number, s: any) => sum + Math.min(1500, Math.max(60, s.delay || 100)), 0)
      function draw(now: number) {
        if (!live || !ref.current) return
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, size, size)
        let t = now % Math.max(1, total)
        let step = effect.animation[0]
        for (const s of effect.animation) {
          const d = Math.min(1500, Math.max(60, s.delay || 100))
          if (t < d) { step = s; break }
          t -= d
        }
        const fm = effect.frames?.[step.frame]
        if (fm) {
          const scale = Math.min(2, Math.max(0.75, Math.min((size - 30) / Math.max(1, fm.w), (size - 30) / Math.max(1, fm.h))))
          const dx = (size - fm.w * scale) / 2, dy = (size - fm.h * scale) / 2
          ctx.globalAlpha = step.alpha != null ? step.alpha : 1
          ctx.drawImage(sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h, dx, dy, fm.w * scale, fm.h * scale)
          ctx.globalAlpha = 1
        }
        raf = requestAnimationFrame(draw)
      }
      // Paint the first frame synchronously (mirrors CompositeStage) so the preview
      // isn't blank while waiting on the next rAF tick — matters on backgrounded/
      // low-priority tabs where rAF can be throttled to near-zero. draw() already
      // schedules its own next frame internally, so this single call is enough.
      draw(performance.now())
    })()
    return () => { live = false; cancelAnimationFrame(raf) }
  }, [effect?.id, size])
  return <canvas ref={ref} width={size} height={size} />
}

export function SkillBrowser({ title, effects, value, onPick, onClose }: {
  title: string; effects: any[]; value: number; onPick: (e: any) => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [previewId, setPreviewId] = useState(value)
  const entries = useMemo(() => effects
    .filter(e => e?.sheet && e?.animation?.length)
    .map(e => ({ key: `effect:${e.id}`, id: e.id, effect: e, label: effectLabel(e), group: effectGroup(e) })), [effects])
  const groups = useMemo(() => {
    const map = new Map<string, typeof entries>()
    const needle = q.trim().toLowerCase()
    for (const e of entries) {
      if (needle && !e.label.toLowerCase().includes(needle) && !String(e.id).includes(needle) && !e.group.toLowerCase().includes(needle)) continue
      if (!map.has(e.group)) map.set(e.group, [])
      map.get(e.group)!.push(e)
    }
    return [...map.entries()]
  }, [entries, q])
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  useEffect(() => {
    if (groups.length && (openGroup == null || !groups.some(([g]) => g === openGroup))) {
      const sel = groups.find(([, items]) => items.some(e => e.id === value))
      setOpenGroup(sel?.[0] || groups[0][0])
    }
  }, [groups, openGroup, value])
  const current = groups.find(([g]) => g === openGroup)?.[1] || []
  const preview = entries.find(e => e.id === previewId) || entries.find(e => e.id === value) || null

  return (
    <div className="f-browser-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="f-browser f-skill-browser" style={{ width: 'min(820px,94vw)' }}>
        <div className="f-browser-head">
          <b>{title}</b>
          <input placeholder="Search effect id or group…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <button className="f-closex" onClick={onClose}>✕</button>
        </div>
        <div className="f-browser-body f-skill-body" style={{ gridTemplateColumns: '172px 1fr 240px' }}>
          <div className="f-browser-groups">
            {groups.map(([g, items]) => (
              <button key={g} className={g === openGroup ? 'on' : ''} onClick={() => setOpenGroup(g)}>{g} <small>{items.length}</small></button>
            ))}
          </div>
          <div className="f-skill-list">
            {current.map(e => (
              <button key={e.key} className={'f-effect-row' + (e.id === value ? ' sel' : '') + (e.id === preview?.id ? ' previewing' : '')}
                onFocus={() => setPreviewId(e.id)} onClick={() => setPreviewId(e.id)}
                onDoubleClick={() => { onPick(e); onClose() }}>
                <span>{e.label}</span><small>{e.effect.animation.length} frames</small>
              </button>
            ))}
            {!current.length && <div className="f-browser-empty">no matches</div>}
          </div>
          <aside className="f-skill-live">
            <div className="f-skill-live-title"><b>Preview</b><span>{preview ? effectLabel(preview.effect) : 'None'}</span></div>
            {preview && (
              <div className="f-skill-live-stage" style={{ width: 200, height: 200 }}>
                <EffectLivePreview effect={preview.effect} />
              </div>
            )}
            {preview && (
              <div className="f-skill-meta">
                <span>{preview.effect.frames?.length || 0} sprites</span>
                <span>{preview.effect.animation?.length || 0} animation steps</span>
              </div>
            )}
            <button className="f-gbtn" style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}
              onClick={() => { if (preview) { onPick(preview); onClose() } }}>Use this effect</button>
          </aside>
        </div>
      </div>
    </div>
  )
}

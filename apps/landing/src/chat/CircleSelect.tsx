// The circle selector — a calm chip that names the family Arganta is speaking
// about, and lets a parent switch circle or span all of them. No jargon: it
// reads like choosing which family you mean, not "select a data scope".
import { useEffect, useRef, useState } from 'react'
import { ALL_CIRCLES, type Circle, type CircleCtx } from './circles'

function Dot({ color }: { color: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
}

export function CircleSelect({ circles, ctx, showAll, name, onSelect }: {
  circles: Circle[]; ctx: CircleCtx; showAll: boolean; name: string; onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Nothing to switch between — show the name as a quiet, unclickable label.
  if (circles.length <= 1 && !showAll) {
    return <span className="ac-circle-chip ac-circle-chip--static"><Dot color={circles[0]?.accent ?? '#DCA254'} />{ctx.label}</span>
  }

  const spanning = ctx.id === ALL_CIRCLES
  const pick = (id: string) => { onSelect(id); setOpen(false) }

  return (
    <div className="ac-circle-wrap" ref={wrap}>
      <button className="ac-circle-chip" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {spanning ? <span className="ac-circle-all">◍</span> : <Dot color={circles.find(c => c.id === ctx.id)?.accent ?? '#DCA254'} />}
        <span className="ac-circle-name">{ctx.label}</span>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden><path d="M2.5 4 L5.5 7 L8.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="ac-circle-pop" role="listbox">
          {name && <div className="ac-circle-who">Signed in as <b>{name}</b></div>}
          {circles.map(c => (
            <button key={c.id} className={'ac-circle-opt' + (ctx.id === c.id ? ' ac-circle-opt--on' : '')} role="option" aria-selected={ctx.id === c.id} onClick={() => pick(c.id)}>
              <Dot color={c.accent} /><span>{c.name}</span>
            </button>
          ))}
          {showAll && (
            <>
              <div className="ac-circle-div" />
              <button className={'ac-circle-opt' + (spanning ? ' ac-circle-opt--on' : '')} role="option" aria-selected={spanning} onClick={() => pick(ALL_CIRCLES)}>
                <span className="ac-circle-all">◍</span>
                <span>All circles<em> · answers span every circle you're in</em></span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

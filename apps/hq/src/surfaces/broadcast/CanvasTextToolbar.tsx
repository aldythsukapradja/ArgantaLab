/**
 * CANVAS TEXT TOOLBAR (B1) — the PowerPoint-shaped bar that floats next to the
 * text you selected, on the canvas, where your eyes already are.
 *
 * Why this exists: the drawer made you look away from the artwork to change the
 * artwork. Type size is a VISUAL decision — you judge it against the picture, so
 * the control belongs beside the picture. The founder's rule for HQ is "manual
 * work or fine-tuning, one element at a time", and this is that rule as a widget:
 * it only ever edits the one selected layer.
 *
 * It is a pure controller — every change goes through the same `patch` the drawer
 * used, so there is exactly one write path into a layer and no new state model to
 * keep in sync. Positioning is derived from doc state (never pointer tracking),
 * so the bar follows a layer through drags, alignment snaps and font changes for
 * free.
 */
import { useState } from 'react'
import {
  AlignLeft, AlignCenter, AlignRight, Bold, Minus, Plus, Sparkles, Type,
} from 'lucide-react'
import { POST_FONTS, FONT_INHERIT, type TextLayer, type BadgeLayer } from './postEngine'

export interface ToolbarPos { left: number; top: number; below: boolean }

const SIZE_MIN = 16
const SIZE_MAX = 240

export function CanvasTextToolbar({ layer, pos, docFontId, patch, onPolish, polishing, canPolish }: {
  layer: TextLayer | BadgeLayer
  pos: ToolbarPos
  docFontId?: string
  patch: (p: Record<string, unknown>) => void
  onPolish?: (preset: PolishPreset) => void
  polishing?: boolean
  canPolish?: boolean
}) {
  const [fontOpen, setFontOpen] = useState(false)
  const [polishOpen, setPolishOpen] = useState(false)
  const isText = layer.type === 'text'
  const t = layer as TextLayer

  const bump = (d: number) => patch({ size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(layer.size + d))) })
  const activeFont = isText ? (t.font || FONT_INHERIT) : 'sans'
  const fontLabel = activeFont === FONT_INHERIT
    ? `Global · ${POST_FONTS.find(f => f.id === (docFontId || 'sans'))?.label ?? 'Sans'}`
    : POST_FONTS.find(f => f.id === activeFont)?.label ?? 'Sans'

  return (
    <div
      className={'pbx-ctb' + (pos.below ? ' pbx-ctb--below' : '')}
      style={{ left: pos.left, top: pos.top }}
      // The canvas clears selection on pointerdown; without this, reaching for
      // any button here would deselect the very layer the bar is editing.
      onPointerDown={e => e.stopPropagation()}
      role="toolbar" aria-label="Text formatting"
    >
      {/* size */}
      <button className="pbx-ctb-b" onClick={() => bump(-4)} title="Smaller" aria-label="Smaller"><Minus size={13} /></button>
      <input
        className="pbx-ctb-size" type="number" value={Math.round(layer.size)} min={SIZE_MIN} max={SIZE_MAX}
        onChange={e => {
          const v = parseInt(e.target.value, 10)
          if (Number.isFinite(v)) patch({ size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, v)) })
        }}
        aria-label="Font size"
      />
      <button className="pbx-ctb-b" onClick={() => bump(4)} title="Bigger" aria-label="Bigger"><Plus size={13} /></button>

      {isText && (<>
        <i className="pbx-ctb-sep" />
        {/* weight — 700 is the neutral middle; the toggle walks 500→700→800 */}
        <button
          className={'pbx-ctb-b' + (t.weight >= 700 ? ' on' : '')}
          onClick={() => patch({ weight: t.weight >= 800 ? 500 : t.weight >= 700 ? 800 : 700 })}
          title={`Weight ${t.weight} — click to cycle`} aria-label="Weight"
        ><Bold size={13} /></button>

        <i className="pbx-ctb-sep" />
        {/* align — mirrors the drawer's old snap so left/right hug the margin */}
        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
          <button
            key={a} className={'pbx-ctb-b' + (t.align === a ? ' on' : '')}
            onClick={() => patch({ align: a, xN: a === 'left' ? 0.12 : a === 'right' ? 0.88 : 0.5 })}
            title={`Align ${a}`} aria-label={`Align ${a}`}
          ><Icon size={13} /></button>
        ))}

        <i className="pbx-ctb-sep" />
        {/* font */}
        <div className="pbx-ctb-drop">
          <button className={'pbx-ctb-font' + (fontOpen ? ' on' : '')} onClick={() => setFontOpen(o => !o)} title="Font">
            <Type size={12} /> <span>{fontLabel}</span>
          </button>
          {fontOpen && (
            <>
              <div className="pbx-ctb-backdrop" onClick={() => setFontOpen(false)} />
              <div className="pbx-ctb-menu" role="menu">
                <button
                  role="menuitem" className={activeFont === FONT_INHERIT ? 'on' : ''}
                  onClick={() => { patch({ font: FONT_INHERIT }); setFontOpen(false) }}
                >
                  Global font
                  <small>follows the post's font in Style</small>
                </button>
                {POST_FONTS.map(f => (
                  <button
                    key={f.id} role="menuitem" className={activeFont === f.id ? 'on' : ''}
                    style={{ fontFamily: f.stack }}
                    onClick={() => { patch({ font: f.id }); setFontOpen(false) }}
                  >{f.label}</button>
                ))}
              </div>
            </>
          )}
        </div>

        <i className="pbx-ctb-sep" />
        {/* colour role — roles, not hexes, so a palette switch still re-inks it */}
        {(['ink', 'soft', 'accent'] as const).map(c => (
          <button
            key={c} className={'pbx-ctb-dot pbx-ctb-dot--' + c + (t.color === c ? ' on' : '')}
            onClick={() => patch({ color: c })} title={`Colour: ${c}`} aria-label={`Colour ${c}`}
          />
        ))}

        <i className="pbx-ctb-sep" />
        {/* plate */}
        <button
          className={'pbx-ctb-b pbx-ctb-hl' + (t.highlight !== 'none' ? ' on' : '')}
          onClick={() => patch({ highlight: t.highlight === 'none' ? 'pill' : t.highlight === 'pill' ? 'underline' : 'none' })}
          title={`Plate: ${t.highlight} — click to cycle`} aria-label="Highlight style"
        >{t.highlight === 'underline' ? 'U' : t.highlight === 'pill' ? '▭' : '—'}</button>
        <button
          className={'pbx-ctb-b' + (t.upper ? ' on' : '')}
          onClick={() => patch({ upper: !t.upper })} title="ALL CAPS" aria-label="All caps"
        ><span className="pbx-ctb-caps">AA</span></button>
      </>)}

      {/* ✦ polish — B3 wires the actual rewrite */}
      {canPolish && onPolish && (<>
        <i className="pbx-ctb-sep" />
        <div className="pbx-ctb-drop">
          <button
            className={'pbx-ctb-b pbx-ctb-polish' + (polishing ? ' busy' : '')}
            onClick={() => setPolishOpen(o => !o)} disabled={polishing}
            title="Polish this line with Arganta Core" aria-label="Polish text"
          ><Sparkles size={13} /></button>
          {polishOpen && (
            <>
              <div className="pbx-ctb-backdrop" onClick={() => setPolishOpen(false)} />
              <div className="pbx-ctb-menu" role="menu">
                {POLISH_PRESETS.map(p => (
                  <button key={p.id} role="menuitem" onClick={() => { setPolishOpen(false); onPolish(p.id) }}>
                    {p.label}<small>{p.blurb}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </>)}
    </div>
  )
}

// ── polish presets (shared with the Compose capsules) ─────────
export type PolishPreset = 'polish' | 'punchier' | 'simpler'
export const POLISH_PRESETS: { id: PolishPreset; label: string; blurb: string }[] = [
  { id: 'polish', label: '✦ Polish', blurb: 'sharper, premium, same meaning' },
  { id: 'punchier', label: 'Punchier', blurb: 'shorter, more scroll-stopping' },
  { id: 'simpler', label: 'Simpler', blurb: 'plainer words, easier to read' },
]

import { Lightbulb, SlidersHorizontal } from 'lucide-react'
import type { Insight } from '../contract/insight'

const TONE: Record<string, { fg: string; bg: string }> = {
  success: { fg: 'var(--ok)', bg: 'var(--ok-bg)' },
  warn: { fg: 'var(--warn)', bg: 'var(--warn-bg)' },
  danger: { fg: 'var(--bad)', bg: 'var(--bad-bg)' },
  info: { fg: 'var(--info)', bg: 'var(--info-bg)' },
}

/** The signature element: every visual carries one of these. */
export function InsightStrip({ insight, onAction }: { insight: Insight; onAction?: () => void }) {
  const tone = TONE[insight.severity] ?? TONE.info
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: tone.bg,
      borderRadius: 'var(--r-md)', padding: '10px 11px' }}>
      <Lightbulb size={16} style={{ color: tone.fg, flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: tone.fg }}>{insight.headline}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10,
            padding: '2px 7px', borderRadius: 5, border: '1px solid var(--brd2)', color: 'var(--dim)' }}>
            <SlidersHorizontal size={11} /> {insight.source === 'rule' ? 'rule-based' : 'AI'}
          </span>
          {insight.action && (
            <button onClick={onAction} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 8,
              border: '1px solid var(--brd2)', color: 'var(--text)', background: 'var(--chip)' }}>
              {insight.action} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

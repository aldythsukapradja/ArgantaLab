import { type ReactNode } from 'react'
import { Check } from 'lucide-react'

export interface Step {
  id: string
  title: string
  hint?: string
  done: boolean
  status?: 'ok' | 'warn' | 'error'
  render: () => ReactNode
}

interface Props {
  steps: Step[]
  active: string
  onActivate: (id: string) => void
}

/**
 * Vertical stepper in the Claude visual language: a clean rail of numbered
 * nodes joined by a hairline; the active node expands to reveal its controls.
 */
export function Stepper({ steps, active, onActivate }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => {
        const isActive = s.id === active
        const isLast = i === steps.length - 1
        return (
          <div key={s.id} style={{ display: 'flex', gap: 12 }}>
            {/* Rail node + connector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onClick={() => onActivate(s.id)}
                style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                  border: `1.5px solid ${isActive ? 'var(--acc)' : s.done ? 'var(--acc)' : 'var(--bd3)'}`,
                  background: s.done ? 'var(--acc)' : isActive ? 'var(--acc-soft)' : 'var(--bg)',
                  color: s.done ? '#fff' : isActive ? 'var(--acc-text)' : 'var(--tx3)',
                  transition: 'all .16s',
                }}
              >
                {s.done ? <Check size={13} /> : i + 1}
              </button>
              {!isLast && (
                <div style={{ width: 1.5, flex: 1, minHeight: 14, background: s.done ? 'var(--acc)' : 'var(--bd2)', margin: '3px 0' }} />
              )}
            </div>

            {/* Header + (when active) body */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14, minWidth: 0 }}>
              <button
                onClick={() => onActivate(s.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 1, textAlign: 'left', width: '100%', padding: '2px 0',
                }}
              >
                <span style={{
                  fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                  color: isActive || s.done ? 'var(--tx)' : 'var(--tx2)',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                  {s.title}
                  {s.status === 'ok' && <span style={{ color: '#16a34a', fontSize: 12 }}>✓</span>}
                  {s.status === 'warn' && <span style={{ color: '#d97706', fontSize: 12 }}>⚠</span>}
                  {s.status === 'error' && <span style={{ color: '#dc2626', fontSize: 12 }}>✗</span>}
                </span>
                {s.hint && <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{s.hint}</span>}
              </button>

              {isActive && (
                <div style={{ marginTop: 12, animation: 'fade .18s ease' }}>
                  {s.render()}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

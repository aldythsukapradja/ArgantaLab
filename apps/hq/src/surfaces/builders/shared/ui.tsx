import type { CSSProperties, ReactNode } from 'react'
import type { FeaturedBadge } from '../../../data/algorithm'

export const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--bd2)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--tx3)', marginBottom: 10,
    }}>{children}</div>
  )
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {label}
        {required && <ReqBadge />}
        {hint && <span style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 400 }}>· {hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** Marks a field as mandatory for classification (Analytics / Discover / content design). */
export function ReqBadge() {
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)',
      padding: '1px 6px', borderRadius: 99, letterSpacing: '.04em',
    }}>REQUIRED</span>
  )
}

export function Pill({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
        border: `1px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`,
        background: on ? 'var(--acc-soft)' : 'transparent',
        color: on ? 'var(--acc-text)' : 'var(--tx2)',
        whiteSpace: 'nowrap', transition: 'all .16s',
      }}
    >{children}</button>
  )
}

const BADGE_COLORS: Record<FeaturedBadge, { bg: string; fg: string }> = {
  'Hot Ranked':  { bg: 'rgba(244,63,94,.12)',  fg: '#f43f5e' },
  'Rising Star': { bg: 'rgba(245,158,11,.14)', fg: '#d97706' },
  'Top Rated':   { bg: 'rgba(99,102,241,.12)', fg: 'var(--acc-text)' },
  'Must Play':   { bg: 'var(--bg3)',            fg: 'var(--tx2)' },
  'Fresh':       { bg: 'rgba(34,197,94,.12)',  fg: '#16a34a' },
  'Pinned':      { bg: 'rgba(168,85,247,.14)', fg: '#a855f7' },
  'Trending':    { bg: 'rgba(245,158,11,.14)', fg: '#d97706' },
}

export function Badge({ kind }: { kind: FeaturedBadge }) {
  const c = BADGE_COLORS[kind]
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
      background: c.bg, color: c.fg, letterSpacing: '.02em', whiteSpace: 'nowrap',
    }}>{kind}</span>
  )
}

export function TrendChip({ pct, dir }: { pct: number; dir: 'up' | 'down' | 'flat' }) {
  const color = dir === 'up' ? '#16a34a' : dir === 'down' ? '#dc2626' : 'var(--tx3)'
  const icon = dir === 'up' ? '📈' : dir === 'down' ? '📉' : '📊'
  const sign = pct > 0 ? '+' : ''
  return (
    <span style={{ color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {icon} {sign}{pct}%
    </span>
  )
}

export function HealthDot({ health }: { health: 'rising' | 'safe' | 'declining' }) {
  const color = health === 'rising' ? '#f59e0b' : health === 'declining' ? '#dc2626' : '#16a34a'
  return <span style={{ color, fontSize: 12 }}>●</span>
}

import type { ReactNode } from 'react'
import { Database } from 'lucide-react'

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span>{icon ?? <Database />}</span>
      <div className="empty-t">{title}</div>
      {children && <div className="empty-s">{children}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading live data…' }: { label?: string }) {
  return (
    <div className="empty" style={{ borderStyle: 'solid' }}>
      <div className="spin" />
      <div className="empty-t">{label}</div>
    </div>
  )
}

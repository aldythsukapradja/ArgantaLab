import { useState } from 'react'
import { Play, Pencil, BarChart3, Maximize2, Archive } from 'lucide-react'
import type { RankedArtifact, FeaturedBadge } from '../../../data/algorithm'
import { fmtCount } from '../artifact'
import { Badge, TrendChip } from './ui'

interface Props {
  item: RankedArtifact
  emoji: string
  badge?: FeaturedBadge
  draft?: boolean
  onPlay: () => void
  onEdit: () => void
  onAnalytics: () => void
  onFullscreen: () => void
  onArchive?: () => void
}

export function ArtifactCard({ item, emoji, badge, draft, onPlay, onEdit, onAnalytics, onFullscreen, onArchive }: Props) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: 0, overflow: 'hidden', position: 'relative', transition: 'transform .16s, box-shadow .16s',
        transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}
    >
      {/* Thumb */}
      <div style={{
        height: 96, position: 'relative',
        background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#4c1d95 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
      }}>
        {item.kind === 'game'
          ? <span>{emoji}</span>
          : <span>{emoji}</span>}
        {badge && <div style={{ position: 'absolute', top: 8, left: 8 }}><Badge kind={badge} /></div>}

        {/* Hover actions */}
        {hover && !draft && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(5,7,15,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Act onClick={onPlay} title="Play"><Play size={15} /></Act>
            <Act onClick={onFullscreen} title="Fullscreen"><Maximize2 size={15} /></Act>
            <Act onClick={onEdit} title="Edit"><Pencil size={15} /></Act>
            <Act onClick={onAnalytics} title="Analytics"><BarChart3 size={15} /></Act>
            {onArchive && <Act onClick={onArchive} title="Archive"><Archive size={15} /></Act>}
          </div>
        )}
        {hover && draft && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(5,7,15,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Act onClick={onEdit} title="Edit"><Pencil size={15} /></Act>
            <Act onClick={onPlay} title="Preview"><Play size={15} /></Act>
            {onArchive && <Act onClick={onArchive} title="Archive"><Archive size={15} /></Act>}
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
          {item.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
            ▶ {fmtCount(item.plays)}
            {item.rating_avg != null && <span style={{ marginLeft: 8 }}>★ {item.rating_avg}</span>}
          </span>
          {draft
            ? <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>● Draft</span>
            : item.trendPct !== 0
              ? <TrendChip pct={item.trendPct} dir={item.trend} />
              : <span style={{ fontSize: 10.5, color: 'var(--ok)' }}>● Live</span>}
        </div>
      </div>
    </div>
  )
}

function Act({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
        background: 'rgba(255,255,255,.14)', color: '#fff', backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,.2)', transition: 'background .14s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--acc)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.14)')}
    >{children}</button>
  )
}

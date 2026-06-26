import { useEffect, useState } from 'react'
import { GraduationCap, Users, MessageSquare, Heart, Megaphone, Eye, Image, Circle } from 'lucide-react'
import { live } from '../data/live'
import type { SchemaInsights } from '../data/types'
import type { KinetikStats } from '../data/live'
import { Empty, Loading } from '../components/Empty'
import { compact } from '../lib/format'

function KMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="KinetikCircle">
      <defs>
        <linearGradient id="km-port" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#km-port)" />
      <circle cx="256" cy="256" r="106" fill="none" stroke="#fff" strokeWidth="40" />
      <circle cx="332" cy="180" r="34" fill="#fff" />
      <circle cx="256" cy="256" r="22" fill="#fff" />
    </svg>
  )
}

function StatCell({ label, value, icon, src }: { label: string; value: string | number; icon?: React.ReactNode; src?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}<span>{label}</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, margin: '2px 0' }}>{typeof value === 'number' ? compact(value) : value}</div>
      {src && <div className="src" style={{ background: 'transparent', padding: 0, fontSize: 10 }}>{src}</div>}
    </div>
  )
}

export function Portfolio() {
  const [i, setI] = useState<SchemaInsights | null | undefined>(undefined)
  const [k, setK] = useState<KinetikStats | null | undefined>(undefined)

  useEffect(() => {
    live.schemaInsights().then(setI)
    live.kinetikStats().then(setK)
  }, [])

  const loading = i === undefined && k === undefined
  const offline = i === null && k === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="h1">Portfolio</div>
        <div className="sub">All live products in the Arganta ecosystem — connect Supabase &amp; sign in as operator to see real data</div>
      </div>

      {loading && <Loading label="Loading app health…" />}
      {offline && <Empty title="No live connection">Connect Supabase and sign in as operator — both app cards populate automatically.</Empty>}

      {/* ── KinetikCircle ──────────────────────────────────── */}
      {k !== undefined && (
        <AppCard
          mark={<KMark size={34} />}
          name="KinetikCircle"
          tagline="Private family social & moment-sharing app"
          status={k ? 'Connected' : 'Offline'}
          pill={k ? 'pill-ok' : 'pill-mut'}
          description="Families create a private Circle and share moments, stories, albums, routines and events — all within a closed group. Platform-authored Discover posts keep the feed alive between real family moments."
          features={[
            'Private Circles — one per family, invite-only',
            'Moments feed — photos, videos, stories, kudos',
            'Stories (24h ephemeral) + photo albums',
            'Routines & events (family calendar)',
            'Discover feed — platform-authored broadcast cards',
            'Reactions + comments; Cheer Squad celebrations',
          ]}
        >
          {k && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
              <StatCell label="Circles" value={k.circles} icon={<Circle size={11} />} src="circles" />
              <StatCell label="Members" value={k.members} icon={<Users size={11} />} src="circle_members" />
              <StatCell label="Posts" value={k.posts} icon={<Image size={11} />} src="kinetik_post" />
              <StatCell label="Posts · 7d" value={k.posts7d} icon={<MessageSquare size={11} />} src="last 7 days" />
              <StatCell label="Reactions" value={k.reactions} icon={<Heart size={11} />} src="kinetik_post" />
              <StatCell label="Broadcasts live" value={k.broadcastsPublished} icon={<Megaphone size={11} />} src="kinetik_broadcast" />
              <StatCell label="Discover views" value={k.broadcastViews} icon={<Eye size={11} />} src="broadcast" />
            </div>
          )}
          {!k && <div style={{ fontSize: 12.5, color: 'var(--tx3)', padding: '8px 0' }}>Sign in as operator to see live stats.</div>}
        </AppCard>
      )}

      {/* ── ArgantaLab ─────────────────────────────────────── */}
      {i !== undefined && (
        <AppCard
          mark={<div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--mag)', display: 'grid', placeItems: 'center' }}><GraduationCap size={18} color="#fff" /></div>}
          name="ArgantaLab"
          tagline="Kids learning super-app — gamified lessons, games & rewards"
          status={i ? 'Connected' : 'Offline'}
          pill={i ? 'pill-ok' : 'pill-mut'}
          description="An educational super-app for kids with mastery-based lessons, mini-games, diamond rewards, and family circles that connect learners to parents. Circles are shared with KinetikCircle."
          features={[
            'Learn engine — lessons, mastery attempts, XP',
            'Mini-games authored via Game Builder',
            'Diamond economy — earn & spend rewards',
            'Learn Builder for operators to create content',
            'Circles shared with KinetikCircle',
          ]}
        >
          {i && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
              <StatCell label="Learners" value={i.learners} icon={<Users size={11} />} src="profiles" />
              <StatCell label="Active · 7d" value={i.activeLearners7d} icon={<MessageSquare size={11} />} src="item_attempts" />
              <StatCell label="Games" value={i.gamesTotal} icon={<Image size={11} />} src="games" />
              <StatCell label="Live content" value={i.itemsLive} icon={<Eye size={11} />} src="items" />
              <StatCell label="Circles" value={i.circles} icon={<Circle size={11} />} src="circles" />
            </div>
          )}
          {!i && <div style={{ fontSize: 12.5, color: 'var(--tx3)', padding: '8px 0' }}>Sign in as operator to see live stats.</div>}
        </AppCard>
      )}
    </div>
  )
}

function AppCard({ mark, name, tagline, status, pill, description, features, children }: {
  mark: React.ReactNode; name: string; tagline: string; status: string; pill: string
  description: string; features: string[]; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          {mark}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{tagline}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`pill ${pill}`}>{status}</span>
          <button className="chip" style={{ fontSize: 11 }} onClick={() => setOpen(v => !v)}>
            {open ? 'Less' : 'About'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.55 }}>{description}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {features.map(f => (
              <div key={f} className="row" style={{ gap: 8, fontSize: 12, color: 'var(--tx2)' }}>
                <span style={{ color: 'var(--acc)', flex: 'none' }}>·</span>{f}
              </div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

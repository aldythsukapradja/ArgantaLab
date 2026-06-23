import { useState, useEffect } from 'react'
import { supabase } from '@lib/supabase'
import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { IconSwitch } from '@components/Icons'

export default function TopBar() {
  const { activeCircleId, setCircle, go } = useUiStore()
  const circles = useDataStore(s => s.circles)
  const people  = useDataStore(s => s.people)
  const circle  = circles.find(c => c.id === activeCircleId) ?? circles[0]

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [initLetter, setInitLetter] = useState('A')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const meta = session.user.user_metadata ?? {}
      setAvatarUrl(meta.avatar_url ?? meta.picture ?? null)
      const name: string = meta.full_name ?? meta.name ?? session.user.email ?? 'A'
      setInitLetter(name[0]?.toUpperCase() ?? 'A')
    })
  }, [])

  const cycleCircle = () => {
    if (circles.length < 2) return
    const i = circles.findIndex(c => c.id === activeCircleId)
    setCircle(circles[(i + 1) % circles.length].id)
  }

  // "Aldyth's" — owner first name possessive
  const owner = circle ? people.find(p => p.circleId === circle.id && p.role === 'owner') : undefined
  const pillLabel = owner ? `${owner.name.split(' ')[0]}'s` : (circle?.name ?? '')

  const accent0 = circle?.accent[0] ?? 'var(--accent)'
  const accent1 = circle?.accent[1] ?? 'var(--care)'

  return (
    <header className="topbar">
      {/* ① Wordmark */}
      <div className="tb-wordmark">
        <span className="wm-k">Kinetik</span><span className="wm-c">Circle</span>
      </div>

      {/* ② Circle pill — centred */}
      {circle ? (
        <button className="circle-pill" onClick={cycleCircle}>
          <span className="circle-dot" style={{ background: `linear-gradient(135deg,${accent0},${accent1})` }} />
          {pillLabel}
          {circles.length > 1 && <IconSwitch width={11} height={11} style={{ color: 'var(--faint)', opacity: 0.7 }} />}
        </button>
      ) : <span />}

      {/* ③ Avatar — Gmail photo → Me tab */}
      <div className="tb-right">
        <button
          className="topbar-avatar"
          onClick={() => go('me')}
          aria-label="Profile & settings"
          style={avatarUrl ? undefined : { background: `linear-gradient(135deg,${accent0},${accent1})` }}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="topbar-avatar-img" referrerPolicy="no-referrer" />
            : <span>{initLetter}</span>
          }
        </button>
      </div>
    </header>
  )
}

import { useAppStore } from '@store/appStore'
import { supabase } from '@lib/supabase'
import { loadMyGames } from '@lib/myGames'

export default function Avatar() {
  const { learnerName, xp, level, diamonds, unlocks, session, go, addToast } = useAppStore()
  const realSession = session && session !== 'loading' ? session : null
  const email = realSession?.user?.email ?? null
  const photo = realSession?.user?.user_metadata?.avatar_url as string | undefined
  const gameCount = loadMyGames().length

  const logout = async () => {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    addToast('See you soon! 👋', '👋')
  }

  return (
    <div className="screen avpage">
      <div className="av-card">
        {photo
          ? <img className="av-photo" src={photo} alt={learnerName} referrerPolicy="no-referrer" />
          : <div className="av-photo av-photo-fallback">{(learnerName[0] ?? '?').toUpperCase()}</div>}
        <h1 className="av-name">{learnerName}</h1>
        <div className="av-lvl">Level {level} · {xp} XP</div>
        {email
          ? <div className="av-email">👤 Logged in as <b>{email}</b></div>
          : <div className="av-email">Playing as a guest</div>}

        <div className="av-stats">
          <div className="av-stat"><b>💎 {diamonds}</b><span>diamonds</span></div>
          <div className="av-stat"><b>{gameCount}</b><span>games</span></div>
          <div className="av-stat"><b>{unlocks.length}</b><span>unlocked</span></div>
        </div>

        {realSession
          ? <button className="btn btn-ghost av-logout" onClick={logout}>⏻ Log out</button>
          : <button className="btn btn-primary av-logout" onClick={() => useAppStore.getState().openAuthWall('to save your progress')}>Sign in</button>}
      </div>

      <div className="av-soon">
        <div className="av-soon-emoji">🎭</div>
        <h2>Avatar customization is coming soon</h2>
        <p>Soon you'll dress up your own avatar with the characters and styles you unlock. For now, here's your hub:</p>
        <div className="av-links">
          <button className="av-link" onClick={() => go({ tab: 'fame' })}><span>🏆</span><div><b>Hall of Fame</b><small>See where you rank</small></div></button>
          <button className="av-link" onClick={() => go({ tab: 'shop' })}><span>💎</span><div><b>Diamond Shop</b><small>Spend your diamonds</small></div></button>
        </div>
      </div>
    </div>
  )
}

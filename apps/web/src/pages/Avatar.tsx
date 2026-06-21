import { useAppStore } from '@store/appStore'
import { supabase } from '@lib/supabase'
import { loadMyGames } from '@lib/myGames'
import { COSTUMES, WORLD_BY_KEY, accessoryFor } from '@/data/learn'
import { worldRing } from '@lib/learnProgress'
import Buddy from '@components/avatar/Buddy'

export default function Avatar() {
  const { learnerName, xp, level, diamonds, unlocks, costume, setCostume, ownsItem, buyItem, session, go, addToast } = useAppStore()
  const realSession = session && session !== 'loading' ? session : null
  const email = realSession?.user?.email ?? null
  const gameCount = loadMyGames().length

  const logout = async () => {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    addToast('See you soon! 👋', '👋')
  }

  const equipped = accessoryFor(costume)

  const isUnlocked = (world: string) => worldRing(WORLD_BY_KEY[world]) >= 50 || ownsItem(`costume:${world}`)

  const onCardClick = (world: string, price: number, name: string) => {
    if (isUnlocked(world)) {
      // toggle equip
      setCostume(costume === world ? null : world)
      if (costume !== world) addToast(`Wearing the ${name}!`, '🎭')
    } else {
      if (buyItem(`costume:${world}`, price, name)) setCostume(world)
    }
  }

  return (
    <div className="screen avpage" style={{ justifyContent: 'flex-start', gap: 16, overflowY: 'auto' }}>
      <div className="av-hero">
        <div className="av-hero-buddy"><Buddy mood="wave" size={150} accessory={equipped} /></div>
        <h1 className="av-name">{learnerName}</h1>
        <div className="av-lvl">Level {level} · {xp.toLocaleString()} XP</div>
        {email ? <div className="av-email">👤 <b>{email}</b></div> : <div className="av-email">Playing as a guest</div>}
        <div className="av-stats">
          <div className="av-stat"><b>💎 {diamonds}</b><span>diamonds</span></div>
          <div className="av-stat"><b>{gameCount}</b><span>games</span></div>
          <div className="av-stat"><b>{unlocks.filter(u => u.startsWith('costume:')).length}</b><span>costumes</span></div>
        </div>
      </div>

      <div className="section-label">Wardrobe</div>
      <p className="av-ward-hint">Unlock a costume by growing that world's ring to 50% — or take a diamond shortcut. Tap to wear it.</p>
      <div className="av-wardrobe">
        {COSTUMES.map(c => {
          const world = WORLD_BY_KEY[c.world]
          const unlocked = isUnlocked(c.world)
          const wearing = costume === c.world
          const pct = worldRing(world)
          return (
            <button key={c.world} className={`av-cos${wearing ? ' on' : ''}${!unlocked ? ' locked' : ''}`}
              style={unlocked ? { borderColor: c.color } : undefined}
              onClick={() => onCardClick(c.world, c.price, c.name)}>
              <div className="av-cos-buddy"><Buddy mood="idle" size={64} bob={false} accessory={{ kind: c.kind, color: c.color }} color={unlocked ? '#8b5cf6' : '#5b6478'} /></div>
              <b style={{ color: unlocked ? 'var(--t1)' : 'var(--t3)' }}>{c.name}</b>
              <small style={{ color: c.color }}>{world.name}</small>
              {wearing
                ? <span className="av-cos-tag" style={{ background: c.color }}>Wearing ✓</span>
                : unlocked
                  ? <span className="av-cos-tag eq">Tap to wear</span>
                  : <span className="av-cos-tag lk">🔒 {pct}% · or {c.price}💎</span>}
            </button>
          )
        })}
      </div>

      <div className="av-links">
        <button className="av-link" onClick={() => go({ tab: 'fame' })}><span>🏆</span><div><b>Hall of Fame</b><small>See where you rank</small></div></button>
        <button className="av-link" onClick={() => go({ tab: 'shop' })}><span>💎</span><div><b>Diamond Shop</b><small>Spend your diamonds</small></div></button>
        <button className="av-link" onClick={() => go({ tab: 'profile' })}><span>📊</span><div><b>Profile</b><small>Your skill rings</small></div></button>
      </div>

      {realSession
        ? <button className="btn btn-ghost av-logout" onClick={logout}>⏻ Log out</button>
        : <button className="btn btn-primary av-logout" onClick={() => useAppStore.getState().openAuthWall('to save your progress')}>Sign in</button>}
    </div>
  )
}

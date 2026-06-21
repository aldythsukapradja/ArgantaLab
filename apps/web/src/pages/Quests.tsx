import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { getQuests, claimQuest, type QuestView } from '@lib/quests'
import { getStreak } from '@lib/streak'

export default function Quests() {
  const { addDiamonds, addXp, addToast, go } = useAppStore()
  const [, force] = useState(0)
  const quests = getQuests()
  const daily = quests.filter(q => q.def.scope === 'daily')
  const weekly = quests.filter(q => q.def.scope === 'weekly')
  const streak = getStreak()

  const claim = (id: string) => {
    const reward = claimQuest(id)
    if (!reward) return
    if (reward.diamonds) addDiamonds(reward.diamonds)
    if (reward.xp) addXp(reward.xp)
    addToast(`Claimed ${reward.diamonds ? `+${reward.diamonds}💎` : ''}${reward.xp ? ` +${reward.xp}XP` : ''}`, '🎁')
    force(n => n + 1)
  }

  const Row = ({ q }: { q: QuestView }) => {
    const pct = Math.round((q.progress / q.def.target) * 100)
    return (
      <div className={`q-row${q.done ? ' done' : ''}`}>
        <div className="q-ic">{q.def.icon}</div>
        <div className="q-body">
          <div className="q-top"><b>{q.def.title}</b><span className="q-reward">{q.def.reward.diamonds ? `+${q.def.reward.diamonds}💎` : ''}{q.def.reward.xp ? ` +${q.def.reward.xp}XP` : ''}</span></div>
          <div className="q-bar"><i style={{ width: `${pct}%` }} /></div>
          <small className="q-prog">{q.progress}/{q.def.target}</small>
        </div>
        {q.claimed
          ? <span className="q-claimed">✓</span>
          : q.done
            ? <button className="q-claim" onClick={() => claim(q.def.id)}>Claim</button>
            : <span className="q-claim ghost">…</span>}
      </div>
    )
  }

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 16, paddingTop: 6 }}>
      <div className="q-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Quests</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Daily <span className="g">quests</span></h1>
        </div>
        <div className="ph-streak">🔥 {streak} day{streak === 1 ? '' : 's'}</div>
      </div>

      <div className="section-label">Today</div>
      <div className="q-list">{daily.map(q => <Row key={q.def.id} q={q} />)}</div>

      <div className="section-label">This week</div>
      <div className="q-list">{weekly.map(q => <Row key={q.def.id} q={q} />)}</div>

      <div className="q-family" onClick={() => go({ tab: 'lif' })}>
        <span className="q-family-ic">🏡</span>
        <div><b>Family quests</b><small>Real-world LifeQuest tasks — a grown-up confirms them. Tap to explore.</small></div>
      </div>

      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => go({ tab: 'learn' })}>📚 Go learn →</button>
    </div>
  )
}

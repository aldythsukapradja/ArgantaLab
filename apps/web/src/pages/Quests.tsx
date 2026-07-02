import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { getQuests, claimQuest, type QuestView, type QuestCtx } from '@lib/quests'
import { todayWorldXp, ringPct } from '@lib/dailyRings'
import { earnDiamonds } from '@lib/wallet'
import { getStreak } from '@lib/streak'

const WORLD_KEYS = ['NUM', 'WRD', 'WON', 'LOG', 'WLD', 'LIF']

export default function Quests() {
  const { addXp, addToast, go } = useAppStore()
  const [, force] = useState(0)
  // Cloud truth (today's XP + full rings) so the Focus/Learn steps reflect what
  // the kid actually did — the same signal the Home North Star reads.
  const [ctx, setCtx] = useState<QuestCtx>({})
  useEffect(() => {
    todayWorldXp().then(x => {
      const todayXp = Object.values(x).reduce((a, b) => a + (b || 0), 0)
      const ringsN = WORLD_KEYS.filter(k => ringPct(x[k] ?? 0) >= 100).length
      setCtx({ todayXp, ringsN })
    })
  }, [])
  const quests = getQuests(ctx)
  const chain = quests.filter(q => q.def.scope === 'daily').sort((a, b) => (a.def.step ?? 0) - (b.def.step ?? 0))
  const weekly = quests.filter(q => q.def.scope === 'weekly')
  const streak = getStreak()

  // the active step = the first one not yet done
  const activeIdx = chain.findIndex(q => !q.done)

  const claim = (id: string) => {
    const reward = claimQuest(id, ctx)
    if (!reward) return
    if (reward.diamonds) earnDiamonds(reward.diamonds, 'quest', `quest:${id}`)
    if (reward.xp) addXp(reward.xp)
    addToast(`Claimed ${reward.diamonds ? `+${reward.diamonds}💎` : ''}${reward.xp ? ` +${reward.xp}XP` : ''}`, '🎁')
    force(n => n + 1)
  }

  const reward = (q: QuestView) => `${q.def.reward.diamonds ? `+${q.def.reward.diamonds}💎` : ''}${q.def.reward.xp ? ` +${q.def.reward.xp}XP` : ''}`

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 16, paddingTop: 6 }}>
      <div className="q-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Quests</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Your <span className="g">quest line</span></h1>
          <p className="ph-sub" style={{ marginTop: 4 }}>One path through the whole app — learn, explore, befriend, build, show.</p>
        </div>
        <div className="ph-streak">🔥 {streak} day{streak === 1 ? '' : 's'}</div>
      </div>

      {/* ── the daily chain ── */}
      <div className="qc">
        {chain.map((q, i) => {
          const pct = Math.round((q.progress / q.def.target) * 100)
          const state = q.claimed ? 'claimed' : q.done ? 'done' : i === activeIdx ? 'active' : 'locked'
          return (
            <div key={q.def.id} className={`qc-step ${state}`}>
              <div className="qc-rail">
                <div className="qc-node">{q.claimed || q.done ? '✓' : q.def.icon}</div>
                {i < chain.length - 1 && <div className={`qc-line${q.done ? ' on' : ''}`} />}
              </div>
              <div className="qc-card">
                <div className="qc-top">
                  <div>
                    <span className="qc-label">{q.def.step}. {q.def.label}</span>
                    <b className="qc-title">{q.def.title}</b>
                  </div>
                  <span className="qc-reward">{reward(q)}</span>
                </div>
                <div className="qc-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="qc-foot">
                  <small className="qc-prog">{q.progress}/{q.def.target}</small>
                  {q.claimed
                    ? <span className="qc-claimed">Claimed ✓</span>
                    : q.done
                      ? <button className="qc-claim" onClick={() => claim(q.def.id)}>Claim {reward(q)}</button>
                      : <button className="qc-go" onClick={() => q.def.route && go({ tab: q.def.route })}>Go {(q.def.label ?? '').toLowerCase()} →</button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── weekly ── */}
      <div className="section-label">This week</div>
      <div className="q-list">
        {weekly.map(q => {
          const pct = Math.round((q.progress / q.def.target) * 100)
          return (
            <div key={q.def.id} className={`q-row${q.done ? ' done' : ''}`}>
              <div className="q-ic">{q.def.icon}</div>
              <div className="q-body">
                <div className="q-top"><b>{q.def.title}</b><span className="q-reward">{reward(q)}</span></div>
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
        })}
      </div>

      <div className="q-family" onClick={() => go({ tab: 'lif' })}>
        <span className="q-family-ic">🏡</span>
        <div><b>Family quests</b><small>Real-world LifeQuest tasks — a grown-up confirms them. Tap to explore.</small></div>
      </div>
    </div>
  )
}

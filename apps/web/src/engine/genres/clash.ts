// ARENA CLASH — analog of Street Fighter (kid-friendly duels).
// Best-of-N rounds vs an AI rival. Punch / kick / block with timing;
// combo meter unlocks a special. Sidekick 'heal' cheers one HP refill.

import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Buttons: 👊 punch, 🦵 kick, 🛡️ block. Land hits to charge your SPECIAL!'

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const roundsToWin = g.num('rounds', 2)
  const aiLevel = g.num('aiLevel', 2)
  const maxHp = g.num('hp', 100)

  const FLOOR = h - 170
  interface Fighter { x: number; hp: number; state: 'idle' | 'punch' | 'kick' | 'block' | 'hurt' | 'special'; t: number; combo: number }
  let me: Fighter = { x: w * 0.3, hp: maxHp, state: 'idle', t: 0, combo: 0 }
  let ai: Fighter = { x: w * 0.7, hp: maxHp, state: 'idle', t: 0, combo: 0 }
  let myWins = 0, aiWins = 0
  let round = 1
  let roundMsg = 'ROUND 1 — FIGHT!'
  let msgT = 1.6
  let aiThink = 0
  let healUsed = !(g.sk?.power === 'heal')
  let over = false

  const BTN = [
    { key: 'punch' as const, label: '👊', x: w / 2 - 130 },
    { key: 'kick' as const, label: '🦵', x: w / 2 - 44 },
    { key: 'block' as const, label: '🛡️', x: w / 2 + 44 },
    { key: 'special' as const, label: '⭐', x: w / 2 + 130 },
  ]
  const BTN_Y = h - 62

  function act(f: Fighter, s: Fighter['state']) {
    if (f.state !== 'idle' && f.state !== 'block') return
    if (s === 'special' && f.combo < 5) return
    f.state = s
    f.t = s === 'punch' ? 0.28 : s === 'kick' ? 0.4 : s === 'special' ? 0.6 : 0.3
    if (s === 'special') f.combo = 0
  }

  function resolveHit(att: Fighter, def: Fighter, kind: 'punch' | 'kick' | 'special') {
    const inRange = Math.abs(att.x - def.x) < (kind === 'kick' ? 150 : kind === 'special' ? 190 : 120)
    if (!inRange) return
    if (def.state === 'block' && kind !== 'special') {
      g.sfx.tick()
      g.burst((att.x + def.x) / 2, FLOOR - 90, '#94a3b8', 6, 120)
      return
    }
    const dmg = kind === 'punch' ? 7 : kind === 'kick' ? 11 : 24
    def.hp -= dmg
    def.state = 'hurt'; def.t = 0.3
    att.combo = Math.min(6, att.combo + 1)
    def.combo = 0
    g.shake(kind === 'special' ? 12 : 6)
    g.sfx[kind === 'special' ? 'boom' : 'hit']()
    g.burst(def.x, FLOOR - 100, kind === 'special' ? '#fde047' : '#f87171', kind === 'special' ? 26 : 10, 220)
    if (att === me) g.addScore(dmg)
    // sidekick heal at low hp
    if (def === me && me.hp < maxHp * 0.25 && !healUsed) {
      healUsed = true
      me.hp = Math.min(maxHp, me.hp + Math.round(maxHp * 0.3))
      g.toast(`${g.sk!.name} cheers you back up! ${g.sk!.emoji}+HP`)
      g.sfx.win()
    }
    if (def.hp <= 0) endRound(att === me)
  }

  function endRound(iWon: boolean) {
    if (iWon) myWins++; else aiWins++
    if (myWins >= roundsToWin || aiWins >= roundsToWin) {
      over = true
      setTimeout(() => g.gameOver(myWins > aiWins, { Rounds: `${myWins}–${aiWins}` }), 700)
      return
    }
    round++
    roundMsg = `ROUND ${round} — FIGHT!`
    msgT = 1.6
    me = { ...me, x: w * 0.3, hp: maxHp, state: 'idle', t: 0, combo: 0 }
    ai = { ...ai, x: w * 0.7, hp: maxHp, state: 'idle', t: 0, combo: 0 }
  }

  return {
    w, h,
    update(dt) {
      if (over) return
      msgT -= dt
      if (msgT > 0) return

      // player input: buttons or keys
      if (g.p.justDown && g.p.y > BTN_Y - 40) {
        for (const b of BTN) if (Math.abs(g.p.x - b.x) < 42) act(me, b.key)
      }
      if (g.hit('j')) act(me, 'punch')
      if (g.hit('k')) act(me, 'kick')
      if (g.hit('l')) act(me, 'block')
      if (g.hit(' ')) act(me, 'special')
      // movement drifts fighters toward each other a bit
      const gap = ai.x - me.x
      if (gap > 130 && me.state === 'idle') me.x += 60 * dt
      if (gap > 130 && ai.state === 'idle') ai.x -= 70 * dt

      // AI brain
      aiThink -= dt
      if (aiThink <= 0 && ai.state === 'idle') {
        aiThink = Math.max(0.25, 1.1 - aiLevel * 0.16)
        const r = Math.random()
        if (me.state === 'punch' || me.state === 'kick') {
          if (r < 0.2 + aiLevel * 0.13) act(ai, 'block')
          else if (r < 0.6) act(ai, Math.random() < 0.5 ? 'punch' : 'kick')
        } else if (ai.combo >= 5 && r < 0.5) act(ai, 'special')
        else if (r < 0.55) act(ai, Math.random() < 0.6 ? 'punch' : 'kick')
        else if (r < 0.7) act(ai, 'block')
      }

      // state timers → hits land at midpoint
      for (const [f, foe] of [[me, ai], [ai, me]] as [Fighter, Fighter][]) {
        if (f.state === 'idle') continue
        const was = f.t
        f.t -= dt
        const mid = (f.state === 'punch' ? 0.14 : f.state === 'kick' ? 0.2 : 0.3)
        if ((f.state === 'punch' || f.state === 'kick' || f.state === 'special') && was > mid && f.t <= mid)
          resolveHit(f, foe, f.state)
        if (f.t <= 0) f.state = 'idle'
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // arena
      glow(c, w / 2, FLOOR + 30, 300, g.world.accent, 0.15)
      c.fillStyle = 'rgba(0,0,0,.35)'
      c.fillRect(0, FLOOR, w, 6)
      c.fillStyle = shade(g.world.tile, -14)
      c.fillRect(0, FLOOR + 6, w, h - FLOOR)
      // crowd dots
      for (let i = 0; i < 30; i++) {
        c.fillStyle = `hsla(${(i * 47) % 360},60%,70%,.25)`
        c.beginPath(); c.arc(20 + (i * 53) % (w - 40), 150 + (i * 31) % 60, 7, 0, Math.PI * 2); c.fill()
      }
      // fighters
      const lungeMe = me.state === 'punch' || me.state === 'kick' || me.state === 'special' ? (1 - me.t) * 40 : 0
      const lungeAi = ai.state === 'punch' || ai.state === 'kick' || ai.state === 'special' ? (1 - ai.t) * 40 : 0
      const shakeMe = me.state === 'hurt' ? Math.sin(g.frame) * 4 : 0
      const shakeAi = ai.state === 'hurt' ? Math.sin(g.frame) * 4 : 0
      // you
      if (me.state === 'block') { c.strokeStyle = '#94a3b8'; c.lineWidth = 4; c.beginPath(); c.arc(me.x + 30, FLOOR - 90, 46, -1, 1); c.stroke() }
      if (me.state === 'special') glow(c, me.x, FLOOR - 90, 90, '#fde047', 0.5)
      g.hero(me.x + lungeMe + shakeMe, FLOOR - 74, 110, g.frame, 1)
      // limb flash
      if (me.state === 'punch') { c.fillStyle = g.look.a; rr(c, me.x + lungeMe + 26, FLOOR - 110, 44, 16, 8); c.fill() }
      if (me.state === 'kick') { c.fillStyle = g.look.b; rr(c, me.x + lungeMe + 22, FLOOR - 66, 54, 18, 9); c.fill() }
      // rival — a shadow version
      const rl = { ...g.look, a: '#64748b', b: '#334155', initial: '?', svg: undefined }
      if (ai.state === 'block') { c.strokeStyle = '#94a3b8'; c.lineWidth = 4; c.beginPath(); c.arc(ai.x - 30, FLOOR - 90, 46, Math.PI - 1, Math.PI + 1); c.stroke() }
      if (ai.state === 'special') glow(c, ai.x, FLOOR - 90, 90, '#f87171', 0.5)
      c.save()
      // draw rival via drawHero on mirrored look
      const dh = (x: number) => {
        const look = g.look
        ;(g as unknown as { look: typeof rl }).look = rl
        g.hero(x, FLOOR - 74, 110, g.frame + 20, -1)
        ;(g as unknown as { look: typeof look }).look = look
      }
      dh(ai.x - lungeAi + shakeAi)
      c.restore()
      if (ai.state === 'punch') { c.fillStyle = '#94a3b8'; rr(c, ai.x - lungeAi - 70, FLOOR - 110, 44, 16, 8); c.fill() }
      if (ai.state === 'kick') { c.fillStyle = '#64748b'; rr(c, ai.x - lungeAi - 76, FLOOR - 66, 54, 18, 9); c.fill() }
      // sidekick corner coach
      if (g.sk) g.sidekick(36, FLOOR - 26, 30)
      // health bars
      const bar = (x: number, hp: number, alignRight: boolean, name: string, wins: number) => {
        c.fillStyle = 'rgba(0,0,0,.5)'; rr(c, x, 76, 190, 18, 9); c.fill()
        c.fillStyle = hp / maxHp > 0.35 ? '#4ade80' : '#f87171'
        const bw = 186 * Math.max(0, hp / maxHp)
        rr(c, alignRight ? x + 190 - 2 - bw : x + 2, 78, bw, 14, 7); c.fill()
        txt(c, name, alignRight ? x + 190 : x, 62, 13, '#fff', alignRight ? 'right' : 'left')
        txt(c, '⭐'.repeat(wins) + '☆'.repeat(roundsToWin - wins), alignRight ? x + 190 : x, 108, 12, '#fde047', alignRight ? 'right' : 'left')
      }
      bar(16, me.hp, false, g.spec.hero.name, myWins)
      bar(w - 206, ai.hp, true, 'Rival', aiWins)
      // buttons
      for (const b of BTN) {
        const special = b.key === 'special'
        const ready = !special || me.combo >= 5
        c.fillStyle = ready ? (special ? 'rgba(251,191,36,.9)' : 'rgba(99,102,241,.75)') : 'rgba(255,255,255,.08)'
        c.beginPath(); c.arc(b.x, BTN_Y, 36, 0, Math.PI * 2); c.fill()
        txt(c, b.label, b.x, BTN_Y, 26)
        if (special) txt(c, `${Math.min(5, me.combo)}/5`, b.x, BTN_Y + 26, 10, '#fff')
      }
      if (msgT > 0) txt(c, roundMsg, w / 2, h / 2 - 60, 34, '#fde047')
    },
  }
}

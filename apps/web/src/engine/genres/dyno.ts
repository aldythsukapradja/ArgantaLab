// DYNO BROTHERS — the raise-and-battle dino game (Tamagotchi × Pokémon).
// Hatch an egg, feed & train through 3 growth stages, win battles to
// evolve into cooler forms. Progress persists via save slots.

import type { GenreFactory } from '../core'
import { rr, glow, txt, emoji, shade } from '../draw'

export const hint = 'Feed 🍖 and train 🏋️ your dino, then BATTLE to evolve it!'

const SPECIES: Record<string, { name: string; stages: string[]; color: string }> = {
  rex:    { name: 'Rex',    stages: ['🥚', '🦎', '🦖', '🐲'], color: '#22c55e' },
  tri:    { name: 'Tri',    stages: ['🥚', '🦎', '🦕', '🐉'], color: '#3b82f6' },
  raptor: { name: 'Raptor', stages: ['🥚', '🦎', '🦖', '🦅'], color: '#f59e0b' },
  bronto: { name: 'Bronto', stages: ['🥚', '🦎', '🦕', '🐋'], color: '#a855f7' },
}
const STAGE_NAMES = ['Egg', 'Hatchling', 'Champion', 'Legend']

interface DynoSave {
  stage: number; food: number; power: number; wins: number; totalWins: number; name: string
}

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const sp = SPECIES[g.str('species', 'rex')] ?? SPECIES.rex
  const battlesPerStage = g.num('battles', 3)

  let stage = 0
  let food = 0       // 0..3 needed to enable training
  let power = 0      // 0..100 within stage; battles need >= 40
  let wins = 0       // wins this stage
  let totalWins = 0
  let mode: 'care' | 'battle' = 'care'
  let msg = 'Tap the egg to warm it!'
  let tapWarm = 0

  // battle state
  let myHp = 0, foeHp = 0, foeMax = 0, myMax = 0
  let turnMsg = ''
  let battleT = 0
  let foeEmoji = '🦖'
  let cheerUsed = false

  const BTNS = [
    { key: 'feed', label: '🍖 Feed', x: w / 2 - 150 },
    { key: 'train', label: '🏋️ Train', x: w / 2 },
    { key: 'battle', label: '⚔️ Battle', x: w / 2 + 150 },
  ]
  const BTN_Y = h - 90

  function startBattle() {
    mode = 'battle'
    myMax = 40 + stage * 30 + Math.floor(power / 2)
    myHp = myMax
    foeMax = 34 + stage * 28 + wins * 12
    foeHp = foeMax
    foeEmoji = ['🐊', '🦂', '🦈', '🐺', '🦁'][g.ri(0, 4)]
    turnMsg = 'Battle start! Tap ATTACK with good timing!'
    battleT = 0
    cheerUsed = !(g.sk && (g.sk.power === 'heal' || g.sk.power === 'shield'))
  }

  function evolve() {
    stage++
    wins = 0; power = 0; food = 0
    g.sfx.win()
    g.burst(w / 2, 300, sp.color, 40, 320)
    g.shake(8)
    msg = stage >= 3 ? `${sp.name} reached LEGEND form! 👑` : `${sp.name} evolved into ${STAGE_NAMES[stage]}!`
    g.toast(msg)
    g.addScore(200 * stage)
  }

  return {
    w, h,
    serialize(): DynoSave { return { stage, food, power, wins, totalWins, name: sp.name } },
    restore(d: unknown) {
      const s = d as DynoSave
      if (!s || typeof s.stage !== 'number') return
      stage = s.stage; food = s.food; power = s.power; wins = s.wins; totalWins = s.totalWins ?? 0
      msg = `Welcome back — ${sp.name} missed you!`
    },
    update(dt) {
      if (mode === 'battle') {
        battleT += dt
        if (g.p.justDown && g.p.y > 200 && g.p.y < 560) {
          // timing meter: sin wave, best near peak
          const timing = Math.abs(Math.sin(battleT * 3))
          const dmg = Math.round((8 + stage * 6) * (0.5 + timing))
          foeHp -= dmg
          g.burst(w / 2 + 110, 320, '#fde047', 12, 200)
          g.sfx[timing > 0.8 ? 'coin' : 'hit']()
          turnMsg = timing > 0.8 ? `PERFECT hit! −${dmg}` : `Hit! −${dmg}`
          if (foeHp <= 0) {
            wins++; totalWins++
            g.addScore(100)
            mode = 'care'
            g.sfx.win()
            if (wins >= battlesPerStage && stage < 3) evolve()
            else msg = `Victory! ${wins}/${battlesPerStage} wins toward evolution.`
            if (stage >= 3 && totalWins >= battlesPerStage * 3 + 2) {
              return g.gameOver(true, { Form: STAGE_NAMES[stage], 'Total wins': totalWins })
            }
            return
          }
          // foe counterattack
          const back = Math.round(6 + stage * 4 * Math.random())
          myHp -= back
          if (myHp <= myMax * 0.25 && !cheerUsed) {
            cheerUsed = true
            myHp = Math.min(myMax, myHp + Math.round(myMax * 0.35))
            g.toast(`${g.sk!.name} cheers ${sp.name} back up! ${g.sk!.emoji}`)
            g.sfx.pop()
          }
          if (myHp <= 0) {
            mode = 'care'
            power = Math.max(0, power - 20)
            msg = `${sp.name} needs rest… train up and try again!`
            g.sfx.lose()
          }
        }
        return
      }
      // care mode
      if (!g.p.justDown) return
      if (stage === 0) {
        // tap egg to hatch
        if (Math.hypot(g.p.x - w / 2, g.p.y - 320) < 90) {
          tapWarm++
          g.burst(w / 2, 320, sp.color, 6, 120)
          g.sfx.tick()
          if (tapWarm >= 8) { evolve(); msg = `${sp.name} hatched! Feed it well 🍖` }
          else msg = `Warm the egg… ${tapWarm}/8`
        }
        return
      }
      for (const b of BTNS) {
        if (Math.abs(g.p.x - b.x) > 70 || Math.abs(g.p.y - BTN_Y) > 34) continue
        if (b.key === 'feed') {
          if (food >= 3) { msg = `${sp.name} is full! Time to train 🏋️`; break }
          food++
          g.burst(w / 2, 340, '#fb923c', 10, 150)
          g.sfx.pop()
          msg = `Yum! Food ${food}/3`
        }
        if (b.key === 'train') {
          if (food <= 0) { msg = 'Feed your dino first! 🍖'; g.sfx.hit(); break }
          food--
          power = Math.min(100, power + 12 + stage * 2)
          g.burst(w / 2, 320, sp.color, 14, 200)
          g.sfx.coin()
          g.addScore(10)
          msg = power >= 40 ? `Power ${power} — ready to BATTLE! ⚔️` : `Power ${power}… keep training!`
        }
        if (b.key === 'battle') {
          if (power < 40) { msg = 'Train to 40 power first!'; g.sfx.hit(); break }
          startBattle()
        }
      }
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      const dinoY = 320
      if (mode === 'care') {
        // habitat
        glow(c, w / 2, dinoY + 60, 200, sp.color, 0.14)
        c.fillStyle = 'rgba(0,0,0,.25)'
        c.beginPath(); c.ellipse(w / 2, dinoY + 90, 170, 40, 0, 0, Math.PI * 2); c.fill()
        // dino (bounces)
        const bounce = Math.sin(g.frame * 0.1) * 8
        if (stage >= 2) glow(c, w / 2, dinoY, 110, sp.color, 0.3)
        emoji(c, sp.stages[stage], w / 2, dinoY + (stage === 0 ? Math.sin(g.frame * 0.3) * 3 : bounce), 90 + stage * 26)
        // trainer = you, beside your dino
        g.hero(w / 2 - 150, dinoY + 50, 64, g.frame)
        if (g.sk) g.sidekick(w / 2 + 150, dinoY + 40, 32)
        // stage + meters
        txt(c, `${sp.name} the ${STAGE_NAMES[stage]}`, w / 2, 120, 24, '#fff')
        txt(c, '★'.repeat(stage + 1) + '☆'.repeat(3 - Math.min(3, stage)), w / 2, 150, 16, '#fde047')
        if (stage > 0) {
          const meter = (label: string, val: number, max: number, y: number, color: string) => {
            txt(c, label, 60, y, 13, 'rgba(255,255,255,.7)', 'left')
            c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, 130, y - 8, w - 190, 16, 8); c.fill()
            c.fillStyle = color; rr(c, 130, y - 8, (w - 190) * Math.min(1, val / max), 16, 8); c.fill()
          }
          meter('🍖 Food', food, 3, 480, '#fb923c')
          meter('💪 Power', power, 100, 512, sp.color)
          meter('⚔️ Wins', wins, battlesPerStage, 544, '#fde047')
        }
        txt(c, msg, w / 2, 600, 15, g.world.glow)
        // buttons
        if (stage > 0) for (const b of BTNS) {
          const enabled = b.key === 'feed' ? food < 3 : b.key === 'train' ? food > 0 : power >= 40
          c.fillStyle = enabled ? 'rgba(99,102,241,.8)' : 'rgba(255,255,255,.08)'
          rr(c, b.x - 68, BTN_Y - 30, 136, 60, 16); c.fill()
          txt(c, b.label, b.x, BTN_Y, 17, enabled ? '#fff' : 'rgba(255,255,255,.4)')
        }
      } else {
        // battle arena
        txt(c, 'BATTLE!', w / 2, 110, 28, '#fde047')
        // timing meter
        const t = Math.abs(Math.sin(battleT * 3))
        c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, 60, 150, w - 120, 14, 7); c.fill()
        c.fillStyle = t > 0.8 ? '#4ade80' : '#f59e0b'
        rr(c, 60, 150, (w - 120) * t, 14, 7); c.fill()
        txt(c, 'tap when the bar is FULL', w / 2, 182, 12, 'rgba(255,255,255,.55)')
        // my dino vs foe
        emoji(c, sp.stages[stage], w / 2 - 110, 340 + Math.sin(g.frame * 0.12) * 6, 90)
        emoji(c, foeEmoji, w / 2 + 110, 320 + Math.sin(g.frame * 0.12 + 2) * 6, 80)
        const hpBar = (x: number, hp: number, max: number) => {
          c.fillStyle = 'rgba(0,0,0,.5)'; rr(c, x - 70, 420, 140, 12, 6); c.fill()
          c.fillStyle = hp / max > 0.35 ? '#4ade80' : '#f87171'
          rr(c, x - 70, 420, 140 * Math.max(0, hp / max), 12, 6); c.fill()
        }
        hpBar(w / 2 - 110, myHp, myMax)
        hpBar(w / 2 + 110, foeHp, foeMax)
        txt(c, turnMsg, w / 2, 500, 16, '#fff')
        c.fillStyle = 'rgba(251,191,36,.9)'
        rr(c, w / 2 - 100, 540, 200, 56, 18); c.fill()
        txt(c, '⚔️ ATTACK', w / 2, 568, 20, shade('#78350f', 0))
        g.hero(60, 600, 54, g.frame)
        if (g.sk) g.sidekick(w - 60, 600, 30)
      }
    },
  }
}

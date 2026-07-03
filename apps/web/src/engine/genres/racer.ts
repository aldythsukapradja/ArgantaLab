// TURBO RACER — analog of Race Master 3D (top-down lane racer).
// Dodge traffic, grab boost pads and coins, distance = score.
// Sidekick 'scout' flags incoming cars; 'shield'/'boost' do the obvious.

import type { GenreFactory } from '../core'
import { rr, glow, txt, shade } from '../draw'

export const hint = 'Steer with ← → or drag left/right. Grab the boosts!'

interface Car { lane: number; y: number; speed: number; color: string }
interface Pickup { lane: number; y: number; kind: 'coin' | 'boost' }

export const make: GenreFactory = (g) => {
  const w = 480, h = 720
  const LANES = 4
  const laneX = (l: number) => w / 2 + (l - (LANES - 1) / 2) * 96
  const traffic = g.num('traffic', 3)
  const boostPads = g.num('boosts', 2)
  const topSpeed = 340 + g.num('speed', 3) * 70

  let heroLane = 1.5
  let targetLane = 1 // integer target
  let speed = topSpeed * 0.7
  let boostT = 0
  let dist = 0
  let cars: Car[] = []
  let pickups: Pickup[] = []
  let spawnT = 0.5
  let shieldUp = g.sk?.power === 'shield'
  let roadOff = 0
  const CAR_COLORS = ['#f43f5e', '#3b82f6', '#a3e635', '#f59e0b', '#c084fc']

  return {
    w, h,
    update(dt) {
      // input
      if (g.hit('ArrowLeft') || g.hit('a')) targetLane = Math.max(0, targetLane - 1)
      if (g.hit('ArrowRight') || g.hit('d')) targetLane = Math.min(LANES - 1, targetLane + 1)
      if (g.p.down) targetLane = Math.round(Math.max(0, Math.min(LANES - 1, (g.p.x - laneX(0)) / 96)))
      heroLane += (targetLane - heroLane) * Math.min(1, dt * 10)

      boostT = Math.max(0, boostT - dt)
      const cur = boostT > 0 ? speed * 1.6 : speed
      speed = Math.min(topSpeed, speed + dt * 12)
      dist += cur * dt
      roadOff = (roadOff + cur * dt) % 64
      g.addScore(Math.floor(cur * dt * 0.05) > 0 ? Math.floor(cur * dt * 0.05) : 0)

      // spawn
      spawnT -= dt
      if (spawnT <= 0) {
        spawnT = Math.max(0.35, 1.4 - traffic * 0.18 - dist / 60000)
        const lane = g.ri(0, LANES - 1)
        if (Math.random() < 0.72) cars.push({ lane, y: -80, speed: cur * (0.4 + Math.random() * 0.25), color: CAR_COLORS[g.ri(0, CAR_COLORS.length - 1)] })
        else pickups.push({ lane, y: -60, kind: Math.random() < boostPads * 0.14 ? 'boost' : 'coin' })
      }

      const heroY = h - 140
      for (const c of cars) c.y += (cur - c.speed) * dt * 0.45 + 60 * dt
      for (const p of pickups) p.y += cur * dt * 0.45 + 60 * dt

      // collisions
      for (const c of cars) {
        if (Math.abs(c.y - heroY) < 54 && Math.abs(c.lane - heroLane) < 0.55) {
          c.y = h + 999
          if (shieldUp) {
            shieldUp = false
            g.toast(`${g.sk!.name} blocked the crash! ${g.sk!.emoji}`)
            g.burst(laneX(heroLane), heroY, g.sk!.color, 18, 220)
            g.sfx.zap()
          } else {
            g.shake(12, 0.4); g.sfx.boom()
            g.burst(laneX(heroLane), heroY, '#f97316', 30, 300)
            return g.gameOver(false, { Distance: `${Math.floor(dist / 100)}m` })
          }
        }
      }
      pickups = pickups.filter(p => {
        if (Math.abs(p.y - heroY) < 44 && Math.abs(p.lane - heroLane) < 0.55) {
          if (p.kind === 'coin') { g.addScore(25); g.sfx.coin(); g.burst(laneX(p.lane), p.y, '#fbbf24', 10, 160) }
          else { boostT = 2.2; g.sfx.zap(); g.toast('BOOST! 🔥'); g.burst(laneX(p.lane), p.y, '#38bdf8', 16, 220) }
          return false
        }
        return p.y < h + 80
      })
      cars = cars.filter(c => c.y < h + 120)
    },
    draw() {
      const c = g.ctx
      g.bgGradient()
      // road
      const roadL = laneX(0) - 60, roadR = laneX(LANES - 1) + 60
      c.fillStyle = 'rgba(0,0,0,.4)'
      c.fillRect(roadL, 0, roadR - roadL, h)
      c.strokeStyle = g.world.accent; c.lineWidth = 4
      c.beginPath(); c.moveTo(roadL, 0); c.lineTo(roadL, h); c.moveTo(roadR, 0); c.lineTo(roadR, h); c.stroke()
      // lane dashes
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.setLineDash([28, 36])
      for (let l = 1; l < LANES; l++) {
        const x = (laneX(l - 1) + laneX(l)) / 2
        c.lineDashOffset = -roadOff
        c.beginPath(); c.moveTo(x, -64); c.lineTo(x, h); c.stroke()
      }
      c.setLineDash([])
      // pickups
      for (const p of pickups) {
        const x = laneX(p.lane)
        if (p.kind === 'coin') { glow(c, x, p.y, 26, '#fde047', 0.4); c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(x, p.y, 12, 0, Math.PI * 2); c.fill(); txt(c, '$', x, p.y + 1, 14, '#78350f') }
        else { glow(c, x, p.y, 34, '#38bdf8', 0.5); txt(c, '⚡', x, p.y, 30) }
      }
      // traffic cars
      for (const car of cars) drawCar(c, laneX(car.lane), car.y, car.color, false)
      // hero car (costume colors) + hero head peeking
      const hx = laneX(heroLane), hy = h - 140
      if (boostT > 0) glow(c, hx, hy + 40, 70, '#38bdf8', 0.6)
      if (shieldUp && g.sk) { c.strokeStyle = g.sk.color; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(hx, hy, 52, 0, Math.PI * 2); c.stroke(); c.setLineDash([]) }
      drawCar(c, hx, hy, g.look.a, true)
      g.hero(hx, hy - 6, 42, g.frame)
      if (g.sk) g.sidekick(hx + 44, hy - 30, 26)
      // sidekick scout warning
      if (g.sk?.power === 'scout') {
        const threat = cars.find(car => car.y < 200 && Math.abs(car.lane - heroLane) < 0.55)
        if (threat) txt(c, `${g.sk.emoji} WATCH OUT!`, laneX(threat.lane), 40, 18, '#fca5a5')
      }
      txt(c, `${Math.floor(dist / 100)}m`, w - 16, h - 24, 18, 'rgba(255,255,255,.7)', 'right')

      function drawCar(cc: CanvasRenderingContext2D, x: number, y: number, color: string, hero: boolean) {
        cc.save(); cc.translate(x, y)
        cc.fillStyle = shade(color, -50)
        rr(cc, -30, -46, 60, 92, 14); cc.fill()
        cc.fillStyle = color
        rr(cc, -26, -42, 52, 84, 12); cc.fill()
        cc.fillStyle = 'rgba(255,255,255,.28)'
        rr(cc, -20, hero ? 8 : -34, 40, 22, 6); cc.fill()
        cc.fillStyle = shade(color, 40)
        rr(cc, -26, hero ? -42 : 30, 52, 10, 5); cc.fill()
        cc.restore()
      }
    },
  }
}

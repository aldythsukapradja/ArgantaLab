// Compose a "weekly family win" — a warm, on-brand post drawn from the real data
// already wired. The image is rendered on a canvas (deterministic, on-brand,
// Ember-on-Starpaper), not AI-generated, so it's fast, free and always tasteful.
// The parent reviews and edits everything before it ever reaches Buffer.
import { fetchWeek, fetchKidReports } from './data'
import type { AskCtx } from './brain'

export interface StoryDraft {
  headline: string     // big line on the image
  stat: string         // small line under the headline
  caption: string      // Instagram caption (editable)
  hashtags: string
  provenance: 'measured' | 'sample'
}

// ── pick the most shareable true thing this week ──
export async function composeWeeklyWin(ctx?: AskCtx): Promise<StoryDraft> {
  const scope = ctx?.scope ?? []
  let headline = 'A good week', stat = 'Small wins, every day', provenance: StoryDraft['provenance'] = 'sample'
  let captionCore = 'Another week of showing up together.'

  try {
    if (scope.length) {
      const kids = await fetchKidReports(scope)
      const streaker = (kids ?? []).filter(k => k.hasData).sort((a, b) => b.streak - a.streak)[0]
      if (streaker && streaker.streak >= 2) {
        headline = `${streaker.streak}-day streak!`
        stat = `${streaker.name} kept learning every day`
        captionCore = `${streaker.name} kept a ${streaker.streak}-day learning streak going this week. Proud of the effort. 🌱`
        provenance = 'measured'
      } else {
        const wk = await fetchWeek(scope)
        if (wk && wk.count > 0) {
          headline = 'Our week, together'
          stat = `${wk.count} moments on the calendar`
          captionCore = `A full week — ${wk.count} little moments, all shared. 💛`
          provenance = 'measured'
        }
      }
    }
  } catch { /* keep the warm default */ }

  const caption = `${captionCore}\n\nLittle by little, a family grows. ✨`
  return { headline, stat, caption, hashtags: '#family #littlewins #growingtogether #arganta', provenance }
}

// ── render the branded card to a PNG blob (1080×1080, IG square) ──
export async function renderStoryCard(draft: StoryDraft): Promise<Blob> {
  const S = 1080
  const c = document.createElement('canvas'); c.width = S; c.height = S
  const g = c.getContext('2d')!

  // Starpaper ground
  g.fillStyle = '#F2F1EC'; g.fillRect(0, 0, S, S)
  // soft ember glow, top-right
  const glow = g.createRadialGradient(S * 0.8, S * 0.2, 40, S * 0.8, S * 0.2, S * 0.7)
  glow.addColorStop(0, 'rgba(220,162,84,0.28)'); glow.addColorStop(1, 'rgba(220,162,84,0)')
  g.fillStyle = glow; g.fillRect(0, 0, S, S)
  // ember bar, top
  const bar = g.createLinearGradient(0, 0, S, 0); bar.addColorStop(0, '#DCA254'); bar.addColorStop(1, '#8F6B3C')
  g.fillStyle = bar; g.fillRect(0, 0, S, 10)

  // the Twin-Peaks A mark
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 26
  g.strokeStyle = '#3A3D45'; g.beginPath(); g.moveTo(120, 300); g.lineTo(200, 120); g.lineTo(280, 300); g.stroke()
  const em = g.createLinearGradient(180, 120, 340, 300); em.addColorStop(0, '#DCA254'); em.addColorStop(1, '#8F6B3C')
  g.strokeStyle = em; g.beginPath(); g.moveTo(196, 300); g.lineTo(268, 156); g.lineTo(348, 300); g.stroke()
  g.fillStyle = em; g.beginPath(); g.arc(268, 138, 15, 0, Math.PI * 2); g.fill()

  // headline
  g.fillStyle = '#15161B'; g.textBaseline = 'alphabetic'
  g.font = '600 92px Georgia, "Fraunces", serif'
  wrap(g, draft.headline, 120, 560, S - 240, 100)
  // stat
  g.fillStyle = '#3A3D45'; g.font = '400 40px Inter, system-ui, sans-serif'
  wrap(g, draft.stat, 120, 700, S - 240, 52)

  // wordmark footer
  g.fillStyle = '#8F6B3C'; g.font = '600 34px Georgia, serif'
  g.fillText('Arganta', 120, S - 90)

  return await new Promise<Blob>((res) => c.toBlob(b => res(b!), 'image/png'))
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' '); let line = ''; let yy = y
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh }
    else line = test
  }
  if (line) g.fillText(line, x, yy)
}

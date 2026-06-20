// Dynamic Open Graph image (1200×630) as SVG — no dependencies, so it can't
// break the build. Renders the game title + creator + ArgantaLab branding.

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function wrap(text, max) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { if (line) lines.push(line); line = w }
    else line = (line + ' ' + w).trim()
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

export default function handler(req, res) {
  const title = (req.query.title || 'A Game').toString().slice(0, 60)
  const by = (req.query.by || 'a kid').toString().slice(0, 40)
  const lines = wrap(title, 18)
  const startY = 300 - (lines.length - 1) * 42

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0e27"/><stop offset="1" stop-color="#241047"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4D9FFF"/><stop offset="0.5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#FF5EA0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="120" r="220" fill="#4D9FFF" opacity="0.12"/>
  <circle cx="180" cy="560" r="260" fill="#FF5EA0" opacity="0.10"/>
  <text x="80" y="110" font-family="system-ui,Segoe UI,sans-serif" font-size="30" font-weight="800" fill="#9fb4ff" letter-spacing="2">🎮 ARGANTALAB</text>
  ${lines.map((l, i) => `<text x="80" y="${startY + i * 84}" font-family="system-ui,Segoe UI,sans-serif" font-size="72" font-weight="900" fill="#ffffff">${esc(l)}</text>`).join('')}
  <text x="80" y="520" font-family="system-ui,Segoe UI,sans-serif" font-size="34" font-weight="700" fill="#c7d2fe">Made with 💚 by ${esc(by)}</text>
  <text x="80" y="566" font-family="system-ui,Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#8a93ae">Play it free — then build your own at ArgantaLab</text>
  <rect x="80" y="588" width="220" height="6" rx="3" fill="url(#brand)"/>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
  res.status(200).send(svg)
}

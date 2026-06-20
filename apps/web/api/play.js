// Vercel serverless function: serves /play/:slug with rich link-preview
// (Open Graph) meta tags AND the playable game. Crawlers (WhatsApp, iMessage,
// Twitter, Discord…) read the static <head>; humans get the game.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escAttr = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

export default async function handler(req, res) {
  const slug = (req.query.slug || '').toString()
  const origin = `https://${req.headers.host}`

  let game = null
  try {
    const url = `${SUPABASE_URL}/rest/v1/games?or=(slug.eq.${encodeURIComponent(slug)},id.eq.${encodeURIComponent(slug)})&visibility=eq.public&select=id,title,html,creator_name,plays&limit=1`
    const r = await fetch(url, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
    const rows = await r.json()
    game = Array.isArray(rows) ? rows[0] : null
  } catch { /* fall through to not-found */ }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!game) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(404).send(notFound(origin))
    return
  }

  // bump play count (fire and forget)
  fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_play`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: game.id }),
  }).catch(() => {})

  const creator = game.creator_name || 'a kid'
  const title = game.title || 'A Game'
  const desc = `Play "${title}" — a game built by ${creator} at ArgantaLab. Make your own!`
  const ogImg = `${origin}/api/og?title=${encodeURIComponent(title)}&by=${encodeURIComponent(creator)}`

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600')
  res.status(200).send(sharePage({ title, creator, desc, ogImg, origin, html: game.html, plays: game.plays || 0 }))
}

function sharePage({ title, creator, desc, ogImg, origin, html, plays }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ArgantaLab</title>
<meta name="description" content="${escAttr(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escAttr(title)} · ArgantaLab">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:image" content="${escAttr(ogImg)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(title)} · ArgantaLab">
<meta name="twitter:description" content="${escAttr(desc)}">
<meta name="twitter:image" content="${escAttr(ogImg)}">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  body{min-height:100vh;background:#0a0e1a;color:#fff;display:flex;flex-direction:column;align-items:center;padding-bottom:30px}
  .top{padding:14px}
  .pill{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:30px;text-decoration:none;font-size:14px;font-weight:600;
    color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(10px)}
  .pill b{font-weight:800}.brand{background:linear-gradient(120deg,#4D9FFF,#8B5CF6,#FF5EA0);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900}
  .frame{width:min(420px,94vw);aspect-ratio:9/16;max-height:74vh;border-radius:26px;overflow:hidden;border:10px solid #1a1f2e;background:#000;box-shadow:0 30px 80px rgba(0,0,0,.5)}
  .frame iframe{width:100%;height:100%;border:none;display:block}
  h1{font-size:26px;font-weight:850;margin-top:18px}
  .sub{color:rgba(255,255,255,.6);font-size:13px;margin-top:4px}
  .cta{margin-top:16px;display:inline-block;padding:14px 28px;border-radius:16px;background:linear-gradient(120deg,#4D9FFF,#8B5CF6);color:#fff;font-weight:800;text-decoration:none}
  .foot{margin-top:14px;font-size:12px;color:rgba(255,255,255,.4)}
</style></head>
<body>
<div class="top"><a class="pill" href="${escAttr(origin)}">Made with 💚 by <b>${esc(creator)}</b> × <span class="brand">ArgantaLab</span></a></div>
<div class="frame"><iframe srcdoc="${escAttr(html)}" sandbox="allow-scripts allow-pointer-lock"></iframe></div>
<h1>${esc(title)}</h1>
<div class="sub">▶ ${plays} plays · made by ${esc(creator)}</div>
<a class="cta" href="${escAttr(origin)}">🎮 Make your own game →</a>
<div class="foot">🏘 Built at ArgantaLab — where kids build real games.</div>
</body></html>`
}

function notFound(origin) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Game not found · ArgantaLab</title>
<meta property="og:title" content="ArgantaLab — kids build real games">
<meta property="og:description" content="Build and share your own games at ArgantaLab.">
<style>body{font-family:system-ui;background:#0a0e1a;color:#fff;min-height:100vh;display:grid;place-items:center;text-align:center;gap:14px}a{color:#4D9FFF}</style></head>
<body><div><div style="font-size:54px">🕹️</div><h1>Game not found</h1><p>This game might be private or the link is wrong.</p>
<a href="${origin}">Make your own game →</a></div></body></html>`
}

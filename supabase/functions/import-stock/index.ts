// import-stock — the "absorb all" ingester. Pulls FREE-licensed stock from the
// official Pexels / Pixabay APIs, downloads each file server-side (no browser
// CORS), stores a copy in the `video-assets` bucket, and indexes it in
// hq_video_asset. This is legitimate API ingestion under those providers' free
// licenses — NOT blind scraping of arbitrary copyrighted sites.
//
// Deploy:
//   supabase functions deploy import-stock
//   supabase secrets set PEXELS_API_KEY=xxx PIXABAY_API_KEY=yyy
// Invoke (operator only) from the Video Builder:
//   supabase.functions.invoke('import-stock', { body: { provider, query, count, kind } })
//
// Free API keys: pexels.com/api  ·  pixabay.com/api/docs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPERATOR = 'aldhyt.sukapradja@gmail.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const slug = (s: string) => (s || 'asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

type Item = { url: string; thumb?: string; mime: string; ext: string; kind: 'image' | 'video'; attribution: string; width?: number; height?: number; name: string }

async function fromPexels(query: string, count: number, kind: 'image' | 'video', orientation: string): Promise<Item[]> {
  const key = Deno.env.get('PEXELS_API_KEY')
  if (!key) throw new Error('PEXELS_API_KEY not set (supabase secrets set PEXELS_API_KEY=…)')
  const base = kind === 'video' ? 'https://api.pexels.com/videos/search' : 'https://api.pexels.com/v1/search'
  const u = new URL(base)
  u.searchParams.set('query', query); u.searchParams.set('per_page', String(Math.min(count, 30)))
  if (orientation) u.searchParams.set('orientation', orientation)
  const r = await fetch(u, { headers: { Authorization: key } })
  if (!r.ok) throw new Error(`Pexels ${r.status}: ${await r.text()}`)
  const d = await r.json()
  if (kind === 'video') {
    return (d.videos || []).map((v: any) => {
      const file = (v.video_files || []).filter((f: any) => f.width <= 1920).sort((a: any, b: any) => b.width - a.width)[0] || v.video_files?.[0]
      return file && { url: file.link, thumb: v.image, mime: file.file_type || 'video/mp4', ext: 'mp4', kind: 'video' as const, width: v.width, height: v.height, name: slug(query) + '-' + v.id, attribution: `Pexels · ${v.user?.name || 'Pexels'} · ${v.url}` }
    }).filter(Boolean)
  }
  return (d.photos || []).map((p: any) => ({ url: p.src?.large2x || p.src?.large || p.src?.original, thumb: p.src?.medium, mime: 'image/jpeg', ext: 'jpg', kind: 'image' as const, width: p.width, height: p.height, name: slug(p.alt || query) + '-' + p.id, attribution: `Pexels · ${p.photographer} · ${p.url}` }))
}

async function fromPixabay(query: string, count: number, kind: 'image' | 'video'): Promise<Item[]> {
  const key = Deno.env.get('PIXABAY_API_KEY')
  if (!key) throw new Error('PIXABAY_API_KEY not set (supabase secrets set PIXABAY_API_KEY=…)')
  const base = kind === 'video' ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/'
  const u = new URL(base)
  u.searchParams.set('key', key); u.searchParams.set('q', query); u.searchParams.set('per_page', String(Math.min(Math.max(count, 3), 30)))
  if (kind === 'image') u.searchParams.set('image_type', 'photo')
  const r = await fetch(u)
  if (!r.ok) throw new Error(`Pixabay ${r.status}: ${await r.text()}`)
  const d = await r.json()
  return (d.hits || []).map((h: any) => kind === 'video'
    ? { url: (h.videos?.medium || h.videos?.small)?.url, thumb: `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg`, mime: 'video/mp4', ext: 'mp4', kind: 'video' as const, width: h.videos?.medium?.width, height: h.videos?.medium?.height, name: slug(query) + '-' + h.id, attribution: `Pixabay · ${h.user} · ${h.pageURL}` }
    : { url: h.largeImageURL || h.webformatURL, thumb: h.previewURL, mime: 'image/jpeg', ext: 'jpg', kind: 'image' as const, width: h.imageWidth, height: h.imageHeight, name: slug(h.tags || query) + '-' + h.id, attribution: `Pixabay · ${h.user} · ${h.pageURL}` }
  ).filter((x: Item) => x.url)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // verify the caller is the operator
    const authHeader = req.headers.get('Authorization') || ''
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user || (user.email || '').toLowerCase() !== OPERATOR) return json({ error: 'not authorized' }, 403)

    const { provider = 'pexels', query = '', count = 8, kind = 'image', orientation = '' } = await req.json()
    if (!query.trim()) return json({ error: 'query required' }, 400)

    const items = provider === 'pixabay'
      ? await fromPixabay(query, count, kind)
      : await fromPexels(query, count, kind, orientation)

    const admin = createClient(url, svc)
    const created: any[] = []
    for (const it of items.slice(0, Math.min(count, 30))) {
      try {
        const resp = await fetch(it.url); if (!resp.ok) continue
        const bytes = new Uint8Array(await resp.arrayBuffer())
        const path = `${provider}/${it.kind}/${it.name}.${it.ext}`
        const up = await admin.storage.from('video-assets').upload(path, bytes, { contentType: it.mime, upsert: true })
        if (up.error) continue
        const row = { kind: it.kind, bucket: 'video-assets', path, name: it.name, mime: it.mime, bytes: bytes.byteLength, width: it.width, height: it.height, source: provider, attribution: it.attribution, created_by: user.id }
        const ins = await admin.from('hq_video_asset').upsert(row, { onConflict: 'bucket,path' }).select().single()
        if (ins.data) created.push(ins.data)
      } catch (_e) { /* skip a failed item, keep importing the rest */ }
    }
    return json({ ok: true, imported: created.length, requested: items.length, assets: created })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})

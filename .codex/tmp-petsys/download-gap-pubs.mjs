// download-gap-pubs.mjs — fetch USGS publications for the provinces whose basins
// still have NO published figure, plus those missing a cross-section.
//
// The full registry is 454 publications (~1.6 GB). Most of that is already-covered
// ground, so this pulls only what would actually close a gap, newest first —
// a later assessment usually reproduces the earlier figures anyway.
//
// USGS publications are US Government works: public domain. Politeness still applies,
// so this runs a small concurrency and identifies itself.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab';
const outDir = `${root}/.codex/tmp-petsys/current-pubs`;
await fs.mkdir(outDir, { recursive: true });

const registry = JSON.parse(await fs.readFile(`${root}/.codex/tmp-petsys/usgs-publication-registry.json`, 'utf8'));
const spine = JSON.parse(await fs.readFile(`${root}/apps/energy/public/kb/master-kb-spine.json`, 'utf8'));

let manifest = { figures: [] };
try { manifest = JSON.parse(await fs.readFile(`${root}/apps/energy/public/basin-figures/manifest.json`, 'utf8')); } catch {}

// provinces that already yielded a cross-section or strat chart — deprioritise
const haveGeology = new Set(
  manifest.figures.filter((f) => ['cross-section', 'strat-chart', 'depositional'].includes(f.type))
    .map((f) => String(f.province_code)));
const haveAny = new Set(manifest.figures.map((f) => String(f.province_code)));

const existing = new Set(await fs.readdir(outDir));
const already = new Set([...existing].map((f) => f.split('-')[0]));

const rows = registry.rows.filter((r) => r.publication_id && r.url);
const unique = [...new Map(rows.map((r) => [String(r.publication_id), r])).values()];

const score = (r) => {
  const c = String(r.province_code ?? '');
  if (!haveAny.has(c)) return 0;        // no figure at all — highest priority
  if (!haveGeology.has(c)) return 1;    // has a map but no geology figure
  return 2;
};
const todo = unique
  .filter((r) => !already.has(String(r.publication_id)))
  .map((r) => ({ r, s: score(r), y: r.publication_date ?? '' }))
  .sort((a, b) => a.s - b.s || b.y.localeCompare(a.y))
  .map((x) => x.r);

console.log(`registry ${unique.length} · already have ${already.size} · queued ${todo.length}`);
console.log(`  priority 0 (no figure at all): ${todo.filter((r) => score(r) === 0).length}`);
console.log(`  priority 1 (map but no geology figure): ${todo.filter((r) => score(r) === 1).length}`);

const clean = (v) => String(v ?? '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 90);
const hrefs = (html, base) => [...html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)]
  .map((m) => { try { return new URL(m[1], base).href; } catch { return null; } }).filter(Boolean);

async function get(url, ms = 60000, opts = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, {
      redirect: 'follow', signal: c.signal,
      headers: { 'user-agent': 'ArgantaEnergy basin-figure research (contact: repo owner)' }, ...opts,
    });
  } finally { clearTimeout(t); }
}

async function grab(url, base, i) {
  const head = await get(url, 25000, { method: 'HEAD' }).catch(() => null);
  const len = Number(head?.headers.get('content-length') ?? 0);
  if (len > 40_000_000) return { status: 'too-big', bytes: len };
  const res = await get(url, 120000);
  if (!res.ok) throw new Error(`${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!/pdf/i.test(ct) && !/\.pdf(?:$|\?)/i.test(res.url)) throw new Error(`not-pdf`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 40_000_000) return { status: 'too-big', bytes: buf.length };
  await fs.writeFile(path.join(outDir, `${base}-${String(i + 1).padStart(2, '0')}.pdf`), buf);
  return { status: 'downloaded', bytes: buf.length };
}

async function one(row) {
  const base = clean(`${row.publication_id}-${row.usgs_series ?? 'report'}`);
  try {
    const res = await get(row.url, 45000);
    if (!res.ok) return { status: 'page-error' };
    const html = await res.text();
    const cands = [...new Set(hrefs(html, res.url).filter((h) => /\.pdf(?:$|\?)/i.test(h)))].slice(0, 2);
    if (!cands.length) return { status: 'no-pdf-link' };
    const out = [];
    for (let i = 0; i < cands.length; i++) {
      try { out.push(await grab(cands[i], base, i)); }
      catch (e) { out.push({ status: 'error', error: String(e.message ?? e) }); }
    }
    return { status: out.some((o) => o.status === 'downloaded') ? 'downloaded' : 'no-usable-pdf', files: out };
  } catch (e) { return { status: 'page-error', error: String(e.message ?? e) }; }
}

const LIMIT = Number(process.argv[2] ?? 400);
const queue = todo.slice(0, LIMIT);
const results = [];
for (let i = 0; i < queue.length; i += 3) {
  results.push(...await Promise.all(queue.slice(i, i + 3).map(one)));
  if ((i / 3) % 10 === 0) {
    const ok = results.filter((r) => r.status === 'downloaded').length;
    process.stdout.write(`  ${Math.min(i + 3, queue.length)}/${queue.length} · downloaded ${ok}\n`);
  }
}
const ok = results.filter((r) => r.status === 'downloaded').length;
const bytes = results.flatMap((r) => r.files ?? []).filter((f) => f.status === 'downloaded').reduce((s, f) => s + f.bytes, 0);
console.log(`DONE downloaded=${ok}/${queue.length} bytes=${(bytes / 1e6).toFixed(0)}MB`);

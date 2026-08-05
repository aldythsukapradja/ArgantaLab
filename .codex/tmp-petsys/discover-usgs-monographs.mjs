// discover-usgs-monographs.mjs — find the USGS province GEOLOGY monographs.
//
// Phase 1 harvested Fact Sheets: 2–4 pages, a location map and a results table. The
// Bulletin 2201–2207, Professional Paper and DDS-69 series are a different animal —
// full province geology reports carrying the stratigraphic charts, cross-sections,
// burial histories and events charts a geologist actually reasons from. Bulletin
// 2204-C alone yielded a stratigraphic summary and burial curves for the North Sea.
//
// The API returns an Index Page, not a PDF, so each index page is scraped for its PDF
// links. Everything is downloaded locally — extraction happens with PyMuPDF, never by
// sending a PDF to a model.
//
// Run: node .codex/tmp-petsys/discover-usgs-monographs.mjs [maxDownloads]
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab';
const OUT = `${ROOT}/.codex/tmp-petsys/monographs`;
const META = `${ROOT}/.codex/tmp-petsys/monograph-index.json`;
await fs.mkdir(OUT, { recursive: true });

const API = 'https://pubs.usgs.gov/pubs-services/publication/';
const UA = 'ArgantaEnergy basin-figure research';

// Several phrasings, because the corpus is not consistently titled: some are
// "Total Petroleum Systems of X", some "Petroleum Geology and Resources of X",
// some "Geology and assessment of undiscovered oil and gas resources of X".
const QUERIES = [
  ['total petroleum system province', 'Bulletin'],
  ['petroleum geology and resources', 'Bulletin'],
  ['assessment of undiscovered oil and gas', 'Bulletin'],
  ['geology and total petroleum systems', 'Bulletin'],
  ['geology and assessment of undiscovered oil and gas resources', 'Professional Paper'],
  ['total petroleum systems geologic assessment', 'Professional Paper'],
  ['circum-arctic resource appraisal', 'Professional Paper'],
];

async function get(url, ms = 45000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { redirect: 'follow', signal: c.signal, headers: { 'user-agent': UA } }); }
  finally { clearTimeout(t); }
}

const found = new Map();
for (const [q, series] of QUERIES) {
  const url = `${API}?q=${encodeURIComponent(q)}&seriesName=${encodeURIComponent(series)}&page_size=200&mimetype=json`;
  try {
    const r = await get(url);
    if (!r.ok) { console.log(`  query failed ${series}/${q}: ${r.status}`); continue; }
    const j = await r.json();
    for (const rec of j.records ?? []) {
      if (!found.has(rec.indexId)) {
        found.set(rec.indexId, {
          indexId: rec.indexId,
          title: rec.title,
          series: rec.seriesTitle?.text,
          number: rec.seriesNumber,
          year: rec.publicationYear,
          doi: rec.doi ?? null,
          indexPage: (rec.links ?? []).find((l) => /index page/i.test(l.type?.text ?? ''))?.url ?? null,
          pdfs: [],
        });
      }
    }
    console.log(`  ${series} / "${q}": ${j.recordCount} records`);
  } catch (e) { console.log(`  error ${series}/${q}: ${e.message}`); }
}
console.log(`\ndistinct publications: ${found.size}`);

// resolve each index page to its PDF links
const hrefs = (html, base) => [...html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)]
  .map((m) => { try { return new URL(m[1], base).href; } catch { return null; } }).filter(Boolean);

let resolved = 0;
const list = [...found.values()].filter((p) => p.indexPage);
for (let i = 0; i < list.length; i += 4) {
  await Promise.all(list.slice(i, i + 4).map(async (p) => {
    try {
      const r = await get(p.indexPage);
      if (!r.ok) return;
      const html = await r.text();
      p.pdfs = [...new Set(hrefs(html, r.url).filter((h) => /\.pdf(?:$|\?)/i.test(h)))]
        .filter((h) => !/thumb|cover/i.test(h)).slice(0, 4);
      if (p.pdfs.length) resolved++;
    } catch { /* index page unreachable — recorded with no pdfs */ }
  }));
  if (i % 40 === 0) process.stdout.write(`  resolved ${Math.min(i + 4, list.length)}/${list.length}\n`);
}
console.log(`publications with a PDF link: ${resolved}`);

// download
const MAX = Number(process.argv[2] ?? 120);
const queue = [...found.values()].filter((p) => p.pdfs.length).slice(0, MAX);
let ok = 0, bytes = 0;
for (let i = 0; i < queue.length; i += 3) {
  await Promise.all(queue.slice(i, i + 3).map(async (p) => {
    for (const [k, url] of p.pdfs.entries()) {
      const file = `${p.indexId}-${k + 1}.pdf`;
      const dest = path.join(OUT, file);
      try { await fs.access(dest); p.localFiles ??= []; p.localFiles.push(file); ok++; continue; } catch { /* not yet */ }
      try {
        const r = await get(url, 180000);
        if (!r.ok) continue;
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 20000 || buf.length > 90_000_000) continue;
        await fs.writeFile(dest, buf);
        p.localFiles ??= []; p.localFiles.push(file);
        ok++; bytes += buf.length;
      } catch { /* skip */ }
    }
  }));
  if ((i / 3) % 6 === 0) process.stdout.write(`  downloaded ${ok} files (${(bytes / 1e6).toFixed(0)} MB)\n`);
}

await fs.writeFile(META, JSON.stringify({ count: found.size, publications: [...found.values()] }, null, 1));
console.log(`\nDONE  publications=${found.size}  pdfs=${ok}  ${(bytes / 1e6).toFixed(0)}MB`);

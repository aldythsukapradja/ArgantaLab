import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab';
const registry = JSON.parse(await fs.readFile(`${root}/.codex/tmp-petsys/usgs-publication-registry.json`, 'utf8'));
const outDir = `${root}/.codex/tmp-petsys/current-pubs`;
await fs.mkdir(outDir, { recursive: true });

const unique = [...new Map(registry.rows.map((row) => [row.publication_id ?? row.url ?? row.title, row])).values()];
const clean = (value) => String(value ?? '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 90);
const hrefs = (html, base) => [...html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)]
  .map((match) => {
    try { return new URL(match[1], base).href; } catch { return null; }
  })
  .filter(Boolean);

async function fetchWithTimeout(url, timeoutMs = 60000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'ArgantaEnergy research ingestion' }, ...options }); }
  finally { clearTimeout(timer); }
}

async function downloadPdf(url, baseName, index) {
  const head = await fetchWithTimeout(url, 30000, { method: 'HEAD' }).catch(() => null);
  const length = Number(head?.headers.get('content-length') ?? 0);
  if (length > 50_000_000) return { pdf_url: url, status: 'skipped-over-50mb', bytes: length };
  const response = await fetchWithTimeout(url, 120000);
  if (!response.ok) throw new Error(`PDF ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!/pdf/i.test(contentType) && !/\.pdf(?:$|\?)/i.test(response.url)) throw new Error(`not-pdf:${contentType}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 50_000_000) return { pdf_url: response.url, status: 'skipped-over-50mb', bytes: bytes.length };
  const file = `${baseName}-${String(index + 1).padStart(2, '0')}.pdf`;
  await fs.writeFile(path.join(outDir, file), bytes);
  return { pdf_url: response.url, local_path: `.codex/tmp-petsys/current-pubs/${file}`, status: 'downloaded', bytes: bytes.length };
}

async function processPublication(row) {
  const baseName = clean(`${row.publication_id ?? 'pub'}-${row.usgs_series ?? 'report'}`);
  try {
    const response = await fetchWithTimeout(row.url, 60000);
    if (!response.ok) throw new Error(`page ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    let candidates = [];
    if (/pdf/i.test(contentType) || /\.pdf(?:$|\?)/i.test(response.url)) {
      candidates = [response.url];
    } else {
      const html = await response.text();
      candidates = [...new Set(hrefs(html, response.url).filter((url) => /\.pdf(?:$|\?)/i.test(url)))];
      const likely = candidates.filter((url) => /(?:report|fs\d|sir\d|ofr|ch_|chapter|\.pdf)/i.test(url));
      if (likely.length) candidates = likely;
    }
    candidates = candidates.slice(0, row.usgs_series === 'Fact Sheet' ? 2 : 8);
    const files = [];
    for (let i = 0; i < candidates.length; i += 1) {
      try { files.push(await downloadPdf(candidates[i], baseName, i)); }
      catch (error) { files.push({ pdf_url: candidates[i], status: 'download-error', error: String(error.message ?? error) }); }
    }
    return { publication_id: row.publication_id, title: row.title, series: row.usgs_series, source_url: row.url, resolved_url: response.url, status: files.some((file) => file.status === 'downloaded') ? 'downloaded' : candidates.length ? 'no-usable-pdf' : 'no-pdf-link', files };
  } catch (error) {
    return { publication_id: row.publication_id, title: row.title, series: row.usgs_series, source_url: row.url, status: 'page-error', error: String(error.message ?? error), files: [] };
  }
}

const results = [];
for (let start = 0; start < unique.length; start += 4) {
  results.push(...await Promise.all(unique.slice(start, start + 4).map(processPublication)));
  process.stdout.write(`processed ${Math.min(start + 4, unique.length)}/${unique.length}\n`);
}

const summary = {
  publications: results.length,
  with_downloads: results.filter((row) => row.status === 'downloaded').length,
  pdfs_downloaded: results.flatMap((row) => row.files).filter((file) => file.status === 'downloaded').length,
  bytes_downloaded: results.flatMap((row) => row.files).filter((file) => file.status === 'downloaded').reduce((sum, file) => sum + file.bytes, 0),
  no_pdf_link: results.filter((row) => row.status === 'no-pdf-link').length,
  errors: results.filter((row) => row.status === 'page-error').length,
};
await fs.writeFile(`${root}/.codex/tmp-petsys/current-publication-downloads.json`, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));

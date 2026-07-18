// Local LLM + workload telemetry for the Command Center v2. The bridge runs on
// the machine where the logs live, so it is the right place to aggregate:
//   - Claude Code usage from ~/.claude/projects/**/*.jsonl (ccusage pattern)
//   - Codex activity from ~/.codex/sessions (best-effort)
//   - ComfyUI work from its /history + /queue + /system_stats API
//
// PROVENANCE: subscription quotas (Claude/Codex) have NO official API — token
// totals are ESTIMATES parsed from local logs, and $ is estimated from public
// pricing. ComfyUI numbers are MEASURED locally. Every block says which it is.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const COMFY_PORT = Number(process.env.COMFY_PORT || 8188);

// --- Claude Code (ccusage-style, ESTIMATE) --------------------------------
// USD per million tokens, from packages/ai/src/registry.js (public Anthropic
// pricing). Cache: write = 1.25x input, read = 0.1x input (Anthropic ratios).
const PRICING: Record<string, { in: number; out: number; label: string }> = {
  opus: { in: 15, out: 75, label: 'Opus' },
  sonnet: { in: 3, out: 15, label: 'Sonnet' },
  haiku: { in: 1, out: 5, label: 'Haiku' },
};
function priceFor(model: string) {
  if (model.includes('opus')) return { ...PRICING.opus };
  if (model.includes('sonnet')) return { ...PRICING.sonnet };
  if (model.includes('haiku')) return { ...PRICING.haiku };
  return { in: 0, out: 0, label: model };
}

interface UsageEntry { ts: number; model: string; label: string; inTok: number; outTok: number; cacheR: number; cacheW: number; cost: number; key: string }

// Incremental cache: parse each JSONL only when its mtime changes. Scanning 100+
// files on a OneDrive path every 15s would be wasteful; this keeps it cheap.
const fileCache = new Map<string, { mtime: number; entries: UsageEntry[] }>();

function parseFile(path: string): UsageEntry[] {
  const out: UsageEntry[] = [];
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { return out; }
  for (const line of raw.split('\n')) {
    if (!line || line.indexOf('"usage"') === -1) continue;
    try {
      const o = JSON.parse(line);
      const u = o?.message?.usage;
      if (!u || o.type !== 'assistant') continue;
      const model = String(o.message.model || '');
      const p = priceFor(model);
      const inTok = u.input_tokens || 0, outTok = u.output_tokens || 0;
      const cacheR = u.cache_read_input_tokens || 0, cacheW = u.cache_creation_input_tokens || 0;
      const cost = (inTok * p.in + cacheW * p.in * 1.25 + cacheR * p.in * 0.1 + outTok * p.out) / 1e6;
      // Dedup key: the same assistant message is replayed across session files;
      // ccusage counts it once via message.id + requestId.
      const key = `${o.message.id || o.uuid || ''}:${o.requestId || ''}`;
      out.push({ ts: Date.parse(o.timestamp) || 0, model, label: p.label, inTok, outTok, cacheR, cacheW, cost, key });
    } catch { /* skip malformed line */ }
  }
  return out;
}

function claudeUsage() {
  const root = join(homedir(), '.claude', 'projects');
  const seen = new Set(fileCache.keys());
  let all: UsageEntry[] = [];
  try {
    for (const d of readdirSync(root)) {
      let dirents: string[];
      try { dirents = readdirSync(join(root, d)); } catch { continue; }
      for (const f of dirents) {
        if (!f.endsWith('.jsonl')) continue;
        const p = join(root, d, f);
        seen.delete(p);
        let mtime = 0;
        try { mtime = statSync(p).mtimeMs; } catch { continue; }
        const cached = fileCache.get(p);
        if (cached && cached.mtime === mtime) { all = all.concat(cached.entries); continue; }
        const entries = parseFile(p);
        fileCache.set(p, { mtime, entries });
        all = all.concat(entries);
      }
    }
  } catch { /* ~/.claude/projects missing */ }
  for (const gone of seen) fileCache.delete(gone); // evict deleted files

  const now = Date.now();
  const dayMs = 86400e3, fiveH = 5 * 3600e3, weekMs = 7 * dayMs;
  const startOfDayUTC = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const byModel: Record<string, { label: string; tokens: number; cost: number }> = {};
  const byDay: Record<string, number> = {};
  let todayTok = 0, todayCost = 0, weekCost = 0, last5hTok = 0, allTok = 0, allCost = 0;
  const seenKeys = new Set<string>();
  for (const e of all) {
    if (e.key !== ':' && seenKeys.has(e.key)) continue; // skip replayed duplicates
    if (e.key !== ':') seenKeys.add(e.key);
    const tot = e.inTok + e.outTok + e.cacheR + e.cacheW;
    const m = (byModel[e.label] ||= { label: e.label, tokens: 0, cost: 0 });
    m.tokens += tot; m.cost += e.cost;
    allTok += tot; allCost += e.cost;
    const day = new Date(e.ts).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + tot;
    if (e.ts >= startOfDayUTC) { todayTok += tot; todayCost += e.cost; }
    if (now - e.ts <= weekMs) weekCost += e.cost;
    if (now - e.ts <= fiveH) last5hTok += tot;
  }
  const days = Object.entries(byDay).sort((a, b) => a[0] < b[0] ? 1 : -1).slice(0, 14).map(([date, tokens]) => ({ date, tokens }));
  // Self-calibrating 5h "fill": relative to the busiest 5h-equivalent day seen
  // (no official cap exists). Honest bar, badged est.
  const peakDay = Math.max(1, ...days.map((d) => d.tokens));
  return {
    provenance: 'est' as const,
    today: { tokens: todayTok, costUsd: round(todayCost) },
    allTime: { tokens: allTok, costUsd: round(allCost) },
    weekCostUsd: round(weekCost),
    last5hTokens: last5hTok,
    fivehFillPct: Math.min(100, Math.round((last5hTok / peakDay) * 100)),
    byModel: Object.values(byModel).map((m) => ({ ...m, cost: round(m.cost) })).sort((a, b) => b.tokens - a.tokens),
    days,
    files: fileCache.size,
  };
}

// --- Codex (ESTIMATE from session logs) -----------------------------------
// Codex writes a `token_count` event whose payload.info.total_token_usage is the
// running per-session total; the LAST one is the session's final usage. Price
// with public GPT-5.1-codex rates (input $1.25/M, cached $0.125/M, output $10/M).
const codexCache = new Map<string, { mtime: number; day: string; inTok: number; cachedTok: number; outTok: number }>();
function codexUsage() {
  const dir = join(homedir(), '.codex', 'sessions');
  const seen = new Set(codexCache.keys());
  let sessions = 0, lastAt = 0;
  try {
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.jsonl') && !e.name.endsWith('.json')) continue;
        sessions++;
        seen.delete(p);
        let mtime = 0;
        try { mtime = statSync(p).mtimeMs; } catch { continue; }
        if (mtime > lastAt) lastAt = mtime;
        const cached = codexCache.get(p);
        if (cached && cached.mtime === mtime) continue;
        // Parse only the last token_count event (session total).
        let last: any = null;
        try {
          for (const line of readFileSync(p, 'utf8').split('\n')) {
            if (line.indexOf('token_count') === -1) continue;
            try { const o = JSON.parse(line); const u = o?.payload?.info?.total_token_usage; if (u) last = u; } catch { /* skip */ }
          }
        } catch { /* unreadable */ }
        codexCache.set(p, {
          mtime, day: new Date(mtime).toISOString().slice(0, 10),
          inTok: last?.input_tokens || 0, cachedTok: last?.cached_input_tokens || 0, outTok: last?.output_tokens || 0,
        });
      }
    };
    walk(dir);
  } catch { /* no codex */ }
  for (const gone of seen) codexCache.delete(gone);

  const now = Date.now(), dayMs = 86400e3, weekMs = 7 * dayMs;
  const startOfDayUTC = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  let inTok = 0, cachedTok = 0, outTok = 0, todayTok = 0, weekCost = 0;
  for (const c of codexCache.values()) {
    inTok += c.inTok; cachedTok += c.cachedTok; outTok += c.outTok;
    const cost = (c.inTok * 1.25 + c.cachedTok * 0.125 + c.outTok * 10) / 1e6;
    const ts = Date.parse(c.day + 'T12:00:00Z');
    if (ts >= startOfDayUTC) todayTok += c.inTok + c.cachedTok + c.outTok;
    if (now - ts <= weekMs) weekCost += cost;
  }
  const allTok = inTok + cachedTok + outTok;
  const allCost = (inTok * 1.25 + cachedTok * 0.125 + outTok * 10) / 1e6;
  return {
    provenance: 'est' as const, sessions,
    lastActiveAt: lastAt ? new Date(lastAt).toISOString() : null,
    today: { tokens: todayTok }, allTime: { tokens: allTok, costUsd: round(allCost) },
    weekCostUsd: round(weekCost),
    inputTokens: inTok, cachedTokens: cachedTok, outputTokens: outTok,
  };
}

// --- ComfyUI (MEASURED, local) --------------------------------------------
async function comfyStats() {
  const base = `http://127.0.0.1:${COMFY_PORT}`;
  const get = async (path: string) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try { const r = await fetch(base + path, { signal: ctl.signal }); return r.ok ? await r.json() : null; }
    catch { return null; } finally { clearTimeout(t); }
  };
  // Bound /history — the full log can be megabytes and blow the timeout.
  const [history, queue, stats] = await Promise.all([get('/history?max_items=200'), get('/queue'), get('/system_stats')]);
  if (history === null && queue === null && stats === null) return { provenance: 'unknown' as const, up: false };

  const now = Date.now(), dayMs = 86400e3, weekMs = 7 * dayMs;
  let jobsToday = 0, jobsWeek = 0, totalMs = 0, timed = 0;
  const models: Record<string, number> = {};
  for (const id of Object.keys(history || {})) {
    const e: any = (history as any)[id];
    const msgs: any[] = e?.status?.messages || [];
    const start = msgs.find((m) => m[0] === 'execution_start')?.[1]?.timestamp;
    const end = msgs.find((m) => m[0] === 'execution_success')?.[1]?.timestamp;
    if (start) {
      if (now - start <= dayMs) jobsToday++;
      if (now - start <= weekMs) jobsWeek++;
    }
    if (start && end && end > start) { totalMs += end - start; timed++; }
    // model per job = the checkpoint/unet loaded
    const nodes = e?.prompt?.[2] || {};
    for (const n of Object.values<any>(nodes)) {
      const ck = n?.inputs?.ckpt_name || n?.inputs?.unet_name;
      if (ck) { models[ck] = (models[ck] || 0) + 1; break; }
    }
  }
  const vramTotal = stats?.devices?.[0]?.vram_total, vramFree = stats?.devices?.[0]?.vram_free;
  return {
    provenance: 'live' as const,
    up: true,
    jobsToday, jobsWeek,
    avgJobSec: timed ? Math.round(totalMs / timed / 1000) : null,
    queueRunning: (queue as any)?.queue_running?.length || 0,
    queuePending: (queue as any)?.queue_pending?.length || 0,
    topModels: Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, runs]) => ({ name, runs })),
    vram: vramTotal ? { usedGb: round((vramTotal - (vramFree || 0)) / 1e9, 1), totalGb: round(vramTotal / 1e9, 1) } : null,
    comfyVersion: stats?.system?.comfyui_version || null,
  };
}

function round(n: number, dp = 4) { const f = 10 ** dp; return Math.round(n * f) / f; }

export async function telemetry() {
  const [comfy] = await Promise.all([comfyStats()]);
  return { claude: claudeUsage(), codex: codexUsage(), comfy, at: new Date().toISOString() };
}

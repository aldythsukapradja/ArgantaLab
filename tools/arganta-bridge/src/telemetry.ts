// Local LLM + workload telemetry for the Command Center v2. The bridge runs on
// the machine where the logs live, so it is the right place to aggregate:
//   - Claude Code usage from ~/.claude/projects/**/*.jsonl (ccusage pattern)
//   - Codex activity from ~/.codex/sessions (real token_count events)
//   - ComfyUI work from its /history + /queue + /system_stats API
//   - Local machine health from node:os
//
// PROVENANCE: subscription quotas (Claude/Codex) have NO official API — token
// totals are ESTIMATES parsed from local logs, and $ is estimated from public
// pricing. ComfyUI + machine numbers are MEASURED locally. Every block says
// which it is.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, totalmem, freemem, cpus } from 'node:os';

const COMFY_PORT = Number(process.env.COMFY_PORT || 8188);

// "Day 0" for the spend-history chart — the founder's declared project start.
// Everything before this date is excluded from the weekly trend (early setup
// noise); overridable via BRIDGE_PROJECT_START=YYYY-MM-DD.
const PROJECT_START = Date.parse((process.env.BRIDGE_PROJECT_START || '2026-05-01') + 'T00:00:00Z');
const WEEK_MS = 7 * 86400e3;
function weekIndex(ts: number): number { return Math.floor((ts - PROJECT_START) / WEEK_MS); }
function weekStartIso(idx: number): string { return new Date(PROJECT_START + idx * WEEK_MS).toISOString().slice(0, 10); }

function round(n: number, dp = 4) { const f = 10 ** dp; return Math.round(n * f) / f; }

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
  // No published rate for these yet — friendly label, honestly $0 (never a
  // fabricated price) rather than showing the raw model slug.
  if (model.includes('fable')) return { in: 0, out: 0, label: 'Fable' };
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
      // Skip internal sentinels (e.g. context-compaction summaries) — not a
      // real model call, always 0 tokens, just noise in the model breakdown.
      if (!model || model.startsWith('<')) continue;
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
  const weekly: Record<number, Record<string, { tokens: number; cost: number }>> = {};
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
    if (e.ts >= PROJECT_START) {
      const wi = weekIndex(e.ts);
      const wm = (weekly[wi] ||= {});
      const wc = (wm[e.label] ||= { tokens: 0, cost: 0 });
      wc.tokens += tot; wc.cost += e.cost;
    }
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
    weekly,
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
  const weekly: Record<number, { tokens: number; cost: number }> = {};
  let inTok = 0, cachedTok = 0, outTok = 0, todayTok = 0, weekCost = 0;
  for (const c of codexCache.values()) {
    inTok += c.inTok; cachedTok += c.cachedTok; outTok += c.outTok;
    const tot = c.inTok + c.cachedTok + c.outTok;
    const cost = (c.inTok * 1.25 + c.cachedTok * 0.125 + c.outTok * 10) / 1e6;
    const ts = Date.parse(c.day + 'T12:00:00Z');
    if (ts >= PROJECT_START) {
      const wi = weekIndex(ts);
      const wm = (weekly[wi] ||= { tokens: 0, cost: 0 });
      wm.tokens += tot; wm.cost += cost;
    }
    if (ts >= startOfDayUTC) todayTok += tot;
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
    weekly,
  };
}

/** Combine Claude's per-model weekly map + Codex's single-series weekly map
 * into one chart-ready series, in exact 7-day buckets from PROJECT_START (so
 * "day 0" always means the same instant in both the actual-date and
 * normalized-day chart modes). ALWAYS starts at week 0 (never the first week
 * with data — day 0 is the founder's declared start, not a discovered one)
 * and fills through the current week, zero-padding empty weeks. */
function combineWeekly(
  claudeWeekly: Record<number, Record<string, { tokens: number; cost: number }>>,
  codexWeekly: Record<number, { tokens: number; cost: number }>,
) {
  const nowIdx = weekIndex(Date.now());
  const idxs = [...Object.keys(claudeWeekly), ...Object.keys(codexWeekly)].map(Number);
  const maxIdx = Math.max(0, nowIdx, ...idxs);
  const range: number[] = [];
  for (let i = 0; i <= maxIdx; i++) range.push(i);
  return range.map((i) => {
    const byModel: Record<string, { tokens: number; cost: number }> = { ...(claudeWeekly[i] || {}) };
    if (codexWeekly[i]) byModel.Codex = codexWeekly[i];
    return { weekStart: weekStartIso(i), dayOffset: i * 7, byModel };
  });
}

// --- ComfyUI (MEASURED, local) — including "how massive" compute signals ---
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
  let jobsToday = 0, jobsWeek = 0, totalMs = 0, timed = 0, totalNodeExecutions = 0;
  let images = 0, videos = 0, audios = 0;
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
    // model per job = the checkpoint/unet loaded; also tally node executions and
    // output types across the whole node graph (real signal of "how much work").
    const nodes = e?.prompt?.[2] || {};
    const nodeList = Object.values<any>(nodes);
    totalNodeExecutions += nodeList.length;
    let modelTagged = false;
    for (const n of nodeList) {
      const ck = n?.inputs?.ckpt_name || n?.inputs?.unet_name;
      if (ck && !modelTagged) { models[ck] = (models[ck] || 0) + 1; modelTagged = true; }
      const ct = String(n?.class_type || '');
      if (/SaveImage|PreviewImage/.test(ct)) images++;
      else if (/VideoCombine|SaveVideo|SaveWEBM/.test(ct)) videos++;
      else if (/SaveAudio/.test(ct)) audios++;
    }
  }
  const vramTotal = stats?.devices?.[0]?.vram_total, vramFree = stats?.devices?.[0]?.vram_free;
  return {
    provenance: 'live' as const,
    up: true,
    jobsToday, jobsWeek,
    avgJobSec: timed ? Math.round(totalMs / timed / 1000) : null,
    computeSec: Math.round(totalMs / 1000),
    totalNodeExecutions,
    outputs: { images, videos, audios },
    queueRunning: (queue as any)?.queue_running?.length || 0,
    queuePending: (queue as any)?.queue_pending?.length || 0,
    topModels: Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, runs]) => ({ name, runs })),
    vram: vramTotal ? { usedGb: round((vramTotal - (vramFree || 0)) / 1e9, 1), totalGb: round(vramTotal / 1e9, 1) } : null,
    comfyVersion: stats?.system?.comfyui_version || null,
  };
}

// --- Local machine health (MEASURED) --------------------------------------
function systemInfo() {
  const total = totalmem(), free = freemem();
  return {
    provenance: 'live' as const,
    ramUsedGb: round((total - free) / 1e9, 1),
    ramTotalGb: round(total / 1e9, 1),
    cpuCount: cpus().length,
    bridgeUptimeSec: Math.round(process.uptime()),
  };
}

export async function telemetry() {
  const claude = claudeUsage();
  const codex = codexUsage();
  const comfy = await comfyStats();
  const weekly = combineWeekly(claude.weekly, codex.weekly);
  const { weekly: _cw, ...claudeOut } = claude;
  const { weekly: _xw, ...codexOut } = codex;
  return { claude: claudeOut, codex: codexOut, comfy, system: systemInfo(), weekly, at: new Date().toISOString() };
}

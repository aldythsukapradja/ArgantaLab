// ─────────────────────────────────────────────────────────────────────────
// C1 · Conversation schema contract  (Opus, contract-freeze)
// The canonical shape of an Arganta Core conversation: threads, messages, and
// the rich blocks a message can carry. This is the boundary every layer honors
// — the C2 migration, the C3 loop, the C4b UI — so it is frozen here, once.
// See docs/arganta-core/Arganta-Core-Concept.md.
// ─────────────────────────────────────────────────────────────────────────

/** Who authored a message. `tool` = a tool's returned result folded back in. */
export const MESSAGE_ROLES = Object.freeze(['user', 'assistant', 'tool', 'system']);
export const isRole = (r) => MESSAGE_ROLES.includes(r);

/**
 * Rich block kinds an assistant message can render. `text` is prose; the media
 * kinds reference an artifact already persisted in media_asset (never inline
 * bytes — the run_id↔asset lineage from Persistence-and-Provider-Strategy.md
 * carries the real file). `tool-trail` is the "→ generate_image · cloudflare-
 * flux · 4.1s" line that shows the agent's work; `delegation` records a
 * consulted office; `error` is an honest failure surface.
 */
export const BLOCK_KINDS = Object.freeze([
  'text', 'image', 'audio', 'website', 'deck', 'brand', 'chart',
  'tool-trail', 'delegation', 'error',
]);
export const isBlockKind = (k) => BLOCK_KINDS.includes(k);

/** Media block kinds resolve to a media_asset row (id + public path). */
export const MEDIA_BLOCK_KINDS = Object.freeze(['image', 'audio', 'website', 'deck', 'brand', 'chart']);
export const isMediaBlock = (k) => MEDIA_BLOCK_KINDS.includes(k);

/**
 * Make a block. Shape by kind:
 *   text        { kind, text }
 *   image|audio { kind, assetId, path, mime, provider, model, costUsd }
 *   website|deck{ kind, assetId, path } | html inline is allowed for deterministic (assetId null)
 *   chart       { kind, assetId?, spec }         chart spec is small enough to inline
 *   tool-trail  { kind, tool, provider, model, costUsd, latencyMs, ok }
 *   delegation  { kind, office, summary }
 *   error       { kind, message }
 * Unknown fields are dropped — the block is the contract, not a free bag.
 */
export function makeBlock(kind, data = {}) {
  if (!isBlockKind(kind)) throw new Error(`unknown block kind: ${kind}`);
  const base = { kind };
  switch (kind) {
    case 'text': return { ...base, text: String(data.text ?? '') };
    case 'image': case 'audio':
      return { ...base, assetId: data.assetId ?? null, path: data.path ?? null, mime: data.mime ?? null, provider: data.provider ?? null, model: data.model ?? null, costUsd: num(data.costUsd) };
    case 'website': case 'deck': case 'brand':
      return { ...base, assetId: data.assetId ?? null, path: data.path ?? null, html: data.html ?? null };
    case 'chart':
      return { ...base, assetId: data.assetId ?? null, spec: data.spec ?? null };
    case 'tool-trail':
      return { ...base, tool: data.tool ?? null, provider: data.provider ?? null, model: data.model ?? null, costUsd: num(data.costUsd), latencyMs: num(data.latencyMs), ok: data.ok !== false };
    case 'delegation':
      return { ...base, office: data.office ?? null, summary: data.summary ?? null };
    case 'error':
      return { ...base, message: data.message ?? 'unknown error' };
    default: return base;
  }
}
const num = (v) => (Number.isFinite(+v) ? +v : 0);

/**
 * A message is valid iff it has a real role and either text content or ≥1 block.
 * (A pure tool-result message carries content only; an assistant message can
 * carry both prose and blocks.)
 */
export function validateMessage(m) {
  if (!m || !isRole(m.role)) return { ok: false, reason: 'bad role' };
  const hasText = typeof m.content === 'string' && m.content.length > 0;
  const hasBlocks = Array.isArray(m.blocks) && m.blocks.length > 0;
  if (!hasText && !hasBlocks) return { ok: false, reason: 'empty message' };
  if (hasBlocks && !m.blocks.every((b) => isBlockKind(b.kind))) return { ok: false, reason: 'bad block kind' };
  return { ok: true };
}

// ── row mapping — the camelCase (app) ↔ snake_case (Postgres) boundary the C2
// migration MUST satisfy. Frozen here so both sides can't drift (the exact
// discipline that bit us on gemini-2.0-flash and the media-proxy content-type).
export function messageToRow(m) {
  return {
    id: m.id, thread_id: m.threadId, role: m.role, content: m.content ?? null,
    blocks: m.blocks ?? [], tool_calls: m.toolCalls ?? [], run_id: m.runId ?? null,
    created_at: m.createdAt ?? new Date().toISOString(),
  };
}
export function messageFromRow(r) {
  return {
    id: r.id, threadId: r.thread_id, role: r.role, content: r.content ?? '',
    blocks: r.blocks ?? [], toolCalls: r.tool_calls ?? [], runId: r.run_id ?? null,
    createdAt: r.created_at,
  };
}

/** The column contract C2's migration must implement (name → intent). A test
 * asserts messageToRow() produces exactly these keys, so the migration and the
 * app can never silently diverge. */
export const THREAD_COLUMNS = Object.freeze(['id', 'title', 'created_by', 'created_at', 'updated_at']);
export const MESSAGE_COLUMNS = Object.freeze(['id', 'thread_id', 'role', 'content', 'blocks', 'tool_calls', 'run_id', 'created_at']);

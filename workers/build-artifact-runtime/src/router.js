// B5 · public artifact runtime — pure logic (Sonnet), implementing
// docs/adr/0006-public-artifact-runtime.md's Decision 3 (CSP mirrors the
// generation-time allowlist) and route shape (/a/:slug, /w/:slug). Kept
// framework-agnostic and dependency-free so it's plain-Node testable, same
// discipline as llm-proxy/media-proxy's router.js split.
import { APPROVED_HOSTS } from '../../../packages/builder/src/validate.js';

// APPROVED_HOSTS (validate.js) is the ONE allowlist, checked at generation
// AND enforced here as CSP — but a CSP needs hosts split by directive
// (script/style/font), which validate.js's flat list doesn't carry. This is
// the one place that categorization is spelled out; a test asserts every
// host in APPROVED_HOSTS appears in exactly one category here, so adding a
// new approved host without categorizing it for CSP fails loudly instead of
// silently under-protecting (or over-blocking) a served artifact.
export const CSP_HOST_CATEGORIES = Object.freeze({
  script: ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'],
  style: ['fonts.googleapis.com'],
  font: ['fonts.gstatic.com'],
});

export function assertCspHostsCoverApprovedHosts() {
  const categorized = new Set([...CSP_HOST_CATEGORIES.script, ...CSP_HOST_CATEGORIES.style, ...CSP_HOST_CATEGORIES.font]);
  const missing = APPROVED_HOSTS.filter((h) => !categorized.has(h));
  const extra = [...categorized].filter((h) => !APPROVED_HOSTS.includes(h));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/** ADR-0006 Decision 3, verbatim. No Set-Cookie is ever added by the caller
 * (index.js) — this function only builds the CSP string. */
export function buildCsp() {
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${CSP_HOST_CATEGORIES.script.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${CSP_HOST_CATEGORIES.style.join(' ')}`,
    `font-src ${CSP_HOST_CATEGORIES.font.join(' ')}`,
    "img-src 'self' data:",
    "connect-src 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': buildCsp(),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/** The one path-prefix ↔ kind mapping. Mirrors publicArtifactUrl() in
 * apps/hq/src/builder-core/persist.ts and the reserved-slug denylist in
 * migration_artifact_game_kind.sql — all three must name the same prefixes. */
const ROUTE_KINDS = Object.freeze({ a: 'application', w: 'website', g: 'game' });

/** `/a/:slug` -> application, `/w/:slug` -> website, `/g/:slug` -> game (GB-2),
 * anything else -> null. Trailing slash tolerated; slug shape matches
 * _artifact_slugify's output (lowercase alnum + hyphens) so a malformed path
 * never even reaches Supabase. */
export function parseRoute(pathname) {
  const m = pathname.match(/^\/(a|w|g)\/([^/]+)\/?$/);
  if (!m) return null;
  const slug = m[2];
  if (!SLUG_RE.test(slug)) return null;
  return { kind: ROUTE_KINDS[m[1]], slug };
}

// ─────────────────────────────────────────────────────────────────────────
// B1 · Deterministic HTML validation rule-set  (Opus, contract-freeze)
// The security + quality GATE. A generated artifact is NOT accepted because the
// model claims it's complete — it's accepted because these deterministic checks
// pass. This is what makes "founder-generated HTML on the public internet"
// (build.arganta.app, B5) safe: it enforces exactly what the generation
// contract (prompts.js) promises. Pure, dependency-free, node-tested. The
// public runtime (B5) re-runs this server-side before serving — never trust a
// client-side pass. See docs/adr/0005-*.
// ─────────────────────────────────────────────────────────────────────────

/** Approved external hosts a generated artifact may load a <script>/<link>
 * from. Everything else is a hard error — an unknown external script is the
 * single highest-risk thing a public artifact can carry. Inline is always OK. */
export const APPROVED_HOSTS = Object.freeze([
  'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
]);

/** Max artifact size — a complete single-file app/site well under this; far
 * over usually means runaway generation or an embedded blob that shouldn't be
 * inlined. 512KB (matches the video-assets bucket's per-object std limit feel). */
export const MAX_HTML_BYTES = 512 * 1024;

const CHECK = (id, level, passed, message) => ({ id, level, passed, message });

// ── structural ─────────────────────────────────────────────────────────────
function structural(html) {
  const c = [];
  const lower = html.toLowerCase();
  c.push(CHECK('has-doctype', 'error', /<!doctype html>/i.test(html) || lower.includes('<html'), 'must be a complete HTML document (<!doctype html> / <html>)'));
  c.push(CHECK('has-viewport', 'error', /<meta[^>]+name=["']?viewport/i.test(html), 'must include a responsive viewport meta tag'));
  c.push(CHECK('closes-html', 'error', /<\/html>\s*$/i.test(html.trim()), 'document appears truncated — must end with </html>'));
  c.push(CHECK('closes-body', 'error', lower.includes('</body>'), 'missing closing </body>'));
  c.push(CHECK('no-markdown-fence', 'error', !/```/.test(html), 'contains markdown code fences — return raw HTML only, no ``` wrappers'));
  c.push(CHECK('size', 'error', byteLength(html) <= MAX_HTML_BYTES, `exceeds ${Math.round(MAX_HTML_BYTES / 1024)}KB size limit`));
  return c;
}

// ── security (all error-level — these gate the public runtime) ──────────────
function security(html) {
  const c = [];
  // exposed secrets — real key shapes, not just the word "key"
  const secretPatterns = [
    /sk-[a-z0-9]{20,}/i,                 // openai-style
    /AIza[0-9A-Za-z_\-]{30,}/,           // google api key
    /cfut_[A-Za-z0-9]{20,}/,             // cloudflare user token
    /service_role/i,                     // supabase service role
    /eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/, // a JWT (anon/service)
    /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  ];
  c.push(CHECK('no-secrets', 'error', !secretPatterns.some((re) => re.test(html)), 'contains something that looks like an API key / secret / credential'));
  // code execution primitives
  c.push(CHECK('no-eval', 'error', !/\beval\s*\(/.test(html) && !/new\s+Function\s*\(/.test(html), 'uses eval() / new Function() — not allowed'));
  // parent/top window access — a sandboxed artifact must not touch its host
  c.push(CHECK('no-parent-access', 'error', !/\b(?:window\.)?(?:parent|top)\s*\.\s*(?:location|postMessage|document|opener)/.test(html) && !/\btop\.location/.test(html), 'attempts to access the parent/top window'));
  // automatic navigation of the host away
  c.push(CHECK('no-auto-redirect', 'error', !/(?:window\.)?location\s*(?:\.href)?\s*=\s*["']https?:\/\//i.test(html), 'sets window.location to an external URL (auto-redirect)'));
  // unapproved external resources
  const externals = extractExternalHosts(html);
  const unapproved = externals.filter((h) => !APPROVED_HOSTS.includes(h));
  c.push(CHECK('approved-hosts-only', 'error', unapproved.length === 0, unapproved.length ? `loads from unapproved host(s): ${[...new Set(unapproved)].join(', ')}` : 'external resources are from approved hosts'));
  return c;
}

// ── quality (warn-level — inform, don't block) ──────────────────────────────
function quality(html, kind) {
  const c = [];
  const lower = html.toLowerCase();
  c.push(CHECK('responsive', 'warn', /@media/.test(html) || /max-width/i.test(html), 'no @media / responsive CSS found'));
  // B3 fix: PLACEHOLDER as filler text is a real smell, but the identical word
  // is also the standard HTML `placeholder="…"` input attribute — a negative
  // lookahead for a following `=` tells the two apart without missing either.
  c.push(CHECK('no-todo', 'warn', !/\b(TODO|FIXME|lorem ipsum)\b|\bPLACEHOLDER\b(?!\s*=)/i.test(html), 'contains TODO / PLACEHOLDER / lorem-ipsum text'));
  c.push(CHECK('has-title', 'warn', /<title>[^<]{1,}<\/title>/i.test(html), 'missing a non-empty <title>'));
  if (kind === 'application') {
    c.push(CHECK('app-has-script', 'warn', lower.includes('<script'), 'an application should have interactive JS'));
  }
  if (kind === 'game') {
    // GB-1 · playability checks. All warn-level BY DESIGN: an unplayable game
    // is a quality failure, not a security one, and the error-level gate exists
    // to keep unsafe HTML off the public runtime — not to referee fun. The
    // founder sees these and decides. (A game missing its loop still shouldn't
    // silently pass as "ok" in the UI, which is why they're surfaced at all.)
    c.push(CHECK('game-has-surface', 'warn', /<canvas/i.test(html) || /class=["'][^"']*\b(?:board|grid|stage)\b/i.test(html), 'no <canvas> or board/grid element — a game needs a play surface'));
    c.push(CHECK('game-has-loop', 'warn', /requestAnimationFrame|setInterval/.test(html), 'no game loop (requestAnimationFrame / setInterval) found'));
    c.push(CHECK('game-has-input', 'warn', /addEventListener\s*\(\s*["'](?:keydown|keyup|pointerdown|touchstart|click|mousedown)/.test(html), 'no input handling found — the player cannot control anything'));
    c.push(CHECK('game-has-touch', 'warn', /(?:pointerdown|touchstart|click)/.test(html), 'no touch/pointer input — the game is unplayable on a phone'));
    c.push(CHECK('game-has-restart', 'warn', /\b(?:restart|reset|play again|tryagain|try again|newgame|new game)\b/i.test(html), 'no restart path found — the player is stuck after game over'));
  }
  return c;
}

/**
 * Validate a single-file HTML artifact.
 * @param {string} html
 * @param {{kind?:'application'|'website'|'game'}} [opts]
 * @returns {{ok:boolean, errors:object[], warnings:object[], checks:object[]}}
 *   ok = no ERROR-level failure. Warnings never block; they surface in the UI
 *   so the founder decides. A structurally-broken or unsafe artifact is never ok.
 */
export function validateHtml(html, opts = {}) {
  const kind = opts.kind || 'website';
  if (typeof html !== 'string' || html.trim().length === 0) {
    const c = [CHECK('non-empty', 'error', false, 'empty output')];
    return { ok: false, errors: c, warnings: [], checks: c };
  }
  const checks = [...structural(html), ...security(html), ...quality(html, kind)];
  const failed = checks.filter((x) => !x.passed);
  const errors = failed.filter((x) => x.level === 'error');
  const warnings = failed.filter((x) => x.level === 'warn');
  return { ok: errors.length === 0, errors, warnings, checks };
}

// ── helpers ──────────────────────────────────────────────────────────────
function byteLength(s) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  return unescape(encodeURIComponent(s)).length; // node<11 / edge fallback
}

/** Hosts referenced by src=/href= on script/link/iframe with an absolute URL.
 * Relative + data:/blob: URLs are ignored (not external). */
export function extractExternalHosts(html) {
  const hosts = [];
  const re = /(?:src|href)\s*=\s*["'](https?:)?\/\/([^\/"'?#]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) hosts.push(m[2].toLowerCase());
  return hosts;
}

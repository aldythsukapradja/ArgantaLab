import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateHtml, extractExternalHosts, APPROVED_HOSTS, MAX_HTML_BYTES } from '../src/index.js';

const GOOD = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<title>Expense Tracker</title><style>@media(max-width:600px){body{font-size:14px}}</style></head>
<body><h1>Expenses</h1><script>const x=1;</script></body></html>`;

test('a complete, safe, responsive document passes with no errors', () => {
  const r = validateHtml(GOOD, { kind: 'application' });
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('empty output is never ok', () => {
  assert.equal(validateHtml('').ok, false);
  assert.equal(validateHtml('   ').ok, false);
});

test('structural: truncated document (no </html>), markdown fences, missing viewport each error', () => {
  assert.equal(validateHtml('<!doctype html><html><body>oops', { kind: 'website' }).ok, false); // truncated
  assert.ok(validateHtml('```html\n' + GOOD + '\n```').errors.some((e) => e.id === 'no-markdown-fence'));
  const noViewport = GOOD.replace(/<meta name="viewport"[^>]*>/, '');
  assert.ok(validateHtml(noViewport).errors.some((e) => e.id === 'has-viewport'));
});

test('security: an exposed secret is a hard error', () => {
  const withKey = GOOD.replace('const x=1;', 'const k="sk-abcdefghijklmnopqrstuvwx1234";');
  assert.ok(validateHtml(withKey).errors.some((e) => e.id === 'no-secrets'));
  const withJwt = GOOD.replace('const x=1;', 'const t="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMH0.dGhpc19pc19hX2xvbmdfc2lnbmF0dXJlX3BhcnQ";');
  assert.ok(validateHtml(withJwt).errors.some((e) => e.id === 'no-secrets'));
});

test('security: eval / new Function is a hard error', () => {
  assert.ok(validateHtml(GOOD.replace('const x=1;', 'eval("2+2");')).errors.some((e) => e.id === 'no-eval'));
  assert.ok(validateHtml(GOOD.replace('const x=1;', 'new Function("return 1")();')).errors.some((e) => e.id === 'no-eval'));
});

test('security: reaching into the parent/top window is a hard error (sandbox escape)', () => {
  assert.ok(validateHtml(GOOD.replace('const x=1;', 'parent.location="http://evil.com";')).errors.some((e) => e.id === 'no-parent-access'));
  assert.ok(validateHtml(GOOD.replace('const x=1;', 'window.top.postMessage(document.cookie,"*");')).errors.some((e) => e.id === 'no-parent-access'));
});

test('security: an auto-redirect to an external URL is a hard error', () => {
  assert.ok(validateHtml(GOOD.replace('const x=1;', 'window.location="https://evil.com";')).errors.some((e) => e.id === 'no-auto-redirect'));
});

test('security: an unapproved external script host is a hard error; approved hosts pass', () => {
  const evil = GOOD.replace('</body>', '<script src="https://evil.cdn.com/x.js"></script></body>');
  const r = validateHtml(evil);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.id === 'approved-hosts-only' && /evil\.cdn\.com/.test(e.message)));

  const ok = GOOD.replace('</body>', '<script src="https://cdn.jsdelivr.net/npm/x/dist/x.js"></script></body>');
  assert.equal(validateHtml(ok).ok, true);
});

test('extractExternalHosts finds absolute-URL hosts, ignores relative/data URLs', () => {
  const html = '<link href="https://fonts.googleapis.com/css"><img src="/local.png"><img src="data:image/png;base64,AAAA"><script src="//unpkg.com/x"></script>';
  const hosts = extractExternalHosts(html);
  assert.ok(hosts.includes('fonts.googleapis.com'));
  assert.ok(hosts.includes('unpkg.com'));
  assert.ok(!hosts.some((h) => h.includes('local') || h.includes('data')));
});

test('quality issues are WARNINGS, not errors — they never block a safe document', () => {
  const todo = GOOD.replace('<h1>Expenses</h1>', '<h1>Expenses</h1><!-- TODO finish this -->');
  const r = validateHtml(todo, { kind: 'application' });
  assert.equal(r.ok, true); // still ok — TODO is warn-level
  assert.ok(r.warnings.some((w) => w.id === 'no-todo'));
});

test('size ceiling is enforced as an error', () => {
  const huge = '<!doctype html><html><head><meta name="viewport" content="x"></head><body>' + 'a'.repeat(MAX_HTML_BYTES) + '</body></html>';
  assert.ok(validateHtml(huge).errors.some((e) => e.id === 'size'));
});

test('APPROVED_HOSTS is a frozen, non-empty allowlist', () => {
  assert.ok(APPROVED_HOSTS.length >= 3);
  assert.ok(Object.isFrozen(APPROVED_HOSTS));
});

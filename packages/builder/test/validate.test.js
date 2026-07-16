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

// ── GB-1 · game playability checks ────────────────────────────────────────
const GOOD_GAME = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<title>Snake</title><style>@media(max-width:600px){canvas{width:100%}}</style></head>
<body><canvas id="c"></canvas><button id="again">Play again</button><script>
addEventListener('keydown',e=>{});addEventListener('pointerdown',e=>{});
function loop(){requestAnimationFrame(loop);}loop();
</script></body></html>`;

test('GB-1: a real game passes clean — surface, loop, input, touch and a restart path', () => {
  const r = validateHtml(GOOD_GAME, { kind: 'game' });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 0, `unexpected warnings: ${r.warnings.map((w) => w.id).join(', ')}`);
});

test('GB-1: an unplayable game WARNS but is never an error — the gate polices safety, not fun', () => {
  const noLoop = GOOD_GAME.replace('function loop(){requestAnimationFrame(loop);}loop();', '');
  const r = validateHtml(noLoop, { kind: 'game' });
  assert.equal(r.ok, true);  // still safe HTML — publishable if the founder insists
  assert.ok(r.warnings.some((w) => w.id === 'game-has-loop'));

  const keyboardOnly = GOOD_GAME.replace("addEventListener('pointerdown',e=>{});", '').replace('<button id="again">Play again</button>', '');
  const r2 = validateHtml(keyboardOnly, { kind: 'game' });
  assert.ok(r2.warnings.some((w) => w.id === 'game-has-touch'), 'keyboard-only is unplayable on a phone');
  assert.ok(r2.warnings.some((w) => w.id === 'game-has-restart'));
});

test('GB-1: game checks apply ONLY to kind:game — an app is not asked for a canvas', () => {
  const app = validateHtml(GOOD, { kind: 'application' });
  assert.ok(!app.warnings.some((w) => w.id.startsWith('game-')));
  const site = validateHtml(GOOD, { kind: 'website' });
  assert.ok(!site.warnings.some((w) => w.id.startsWith('game-')));
});

test('GB-1: a game is held to the SAME security gate as everything else', () => {
  const evilGame = GOOD_GAME.replace('function loop(){', 'eval("cheat()");function loop(){');
  assert.equal(validateHtml(evilGame, { kind: 'game' }).ok, false);
});

test('quality issues are WARNINGS, not errors — they never block a safe document', () => {
  const todo = GOOD.replace('<h1>Expenses</h1>', '<h1>Expenses</h1><!-- TODO finish this -->');
  const r = validateHtml(todo, { kind: 'application' });
  assert.equal(r.ok, true); // still ok — TODO is warn-level
  assert.ok(r.warnings.some((w) => w.id === 'no-todo'));
});

test('no-todo does not false-positive on an ordinary HTML placeholder= attribute (B3 fix)', () => {
  const withInput = GOOD.replace('<h1>Expenses</h1>', '<h1>Expenses</h1><input placeholder="Add an item…">');
  const r = validateHtml(withInput, { kind: 'application' });
  assert.ok(!r.warnings.some((w) => w.id === 'no-todo'));
  const stillCatchesFiller = GOOD.replace('<h1>Expenses</h1>', '<h1>Expenses</h1><p>PLACEHOLDER content goes here</p>');
  assert.ok(validateHtml(stillCatchesFiller, { kind: 'application' }).warnings.some((w) => w.id === 'no-todo'));
});

test('size ceiling is enforced as an error', () => {
  const huge = '<!doctype html><html><head><meta name="viewport" content="x"></head><body>' + 'a'.repeat(MAX_HTML_BYTES) + '</body></html>';
  assert.ok(validateHtml(huge).errors.some((e) => e.id === 'size'));
});

test('APPROVED_HOSTS is a frozen, non-empty allowlist', () => {
  assert.ok(APPROVED_HOSTS.length >= 3);
  assert.ok(Object.isFrozen(APPROVED_HOSTS));
});

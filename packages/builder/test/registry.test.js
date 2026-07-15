// B4b · registry tests — mechanical checks that the 20 portable blocks
// (docs/arganta-core/blocks/*.html, generated into registry.js by
// build-registry.js) actually satisfy the B1-frozen contracts they promise:
// the PortableComponent shape, the assembly-safety rules blocks must follow
// so they can be concatenated into one artifact, and validate.js's gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PORTABLE_REGISTRY, isValidComponent, COMPONENT_CATEGORIES, selectComponents, validateHtml, extractExternalHosts, APPROVED_HOSTS } from '../src/index.js';

test('exactly 20 blocks are registered (B4a-Block-Design.md §5 has 20 rows)', () => {
  assert.equal(PORTABLE_REGISTRY.length, 20);
});

test('every registered block passes isValidComponent', () => {
  PORTABLE_REGISTRY.forEach((c) => {
    assert.ok(isValidComponent(c), `${c.id} failed isValidComponent`);
  });
});

test('ids are unique and categories are from the frozen COMPONENT_CATEGORIES set', () => {
  const ids = PORTABLE_REGISTRY.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id found');
  PORTABLE_REGISTRY.forEach((c) => {
    assert.ok(COMPONENT_CATEGORIES.includes(c.category), `${c.id} has unknown category ${c.category}`);
  });
});

test('ids/categories match the B4a spec table exactly', () => {
  const expected = {
    'nav-top': 'navigation', 'nav-sidebar': 'navigation', 'nav-bottom': 'navigation',
    'hero-centered': 'hero', 'hero-split': 'hero',
    'feature-grid': 'layout', 'metric-card': 'metric', 'metric-grid': 'metric',
    'data-table': 'table', 'activity-feed': 'timeline',
    'kanban': 'layout', 'calendar': 'layout', 'gallery': 'gallery',
    'chart-line': 'chart', 'chart-bar': 'chart', 'chart-donut': 'chart',
    'form-modal': 'form', 'pricing': 'pricing', 'testimonials': 'layout', 'footer': 'footer',
  };
  const byId = Object.fromEntries(PORTABLE_REGISTRY.map((c) => [c.id, c.category]));
  Object.entries(expected).forEach(([id, category]) => {
    assert.equal(byId[id], category, `${id} expected category ${category}, got ${byId[id]}`);
  });
  assert.equal(Object.keys(byId).length, Object.keys(expected).length);
});

test('no block html/css/js references an external URL, eval(, new Function(, or parent/top window access', () => {
  // Reuse validate.js's OWN extractExternalHosts (matches only src=/href=
  // attribute URLs) rather than a hand-rolled regex — a hand-rolled "any
  // http:// substring" check false-positives on the standard SVG namespace
  // URI (http://www.w3.org/2000/svg) that chart-bar/-line/-donut legitimately
  // pass to createElementNS, which fetches nothing.
  PORTABLE_REGISTRY.forEach((c) => {
    const combined = c.html + c.css + (c.javascript || '');
    const hosts = extractExternalHosts(combined).filter((h) => !APPROVED_HOSTS.includes(h));
    assert.deepEqual(hosts, [], `${c.id} references unapproved external host(s): ${hosts.join(', ')}`);
    assert.ok(!/\beval\s*\(/.test(combined), `${c.id} uses eval(`);
    assert.ok(!/new\s+Function\s*\(/.test(combined), `${c.id} uses new Function(`);
    assert.ok(!/\b(window\.top|window\.parent|\bparent\.|\btop\.)/.test(combined), `${c.id} touches parent/top window`);
  });
});

test('all 20 blocks assembled into one document pass validate.js with zero errors', () => {
  const css = PORTABLE_REGISTRY.map((c) => c.css).join('\n');
  const html = PORTABLE_REGISTRY.map((c) => c.html).join('\n');
  const js = PORTABLE_REGISTRY.filter((c) => c.javascript).map((c) => c.javascript).join('\n');
  const assembled = `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assembled blocks</title><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;

  const result = validateHtml(assembled, { kind: 'application' });
  assert.deepEqual(result.errors, [], `assembled doc has validation errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.ok, true);
});

test('selectComponents: "dashboard with charts and a kanban board" (application) returns chart + kanban blocks', () => {
  const picked = selectComponents(PORTABLE_REGISTRY, { brief: 'A dashboard with charts and a kanban board', kind: 'application', max: 8 });
  const ids = picked.map((c) => c.id);
  assert.ok(ids.some((id) => id.startsWith('chart-')), `expected a chart block, got: ${ids.join(', ')}`);
  assert.ok(ids.includes('kanban'), `expected kanban, got: ${ids.join(', ')}`);
  picked.forEach((c) => assert.ok(c.suitableFor.includes('application')));
});

test('selectComponents: a website brief never returns application-only blocks', () => {
  const picked = selectComponents(PORTABLE_REGISTRY, { brief: 'A landing page with pricing and testimonials', kind: 'website', max: 8 });
  picked.forEach((c) => assert.ok(c.suitableFor.includes('website'), `${c.id} is not suitable for website`));
});

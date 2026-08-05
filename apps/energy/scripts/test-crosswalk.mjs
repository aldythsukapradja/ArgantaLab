// crosswalk truth-lock — country normalisation (G5/G6) + the country ⇄ province
// link that does not exist in any source (G3).
// Run: node scripts/test-crosswalk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

const cwPath = path.join(root, 'public', 'agent', 'crosswalk.json');
if (!fs.existsSync(cwPath)) { console.log('SKIP — run `node scripts/build-crosswalk.mjs` first'); process.exit(0); }
const cw = JSON.parse(fs.readFileSync(cwPath, 'utf8'));
const { resolveCountryToken, toIso2, COUNTRIES } = await import('./lib/countries.mjs');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(root, 'public', ...p), 'utf8'));

// ── 1 · the token space is fully covered ─────────────────────────────────────
// The whole point of the table. If a new source introduces a spelling we do not
// know, this fails LOUDLY rather than dropping that country's fields silently.
const search = readJson('osdu', 'cockpit-search.json');
const scopeFields = readJson('osdu', 'cockpit-scope-fields.json');
const kbFields = readJson('kb', 'master-kb-fields.json').field;
const spine = readJson('kb', 'master-kb-spine.json');

const tokens = new Set();
for (const e of search.entries) { if (e.type === 'country') tokens.add(e.name); if (e.type === 'field') tokens.add(e.parent); }
for (const f of Object.values(scopeFields.provinces).flat()) tokens.add(f.country);
for (const f of Object.values(scopeFields.assessmentUnits).flat()) tokens.add(f.country);
for (const f of kbFields) tokens.add(f.country_id);
for (const c of spine.country) tokens.add(c.name);

const unresolved = [...tokens].filter((t) => t !== null && t !== undefined && resolveCountryToken(t).kind === 'unknown');
check(`every country token across 5 sources resolves (${tokens.size} distinct)`, unresolved.length === 0,
  unresolved.length ? `unresolved: ${unresolved.slice(0, 8).join(' | ')}` : '');
check('the build recorded no unknown tokens either', cw.unknownCountryTokens.length === 0);

// ── 2 · the five spellings of one country collapse (G5) ──────────────────────
check('NO ≡ Norway', toIso2('NO') === 'NO' && toIso2('Norway') === 'NO');
check('GB ≡ United Kingdom ≡ UK', toIso2('GB') === 'GB' && toIso2('United Kingdom') === 'GB' && toIso2('UK') === 'GB');
check('U.S.A. ≡ United States', toIso2('U.S.A.') === 'US' && toIso2('United States') === 'US');
check('Türkiye ≡ Turkey ≡ the GOGET slug', toIso2('Türkiye') === 'TR' && toIso2('Turkey') === 'TR' && toIso2('t-rkiye') === 'TR');
check("Côte d'Ivoire ≡ Cote d'Ivoire ≡ the GOGET slug", toIso2("Côte d'Ivoire") === 'CI' && toIso2("Cote d'Ivoire") === 'CI' && toIso2('c-te-d-ivoire') === 'CI');
check('Papua-New Guinea ≡ Papua New Guinea', toIso2('Papua-New Guinea') === 'PG' && toIso2('Papua New Guinea') === 'PG');
check('atlas: ids unwrap', toIso2('atlas:country:un:NO') === 'NO' && toIso2('atlas:country:goget:united-states') === 'US');
check('ANP puts a BASIN in the country slot — the prefix still wins', toIso2('BR · Santos') === 'BR' && toIso2('BR · Espírito Santo-Mucuri') === 'BR');

// merging must not over-merge
check('Congo and DR Congo stay distinct', toIso2('Congo') === 'CG' && toIso2('Democratic Republic of Congo') === 'CD');
check('Israel and Palestine stay distinct', toIso2('Israel') === 'IL' && toIso2('Palestine') === 'PS');
check('Guinea, Equatorial Guinea and Guinea-Bissau stay distinct',
  new Set(['Guinea', 'Equatorial Guinea', 'Guinea-Bissau'].map(toIso2)).size === 3);
check('no two ISO codes share a canonical name', new Set(COUNTRIES.map((c) => c.name)).size === COUNTRIES.length);

// ── 3 · regions are demoted, not deleted (G6) ────────────────────────────────
const regionTokens = ['Europe', 'Asia Pacific', 'North America', 'Former Soviet Union',
  'Middle East and North Africa', 'Central and South America', 'Sub-Saharan Africa and Antarctica',
  'South Asia', 'Arctic Ocean'];
check('all 9 USGS regions resolve as regions, not countries',
  regionTokens.every((t) => resolveCountryToken(t).kind === 'region'));
check('regions carry their USGS digit', resolveCountryToken('Europe').code === '4' && resolveCountryToken('Asia Pacific').code === '3');
check('"Offshore" is neither country nor region', resolveCountryToken('Offshore').kind === 'none');
check('no region leaked into the country list', !cw.countries.some((c) => regionTokens.includes(c.name)));
check('crosswalk carries all 9 regions', cw.regions.length === 9);

// ── 4 · the link that did not exist (G3) ─────────────────────────────────────
const byIso = new Map(cw.countries.map((c) => [c.iso2, c]));
const provName = (code) => cw.provinces.find((p) => p.code === code)?.name;
const provincesOf = (iso) => cw.edges.filter((e) => e.country === iso).map((e) => provName(e.province));

check('131 of 179 provinces reach a country', cw.counts.provincesWithCountry === 131 && cw.counts.provinces === 179);
check('77 countries reach a province', cw.counts.countries === 77 && cw.countries.length === 77);

const idn = provincesOf('ID');
check('Indonesia → 12 basins', idn.length === 12, idn.length ? `got ${idn.length}` : '');
check('Indonesia includes Kutei Basin', idn.includes('Kutei Basin'));
check('Kutei Basin is province 3817 with 20 member fields',
  cw.edges.some((e) => e.country === 'ID' && e.province === '3817' && e.fields === 20));
check('Norway → 3 basins', provincesOf('NO').length === 3);
check('United Kingdom → 2 basins', provincesOf('GB').length === 2);
// 8, not the 4 an un-normalised probe reports: ANP tags fields "BR" while GOGET
// tags them "Brazil", so half of Brazil's provinces only appear once G5 is fixed.
check('Brazil → 8 basins (ISO merge recovers the ANP half)', provincesOf('BR').length === 8);

// ── 5 · a province is a container that crosses borders ───────────────────────
const nsg = cw.provinces.find((p) => p.code === '4025');
check('North Sea Graben is shared by 5 countries', nsg.countries.length === 5);
check('… ranked by member fields, GB first', nsg.countries[0].country === 'GB' && nsg.countries[1].country === 'NO');
check('… and none of them claims 100%', nsg.countries.every((c) => c.share < 1));
check('shares are a membership statistic that sums to 1',
  cw.provinces.filter((p) => p.countries.length).every((p) => {
    const sum = p.countries.reduce((s, c) => s + c.share, 0);
    return Math.abs(sum - 1) < 0.01;
  }));
check('Indonesia is correctly a MINORITY member of the Malay Basin',
  cw.edges.find((e) => e.country === 'ID' && e.province === '3703').share < 0.2);

// ── 6 · every edge is honest about how it was derived ────────────────────────
const VOCAB = ['authoritative', 'spatial', 'membership', 'inferred'];
check('every edge carries a confidence from the vocabulary', cw.edges.every((e) => VOCAB.includes(e.confidence)));
check('no edge claims to be authoritative — none of this is published anywhere',
  !cw.edges.some((e) => e.confidence === 'authoritative'));
check('186 of 191 edges are corroborated by both derivations',
  cw.counts.corroboratedEdges === 186 && cw.counts.edges === 191);
check('the membership pass reaches no province the spatial pass missed',
  cw.edges.filter((e) => e.confidence === 'membership').length === 0);
check('every edge cites at least one field', cw.edges.every((e) => e.fields > 0));

// ── 7 · orphans are retained with a reason ───────────────────────────────────
check('48 orphan provinces are retained, not dropped', cw.orphans.length === 48);
check('every orphan states why', cw.orphans.every((o) => typeof o.reason === 'string' && o.reason.length > 10));
// The finding that removed the need for a country-boundary layer entirely.
check('EVERY orphan has zero member fields (a polygon layer would add nothing)',
  cw.orphans.every((o) => o.memberFields === 0));
check('orphans keep their region so they stay reachable', cw.orphans.every((o) => /^[0-8]$/.test(o.region)));
check('linked + orphan = all provinces', cw.counts.provincesWithCountry + cw.orphans.length === cw.counts.provinces);

// ── 8 · derived country geometry ─────────────────────────────────────────────
const extents = cw.countries.filter((c) => c.dataExtent);
check('every country with fields gets a data extent', extents.length === cw.countries.length);
check('extents are valid lon/lat', extents.every((c) => {
  const [w, s, e, n] = c.dataExtent.bbox;
  return w >= -180 && w <= 180 && e >= -180 && e <= 180 && s >= -90 && s <= 90 && n >= -90 && n <= 90 && n >= s;
}));
check('fly targets sit inside their own latitude range', extents.every((c) => {
  const [, s, , n] = c.dataExtent.bbox;
  return c.dataExtent.fly.lat >= s - 1e-6 && c.dataExtent.fly.lat <= n + 1e-6;
}));
// Russia's fields straddle the antimeridian; a naive bbox flies the map to the Atlantic.
check('Russia gets a sane extent despite the dateline',
  byIso.get('RU').dataExtent.fly.lon > 30 && byIso.get('RU').dataExtent.fly.lon < 150);
check('Indonesia flies to the archipelago', (() => {
  const { lon, lat } = byIso.get('ID').dataExtent.fly;
  return lon > 94 && lon < 142 && lat > -12 && lat < 7;
})());
check('a big country zooms out further than a small one',
  byIso.get('RU').dataExtent.fly.zoom < byIso.get('GB').dataExtent.fly.zoom);

// ── 9 · country → region is derived, and admits multi-region countries ───────
check('every country resolves a primary region', cw.countries.every((c) => /^[0-8]$/.test(c.primaryRegion)));
check('Indonesia is Asia Pacific (3)', byIso.get('ID').primaryRegion === '3');
check('Norway and the UK are Europe (4)', byIso.get('NO').primaryRegion === '4' && byIso.get('GB').primaryRegion === '4');
check('Russia is Former Soviet Union (1)', byIso.get('RU').primaryRegion === '1');
check('a country spanning two USGS regions keeps both', cw.countries.some((c) => c.regions.length > 1));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

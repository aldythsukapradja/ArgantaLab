// scripts/lib/countries.mjs — the country normalisation table (agent gap G5/G6).
//
// Five sources name the same country five ways:
//   USGS DDS-69     "U.S.A."           "Papua-New Guinea"  "Cote d'Ivoire"
//   GOGET           "United States"    "Papua New Guinea"  "Côte d'Ivoire"
//   Sodir / NSTA    "NO"               "GB"
//   Brazil ANP      "BR · Santos"      (a BASIN in the country slot)
//   Master KB       "atlas:country:goget:united-states" | "atlas:country:un:NO"
//
// Every token from every source resolves here to one ISO-3166-1 alpha-2 code, or
// the build fails loudly. `test-crosswalk.mjs` asserts the token space is fully
// covered, so a new data source can never silently drop a country on the floor.
//
// The nine USGS "regions" and the GOGET "Offshore" placeholder ride in the same
// country slot upstream; they are demoted here rather than deleted, because the
// agent still has to answer "what's in Europe" — just not as a country.

/** USGS DDS-69 assessment regions. `code` is the leading digit of a province id. */
export const USGS_REGIONS = [
  { code: '0', name: 'Arctic Ocean' },
  { code: '1', name: 'Former Soviet Union' },
  { code: '2', name: 'Middle East and North Africa' },
  { code: '3', name: 'Asia Pacific' },
  { code: '4', name: 'Europe' },
  { code: '5', name: 'North America' },
  { code: '6', name: 'Central and South America' },
  { code: '7', name: 'Sub-Saharan Africa and Antarctica' },
  { code: '8', name: 'South Asia' },
];

// Keyed by the SAME fold used at lookup time. A plain .toLowerCase() here silently
// missed every hyphenated region ("Sub-Saharan Africa and Antarctica"), which then
// fell through to the country table and came back unknown.
const REGION_BY_KEY = new Map(USGS_REGIONS.map((r) => [foldToken(r.name), r]));

/** Tokens that occupy a country slot but name no country. */
const NON_COUNTRY = new Set(['offshore', 'unknown', 'n/a', '-', '']);

/**
 * ISO2 → canonical name + every spelling seen in the shipped data.
 * Aliases are matched case- and accent-insensitively, so only genuinely
 * different STRINGS need listing (not "Türkiye" vs "Turkiye").
 */
export const COUNTRIES = [
  ['AF', 'Afghanistan'],
  ['AL', 'Albania'],
  ['DZ', 'Algeria'],
  ['AO', 'Angola'],
  ['AR', 'Argentina'],
  ['AU', 'Australia'],
  ['AT', 'Austria'],
  ['AZ', 'Azerbaijan'],
  ['BH', 'Bahrain'],
  ['BD', 'Bangladesh'],
  ['BB', 'Barbados'],
  ['BY', 'Belarus'],
  ['BE', 'Belgium'],
  ['BZ', 'Belize'],
  ['BJ', 'Benin'],
  ['BO', 'Bolivia'],
  ['BR', 'Brazil'],
  ['BN', 'Brunei', ['Brunei Darussalam']],
  ['KH', 'Cambodia'],
  ['CM', 'Cameroon'],
  ['CA', 'Canada'],
  ['CF', 'Central African Republic'],
  ['TD', 'Chad'],
  ['CL', 'Chile'],
  ['CN', 'China'],
  ['CO', 'Colombia'],
  // USGS says "Congo" for the republic; GOGET spells it out. The DRC is separate.
  ['CG', 'Republic of the Congo', ['Congo', 'Congo-Brazzaville']],
  ['CD', 'Democratic Republic of Congo', ['DR Congo', 'Congo-Kinshasa', 'Zaire']],
  // GOGET slugs ids by replacing every non-ASCII char with '-', which DROPS the
  // letter: "Côte" → "c-te", "Türkiye" → "t-rkiye". Those slugs are listed
  // verbatim rather than reconstructed by a wildcard rule that could mis-map.
  ['CI', "Côte d'Ivoire", ["Cote d'Ivoire", 'Ivory Coast', 'c-te-d-ivoire']],
  ['CU', 'Cuba'],
  ['CY', 'Cyprus'],
  ['DK', 'Denmark'],
  ['EC', 'Ecuador'],
  ['EG', 'Egypt'],
  ['GQ', 'Equatorial Guinea'],
  ['ER', 'Eritrea'],
  ['ET', 'Ethiopia'],
  ['FK', 'Falkland Islands', ['Falkland Islands (Malvinas)', 'Malvinas']],
  ['FR', 'France'],
  ['GA', 'Gabon'],
  ['GM', 'Gambia', ['The Gambia']],
  ['GE', 'Georgia'],
  ['DE', 'Germany'],
  ['GH', 'Ghana'],
  ['GL', 'Greenland'],
  ['GD', 'Grenada'],
  ['GT', 'Guatemala'],
  ['GN', 'Guinea'],
  ['GW', 'Guinea-Bissau'],
  ['GY', 'Guyana'],
  ['HU', 'Hungary'],
  ['IN', 'India'],
  ['ID', 'Indonesia'],
  ['IR', 'Iran', ['Islamic Republic of Iran']],
  ['IQ', 'Iraq'],
  ['IE', 'Ireland'],
  // USGS assesses Israel and the Palestinian Territories as one province set. We
  // keep ISO IL as the key and record the aggregate spelling as an alias rather
  // than inventing a country that ISO does not have.
  ['IL', 'Israel', ['Israel and Palestinian Territories']],
  ['PS', 'Palestine', ['Palestinian Territories', 'State of Palestine']],
  ['IT', 'Italy'],
  ['JP', 'Japan'],
  ['JO', 'Jordan'],
  ['KZ', 'Kazakhstan'],
  ['KE', 'Kenya'],
  ['KW', 'Kuwait'],
  ['LA', 'Laos', ["Lao People's Democratic Republic"]],
  ['LB', 'Lebanon'],
  ['LY', 'Libya'],
  ['MG', 'Madagascar'],
  ['MY', 'Malaysia'],
  ['MR', 'Mauritania'],
  ['MX', 'Mexico'],
  ['MN', 'Mongolia'],
  ['MA', 'Morocco'],
  ['MZ', 'Mozambique'],
  ['MM', 'Myanmar', ['Burma']],
  ['NA', 'Namibia'],
  ['NL', 'Netherlands', ['The Netherlands', 'Holland']],
  ['NZ', 'New Zealand'],
  ['NE', 'Niger'],
  ['NG', 'Nigeria'],
  ['NO', 'Norway'],
  ['OM', 'Oman'],
  ['PK', 'Pakistan'],
  ['PG', 'Papua New Guinea', ['Papua-New Guinea']],
  ['PY', 'Paraguay'],
  ['PE', 'Peru'],
  ['PH', 'Philippines'],
  ['PL', 'Poland'],
  ['QA', 'Qatar'],
  ['RO', 'Romania'],
  ['RU', 'Russia', ['Russian Federation']],
  ['SA', 'Saudi Arabia'],
  ['SN', 'Senegal'],
  ['ZA', 'South Africa'],
  ['SS', 'South Sudan'],
  ['ES', 'Spain'],
  ['LK', 'Sri Lanka'],
  ['SD', 'Sudan'],
  ['SR', 'Suriname'],
  ['SY', 'Syria', ['Syrian Arab Republic']],
  ['TJ', 'Tajikistan'],
  ['TZ', 'Tanzania', ['United Republic of Tanzania']],
  ['TH', 'Thailand'],
  ['TL', 'Timor-Leste', ['East Timor']],
  ['TG', 'Togo'],
  ['TT', 'Trinidad and Tobago'],
  ['TN', 'Tunisia'],
  ['TR', 'Türkiye', ['Turkey', 't-rkiye']],
  ['TM', 'Turkmenistan'],
  ['UG', 'Uganda'],
  ['UA', 'Ukraine'],
  ['AE', 'United Arab Emirates', ['UAE']],
  ['GB', 'United Kingdom', ['UK', 'Great Britain', 'U.K.']],
  ['US', 'United States', ['U.S.A.', 'USA', 'United States of America', 'U.S.']],
  ['UZ', 'Uzbekistan'],
  ['VE', 'Venezuela'],
  ['VN', 'Vietnam', ['Viet Nam']],
  ['EH', 'Western Sahara'],
  ['YE', 'Yemen'],
  ['ZW', 'Zimbabwe'],
].map(([iso2, name, aliases = []]) => ({ iso2, name, aliases }));

/** Fold accents, punctuation and case so "Côte d'Ivoire" ≡ "cote d ivoire". */
export function foldToken(raw) {
  return String(raw ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const BY_TOKEN = new Map();
for (const country of COUNTRIES) {
  BY_TOKEN.set(foldToken(country.iso2), country.iso2);
  BY_TOKEN.set(foldToken(country.name), country.iso2);
  for (const alias of country.aliases) BY_TOKEN.set(foldToken(alias), country.iso2);
}
export const COUNTRY_BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]));

// Letters-only index for the separator-insensitive retry. A squashed key that
// would map to two different countries is dropped rather than picked at random.
const LOOSE_INDEX = new Map();
for (const [token, iso2] of BY_TOKEN) {
  const squashed = token.replace(/[^a-z0-9]/g, '');
  if (!squashed) continue;
  if (LOOSE_INDEX.has(squashed) && LOOSE_INDEX.get(squashed) !== iso2) LOOSE_INDEX.set(squashed, null);
  else if (!LOOSE_INDEX.has(squashed)) LOOSE_INDEX.set(squashed, iso2);
}
for (const [key, value] of [...LOOSE_INDEX]) if (!value) LOOSE_INDEX.delete(key);

/**
 * Resolve any country-slot token to a verdict. Never throws, never guesses —
 * an unknown token comes back as `{ kind: 'unknown' }` and the build reports it.
 *
 *   'Norway' | 'NO' | 'atlas:country:un:NO'    → { kind:'country', iso2:'NO' }
 *   'BR · Santos'                              → { kind:'country', iso2:'BR' }  (ANP puts a basin here)
 *   'Europe'                                   → { kind:'region', code:'4' }
 *   'Offshore'                                 → { kind:'none' }
 */
export function resolveCountryToken(raw) {
  if (raw === null || raw === undefined) return { kind: 'none' };
  let token = String(raw).trim();

  // atlas:country:<authority>:<native> — take the native part.
  if (token.startsWith('atlas:country:')) token = token.split(':').pop() ?? '';
  // ANP writes "BR · Santos" (country · basin). The prefix is the country.
  const sep = token.indexOf('·');
  if (sep > 0) token = token.slice(0, sep);

  const folded = foldToken(token);
  if (!folded || NON_COUNTRY.has(folded)) return { kind: 'none' };
  const region = REGION_BY_KEY.get(folded);
  if (region) return { kind: 'region', code: region.code, name: region.name };
  const iso2 = BY_TOKEN.get(folded);
  if (iso2) return { kind: 'country', iso2, name: COUNTRY_BY_ISO.get(iso2).name };

  // Separator-insensitive retry ("unitedkingdom" ≡ "united kingdom"). Compares
  // letters only, so it can merge spellings but never two different countries.
  const squashed = folded.replace(/[^a-z0-9]/g, '');
  const loose = LOOSE_INDEX.get(squashed);
  if (loose) return { kind: 'country', iso2: loose, name: COUNTRY_BY_ISO.get(loose).name };

  return { kind: 'unknown', token: String(raw) };
}

/** Convenience: the ISO2 or null. */
export function toIso2(raw) {
  const verdict = resolveCountryToken(raw);
  return verdict.kind === 'country' ? verdict.iso2 : null;
}

/**
 * DE-IDENTIFICATION for the public twin.
 *
 * The alias on an ExperienceEntry only covers the company FIELD. Real employers
 * still leak through everything else — bullet prose ("candidate for Total E&P's
 * Best Innovator"), award lines ("Nahr Umr Award — North Oil Company"), schools,
 * and the field names that identify an operator instantly (Al Shaheen). The
 * Arganta profile is the ground truth for a PUBLIC account, so a leak here ships
 * a real employer name to Instagram.
 *
 * So the twin's seed text runs through one ordered replacement map. It is
 * applied when the twin profile is built, which means the founder sees the
 * de-identified prose in the editor and can rewrite any line by hand — the map
 * is a safe default, not a runtime filter he can't see. `scrubTwin` is also
 * exported as a final guard for the Core export.
 *
 * What deliberately STAYS: geography (Indonesia · France · Qatar), basin and
 * conference names, and the products the founder built. The canonical handoff
 * makes the countries and the journey public on purpose, and conference names
 * are already on the public papers. Only the employer identity is removed.
 *
 * Ordered longest-first: "Total E&P Indonésie" must match before "Total E&P".
 */

export const TWIN_REPLACEMENTS: [RegExp, string][] = [
  // employers
  [/North Oil Company/g, 'the operator'],
  [/Total E&P Indonésie/g, 'the French supermajor'],
  [/Total E&P’s/g, 'the French supermajor’s'],
  [/Total E&P/g, 'the French supermajor'],
  [/Total Global Scholarship/g, 'a supermajor’s global scholarship'],
  [/Pertamina Hulu Mahakam/g, 'the Mahakam joint venture'],
  [/Pertamina/g, 'the national energy company'],
  [/Energi Mega Persada/g, 'an Indonesian independent E&P'],
  [/LAPI-ITB × British Petroleum/g, 'a university research group × a British supermajor'],
  [/LAPI-ITB/g, 'a university research group'],
  [/British Petroleum/g, 'a British supermajor'],
  [/\bBP\b/g, 'a British supermajor'],
  // the state major + its forum
  [/QatarEnergy LNG Forum/g, 'a national LNG forum'],
  [/QatarEnergy/g, 'the state energy major'],
  // schools
  [/IFP School/g, 'a French petroleum institute'],
  [/Institut Teknologi Bandung/g, 'a leading Indonesian technical institute'],
  [/\bITB\b/g, 'a leading Indonesian technical institute'],
  // fields that identify the employer on sight
  [/Al Shaheen/g, 'the giant carbonate oil field'],
  [/Nahr Umr Award for Innovation & Business Efficiency/g, 'the operator’s innovation & business-efficiency award'],
  [/Nahr Umr Award/g, 'the operator’s innovation award'],
  [/Nahr Umr/g, 'the operator’s innovation award'],
  // internal award vocabulary
  [/Recognition Award, first service year/g, 'first-service-year recognition award'],
]

export const scrubTwin = (s: string): string =>
  TWIN_REPLACEMENTS.reduce((out, [re, to]) => out.replace(re, to), s)

/** Deep-scrub every string in a cloned twin payload. */
export function scrubDeep<T>(v: T): T {
  if (typeof v === 'string') return scrubTwin(v) as unknown as T
  if (Array.isArray(v)) return v.map(scrubDeep) as unknown as T
  if (v && typeof v === 'object') {
    const out: any = {}
    for (const [k, val] of Object.entries(v as any)) {
      // never rewrite ids, urls or asset paths — only human prose
      out[k] = k === 'id' || k === 'url' || k === 'logo' || k === 'photo' ? val : scrubDeep(val)
    }
    return out
  }
  return v
}

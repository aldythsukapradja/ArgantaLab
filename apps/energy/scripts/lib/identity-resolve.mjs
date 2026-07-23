// identity-resolve.mjs — cross-source Field identity resolution (way-forward Stream A).
// The same physical field appears in GOGET (global spine) AND a regulator lane (North Sea
// Sodir/NSTA, Brazil ANP), with DIFFERENT names ("16/1-34 S (Lillefix) … (Norway)" vs the
// regulator's "VOLVE") and different country tokens ("Norway" vs "NO"). Left alone that is a
// duplicate OSDU Field record + a duplicate cockpit dot. This resolves clusters into ONE
// identity, keeps every native ID as a reviewed alias, and NEVER merges on name alone —
// every match requires spatial agreement (contract: "retain every native source ID and
// never merge on name alone"). Dependency-free.

// ── country normalization (GOGET verbose ↔ regulator ISO-2) ──
const COUNTRY = {
  norway: 'NO', no: 'NO', 'united kingdom': 'GB', uk: 'GB', gb: 'GB', 'great britain': 'GB',
  brazil: 'BR', br: 'BR', denmark: 'DK', dk: 'DK', netherlands: 'NL', nl: 'NL', germany: 'DE', de: 'DE',
  'united states': 'US', usa: 'US', us: 'US', canada: 'CA', ca: 'CA', australia: 'AU', au: 'AU',
};
export function normCountry(s) {
  const k = String(s || '').toLowerCase().trim();
  return COUNTRY[k] || (k ? k.toUpperCase().slice(0, 2) : '');
}

// ── name normalization + parenthetical-alias extraction ──
const STOP = new Set(['oil', 'gas', 'and', 'condensate', 'ngl', 'field', 'unit', 'the', 'area', 'discovery']);
export function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter((t) => t && !STOP.has(t)).join(' ').trim();
}
export function parenAlias(s) { const m = /\(([^)]+)\)/.exec(String(s || '')); return m ? normName(m[1]) : ''; }

// Dice coefficient on token sets
function nameSim(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' ').filter(Boolean)), tb = new Set(b.split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0; for (const t of ta) if (tb.has(t)) inter += 1;
  return (2 * inter) / (ta.size + tb.size);
}

function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const la1 = a[1] * rad, la2 = b[1] * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// match decision — ALWAYS requires spatial agreement (never name-alone)
function isMatch(A, B) {
  if (A.cc && B.cc && A.cc !== B.cc) return false;       // countries must agree when both known
  const d = haversineKm(A.c, B.c);
  if (d > 15) return false;
  const ns = Math.max(nameSim(A.nn, B.nn), nameSim(A.alias, B.nn), nameSim(A.nn, B.alias), nameSim(A.alias, B.alias));
  if (d <= 1.5) return true;             // co-located + same country → same field (names differ by source)
  if (d <= 5 && ns >= 0.34) return true; // close + some name signal
  if (d <= 15 && ns >= 0.7) return true; // moderate + strong name signal
  return false;
}

// GOGET is the global spine; regulator/Volve lanes are authoritative for their jurisdiction.
const isSpine = (s) => s === 'GOGET';

// match SCORE (higher = better), or -1 for no match. Same gate as isMatch but ranked.
function matchScore(A, B) {
  if (A.cc && B.cc && A.cc !== B.cc) return -1;
  const d = haversineKm(A.c, B.c);
  if (d > 15) return -1;
  const ns = Math.max(nameSim(A.nn, B.nn), nameSim(A.alias, B.nn), nameSim(A.nn, B.alias), nameSim(A.alias, B.alias));
  const ok = (d <= 1.5) || (d <= 5 && ns >= 0.34) || (d <= 15 && ns >= 0.7);
  return ok ? ns * 100 + (15 - d) : -1;  // name-first, then proximity
}

/**
 * DIRECTIONAL resolution: each authoritative (regulator/ANP/Volve) field claims its single
 * best GOGET duplicate. No same-source merges, no transitive blobs. One GOGET record is
 * claimed at most once. Canonical = the authoritative field; the GOGET record becomes a
 * reviewed alias. GOGET-only fields keep their own identity.
 * @param items Array<{id, name, source, country, centroid:[lon,lat]}>
 * @returns { clusters, canonicalOf:Map, aliasToCanonical:Map, stats }
 */
export function resolveIdentities(items) {
  const F = items.map((it) => ({
    id: it.id, name: it.name, source: it.source,
    cc: normCountry(it.country), nn: normName(it.name), alias: parenAlias(it.name), c: it.centroid,
  }));
  // spatial hash of the GOGET spine only (the dedup targets)
  const cellKey = (c) => `${Math.floor(c[0] * 2)}:${Math.floor(c[1] * 2)}`;
  const spineGrid = new Map();
  F.forEach((f, i) => { if (isSpine(f.source) && f.c) { const k = cellKey(f.c); (spineGrid.get(k) || spineGrid.set(k, []).get(k)).push(i); } });

  const claimed = new Set();            // GOGET indices already claimed
  const aliasToCanonical = new Map();   // gogetId -> authoritativeId
  const canonicalOf = new Map();        // every id -> its resolved identity
  const clusters = [];

  // authoritative fields first (deterministic order), each claims best unclaimed GOGET twin
  const authIdx = F.map((f, i) => i).filter((i) => !isSpine(F[i].source) && F[i].c)
    .sort((a, b) => F[a].id.localeCompare(F[b].id));
  for (const ai of authIdx) {
    const f = F[ai];
    const [cx, cy] = [Math.floor(f.c[0] * 2), Math.floor(f.c[1] * 2)];
    let best = -1, bestScore = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const bucket = spineGrid.get(`${cx + dx}:${cy + dy}`); if (!bucket) continue;
      for (const gi of bucket) {
        if (claimed.has(gi)) continue;
        const sc = matchScore(f, F[gi]);
        if (sc > bestScore) { bestScore = sc; best = gi; }
      }
    }
    canonicalOf.set(f.id, f.id);
    if (best >= 0) {
      claimed.add(best);
      const g = F[best];
      aliasToCanonical.set(g.id, f.id);
      canonicalOf.set(g.id, f.id);
      clusters.push({
        canonicalId: f.id, name: f.name, country: f.cc, memberCount: 2,
        sources: [{ id: f.id, source: f.source, name: f.name }, { id: g.id, source: g.source, name: g.name }],
      });
    }
  }
  // all unclaimed GOGET fields keep their own identity
  F.forEach((f) => { if (!canonicalOf.has(f.id)) canonicalOf.set(f.id, f.id); });

  const identities = new Set([...canonicalOf.values()]).size;
  return {
    clusters,
    canonicalOf,
    aliasToCanonical,
    stats: {
      inputFields: F.length, identities, duplicatesCollapsed: aliasToCanonical.size,
      authoritativeFields: authIdx.length, spineFields: F.filter((f) => isSpine(f.source)).length,
    },
  };
}

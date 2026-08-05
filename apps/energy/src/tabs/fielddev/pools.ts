// pools.ts — separate the model's filled area into ACCUMULATIONS (S8).
//
// THE QUESTION THIS ANSWERS. An unfaulted model with no closure polygon fills every
// column whose reservoir top is shallower than the contact. On Volve that is 38 km²
// against a real trap of roughly 1.3 km², and the volume comes out ~29× too large.
// But "38 km² above the contact" is not one accumulation — it is every structural
// high on the map, most of them small, most of them separated from the field by
// saddles that lie BELOW the contact and therefore hold no oil.
//
// A pool is a CONNECTED component of above-contact columns. Two columns belong to the
// same accumulation only if you can walk between them without ever crossing below the
// contact — which is the physical statement that oil in one can reach the other.
// Flood-fill the above-contact region and each component is a separate accumulation
// with its own crest, its own area and its own volume.
//
// 4-connectivity, not 8. Two columns touching only at a corner are not a flow path;
// counting them as connected merges pools across a diagonal pinch-point that a
// finite-difference simulator would never let fluid through.
//
// AND THEN: a pool with a producing well in it is DRAINED — its volume is connected
// to something that actually flowed. A pool with no well is an undrained closure at
// best and a mapping artifact at worst, and the two must never be added together
// into one "STOIIP" without saying which is which.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.

export interface PoolGrid {
  nx: number; ny: number;
  dx: number; dy: number;
  x0: number; y0: number;
  /** per-column reservoir TOP, TVDSS positive down; NaN outside the model */
  topZ: ArrayLike<number>;
  /** per-column reservoir BASE */
  baseZ: ArrayLike<number>;
  /** 1 = column is in the model */
  activeCol: ArrayLike<number>;
}

export interface PoolWell {
  name: string;
  x: number; y: number;
  /** true when this bore actually produced — the distinction that makes a pool
   *  "drained" rather than merely "penetrated" */
  producer: boolean;
}

export interface Pool {
  id: number;
  /** column indices belonging to this accumulation */
  columns: number[];
  /** map area, m² */
  areaM2: number;
  /** shallowest reservoir top in the pool — the crest */
  crestZ: number;
  /** deepest above-contact top — how far down the closure reaches */
  deepestZ: number;
  /** gross rock volume between top and the contact, m³ */
  grvM3: number;
  /** oil column at the crest, m */
  columnM: number;
  /** wells whose surface slot falls inside this pool */
  wells: string[];
  /** wells in this pool that actually produced */
  producers: string[];
  /** true when at least one producing well sits in it */
  drained: boolean;
}

export interface PoolResult {
  pools: Pool[];
  /** total above-contact area across every pool, m² */
  totalAreaM2: number;
  /** pools holding at least one producer */
  drainedCount: number;
  /** GRV in drained pools vs everything else */
  drainedGrvM3: number;
  undrainedGrvM3: number;
  /** pools smaller than the noise floor, which are almost certainly map artifacts */
  tinyCount: number;
}

/**
 * Find the accumulations.
 *
 * `minColumns` drops components below a size that could not be a real closure —
 * a single column shallower than its neighbours is grid noise, not a field. They
 * are COUNTED so the number is visible rather than quietly discarded.
 */
export function findPools(
  grid: PoolGrid,
  owc: number,
  wells: PoolWell[] = [],
  minColumns = 4,
): PoolResult {
  const { nx, ny, dx, dy, topZ, baseZ, activeCol } = grid;
  const n = nx * ny;
  const cellArea = dx * dy;

  // a column is "filled" when it is in the model AND its reservoir top is above the
  // contact — there is oil in it only if the top of the rock is shallower than the
  // level below which everything is water
  const filled = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    if (!activeCol[c]) continue;
    const t = topZ[c], b = baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) continue;
    if (t < owc) filled[c] = 1;
  }

  // ── flood fill, 4-connected ──
  const label = new Int32Array(n).fill(-1);
  const pools: Pool[] = [];
  const stack: number[] = [];
  let tiny = 0;

  for (let seed = 0; seed < n; seed++) {
    if (!filled[seed] || label[seed] >= 0) continue;
    const id = pools.length;
    const columns: number[] = [];
    stack.length = 0;
    stack.push(seed);
    label[seed] = id;

    while (stack.length) {
      const c = stack.pop() as number;
      columns.push(c);
      const i = c % nx, j = (c - (c % nx)) / nx;
      // 4-connectivity: a corner touch is not a flow path
      const nb = [
        i > 0 ? c - 1 : -1,
        i < nx - 1 ? c + 1 : -1,
        j > 0 ? c - nx : -1,
        j < ny - 1 ? c + nx : -1,
      ];
      for (const m of nb) {
        if (m < 0 || !filled[m] || label[m] >= 0) continue;
        label[m] = id;
        stack.push(m);
      }
    }

    if (columns.length < minColumns) { tiny++; continue; }

    let crest = Infinity, deepest = -Infinity, grv = 0;
    for (const c of columns) {
      const t = topZ[c] as number, b = baseZ[c] as number;
      if (t < crest) crest = t;
      if (t > deepest) deepest = t;
      // rock between the top and whichever is shallower: the contact or the base
      const fillBase = Math.min(b, owc);
      if (fillBase > t) grv += cellArea * (fillBase - t);
    }

    pools.push({
      id, columns,
      areaM2: columns.length * cellArea,
      crestZ: crest, deepestZ: deepest,
      grvM3: grv,
      columnM: Math.max(0, owc - crest),
      wells: [], producers: [], drained: false,
    });
  }

  // ── attribute wells to pools ──
  for (const w of wells) {
    const i = Math.floor((w.x - grid.x0) / dx);
    const j = Math.floor((w.y - grid.y0) / dy);
    if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
    const id = label[j * nx + i];
    if (id < 0) continue;
    const pool = pools.find((p) => p.id === id);
    if (!pool) continue;                       // fell in a component below minColumns
    pool.wells.push(w.name);
    if (w.producer) { pool.producers.push(w.name); pool.drained = true; }
  }

  // biggest first — the field, then everything the map also happens to close
  pools.sort((a, b) => b.grvM3 - a.grvM3);

  return {
    pools,
    totalAreaM2: pools.reduce((a, p) => a + p.areaM2, 0),
    drainedCount: pools.filter((p) => p.drained).length,
    drainedGrvM3: pools.filter((p) => p.drained).reduce((a, p) => a + p.grvM3, 0),
    undrainedGrvM3: pools.filter((p) => !p.drained).reduce((a, p) => a + p.grvM3, 0),
    tinyCount: tiny,
  };
}

/**
 * The columns belonging to a set of pools, as a lookup.
 *
 * Volumes are then computed for THOSE columns only, which is what makes "STOIIP of
 * the drained accumulation" a different and more defensible number than "STOIIP of
 * everything above the contact".
 */
export function poolColumnMask(result: PoolResult, poolIds: number[], nCol: number): Uint8Array {
  const wanted = new Set(poolIds);
  const mask = new Uint8Array(nCol);
  for (const p of result.pools) {
    if (!wanted.has(p.id)) continue;
    for (const c of p.columns) mask[c] = 1;
  }
  return mask;
}

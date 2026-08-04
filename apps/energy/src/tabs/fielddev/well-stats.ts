// fielddev/well-stats.ts — what a single wellbore actually did, from its own
// monthly record. Feeds the hover card on the map's impact points.
//
// EVERY number here is a sum or a ratio of published monthly volumes. Nothing is
// modelled, and nothing is filled in. In particular:
//   • RESERVES and RECOVERY FACTOR are NOT computed. Both need a volume in place
//     or a booking, and the bundle publishes neither PER WELL — only field STOIIP
//     and a field reserves filing. Dividing a well's cumulative by a field STOIIP
//     would produce a number that looks like a well RF and is not one, so the
//     caller is handed `null` and says "not published per well" instead.
//   • ACTIVE means the well moved fluid in the LAST month of the field record,
//     not that it exists or is completed. A shut-in producer is a producer with
//     no rate, and colouring it as flowing would overstate the running well count.

export interface WellMonth {
  ym: string;
  oil?: number | null; gas?: number | null; water?: number | null; wi?: number | null;
}

export interface WellStats {
  months: number;
  /** cumulative, in whatever unit the series was published in — the caller labels it */
  cumOil: number; cumGas: number; cumWater: number; cumWi: number;
  /** water cut over the LIFE of the well, water / (oil + water). Null when the well
   *  produced no liquid at all — 0/0 is undefined, not zero percent. */
  wct: number | null;
  /** water cut over the last 12 producing months — the current state, which is what
   *  a surveillance reader actually wants. Null on the same rule. */
  wctRecent: number | null;
  firstFlow: string | null;
  lastFlow: string | null;
  /** moved fluid in the reference month (normally the last month of the field record) */
  active: boolean;
  /** what it moved, measured — not what its published role says it is */
  observed: 'oil' | 'water-injection' | 'none';
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param monthly the well's own series, any order
 * @param referenceMonth the month "active" is judged against — pass the FIELD's last
 *        month, not the well's, so a well that stopped in 2014 is not called active
 *        just because 2014 is the last row it happens to carry.
 */
export function summariseWell(monthly: WellMonth[], referenceMonth?: string): WellStats {
  const rows = (monthly ?? []).filter((m) => m && m.ym).slice().sort((a, b) => a.ym.localeCompare(b.ym));
  let cumOil = 0, cumGas = 0, cumWater = 0, cumWi = 0;
  let firstFlow: string | null = null, lastFlow: string | null = null;
  for (const m of rows) {
    const o = num(m.oil), g = num(m.gas), w = num(m.water), i = num(m.wi);
    cumOil += o; cumGas += g; cumWater += w; cumWi += i;
    if (o > 0 || i > 0) { if (!firstFlow) firstFlow = m.ym; lastFlow = m.ym; }
  }

  const liquid = cumOil + cumWater;
  const wct = liquid > 0 ? cumWater / liquid : null;

  // last 12 months that actually produced, not the last 12 calendar rows — a well
  // shut in for two years would otherwise report a water cut of "no data" as 0.
  const producing = rows.filter((m) => num(m.oil) + num(m.water) > 0);
  const tail = producing.slice(-12);
  const tailLiquid = tail.reduce((s, m) => s + num(m.oil) + num(m.water), 0);
  const wctRecent = tailLiquid > 0 ? tail.reduce((s, m) => s + num(m.water), 0) / tailLiquid : null;

  const refYm = referenceMonth ?? rows[rows.length - 1]?.ym ?? null;
  const ref = refYm ? rows.find((m) => m.ym === refYm) : undefined;
  const refOil = num(ref?.oil), refWi = num(ref?.wi);
  const observed: WellStats['observed'] = refOil > 0 ? 'oil' : refWi > 0 ? 'water-injection' : 'none';

  return {
    months: rows.length,
    cumOil, cumGas, cumWater, cumWi,
    wct, wctRecent, firstFlow, lastFlow,
    active: observed !== 'none',
    observed,
  };
}

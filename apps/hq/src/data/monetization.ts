// Monetization forecast — a driver-based model for two revenue streams:
//   A) Subscription  — parents pay recurring (free→paid conversion × price)
//   B) Diamond IAP    — parents buy diamond packs for kids (buyer% × spend)
// Pure functions, same contract as the rest of HQ. Low/Mid/High are just three
// driver sets fed through the same math, so an investor sees a defensible fan of
// outcomes rather than a single hopeful number.

export type Case = 'low' | 'mid' | 'high'

export interface Drivers {
  conv: number       // free→paid subscription (fraction of families)
  price: number      // subscription $/family/month
  churn: number      // monthly logo churn (fraction)
  iapBuyers: number  // fraction of families buying diamonds in a month
  iapSpend: number   // $ spent per buyer per month
}

export interface Globals {
  margin: number     // gross margin (fraction)
  cac: number        // $ to acquire one paying family
}

export interface DriverMeta {
  key: keyof Drivers
  label: string
  unit: '%' | '$'
  min: number; max: number; step: number
  /** stored value ↔ slider value (e.g. fraction ↔ percent) */
  toSlider: (v: number) => number
  fromSlider: (v: number) => number
}

// Slider matrix definition — rows of the assumption table, made editable.
export const DRIVER_META: DriverMeta[] = [
  { key: 'conv',      label: 'Free → paid subscription', unit: '%', min: 0, max: 25, step: 0.5, toSlider: v => v * 100, fromSlider: v => v / 100 },
  { key: 'price',     label: 'Subscription price / mo',   unit: '$', min: 2.99, max: 19.99, step: 1, toSlider: v => v, fromSlider: v => v },
  { key: 'churn',     label: 'Monthly churn',             unit: '%', min: 1, max: 15, step: 0.5, toSlider: v => v * 100, fromSlider: v => v / 100 },
  { key: 'iapBuyers', label: 'Families buying diamonds',  unit: '%', min: 0, max: 25, step: 0.5, toSlider: v => v * 100, fromSlider: v => v / 100 },
  { key: 'iapSpend',  label: 'Diamond spend / buyer / mo', unit: '$', min: 1, max: 40, step: 1, toSlider: v => v, fromSlider: v => v },
]

export const PRESETS: Record<Case, Drivers> = {
  low:  { conv: 0.02, price: 5.99, churn: 0.08, iapBuyers: 0.03, iapSpend: 4 },
  mid:  { conv: 0.05, price: 7.99, churn: 0.05, iapBuyers: 0.07, iapSpend: 8 },
  high: { conv: 0.10, price: 9.99, churn: 0.03, iapBuyers: 0.12, iapSpend: 15 },
}

export const DEFAULT_GLOBALS: Globals = { margin: 0.85, cac: 25 }

export const CASE_META: Record<Case, { label: string; blurb: string; accent: string }> = {
  low:  { label: 'Low · cautious',  blurb: 'conservative take-up', accent: 'var(--tx3)' },
  mid:  { label: 'Mid · base case', blurb: 'planning assumption',   accent: 'var(--acc)' },
  high: { label: 'High · breakout', blurb: 'best-in-class take-up', accent: 'var(--ok)' },
}

export interface ScenarioResult {
  subscribers: number
  buyers: number
  subMrr: number
  iapMrr: number
  mrr: number
  arr: number
  arpu: number            // blended revenue per family / mo
  ltv: number             // lifetime value of a paying subscriber
  ltvCac: number | null
  paybackMo: number | null
}

export function computeScenario(d: Drivers, families: number, g: Globals): ScenarioResult {
  const subscribers = families * d.conv
  const buyers = families * d.iapBuyers
  const subMrr = subscribers * d.price
  const iapMrr = buyers * d.iapSpend
  const mrr = subMrr + iapMrr
  const grossPerSub = d.price * g.margin
  const ltv = d.churn > 0 ? grossPerSub / d.churn : 0
  return {
    subscribers, buyers, subMrr, iapMrr, mrr,
    arr: mrr * 12,
    arpu: families > 0 ? mrr / families : 0,
    ltv,
    ltvCac: g.cac > 0 ? ltv / g.cac : null,
    paybackMo: grossPerSub > 0 ? g.cac / grossPerSub : null,
  }
}

export interface CurvePoint { families: number; arr: number }
export function forecastCurve(d: Drivers, g: Globals, maxFamilies: number, steps = 10): CurvePoint[] {
  const pts: CurvePoint[] = []
  for (let i = 0; i <= steps; i++) {
    const f = (maxFamilies * i) / steps
    pts.push({ families: f, arr: computeScenario(d, f, g).arr })
  }
  return pts
}

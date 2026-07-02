// Report composition model — a report is an ordered list of sections over the
// one ontology. Deterministic today; the LLM narration seam fills the same
// shapes later. Provenance travels: every section carries a source badge.

import type { Source, OfficeId, Health } from '../graph/types'
import type { ChartData, KpiItem } from '../../components/charts'
import type { RSeries } from '../../components/rcharts'

export type Cadence = 'onDemand' | 'daily' | 'weekly' | 'monthly' | 'quarterly'

export interface ChiefLine {
  office: OfficeId
  chief: string
  headline: string
  metricLabel: string
  value: string
  badge: Source
  action: string
  laddersTo: string
  health: Health
}

export interface ConsultItem { id: string; from: OfficeId; to: OfficeId; note: string; status: string; priority: number }

export type Section =
  | { id: string; kind: 'kpiRow'; source: Source; items: KpiItem[] }
  | { id: string; kind: 'headline'; source: Source; label: string; text: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' | 'mut' }
  | { id: string; kind: 'chiefLines'; source: Source; title: string; lines: ChiefLine[] }
  | { id: string; kind: 'consults'; source: Source; title: string; items: ConsultItem[] }
  | { id: string; kind: 'chart'; source: Source; title: string; chart: ChartData }
  | { id: string; kind: 'reChart'; source: Source; title: string; data: Record<string, number>[]; series: RSeries[]; unit: 'money' | 'count'; months: number }
  | { id: string; kind: 'table'; source: Source; title: string; head: string[]; rows: (string | number)[][]; strongLast?: boolean }
  | { id: string; kind: 'text'; source: Source; text: string }

export interface Report {
  id: string
  title: string
  subtitle?: string
  owner: OfficeId | 'company'
  cadence: Cadence
  audience: string
  sections: Section[]
  livePct: number      // provenance rollup — share grounded
}

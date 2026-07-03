// Registers the read-only Bridge surface as MCP tools on a McpServer.
// The LLM sees: one hierarchical CEO entry (ceo_ask), the org brief, per-office
// drill-down, and the data/money/scale engines. All read-only, all provenance-tagged.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  orgBrief, askCeo, officeReport, graphQuery, nodeGet, verdictQueue,
  rootCauseChain, financialModel, scaleModel, OFFICE_IDS,
} from './bridge'
import {
  pixelQuery, pixelFacets, pixelGet, pixelSimilar, pixelVocab, pixelPalettes, pixelUsage,
} from './vault'

const OfficeEnum = z.enum(OFFICE_IDS as [string, ...string[]])
const SourceEnum = z.enum(['live', 'partial', 'simulated', 'placeholder'])

// wrap any JSON-able payload as an MCP text result
const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] })

export function registerTools(server: McpServer) {
  server.tool(
    'ceo_brief',
    'The CEO polls all six offices at once. Returns the North Star, instrumentation coverage, ' +
    'each office (chief, health, open verdicts, SLA), the weakest lever, and the cross-office ' +
    'resolve queue. Start here for any "how are we doing?" question.',
    {},
    async () => json(orgBrief()),
  )

  server.tool(
    'ceo_ask',
    'Hierarchical CEO. Give a plain-English question; the CEO routes it to the relevant office(s), ' +
    'gathers their packets, and hands you decision-grade context to synthesize ONE answer. ' +
    'Pass `focus` to force a specific office. This is the main entry point.',
    { question: z.string().describe('the operator’s question in plain English'), focus: OfficeEnum.optional().describe('force routing to one office') },
    async ({ question, focus }) => json(askCeo(question, focus as never)),
  )

  server.tool(
    'office_report',
    'Drill into one chief. Returns that office’s slice, SLA, owned nodes (with provenance/health), ' +
    'open verdicts, and cross-office consults. Treasury adds the financial model; Technology adds ' +
    'coverage + the scale/cost model.',
    { office: OfficeEnum.describe('bridge=CEO, operations=COO, technology=CTO, treasury=CFO, legal=GC, roster=CAPO') },
    async ({ office }) => json(officeReport(office as never)),
  )

  server.tool(
    'graph_query',
    'Query the product ontology graph. Filter by kind, owning office, provenance source, or lever. ' +
    'Returns matching nodes each with a provenance badge and derived health.',
    {
      kind: z.string().optional().describe('e.g. northstar, lever, stage, app, tab, signal, metric'),
      office: OfficeEnum.optional(),
      source: SourceEnum.optional().describe('provenance filter'),
      lever: z.string().optional().describe('breadth | depth | frequency | efficiency'),
    },
    async (f) => json(graphQuery(f as never)),
  )

  server.tool(
    'node_get',
    'Fetch one node by its immutable id: its provenance/health, owning office, children, and — for ' +
    'signals/metrics — the blast radius of what breaks if it goes red.',
    { id: z.string().describe('immutable node id, e.g. ns.w2f or lever.efficiency') },
    async ({ id }) => json(nodeGet(id)),
  )

  server.tool(
    'verdict_queue',
    'The open verdict queue — the org’s to-do list. Every verdict LADDERS_TO a lever/stage/coverage ' +
    'node (no orphan opinions). Optionally scope to one office.',
    { office: OfficeEnum.optional() },
    async ({ office }) => json(verdictQueue(office as never)),
  )

  server.tool(
    'root_cause',
    'Deterministic root-cause chain: North Star → weakest lever → least-instrumented surface → the ' +
    'missing event. Use to answer "why is the North Star soft and what do we fix first?"',
    {},
    async () => json(rootCauseChain()),
  )

  server.tool(
    'financial_model',
    'Run the Treasury unit-economics + cashflow model (SIMULATED). Choose a case (low/mid/high), a ' +
    'horizon in months, and optional assumption overrides (conv, listPrice, infraActive, cac, churn, ' +
    'cap, kidD30, parentD30). Returns ARPU, contribution/active, break-even actives, first cash-positive ' +
    'month, cumulative net, and NPV.',
    {
      case: z.enum(['low', 'mid', 'high']).optional(),
      months: z.number().int().min(1).max(228).optional(),
      overrides: z.object({
        conv: z.number().optional(), listPrice: z.number().optional(), infraActive: z.number().optional(),
        cac: z.number().optional(), churn: z.number().optional(), cap: z.number().optional(),
        kidD30: z.number().optional(), parentD30: z.number().optional(),
      }).optional(),
    },
    async (a) => json(financialModel(a as never)),
  )

  server.tool(
    'scale_model',
    'Run the CTO architecture cost model (SIMULATED) at a given family count. Returns per-layer ' +
    'monthly cost (UI, Agent, AI/ML, Data, Infra), total, $/active vs the Treasury $0.08 load, and the ' +
    'data tier. Use to answer "what does the stack cost at 100k families and why?"',
    { families: z.number().int().min(100).max(5_000_000).optional().describe('default 10000') },
    async ({ families }) => json(scaleModel(families ?? 10000)),
  )

  // ── Pixel Vault — the pixel-art catalogue, queryable before generating ─────
  const PixelFilter = {
    domain: z.string().optional(), kind: z.string().optional(), theme: z.string().optional(),
    characterType: z.string().optional(), style: z.string().optional(), groupId: z.string().optional(),
    tier: z.enum(['T0', 'T1', 'T2']).optional(), source: z.string().optional(),
    animated: z.boolean().optional(), canonical: z.boolean().optional(),
    q: z.string().optional(), includeUnverified: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional(),
  }

  server.tool(
    'pixel_query',
    'Search the Pixel Vault catalogue of open-source pixel art. Filter by domain (rpg/cinematic/ui/…), ' +
    'kind (character/tile/background/…), theme, characterType, style, groupId, tier (T0 ship-as-is / T1 ' +
    'reference-only / T2 do-not-use), source, animated, or free text. Use BEFORE generating art to find a ' +
    'style reference. Returns each item with its license tier and shippability.',
    PixelFilter,
    async (f) => json(pixelQuery(f as never)),
  )

  server.tool(
    'pixel_facets',
    'Benchmark the catalogue: distinct values + counts per field (domain, kind, theme, style, tier, source, ' +
    'animated) over an optional filter scope. Answers "how many T0 characters exist per theme" before you ' +
    'decide to reuse or generate. Counts trust verified items unless includeUnverified is set.',
    PixelFilter,
    async (f) => json(pixelFacets(f as never)),
  )

  server.tool(
    'pixel_get',
    'Fetch one vault item by id: full metadata, license tier policy, and its palette.',
    { id: z.string().describe('vault item id, e.g. ref.kenney.pixel-platformer.coin_gold') },
    async ({ id }) => json(pixelGet(id)),
  )

  server.tool(
    'pixel_similar',
    'Given a vault item id, return everything in its group plus items sharing theme/style/kind — pull a ' +
    'whole cast or set for a scene in one call.',
    { id: z.string() },
    async ({ id }) => json(pixelSimilar(id)),
  )

  server.tool(
    'pixel_vocab',
    'The controlled vocabulary (domain/kind/theme/characterType/style/animation), the license→tier policy, ' +
    'and the registered sources. Read this first so your tags match the catalogue instead of inventing synonyms.',
    {},
    async () => json(pixelVocab()),
  )

  server.tool(
    'pixel_palettes',
    'List the shared color palettes (canonical Arganta sets + public-domain Lospec palettes) with their colors.',
    {},
    async () => json(pixelPalettes()),
  )

  server.tool(
    'pixel_usage',
    'The render-key coverage x-ray: which sprite keys across the Arganta apps are wired to a real asset vs ' +
    'still procedural placeholders vs missing, plus published-but-unused (orphan) assets.',
    {},
    async () => json(pixelUsage()),
  )
}

// C4b · local block typing — mirrors @arganta/agent/thread.js's makeBlock()
// shapes (frozen there; re-declared here only because that package ships as
// plain JS with a blanket `declare module` .d.ts shim with no real types).
export type CoreBlock =
  | { kind: 'text'; text: string }
  | { kind: 'image' | 'audio'; assetId: string | null; path: string | null; mime: string | null; provider: string | null; model: string | null; costUsd: number }
  | { kind: 'website' | 'deck' | 'brand'; assetId: string | null; path: string | null; html: string | null }
  | { kind: 'chart'; assetId: string | null; spec: unknown }
  | { kind: 'tool-trail'; tool: string | null; provider: string | null; model: string | null; costUsd: number; latencyMs: number; ok: boolean }
  | { kind: 'delegation'; office: string | null; summary: string | null }
  | { kind: 'error'; message: string }

export const asBlocks = (raw: Record<string, unknown>[]): CoreBlock[] => raw as unknown as CoreBlock[]

export const MEDIA_BLOCK_KINDS = new Set(['image', 'audio', 'website', 'deck', 'brand', 'chart'])

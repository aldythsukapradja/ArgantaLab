// Stub generator for studios whose real engine isn't wired yet (Website,
// Presentation, Scene, Brand Kit, Campaign). It returns the SAME result shape as
// @arganta/media-core's generate() and enforces the SAME approval gate — so the
// cockpit, provenance panel, and premium lock all behave identically to the real
// Media Center. Swap each stub for a real engine later without touching the UI.

import { MATURITY } from '@arganta/media-core'

const LABELS = ['deterministic', 'free-api', 'economical', 'premium']

export interface StudioResult {
  status: 'succeeded' | 'deferred' | 'failed'
  runtime?: string
  descriptor?: any
  downgraded?: boolean
  provenance?: any
  error?: { code: string; source: string; message: string }
}

/**
 * @param kind     logical output kind, e.g. 'website' | 'deck' | 'scene'
 * @param stage    requested maturity 0..3
 * @param approved required to run stage >= PREMIUM
 * @param provider provider id shown in provenance (e.g. 'stub-website')
 * @param runtime  where it would run ('stub' | 'browser' | 'mcp')
 * @param estCost  estimated premium cost
 */
export function stubGenerate(
  kind: string,
  stage: number,
  approved: boolean,
  provider: string,
  runtime = 'stub',
  estCost = 0,
): StudioResult {
  if (stage >= MATURITY.PREMIUM && !approved) {
    return {
      status: 'failed',
      error: { code: 'approval_required', source: 'policy', message: `Stage ${stage} (${kind}) is premium and requires approval.` },
    }
  }
  const premium = stage >= MATURITY.PREMIUM
  return {
    status: 'deferred',
    runtime: premium ? 'mcp' : runtime,
    descriptor: { engine: provider, kind },
    provenance: {
      provider,
      tier: stage,
      maturityStage: stage,
      maturityLabel: LABELS[stage],
      cost: premium ? estCost : 0,
      estimated: premium,
      spec: { kind },
    },
  }
}

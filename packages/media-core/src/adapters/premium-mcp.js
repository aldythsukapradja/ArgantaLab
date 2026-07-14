// Stage-3 premium adapters. These map to paid MCP providers (Higgsfield
// generate_image/video/audio, PixelLab, ElevenLabs). They NEVER call a provider
// from this package — a package must not hold provider secrets or run long paid
// jobs. Instead they emit an approval-gated descriptor that an operator (the
// Claude Code MCP tools, or a server-side worker) fulfills.
//
// The maturity gate in core.js blocks these unless the job is `approved`.

import { MATURITY } from '../contracts.js';

const premium = ({ kind, tool, estimate }) => ({
  id: `premium-${kind}`,
  kind,
  tier: 3,
  stage: MATURITY.PREMIUM,
  runtime: 'mcp',
  cost: estimate,
  estimated: true,
  run(spec) {
    return {
      deferred: true,
      reason: `${kind} premium generation is approval-gated and executed via a paid MCP provider.`,
      descriptor: { tool, call: 'generate', args: spec, estimatedCost: estimate },
    };
  },
});

// Estimates are placeholders until a real price snapshot is wired (BattleTest
// Gap 3). estimated:true ensures they are never shown as measured cost.
export const premiumImageAdapter = premium({ kind: 'image', tool: 'higgsfield.generate_image', estimate: 0.04 });
export const premiumVideoAdapter = premium({ kind: 'video', tool: 'higgsfield.generate_video', estimate: 0.5 });
export const premiumMusicAdapter = premium({ kind: 'music', tool: 'higgsfield.generate_audio', estimate: 0.1 });
export const premiumVoiceAdapter = premium({ kind: 'voice', tool: 'elevenlabs.create_voice', estimate: 0.08 });

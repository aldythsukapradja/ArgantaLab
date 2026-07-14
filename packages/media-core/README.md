# @arganta/media-core

Provider-agnostic media generation router. **One call, maturity-staged routing:
deterministic & free first, premium only after approval.**

```js
import { generate, MATURITY } from '@arganta/media-core';

// free, deterministic, reproducible — real PNG bytes right here in Node
const r = generate({ kind: 'image', spec: { prompt: 'launch key art', width: 512, height: 512 } });
r.status;              // 'succeeded'
r.output.bytes;        // Buffer (valid PNG)
r.provenance.cost;     // 0
r.provenance.checksum; // sha256 — no asset without provenance

// premium is blocked until explicitly approved
generate({ kind: 'image', maturityStage: MATURITY.PREMIUM }).error.code; // 'approval_required'
generate({ kind: 'image', maturityStage: MATURITY.PREMIUM, approved: true }).status; // 'deferred' → MCP
```

## Maturity stages

| Stage | Const | Cost | Runs where |
|---|---|---|---|
| 0 | `DETERMINISTIC` | $0, reproducible | Node (image) / browser engines (music, video, voice, sfx) |
| 1 | `FREE_API` | $0 | free hosted models *(not yet wired)* |
| 2 | `ECONOMICAL` | low | cheap paid models *(not yet wired)* |
| 3 | `PREMIUM` | $$ | paid MCP providers — **requires `approved: true`** |

**Routing walks _down_**, never up: ask for stage 2 with only stage 0 available →
you get stage 0 for free. The system never silently escalates to a paid provider.

## Result shape

- `status`: `succeeded` (bytes produced here) · `deferred` (a browser engine or
  MCP tool must run it — carries a `descriptor`) · `failed` (normalized `error`).
- `provenance`: `{ provider, tier, maturityStage, cost, estimated, seed, checksum, spec, correlationId }`.
- `runtime`: `node` | `browser` | `mcp` — who can actually produce the bytes.

## What runs today vs. deferred

- **image / stage 0** — fully in Node (`src/adapters/image-deterministic.js` + a
  dependency-free PNG encoder in `src/png.js`). Produces a real reproducible PNG.
- **music / video / voice / sfx / stage 0** — routed to the existing
  `@arganta/audio` + `@arganta/video` engines, which are Web Audio / canvas /
  MediaRecorder based. Returns a `deferred` descriptor the HQ browser runtime
  fulfills. See `src/adapters/browser-engines.js`.
- **premium / stage 3** — approval-gated `deferred` descriptor pointing at a paid
  MCP tool (Higgsfield / ElevenLabs). No provider secret or paid call lives in
  this package. See `src/adapters/premium-mcp.js`.

## Run it

```bash
cd packages/media-core
node --test      # 8 tests
node demo.js     # writes out/launch.png, prints routing for every modality
```

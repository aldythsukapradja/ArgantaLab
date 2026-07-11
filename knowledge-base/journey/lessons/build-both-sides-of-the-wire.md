---
type: lesson
status: living
tags: [arganta, lesson]
---

# A sensor with no consumer is a log file — build both sides of the wire or it's unbuilt

> [!quote] The principle
> Emitting an event, adding a column, or publishing a record does nothing until something reads it. Provenance-in-use, not code-existence, is proof of done. Half-wired is unbuilt.

## Evidence
- `docs/fable handoff/new-skills/instrumentation-wiring.md` — states the rule directly: "a sensor with no consumer is a log file; provenance badge, not code existence, is proof of done." The 15 blind HQ nodes it targeted are still hard-coded `status:'placeholder'` in `apps/hq/src/data/graph/seed.ts`; no `waitlist_joined`/`dead_end_quit`/`paywall_bounce` events fire anywhere. The whole Fable cluster authored rails and never rode them.
- `DESIGN_BUILDERS_KINETIKCIRCLE_INTEGRATION.md` — circle plumbing landed in the builder (`listUserCircles`, `hq_app.visibility`/`circle_ids`), but Kinetik never reads `hq_app`, so **circle targeting has no runtime effect.** The emit side shipped; the consume side didn't; net behaviour: nothing.
- `CONCEPT_APP_BUILDER.md` / `SPEC_CIRCLE_APP_SDK.md` — the "publish → live in KinetikCircle" loop was the whole point; the mock SDK shipped verbatim but the loop never connected. Kinetik's mini-apps stayed hand-coded.
- `apps/kingdom/data/derived/audit.md` — skills 0/227 linked; the one join the pipeline couldn't automate (44 spell GIFs vs 648 client effects) needed manual review that simply never happened. The sensor (audit) worked; the consumer (linking) was never built.

## The pattern
Across the repo, the *producer* side ships easily (it's the fun, visible half) and the *consumer* side quietly doesn't — leaving columns, events, and published records that no code reads. The result looks built (the migration ran, the badge exists) but changes zero runtime behaviour. A feature is done when a value flows end to end and something downstream *acts* on it.

## Watch for
- A migration or event added this session with no reader added in the same session — schedule the consumer or don't claim the feature.
- A `live` or `owned` badge on a node whose events don't fire (KB debt D8; `knowledge-graph-map.md` declared ownership that was never true). Verify by tracing a value from emit to render, not by checking the emit exists.
- "Circle-scoped" / "targeted" / "personalized" claims where the targeting field is written but never queried — the classic silent no-op.

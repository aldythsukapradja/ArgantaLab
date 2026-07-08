# Effort Scorer

> Pre-flight triage. Score a task BEFORE running so I never over/under-provision a model.
> A Rail (deterministic thresholds) authored once, ridden by any Reasoner.
> Status: DRAFT skill written July 7 (fable-handoff/new-skills/effort-scorer.md) — thresholds
> uncalibrated until ~20 logged router runs.

## The axes (score 0–2 each)
- **Ambiguity** — fully specified, or must the model decide what to do? (Resists scaffolding →
  pushes UP hardest.)
- **Horizon** — one turn, or hours across many tool calls?
- **Reversibility / stakes** — undoable cheaply, or hits prod/money/a client?
- **Context volume** — fits comfortably, or needs big window + compaction?
- **Verification cost** — if wrong, how expensive to catch?

## Draft thresholds (verify against real usage — DO NOT treat as calibrated)
- Ambiguity 2 → top tier regardless (the one axis scaffolding can't buy)
- Total ≤3 → Haiku + fully specified spec · 4–6 → Sonnet + plan + adversarial pass ·
  7–8 → Opus + orchestration + compaction · 9–10 or stakes 2 + verify 2 → pay up

## The output
Not "use model X" — but "use model X AND here's the scaffolding to make it perform like X+1."
E.g. "Sonnet-executable IF given a plan; Opus if not." That conditional is the product.

## The one-question shortcut (for the daily loop)
Frame-inventing or frame-filling? Inventing → Opus/Fable. Filling → Sonnet/Haiku.

## Calibration duty
Every scoring is a run-log row (hq-router step 9). Weekly Guild review of misses turns these
draft thresholds into calibrated ones — then remove the DRAFT flag.

## Links
- Feeds: [[daily-loop#Midday — Route]]
- Built on: [[model-ladder]]

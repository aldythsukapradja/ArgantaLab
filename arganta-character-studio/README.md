# Arganta Character Studio

Sovereign character-identity system ("Soul ID") for Arganta's recurring AI characters,
built on the local ComfyUI Desktop server (RTX 3070 Ti, 8GB VRAM, SD 1.5 → SDXL later).

Source spec: `20260717-Fable-Handoff-ComfyUI-Soul-ID-SD15.md` (founder ↔ ChatGPT handoff).
Executor: Claude Code (Fable), end-to-end, founder reviews final product only.

A **Soul ID** is a versioned package that reproduces one character consistently across
poses, expressions, wardrobe, lighting, and video keyframes: curated dataset → character
LoRA → IP-Adapter face anchoring → ControlNet pose → face refinement → evaluation.

## Layout

- `environment/` — version locks, node/model manifests, install + VRAM logs
- `workflows/` — ComfyUI **API-format** JSON graphs 00–06, driven from the media-gen MCP
- `templates/` — prompt/caption/rights/evaluation templates shared by all characters
- `characters/<name>/` — one Soul ID package per character (see handoff §7)
- `tests/` — identity test matrix + baseline/regression contact sheets
- `docs/` — operating, training, troubleshooting, SDXL migration guides

## Runtime wiring

Generation is triggered from Claude Code via `tools/media-gen-mcp` (→ ComfyUI on
`127.0.0.1:8188`); every output persists to the Supabase `media-artifacts` bucket +
`media_asset` lineage row, which Media Center / Post Studio consume by default.

Heavy artifacts (datasets, checkpoints, LoRA files, evaluation images) are
**gitignored** — this repo tracks the reproducible system, not the bytes.

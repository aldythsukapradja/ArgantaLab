# HANDOFF — Digital Brain Twin OS (resume here)

> Work-state doc so any future session (or a cheaper model with this file) picks up with zero
> re-discovery. No frontmatter on purpose → excluded from the app knowledge graph; this is
> meta-work, not knowledge. Last updated: 2026-07-08.

## What this is
A lifelong personal knowledge OS = **`vault-hq/`** (a folder of markdown = the single source of
truth) that renders in **both** Obsidian and the **HQ Arganta webapp** (`apps/hq/src/vault`).
Branch: `claude/digital-brain-twin-os-omes01`. All work committed + pushed.

## Status at a glance (the "one noun, four verbs" model)
- **NOUN — the vault**: ✅ DONE. 41 md files, 34 are app-loadable knowledge nodes, unified
  schema + guardrail (`class`) + versioning (`canonical`/`version`) + badges + MOC mind-map spine.
  Verified clean by `scripts` verifier: 0 duplicate basenames, 0 id collisions, 0 broken links
  among knowledge notes.
- **CAPTURE (write raw in)**: ⏳ skill exists as text; not installed to `.claude/skills/` and not
  auto-wired to `_INBOX/`. One real capture done by hand (the IG carousel).
- **HARVEST (raw→truth)**: rules ✅; the ritual is human + weekly (by design, never automated).
- **SYNC (files everywhere)**: designed in `90-META/SYNC.md`; not set up on your machine yet.
- **DISPLAY — Obsidian**: ✅ reads natively today.
- **DISPLAY — HQ webapp**: ⏳ loader BUILT (`apps/hq/src/vault/vaultLoader.ts`) + data-verified,
  but NOT wired into `store.ts` and NOT runtime-verified (this container has no node_modules/
  browser). **This is the one open blocker.**

## The single next action (unblocks "view in HQ")
Apply the 2 edits in `apps/hq/src/vault/LOADER-INTEGRATION.md`, then:
```
cd apps/hq && npm install && npm run dev
```
Open Vault → Graph. Expect ~34 nodes incl. the "Paid vs Free AI Tools" capture (product:
Research) linked to mcp-connectors + circle-hq. If it renders, the SSOT→HQ leg is proven.

## Remaining work (ordered)
1. Verify the loader locally (above) — YOUR step (only you can run the app).
2. Install `digital-brain-capture` skill → `.claude/skills/` + point it at `_INBOX/`.
3. Set up SYNC (`90-META/SYNC.md`): desktop git background-pull; phone via Obsidian Sync.
4. Optional: a "Reload from vault" command in the app (uses existing `replaceVault`).
5. Harvest the pending capture: promote → patch `mcp-connectors` free-alternatives (your gate).

## Key locations
- Vault root: `vault-hq/` · entry `HOME.md` · rules `DIGEST.md` + `90-META/{TAXONOMY,CONVENTIONS,PIPELINE,SYNC}.md`
- Pending capture: `vault-hq/60-CAPTURES/_INBOX/2026-07-08-paid-vs-free-ai-tools.md`
- App bridge: `apps/hq/src/vault/vaultLoader.ts` + `LOADER-INTEGRATION.md`
- Verifier (not committed; in session scratchpad): replicates app id+link contract over the vault.

## Open decisions for Aldyth
- Loader precedence: localStorage snapshot currently wins over the vault — decide if "Reload
  from vault" should force the SSOT (recommended) or stay opt-in.
- Phone sync: Obsidian Sync (paid, easiest) vs git client (free, clunkier on a monorepo subfolder).
- Model routing going forward: build turns are frame-FILLING → Sonnet + a written plan is enough;
  keep Opus for stress-test/verify passes.

## Honest caveats
- Nothing in the HQ app was runtime-verified from this container (no deps/browser). Loader is
  additive + data-verified only.
- Verifier residual hits (case-only rail-doc ids, `[[wikilinks]]` example syntax in manual docs)
  are cosmetic, not real broken edges.

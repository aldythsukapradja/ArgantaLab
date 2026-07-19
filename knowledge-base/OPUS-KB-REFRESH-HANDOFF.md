---
title: OPUS HANDOFF — refresh the knowledge base to the 2026-07-18 strategy of record
type: handoff
status: open
date: 2026-07-19
tags: [arganta, knowledge-base, handoff, opus]
---

# 🛠️ OPUS HANDOFF — KB refresh (2026-07-18 events)

> [!todo] Resumable checklist (update statuses in place as you work — an interrupted session resumes here)
> - [ ] **0 · `FOCUS.md` at repo root FIRST** — wedge sentence, freeze list, hierarchy of truth (per [[METHOD]] A1), links to strategy of record + handoffs. This ships even if the session dies one minute later.
> - [ ] 1 · Delta note `2026-07-18-delta/20260718-Strategy-Delta.md`
> - [ ] 2 · Decision register pass on [[founder-decisions]] (METHOD A2: one `current` answer per question, losers `superseded` in the same commit)
> - [ ] 3 · [[00-MASTER-KB]] — §12 heartbeat line + reorder snapshot per METHOD A3 (families before LOC)
> - [ ] 4 · Superseded banners: [[investor-narrative]], [[20260713-Business-ArgantaLab-Valuation-Audit]]
> - [ ] 5 · [[family-pilot-plan]] → review's §9 plan + gates
> - [ ] 6 · Brand notes (F9 desire-map collapse, dual metaphor)
> - [ ] 7 · [[market-research]] external facts with citations
> - [ ] 8 · Atlas + link audit + **`npm run build:vault-seed`** (METHOD A6 — `founder/*.md` edits and `kb.generated.ts` in the same commit) + commit to main
> - [ ] 9 · Mark this handoff `status: done`
>
> Provenance vocabulary throughout: fact / inference / hypothesis / recommendation (METHOD A5).
> Sequence: this handoff runs **before** `docs/audit/2026-07-18/00-Opus-Handoff-Master.md` (METHOD A7).

> [!abstract] The job
> The KB's baseline is **2026-07-11 (`a00b826`)**. On **2026-07-18** the company's strategy changed materially: a 24-note audit, a consolidated founder-investor review that became the **strategy of record**, a ratified wedge, a freeze list, and a superseding master handoff. This vault — the founder's system of record — does not know any of it. Bring it current using the vault's own [[METHOD]] (Align → Verify → Synthesize → Wire → Audit → Commit → Deliver) and house voice. **Time-box: this is documentation, not strategy — one session, no new analysis** (see the black-hat rule in `docs/audit/2026-07-18/23-Black-Hat-Final-Critique.md`: strategy work is closed until family #1).

## Inputs (hierarchy of truth — same as the master handoff)
1. `docs/ARGANTA-CONSOLIDATED-FOUNDER-INVESTOR-REVIEW-2026-07-18.md` — **strategy of record**
2. `docs/audit/2026-07-18/00-Opus-Handoff-Master.md` + `22-…` (W1–W6 patches) + `23-…` (black hat B1–B9)
3. `docs/audit/2026-07-18/` notes 01–21 — subordinate reference
4. The code — METHOD's one principle applies: **verify against source, never trust the doc** (including the audit's own docs; note 19/22 list its known errors).

## Work order

### 1 · New delta note (use [[_templates/delta.md]])
Create `2026-07-18-delta/20260718-Strategy-Delta.md`, `matters: high`, superseding the 07-11 baseline's *strategic* layer (not its architectural inventory). What changed, minimum set:
- **Wedge RESOLVED** — the open question in [[founder-decisions]] is closed: the **family growth ritual** (Today glance + one child quest + parent evidence + weekly reset), fusing Kinetik shell + ArgantaLabs learning engine. This reconciles the three previously contradictory decision notes (learning-first · family-shell-first · Kinetik-first) — link all three.
- **Freeze list ratified** (HQ/studios/worlds/personas) with the governance metric "new frozen surfaces = 0".
- **Pricing hypothesis** moved $4.99 → **$9/mo · $79/yr test**; valuation frame $1.8–2.8M pre.
- **Product truth corrections** — chat-brain has one live tool; visible assistant is deterministic routing; CI protects the wrong apps (these correct any KB note that claims otherwise).
- **90-day evidence plan + decision gates** adopted; capacity envelope 20 h/wk.
- **New constraints** — incorporation is a pilot precondition; spouse consent is step 0; Qatar non-dilutive track (QSTP/QDB/WISE) added.

### 2 · Update existing notes (edit in place, don't rewrite history)
- [[00-MASTER-KB]] — §9 history (one entry: 2026-07-18), §10 scoreboard (still 0 external users — keep the honesty), §12 weekly section pointing at the ritual wedge + gates. Do **not** regenerate §1–8 unless code changed.
- [[founder-decisions]] — append the wedge resolution + freeze, linking the review as source.
- [[investor-narrative]] + [[20260713-Business-ArgantaLab-Valuation-Audit]] — banner note at top: superseded by the review's §1 scorecard and financing view; keep as history.
- [[family-pilot-plan]] — replace body with (or point to) the review's §9 capacity-enveloped plan + gates.
- `brand/brand-f9-marketing-doctrine.md` + [[brand-f2-audiences-positioning]] — apply the audit's C2 ruling: desire map collapses to 4 wedge-era rows; dual-metaphor ruling (subsurface = founder brand, whiteboard = product brand); doctrine mechanism/voice/claims classes unchanged (they won the battle test).
- [[market-research]] — fold in the review's verified external facts (Ollie $25–100 pricing, Cozi Max AI $79.99/yr, Hearth $699+$9, Duolingo FY2025) with citations.

### 3 · Wire + audit (METHOD steps 4–5)
Every new/edited note front-mattered, wikilinked both ways (delta ↔ touched notes), atlas [[00-doc-atlas]] updated, link-check before commit. Commit to **main** (founder's standing rule), one message: `kb: 2026-07-18 strategy delta — ritual wedge, freeze, review of record`.

### 4 · Out of scope (explicitly)
No new baseline (architecture didn't change) · no new strategy analysis · no touching `docs/audit/` (it's closed) · no LOC/table recounts unless a claim you're writing depends on one.

> [!important] Done means
> A reader opening [[00-MASTER-KB]] cold on 2026-07-19 learns the ritual wedge, the freeze, the gates, and where the strategy of record lives — without ever opening the audit folder.

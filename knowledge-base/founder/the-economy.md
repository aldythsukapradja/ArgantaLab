---
title: The Economy
product: HQ
type: spec
status: living
tags: [economy, currency, diamonds, bloom]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# The Economy — Diamonds & Bloom

Grounded correction: there is no "Argons". The real ecosystem runs **two currencies**, and the rules below are enforced in the schema (diamond_ledger, RPC wallet_*).

## Diamonds — the cross-app wallet
- **Single source of truth: [[ArgantaLabs]].** Kids earn Diamonds **only** from learning apps or approved guardian events — **never** from game actions.
- Diamonds buy **skins/cosmetics only, never power**.
- Append-only ledger (diamond_ledger); every move goes through wallet_earn / wallet_spend / wallet_reconcile.
- Diamonds never convert to real money.

## Bloom 🌸 — LashiraBloom's play currency
- Earned and spent inside [[LashiraBloom]] (farming, world events). Was Gold, renamed Bloom on 2026-07-08.
- Buys Lashira cosmetics and plot upgrades. Kept separate from Diamonds so play can't mint power.

## Balance laws
1. **Learning is the only faucet that mints Diamonds** — the economy pays kids for learning, not for playing.
2. Adults play freely; multipliers flow from the kids' learning streaks.
3. No rot timers, no real-money bridge.

See [[Founder Decisions]] for the Gold → Bloom call and the diamonds-single-source rule.

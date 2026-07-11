---
title: LashiraBloom — MMORPG Systems Architecture
type: doc-node
product: LashiraBloom
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# LashiraBloom — MMORPG Systems Architecture

`docs/lashirabloom/mmorpg-architecture.md` · verdict **partial**

The Room-generalization concept partly shipped as 'realms', but the load-bearing new tier it centered on — server-adjudicated authority (RPC referee + append-only ledgers) — never landed; PvP and farm stayed victim/host-authoritative.

**Lesson:** Correctly named the single hardest MMO problem (who is allowed to decide what) as the one new tier — and that tier is exactly the part that was deferred, so value-minting stayed client-trusted within circles.

In [[00-doc-atlas]] · product [[LashiraBloom]].

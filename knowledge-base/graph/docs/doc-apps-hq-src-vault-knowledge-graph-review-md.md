---
title: Knowledge Graph Self-Review
type: doc-node
product: HQ
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Knowledge Graph Self-Review

`apps/hq/src/vault/KNOWLEDGE_GRAPH_REVIEW.md` · verdict **current**

A battle-test of the live Vault graph; the reviewed code exists and the no-library canvas-2D decision it defends is still the standing approach.

**Lesson:** A deliberate, measured 'don't add dependencies before scale demands it' call: custom canvas-2D + custom force sim chosen over Sigma.js/G6/Cytoscape/React-Flow, with an in-repo stress harness (?vaultStress=N) proving 96fps at 1k nodes and a documented swap-to-sigma path past 2.5k. Zero-dep discipline plus an honest weakness list (O(n²) repulsion, no label collision) is the proven instinct.

In [[00-doc-atlas]] · product [[HQ]].

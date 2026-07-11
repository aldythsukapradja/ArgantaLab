---
title: Kingdom data audit (build-output duplicate)
type: doc-node
product: LashiraBloom
status: archived
verdict: archive
tags: [doc, atlas]
date: 2026-07-11
---

# Kingdom data audit (build-output duplicate)

`apps/kingdom/dist_site/data/derived/audit.md` · verdict **archive**

Byte-identical copy of data/derived/audit.md living inside the dist_site/ build artifact — which .gitignore explicitly says to never commit, yet it is present.

**Lesson:** A committed build-output copy is exactly the duplication that inflated .git to 939MB; the gitignore rule existed but was violated in practice.

Superseded by [[doc-apps-kingdom-data-derived-audit-md]].

In [[00-doc-atlas]] · product [[LashiraBloom]].

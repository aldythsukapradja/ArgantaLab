---
title: "ADR 0006 — Public Artifact Runtime & Serve-Time Safety"
date: 2026-07-15
status: accepted (contract) · unimplemented (B5)
owner: Opus
tags: [adr, builder, publishing, security, cloudflare, csp, arganta-core]
---

# ADR 0006 — Public Artifact Runtime & Serve-Time Safety

## Status
Accepted as the B5 contract. This freezes *where* published artifacts are
served, *how* they are kept safe on every request, and *what* records back a
publication — before any of it is built. Implementation (a Cloudflare Worker,
an additive migration, a publish RPC, the `publish_artifact` executor) is
Sonnet's, against this contract; the go-live still gets a final Opus review,
same posture ADR-0005 promised.

## Context
B1–B4 shipped: artifacts are generated (B2), validated (`validateHtml`, B1),
persisted and versioned (B3), and assembled from portable blocks (B4). The last
step is the one ADR-0005 flagged as "a new attack surface": serving
founder-generated HTML to the open internet at `build.arganta.app/a/:slug`
(applications) and `/w/:slug` (websites). This is the **first surface in the
entire system that serves anything to an unauthenticated visitor** — every
gateway until now was `hq_is_operator()`-gated. It needs its own security
decisions, made up front, not retrofitted.

Three constraints shape every decision below:
- **The B1 schema is frozen.** `schema.js`'s `ARTIFACT_COLUMNS` is asserted
  exact by a test; publishing cannot add columns to `hq_artifact`.
- **`build.arganta.app` is already a Cloudflare-hosted subdomain**, and the
  founder's Cloudflare Workers quota is completely unused (0 / 100k req·day,
  per the 2026-07-15 audit).
- **`validate.js` is pure, dependency-free JS** — it runs identically in Node,
  a Deno Edge Function, and a Cloudflare Worker.

## Decision 1 — the runtime is a Cloudflare Worker, not a Supabase function
The public runtime lives in a **Cloudflare Worker** routed at
`build.arganta.app/*`, NOT a Supabase Edge Function. Reasons, in priority order:

1. **Isolation of the public surface from the data plane.** Every byte of the
   founder's real data lives in the Supabase project. A public, unauthenticated
   endpoint is the thing most likely to be probed, scraped, or abused; putting
   it on Cloudflare's edge keeps that traffic off the Supabase project entirely.
   The Worker reaches back into Supabase through exactly ONE narrow, read-only,
   live-publications-only RPC (Decision 4) — nothing else.
2. **The domain is already there.** `build.arganta.app` is Cloudflare DNS; a
   Worker route is the native way to serve it. A Supabase function serves from
   `<ref>.supabase.co/functions/v1/…` and would need custom-domain gymnastics.
3. **Free, and the right home.** Workers are the audit's flagged "future home of
   async orchestration," currently at zero use. Serving cached public HTML at
   the edge is exactly what they're for.
4. **`validate.js` ports as-is.** The Worker re-runs the same gate (Decision 3)
   with zero translation — one rule-set, three runtimes.

This matches the standing "Cloudflare workhorse / Supabase memory" split
(media-platform-strategy). The Worker's deploy + the `build.arganta.app/*` route
are a **founder infrastructure prerequisite**, recorded like ADR-0004's
Vault-ify-secrets step — B5 code can't self-provision it.

## Decision 2 — publication is a separate record, not a mutation of the artifact
A new **`artifact_publication`** table (additive B5 migration — leaves the
frozen `hq_artifact`/`artifact_version` untouched):

| column | meaning |
|---|---|
| `slug` | the public path segment, immutable once assigned, unique |
| `artifact_id` | → `hq_artifact` |
| `kind` | `application` \| `website` — decides `/a/` vs `/w/` |
| `version_number` | the **pinned** published version (→ `artifact_version`) |
| `is_live` | takedown switch — `false` serves "unavailable", never deletes |
| `published_at`, `published_by` | provenance |

The key semantic: **the published version is pinned and independent of the
draft's `current_version`.** The founder publishes v3, then keeps editing to
v5 — the public keeps seeing v3 until they explicitly re-publish. "What I'm
working on" and "what the world sees" are different facts, exactly the
`hq_artifact` ↔ `hq_app` separation ADR-0005 already drew. `hq_artifact.status`
/`visibility` still reflect founder intent ('published'/'public'); the
`artifact_publication` row is the authoritative serving record.

This also sidesteps the frozen-schema constraint cleanly: no new columns on
`hq_artifact`, so `ARTIFACT_COLUMNS` and its test are unchanged.

## Decision 3 — the same allowlist is checked at generation AND enforced at serve
`validate.js`'s `APPROVED_HOSTS` is checked when an artifact is *generated*
(B2) and asserted before *publish*. The Worker enforces the **same allowlist as
a Content-Security-Policy header on every served response** — generation-time
validation and serve-time CSP are one allowlist stated once.

The Worker sets, on every artifact response:

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com cdnjs.cloudflare.com;
  style-src  'self' 'unsafe-inline' fonts.googleapis.com;
  font-src   fonts.gstatic.com;
  img-src    'self' data:;
  connect-src 'none';
  form-action 'self';
  base-uri 'none';
  frame-ancestors 'none';
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```
…and **never a `Set-Cookie`.**

The reasoning behind the tight directives:
- **`connect-src 'none'` + `img-src 'self' data:`** — a published artifact is
  self-contained (localStorage is fine, the network is not). Together these
  close the two exfiltration channels available to inline JS: `fetch`/XHR/
  WebSocket, and image-beacon URLs. A malicious or buggy artifact can't phone
  anything a visitor types out to a third party.
- **`script-src 'unsafe-inline'` is unavoidable and accepted** — artifacts are
  single-file with inline JS by design; nonces don't fit generated content.
  The residual risk is contained by the *other* directives (nothing can be
  exfiltrated) and by `validate.js` already forbidding `eval`/`new Function`.
  This is the one accepted residual, stated honestly.
- **`frame-ancestors 'none'` + `base-uri 'none'`** — the artifact can't be
  clickjacked, and can't rewrite its own base to smuggle in external URLs past
  the other directives.
- **No cookies, and `build.arganta.app` is a distinct origin** from any
  authenticated Arganta surface — so even same-site confusion can't leak a
  session; there is no session on this origin to leak.

## Decision 4 — the Worker reads exactly one thing, and re-validates before serving
The Worker's only reach into Supabase is a public, read-only RPC
`publication_by_slug(slug)` — `SECURITY DEFINER`, granted to `anon`, returning
**only `is_live` publications'** `{ kind, html, version_number }` and nothing
for a missing/taken-down/non-live slug. `anon` gets this ONE new grant;
`hq_artifact` and `artifact_version` stay operator-only. The Worker calls it
with the anon key (a public value already in client bundles — safe here because
the RPC exposes only what the founder explicitly published).

Before serving, the Worker **re-runs `validateHtml()` server-side** on the
returned HTML. Publish already required a pass, so this should never fail — but
defence in depth means we never serve HTML we haven't just re-checked (guards
against DB tampering, or a `validate.js` rule tightening *after* something was
published). A re-validation failure serves a neutral "this artifact is
unavailable" page, not the HTML — the ADR-0005 promise ("re-run this
server-side; never trust a client-side pass") made concrete.

## Decision 5 — publish stays human-in-the-loop, unchanged from ADR-0004/0005
`publish_artifact` remains the sole `sideEffect: true, autonomySafe: false`
builder tool. Nothing here relaxes that:
- `autonomyGate` (ADR-0004) already refuses it to any headless mission — a
  scheduled agent can draft and even revise a site, but can never publish one.
- The publish flow is: human confirm → `publish_artifact(artifactId,
  versionNumber?)` → executor re-checks `validateHtml` (UX: tell the founder
  *why* if it can't) → `hq_artifact_publish` RPC (operator-gated) assigns/reuses
  a slug, pins the version, sets `is_live`, flips `hq_artifact` status/
  visibility → returns the public URL. Two server-side validation checkpoints
  (publish-time and every serve), neither of them the browser.
- **Slugs**: derived from the title, deduped with a short random suffix,
  immutable once assigned, drawn from a reserved-word denylist (`a`, `w`, `api`,
  `_health`, `admin`, …) so a slug can never shadow a runtime route.
- **Takedown**: `is_live = false` is instant and reversible; artifacts and
  versions are never hard-deleted (audit trail).

## What is NOT a technical control (stated so it isn't mistaken for one)
- **Content responsibility is the founder's.** A single operator publishes to
  their own subdomain; "abuse" is self-abuse. The system's job is to stop an
  artifact harming its *visitors* (Decision 3) and to stop a *headless agent*
  publishing without a human (Decision 5) — not to police what the founder
  themselves chooses to put up. The `is_live` switch is the response mechanism
  if that ever changes (multi-user, delegated publish).
- **Confidential data can't reach a published artifact by construction**, not
  by scanning: artifacts generate at `dataClass:'public'` (B2), and the
  `analyze`-style confidential data never enters generation. `validate.js`'s
  secret-shape check is a backstop, not the primary guarantee.

## Alternatives considered
- **Serve from a Supabase Edge Function + custom domain.** Rejected — puts the
  public surface on the same project as all founder data, and fights Supabase's
  function-URL scheme for a clean `build.arganta.app/w/:slug` path. The Worker
  is both safer (isolation) and more natural (the domain is already there).
- **Per-artifact deploys (a Vercel project / static file per publish).**
  Rejected in the Single-File-Builder plan already; one shared runtime + a slug
  lookup is the v1, no deploy per artifact.
- **Iframe-sandbox the artifact inside an arganta.app page** instead of serving
  it top-level. Rejected — a top-level document on an isolated, cookieless
  origin with a tight CSP is *simpler and stronger* than an embed (no parent to
  attack, no host page to compromise), and it's the honest thing to hand
  someone as "your published site."
- **Allow `connect-src`/arbitrary `img-src` so artifacts can be real
  networked apps.** Deferred, not rejected — a self-contained artifact is the
  v1; per-artifact network opt-in (with its own review) is a later, deliberate
  capability, not a default.

## Consequences
- B5 (Sonnet) builds: the Cloudflare Worker (`build.arganta.app/*`, imports
  `validate.js`), an additive `migration_artifact_publications.sql`
  (`artifact_publication` + `publication_by_slug` + `hq_artifact_publish`), the
  `publish_artifact`/`unpublish` executors in `lib/core/tools.ts` (wiring
  `WIRED_BUILDER_SPECS` from 6 → 7+), and the founder-facing publish/takedown UI
  in the Builder + Core.
- **Founder prerequisites** (recorded, like ADR-0004's Vault step): deploy the
  Worker and add the `build.arganta.app/*` route; confirm `build.arganta.app`
  resolves. No new paid service — Workers free tier covers this.
- The public attack surface is provably narrow: one cookieless origin, one
  read-only live-only RPC, one CSP that mirrors the generation allowlist,
  re-validated on every serve. Its go-live is the final Opus review ADR-0005
  named.

## Related
- ADR-0005 (artifact model & publish safety) — the model this serves; the
  "re-run validation server-side" promise this fulfills.
- ADR-0004 (autonomous invocation) — why publish can never run headless.
- ADR-0003 (data-class governance) — why confidential data can't reach a
  published artifact.
- `packages/builder/src/validate.js` — the one allowlist, checked at generation
  and enforced as CSP at serve.
- `docs/arganta-core/Single-File-Builder.md` — the B1–B5 plan.

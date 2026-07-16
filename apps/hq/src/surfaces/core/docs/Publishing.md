---
title: Publishing
updated: 2026-07-16
type: reference
tags: [arganta-core, publishing, builder]
---

# Publishing

A site or app Core builds starts as a private **draft** with full version history. Publishing pins one version to a public URL on `build.arganta.app` — served by a dedicated Cloudflare Worker isolated from all your Supabase data.

## The flow

1. Ask Core to build something → `create_website` / `create_application` (see [[Capabilities]]).
2. Revise it in conversation as many times as you like — every version is kept.
3. Say `publish that` → Core re-validates the exact HTML, then asks you to confirm.
4. It goes live at `build.arganta.app/w/<slug>` (sites) or `/a/<slug>` (apps).
5. Take it down anytime — unpublish flips it to `404` in seconds; nothing is hard-deleted.

> [!warning] Always confirmed, never silent
> `publish_artifact` is the **only** tool that touches the outside world, so it always requires your explicit go-ahead. Core cannot publish on its own.

## Safety built in

- The published version is **pinned** — you can keep editing the draft to v5 while the public still sees the v3 you published, until you re-publish.
- The Worker **re-validates** the HTML server-side on every serve (no secrets, no eval, approved hosts only) and sets a strict CSP — defence in depth, never trusting the publish-time check alone.
- Confidential data can't reach a published artifact by construction: artifacts generate at the `public` data class.

See [[Models and Cost]] for how generation is billed ($0 free tier) and [[How It Works]] for the validation gate.

_Last reviewed 2026-07-16._

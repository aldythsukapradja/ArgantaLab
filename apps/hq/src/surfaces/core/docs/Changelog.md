---
title: Changelog
updated: 2026-07-16
type: log
tags: [arganta-core, changelog]
---

# Changelog

Dated log of what shipped in Arganta Core. Newest first. Back to [[Home]].

## 2026-07-16 — Mobile polish (M1)
- **The chat is now full screen on phones and tablets**, ChatGPT/Claude-style. The composer is two rows — your message on top, model picker and send beneath — so nothing gets crushed. Send is a proper thumb-sized button.
- **The model picker opens as a bottom sheet** on mobile, and today's free usage (Cloudflare neurons, Gemini, Groq, session cost) lives inside it instead of cluttering the composer. See [[Models and Cost]].
- **The Agent button is a reactor** now — a glowing core with three orbiting product pods, dead-center in the bottom dock. Tap it → the chat opens full screen; the X (top-right) returns you to where you were.
- **The dock reaches tablets too** (≤980px), and full-screen chat properly covers it.
- **Build opens Content Builder by default**, and Content Builder is mobile-responsive — stacked layout, the copilot as a bottom sheet, a snap-scrolling slide strip.

## 2026-07-16
- **Gemini is live as the brain.** `GEMINI_API_KEY` set; chat now returns real replies with `edgeProxy · gemini-flash-latest · $0.0000` provenance. See [[Models and Cost]].
- **Fixed a tool-schema double-wrap** that made every tool-using turn fail (Gemini rejected empty function names; Cloudflare hallucinated fake ones). Root cause of the earlier "no live model on every message".
- **Switched the gateway to `gemini-flash-latest`** — the pinned `gemini-2.0-flash` has free-tier quota `limit: 0` on this project.
- **Honest partial-success message.** When a tool made a real artifact but the follow-up caption call couldn't reach a model, Core now says the artifact is real and saved instead of "nothing was fabricated".
- **This live help panel** — the pages you're reading, as editable Markdown with `[[wikilinks]]`.

## 2026-07-15
- **C6 — grounded office delegation** ([[Agents and Offices]]): `operations`/`treasury` run real pipelines over live data, confidential answers stay local.
- **C5 — Vault memory + auto-recall** ([[Memory and Vault]]).
- **B5 — public publishing** ([[Publishing]]) live at `build.arganta.app`.
- **B1–B4 — the Single-File Builder** (`create_website` / `create_application`, validation gate, portable blocks).
- **C3 — the tool loop** ([[How It Works]]): the brain can call real tools.

## Roadmap (not yet shipped)
- Multi-brain routing + a real model picker once `GROQ_API_KEY` / `ANTHROPIC_API_KEY` are set — see [[Models and Cost]].
- C7 — an autonomous heartbeat (nightly rollups, morning brief), pending secrets hardening.
- Office orchestration (one office convening others) — see [[Agents and Offices]].

_Last reviewed 2026-07-16._

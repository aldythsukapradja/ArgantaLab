---
title: Models and Cost
updated: 2026-07-16
type: reference
tags: [arganta-core, models, cost, routing]
---

# Models and Cost

Core runs on a **four-tier router**: it always picks the cheapest model that can actually do the job. In practice, on your free setup, that means three *different* models doing three *different* jobs in a single turn — which is why you see more than one provider in the trail.

## Which model does what

| Job | Model | Provider | Shows in trail as |
|---|---|---|---|
| **The brain** (chat, reasoning, deciding which tool to call) | Gemini Flash | Google (via your gateway) | `edgeProxy · gemini-flash-latest` |
| **Images** | FLUX | Cloudflare Workers AI | `cloudflare-flux` |
| **Voice** | Aura-1 | Cloudflare Workers AI | `cloudflare-aura` |
| **Memory embeddings** | BGE | Cloudflare Workers AI | `cloudflare-bge` |

> [!important] "Is it always Cloudflare?"
> No. The **brain** is **Gemini** right now. The Cloudflare entries you see (`cloudflare-flux`, `cloudflare-bge`) are the **image** and **embedding** models — separate engines the brain calls, not the brain itself. So a single "generate image" turn legitimately shows Gemini (deciding), Cloudflare-BGE (recall), and Cloudflare-FLUX (the image).

## Can I pick the brain?

Today the brain is auto-selected as the cheapest **tools-capable** model, and the only free tools-capable model configured is **Gemini** — so there's effectively one choice. Cloudflare's free Llama is deliberately **not** used as the brain: it isn't reliable at tool-calling (it invents fake tool names), so routing excludes it. A real picker becomes useful the moment a second tools-capable key is set — see below.

## Turning on more brains

- **`GROQ_API_KEY`** (free, console.groq.com) — adds Llama-3.3-70B as a fast second brain and a **fallback**, so a transient Gemini hiccup stops degrading to "no live model".
- **`ANTHROPIC_API_KEY`** — unlocks Claude (Economy/Frontier tiers) for harder reasoning, if you raise the tier ceiling.

## Why it's $0

Everything above is free-tier: Gemini's free quota, Cloudflare Workers AI's free neuron allowance. The footer under every reply shows the real cost — it reads `$0.0000` because it genuinely is. Watch the free allowance in **[[Publishing|Model Rack]]** (the quota gauges). See [[How It Works]] for the honest-degrade behaviour when a free tier is momentarily exhausted.

## A note on the Gemini model id

The gateway uses `gemini-flash-latest`, not the pinned `gemini-2.0-flash`. On this project the pinned id returns free-tier quota `limit: 0`; the alias has quota and does real tool-calling. If you ever see tool calls fail, that pin is the first thing to check.

_Last reviewed 2026-07-16._

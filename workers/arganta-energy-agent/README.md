# arganta-energy-agent

The **language layer** for the ArgantaEnergy agent — and nothing else.

## What it does

It turns a geoscientist's sentence into one tool call against the app's capability
registry. That is the whole job.

```
"what do you have on kutai"  →  tool: basin_dossier { query: "kutai" }
```

The tool then executes **in the browser**, against local JSON, and renders a data
card built by deterministic code. The Worker never sees a field, a well, a basin
or a volume — so it cannot fabricate one, and a client's dataset never leaves
their machine.

## What it deliberately does not do

- It does not resolve entity names. `"kutai"` is passed through verbatim; the
  app's five-stage resolver corrects it to **Kutei Basin** and asks the user to
  confirm. A model that "helpfully" tidies a half-remembered basin name is the
  exact failure this design prevents.
- It does not summarise results. The tool result handed back to the model is a
  number-free one-liner.
- It does not state facts. The system prompt forbids it, and `agent/guard.ts`
  enforces it on the client: any number in the model's prose that is not in the
  card or the user's own words causes the whole utterance to be **discarded**.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/health` | which providers are configured; `503` when none |
| `POST` | `/v1/chat/completions` | OpenAI-compatible, `stream: true` supported |

OpenAI-compatible on purpose: `@arganta/ai`'s `createLLM({ openaiCompat: { baseUrl } })`
works against it unmodified, and its `readSSE()` gives real token streaming.

## Providers

Cheapest-capable-first, same ordering discipline as `supabase/functions/llm-proxy`:

1. **groq** (`GROQ_API_KEY`) — free tier and, importantly, **tool-capable**.
2. **Workers AI** (`[ai]` binding) — always available; weaker tool support, so a
   turn that lands here may return no tool call, at which point the client falls
   back to its own deterministic grammar.

Why not `llm-proxy`: it hard-gates on an operator email in the Supabase JWT
(`403`) and `apps/energy` has no Supabase auth at all. It also has no Anthropic
tool-call translation, so a tool-using agent could only reach groq/gemini
through it anyway.

## Deployed

```
https://arganta-energy-agent.aldhyt-sukapradja.workers.dev
```

Verified live: `/v1/health` → 200 with the Workers AI provider bound; `POST
/v1/chat/completions` → **401** until `AGENT_TOKEN` is set; unknown path → 404;
`GET` on the chat route → 405; CORS echoes `energy.arganta.app` and returns
`null` for `arganta.app.evil.com`.

**Auth fails closed.** An unset `AGENT_TOKEN` refuses every request rather than
waving them through — this Worker holds a provider key and an AI binding, so an
unconfigured deploy that answered anonymously would be an open invitation to
spend the account's quota. The 401 body says exactly what to run.

## Setup

```bash
openssl rand -hex 32          # → AGENT_TOKEN
```

```bash
cd workers/arganta-energy-agent && wrangler secret put AGENT_TOKEN
```

```bash
cd workers/arganta-energy-agent && wrangler secret put GROQ_API_KEY
```

```bash
cd workers/arganta-energy-agent && wrangler deploy
```

Then point the app at it in `apps/energy/.env.local`:

```bash
printf 'VITE_ENERGY_AGENT_URL=https://arganta-energy-agent.<subdomain>.workers.dev\nVITE_ENERGY_AGENT_TOKEN=<AGENT_TOKEN>\n' >> apps/energy/.env.local
```

With no `VITE_ENERGY_AGENT_URL` set the app runs the **deterministic tier** and
shows a "Lite" badge. It never silently mocks.

## Local development

```bash
cd workers/arganta-energy-agent && wrangler dev
```

Copy `.dev.vars.example` to `.dev.vars` and set `AGENT_TOKEN` — auth fails closed
in dev too. Every `localhost` origin is allowed at any port (Vite's autoPort
moves the dev port around).

## Tests

```bash
cd workers/arganta-energy-agent && npm test
```

29 pure tests over CORS, auth, validation, provider selection and the SSE shim.
Run in CI by the `test` job. The client half — tool projection and the grounding
guard — is covered by `apps/energy` → `npm run test:agent`.

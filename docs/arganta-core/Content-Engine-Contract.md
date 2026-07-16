# Arganta Core Content Engine — Wire Contract (O2)

The single agreement between the Cloudflare Worker (`workers/arganta-core-content`),
the HQ client (`apps/hq/src/lib/argantaCoreClient.ts`), and the Claude Code MCP bridge
(`tools/arganta-core-mcp`). One endpoint, two kinds.

**Endpoint:** `POST {VITE_ARGANTA_CORE_URL}/v1/generate`
**Auth:** `Authorization: Bearer {CORE_TOKEN}` (skipped when the Worker has no token — local dev).
**CORS:** Worker echoes the request Origin only if it's in `ALLOWED_ORIGINS`.

## Kind `copy` — carousel text + caption

### Request
```jsonc
{
  "kind": "copy",
  "brief": "5-slide carousel about ocean animals, playful",   // required, <=2000 chars
  "context": {                                                 // all optional
    "format": "portrait",          // POST_FORMATS id — steers aspect language
    "palette": "ocean",            // POST_PALETTES id — preferred palette
    "platform": "instagram",       // CAPTION_RULES id — caption limits/hook
    "brand": { "name": "KinetikCircle", "handle": "@kinetikcircle" },
    "wantImages": true,            // default true — include per-slide imagePrompt
    "existingSlides": [            // revise mode: current canvas (headline+body+template)
      { "template": "hook", "headline": "…", "body": "…" }
    ]
  }
}
```

### Response
```jsonc
{
  "ok": true,
  "kind": "copy",
  "copy": {                         // shape = COPY_SCHEMA (schema.js) = coercePost input
    "palette": "ocean",
    "slides": [
      { "template": "hook", "headline": "…", "body": "…", "badge": "WOW",
        "imagePrompt": "a vivid octopus underwater, dark water" }
    ],
    "caption": "…",
    "hashtags": "#a #b #c"
  },
  "usable": true,                   // false if the model produced 0 valid slides
  "provenance": { "provider": "cloudflare-workers-ai", "model": "@cf/…",
                  "latencyMs": 812, "neurons": 1, "estimated": true }
}
```
`copy` drops straight into Post Studio's existing `coercePost(copy, brief, doc)` — no new
coercion path. Templates/palettes are clamped to the known vocab server-side (`coerceCopy`).

## Kind `image` — one still background

### Request
```jsonc
{
  "kind": "image",
  "prompt": "a vivid octopus underwater, dark water",  // required, <=800 chars
  "format": "portrait",                                // resolves generation aspect
  "context": { "palette": "ocean" }                    // optional mood hint
}
```

### Response
```jsonc
{
  "ok": true,
  "kind": "image",
  "imageBase64": "iVBOR…",          // PNG bytes, base64
  "mime": "image/png",
  "width": 819, "height": 1024,     // fit inside 1024 at the format's aspect
  "provenance": { "provider": "cloudflare-workers-ai", "model": "@cf/…",
                  "latencyMs": 3200, "neurons": 1, "estimated": true }
}
```
The client turns `imageBase64` into a Blob → `uploadAsset` (media library, same-origin so
export stays untainted) → places it as the slide's `bg` image layer.

## Errors (any kind)
```jsonc
{ "ok": false, "error": { "code": "no_brief|bad_kind|unauthorized|generation_failed|…",
                          "message": "human-readable" } }
```
HTTP status mirrors the class (400 validation, 401 auth, 404 route, 502 upstream). The HQ
client treats **any** non-ok as a signal to fall back to `ai.chatJSON` → `localPost` — the
builder never hard-fails.

## Provenance discipline
`estimated:true` marks the neuron/cost figures as derived, never measured — same rule as
`mediaGateway`/the Model Rack. HQ logs every call through `logAgentRun` so the rack shows
real provider/model/latency for each generation.

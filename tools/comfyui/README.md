---
title: Local ComfyUI + Modal — image generation runbook
app: comfyui
appId: comfyui
gpu: RTX 3070 Ti Laptop (8GB VRAM)
scope: images solid locally · video stays on Modal
isolation: C:\ComfyUI lives OUTSIDE the repo — never touches git/Vercel/Cloudflare/Supabase
updated: 2026-07-17
---

# Comfy Console

Two generation backends behind one HQ panel. **Local ComfyUI** runs on your GPU
(free, offline, images). **Modal FLUX** is your owned serverless GPU (L40S 48GB,
the real video/heavy path) reached through the deployed `media-proxy`.

Nothing here can destabilise your cloud stack: the local server is a separate
process on `127.0.0.1:8188` with its own embedded Python, installed to `C:\ComfyUI`,
which is not in git.

## 0 · Two ways to install (pick ONE)

**A · Comfy Desktop (recommended for stability).** The `.exe` from comfy.org.
GUI installer, bundles Python, auto-updates, built-in model manager. After install,
open Settings (`Ctrl+,`) → Server Config and set:
  - **Enable CORS header** = `*`  (so the HQ panel can reach it)
  - **Port** = `8188`  (Desktop defaults to 8000 — set 8188 to match everything here,
    or leave 8000 and put `http://127.0.0.1:8000` in the panel's Local URL field)
  - **VRAM management mode** = `normalvram`  ·  VAE precision `fp16` (safe on 8GB)
Then SKIP steps 1–2 below — Desktop replaces the installer + launcher.

**B · Portable (scripted).** Steps 1–2 below. Use if you want a fully scriptable,
no-GUI install.

Either way, steps 3–5 (panel, Modal, MCP routing) are identical.

## 1 · Install the local server — Portable path (your click — downloads ~4GB)

```powershell
powershell -ExecutionPolicy Bypass -File tools\comfyui\install-comfyui.ps1
# optional, adds SDXL (~6.9GB, slower on 8GB):
powershell -ExecutionPolicy Bypass -File tools\comfyui\install-comfyui.ps1 -SDXL
```

Idempotent — safe to re-run. If a download 404s it tells you exactly which file
and where to drop a checkpoint by hand; it will not fake a working install.

## 2 · Run it

```
start-comfyui.bat        (double-click, or from repo root)
```

Serves `http://127.0.0.1:8188`. Uses `--normalvram`; if you OOM on SDXL/batches,
switch `--normalvram` → `--lowvram` in `start-comfyui.bat`.

## 3 · Open the panel

`apps/hq/prototypes/comfy-console.html` — via HQ dev server or opened directly.
Backend toggle: **Local · Modal · Cloudflare · Leonardo**. Local needs nothing;
the cloud three need your media-proxy URL + anon key (Cloud settings drawer, stored
in-browser only).

## 4 · Deploy Modal (your click — provisions billable GPU)

`modal/media_image.py` is already written and hardened (FLUX.1-schnell, L40S).
I do **not** run these for you — they auth to your account and bill per-second:

```bash
pip install modal
modal setup
modal secret create arganta-media MEDIA_TOKEN=<long-random-string>
modal deploy modal/media_image.py          # prints the https://…modal.run URL
```

Then wire it into the gateway (already the contract your media-proxy speaks):

```bash
supabase secrets set MODAL_IMAGE_URL=<the printed url>
supabase secrets set MODAL_TOKEN=<same MEDIA_TOKEN>
```

Health check (does NOT spin the GPU): `GET <modal-url>/health`.

## 5 · (Optional) route the media-gen MCP through your own GPUs

`tools/media-gen-mcp` now knows both backends. Default order is unchanged
(`cloudflare,leonardo`). To prefer your own GPU, in `tools/media-gen-mcp/.env`:

```
MEDIA_PROVIDER_ORDER=local,modal,cloudflare,leonardo
COMFY_URL=http://127.0.0.1:8188
MEDIA_PROXY_URL=https://<ref>.supabase.co/functions/v1/media-proxy
SUPABASE_ANON_KEY=ey…
```

Left-to-right with automatic fallback. Unset = original behaviour, zero change.

## Uninstall

Delete `C:\ComfyUI`. Revert the repo files with git. Done — no residue in your
cloud stack.

## Honest limits

- 8GB VRAM: SD1.5 comfortable, SDXL works with low-VRAM flags, **video will OOM** —
  keep video on Modal.
- Download URLs are pinned to ungated public hosts but were unverified at authoring
  time. If one breaks, the installer degrades gracefully (tells you where to drop a file).
- `modal deploy` and the local download are the only irreversible/billable steps,
  and both are yours to run.

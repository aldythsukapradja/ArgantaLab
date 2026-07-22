# ArgantaStudio — ComfyUI Video Quality Guide (Wan 2.2 on 8GB)

Your RTX 3070 Ti Laptop (8GB) can produce genuinely good Wan 2.2 video — the earlier "melting rainbow" output was purely a **resolution** bug (generating at 384², far below Wan's 480p–720p training band). That is now fixed in code. This guide adds the **speed + quality** upgrades you asked about.

## What was already fixed (no action needed)

The adapter now generates at Wan-supported resolutions and lengths:
- **Draft = 832×480** (default, coherent, ~3 min for 2s on your card)
- **HD = 1280×704** (native 720p, best quality, slow on 8GB)
- Length up to **5s / 121 frames** (was capped at 1s)
- Video Studio has **Aspect Ratio · Duration · Quality (draft/hd)** controls.

## The big upgrade: Turbo GGUF (4-step, ~6× faster)

The single best lever on 8GB is the **distilled Turbo model** — it renders in **4 steps instead of 30** (≈30s clips instead of 3 min) *and* fits 720p in VRAM. There is no 4-step LoRA for the 5B model yet (only for the big 14B), so the Turbo GGUF *checkpoint* is the right path.

### Step 1 — Install the ComfyUI-GGUF node
In ComfyUI: **Manager → Custom Nodes Manager → search "ComfyUI-GGUF" (by city96) → Install → Restart.**
(Or clone `https://github.com/city96/ComfyUI-GGUF` into `custom_nodes/` and restart.)

### Step 2 — Download the Turbo model
Already added to your download script — run:
```powershell
powershell -ExecutionPolicy Bypass -File tools\comfyui\download-media-models.ps1
```
This fetches `Wan2.2-TI2V-5B-Turbo-Q5_K_M.gguf` (~3.8GB) into the ComfyUI `unet` folder. Restart ComfyUI so it re-scans.

### Step 3 — Nothing else
**The adapter auto-detects it.** Once the `.gguf` is in the `unet` folder, ArgantaStudio uses it automatically (4 steps / cfg 1 / euler / shift 5), and the Library shows `engine: comfyui-wan22-turbo`. If you remove it, it falls back to the fp16 30-step path. No code change on your end.

## Optional extras (more speed / headroom)

- **Sage Attention** — meaningful speed-up + lower peak memory on RTX 30-series. Install the `sageattention` Python package into ComfyUI's env, then launch ComfyUI with `--use-sage-attention`.
- **`--lowvram` launch flag** — aggressive weight offloading; use it if you OOM at HD. (ComfyUI's native offloading already handles most 5B cases automatically.)
- **fp8 text encoder** — you already have `umt5_xxl_fp8_e4m3fn_scaled` installed, which saves ~5GB vs fp16. Good.

## If it still looks off

Wan 2.2 is "finicky with a narrow range of settings." In order:
1. **Resolution ≥ 480p** — the #1 cause of noise (now enforced in code).
2. **Shift** — 8 for base fp16, ~5 for turbo. Lower shift (3–5) = more motion; higher = more stability.
3. **Steps/cfg** — base: 30 steps / cfg 5. Turbo: 4 steps / cfg 1 (more steps on turbo *hurts*).
4. Keep clips **≤ 5s** — beyond 121 frames degrades.

## Reality check on 8GB

- **Music (ACE-Step)** is fast — ~30s. No changes needed.
- **Video draft (832×480)** on fp16 ≈ 3 min for 2s; with Turbo GGUF ≈ 30–60s.
- **Video HD (1280×704)** is where 8GB hurts — expect several minutes even with Turbo. Use it for hero shots, draft for iteration.

## Sources
- [ComfyUI Wan 2.2 docs](https://docs.comfy.org/tutorials/video/wan/wan2_2) · [official 5B workflow](https://comfy.org/workflows/video_wan2_2_5B_ti2v-f83ee3caa04e/)
- [Wan-AI/Wan2.2-TI2V-5B model card](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B)
- [hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF](https://huggingface.co/hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF) · [QuantStack base GGUF](https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF)
- [ComfyUI-GGUF (city96)](https://github.com/city96/ComfyUI-GGUF) · [lightx2v Lightning (5B not yet released)](https://huggingface.co/lightx2v/Wan2.2-Lightning)

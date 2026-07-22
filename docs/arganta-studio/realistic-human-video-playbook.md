# ArgantaStudio — Realistic Human Video on 8GB (the honest playbook)

**The hard truth:** 8GB (your RTX 3070 Ti Laptop) is on the wrong side of the line for photorealistic, identity-consistent, close-up human video *locally*. You can make it meaningfully better, but you cannot make it reliably good for hero faces without either a lot of patience or a paid API. Sourced research summary below.

## Why the Wan 5B face melts

Wan 2.2 **TI2V-5B** is a single dense model tuned to fit 8GB. The **14B** is a dual-expert MoE: a *high-noise* expert (composition/motion) + a *low-noise* expert (detail/skin/temporal consistency). **Faces live in that low-noise stage — which the 5B doesn't have.** More steps won't fix it; it's a model-capacity limit, not a settings problem.

## The three levers (in order of ROI on 8GB)

### 1. Face-restore + face-swap post-processing — highest ROI, do this first
Run each generated frame through a face node *after* Wan (the diffusion model is unloaded, so it's 8GB-friendly):
- **ReActor** (`ReActorRestoreFace` + face-swap) — swap your *real source face* onto every frame. Most temporally stable (least flicker) because it pastes a consistent identity. Best identity lock on low VRAM.
- **CodeFormer** (`mav-rik/facerestore_cf`) — tunable fidelity; better identity balance than GFPGAN.
- **FaceDetailer** (Impact Pack) — strongest quality, slowest (re-diffuses each face crop).
- Then **upscale 480p→720p** (Real-ESRGAN Video).
- Caveat: per-frame restore can *flicker*; keep restore strength ~0.5–0.7. ReActor swap flickers least.

### 2. Bigger local model — better, but slow
- **Wan 2.2 14B I2V GGUF Q4_K_M** (need BOTH experts): [QuantStack/Wan2.2-I2V-A14B-GGUF](https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF) — HighNoise + LowNoise files. ~9.65GB/expert → needs **block-swap** (Kijai WanVideoWrapper "WanVideo Block Swap") on 8GB. **~20–30 min per 5s clip.** Add [lightx2v 4-step distill LoRAs](https://huggingface.co/lightx2v/Wan2.2-Distill-Loras) (apply high+low-noise) for ~4–6× speed. Avoid Q3 — it can lose to the 5B on face detail.
- **HunyuanVideo (FP8 + tiling)** — widely cited as the best *open* model for humans specifically; 13B fits ~8GB. Weaker I2V/identity control than Wan.
- **LTX-Video** — fastest (targets 8GB), but face realism a step below. Good for drafts / non-close-up motion.

### 3. Paid API — the honest path for hero human content
For faces your brand actually depends on, **a paid API (fal.ai hosting Wan/Kling, or Kling / Runway / Veo directly)** produces dramatically more coherent humans than anything 8GB does locally — seconds-to-a-minute per clip, cents-to-a-few-dollars each. This is the "Frontier" tier already in the ArgantaStudio master plan.

## I2V identity tips (for image→video)
- Frame the source photo so the **face is large** (>10% of frame) — "the model can't preserve what it can't see."
- Use 14B I2V (low-noise expert holds likeness), or lock identity with **ReActor face-swap** from the source photo (most reliable on low VRAM).
- A trained character-consistency LoRA (varied angles) is the gold standard but is real work.

## The verdict (what to actually do)
1. **Now, free:** add a **ReActor face-swap + CodeFormer restore + upscale** pass to local output. Takes "distorted non-human" → "acceptable social human" for many shots, on 8GB, today.
2. **If pushing local:** Wan 14B GGUF Q4_K_M + lightx2v LoRAs + block-swap, or HunyuanVideo FP8. "Good," rarely "flawless," never fast.
3. **For hero faces:** use a paid API. Your iteration time on an 8GB laptop is worth more than the API spend on the few clips that ship.

**The line:** 8GB is fine for B-roll, backgrounds, non-close-up human motion, and *drafts* — especially with face-swap locking identity. It cannot reliably do photorealistic close-up faces that survive scrutiny. Local for volume, paid for the faces that matter.

## Sources
QuantStack [I2V-A14B GGUF](https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF) · [T2V-A14B GGUF](https://huggingface.co/QuantStack/Wan2.2-T2V-A14B-GGUF) · [lightx2v distill LoRAs](https://huggingface.co/lightx2v/Wan2.2-Distill-Loras) · [Cordux low-VRAM workflow](https://github.com/Cordux/ComfyUI-Wan2.2-workflow) · [ReActor restore node](https://www.runcomfy.com/comfyui-nodes/comfyui-reactor-node/re-actor-restore-face) · [facerestore_cf](https://github.com/mav-rik/facerestore_cf) · [comfyui_gfpgan](https://github.com/comfyorg/comfyui_gfpgan) · [RunComfy I2V consistency LoRA](https://www.runcomfy.com/trainer/ai-toolkit/wan-2-2-i2v-character-consistency-lora) · [fal.ai Wan 2.2](https://blog.fal.ai/wan-2-2-vs-wan-2-1-whats-new-and-how-to-upgrade-your-video-pipeline/)

# Arganta media — Economy-tier (costClass 2) text-to-image on Modal.
# Serverless GPU: pay per-second, scale-to-zero. Runs FLUX.1-schnell (Apache-2.0,
# ungated) so you OWN the pipeline — no per-generation vendor tax.
#
# Contract the media-proxy Edge Function speaks (supabase/functions/media-proxy):
#   POST  Authorization: Bearer <MEDIA_TOKEN>   { "prompt": "..." }
#   200   { "image_base64": "<png base64>" }
#
# ── Deploy (founder, one time) ─────────────────────────────────────────────
#   pip install modal
#   modal setup                                   # links your Modal account
#   modal secret create arganta-media MEDIA_TOKEN=<pick-a-long-random-string>
#   modal deploy modal/media_image.py             # prints the web endpoint URL
# Then wire it into the gateway:
#   supabase secrets set MODAL_IMAGE_URL=<the printed https://…modal.run url>
#   supabase secrets set MODAL_TOKEN=<the same MEDIA_TOKEN value>
#
# NOTE: Modal's Python SDK evolves — if a decorator name errors, check
# modal.com/docs (e.g. web_endpoint↔fastapi_endpoint, container_idle_timeout↔
# scaledown_window). This is written against the current stable API but is
# UNVERIFIED here (no Modal account in this environment).
#
# GPU: FLUX.1-schnell (full) wants ~24GB+; L40S (48GB) is a safe, cost-effective
# pick. To run on a cheaper A10G (24GB), switch MODEL to a smaller pipeline
# (e.g. "stabilityai/sdxl-turbo") — see SMALLER_ALT below.

import base64
import io
import os

import modal

MODEL = "black-forest-labs/FLUX.1-schnell"     # primary (Apache-2.0, ungated)
# SMALLER_ALT = "stabilityai/sdxl-turbo"       # fits A10G; swap MODEL + pipeline below

app = modal.App("arganta-media-image")

# Persist model weights across cold starts so only the FIRST deploy pays the
# ~24GB download; later container starts are fast.
cache = modal.Volume.from_name("arganta-hf-cache", create_if_missing=True)
CACHE_DIR = "/cache"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "diffusers>=0.30",
        "transformers>=4.44",
        "accelerate",
        "sentencepiece",
        "protobuf",
        "fastapi[standard]",
    )
    .env({"HF_HOME": CACHE_DIR})
)


@app.cls(
    gpu="L40S",
    image=image,
    volumes={CACHE_DIR: cache},
    timeout=600,
    scaledown_window=120,  # keep the container warm 2 min after a request
)
class ImageModel:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import FluxPipeline

        self.pipe = FluxPipeline.from_pretrained(
            MODEL, torch_dtype=torch.bfloat16, cache_dir=CACHE_DIR
        )
        self.pipe.to("cuda")

    @modal.method()
    def generate(self, prompt: str) -> str:
        image = self.pipe(
            prompt,
            num_inference_steps=4,   # schnell is a 4-step distilled model
            guidance_scale=0.0,
            height=1024,
            width=1024,
        ).images[0]
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()


@app.function(image=image, secrets=[modal.Secret.from_name("arganta-media")])
@modal.fastapi_endpoint(method="POST")
def web(data: dict, request):
    # Shared-secret auth: the media-proxy Edge Function sends the same token we
    # stored in the `arganta-media` Modal secret. Reject anything else.
    from fastapi.responses import JSONResponse

    expected = os.environ.get("MEDIA_TOKEN", "")
    auth = request.headers.get("authorization", "")
    if not expected or auth != f"Bearer {expected}":
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    prompt = (data or {}).get("prompt")
    if not prompt:
        return JSONResponse({"error": "prompt required"}, status_code=400)

    b64 = ImageModel().generate.remote(prompt)
    return JSONResponse({"image_base64": b64})

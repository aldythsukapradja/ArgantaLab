# Custom nodes lock

Installed 2026-07-17 into `C:\Users\aldhy\AppData\Local\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI\custom_nodes`
(ComfyUI Desktop 0.28.0 · Python 3.13.12 · torch 2.10.0+cu130 · RTX 3070 Ti 8GB).
All cloned `--depth 1` from main; pip deps into the Desktop `.venv`.

| Repo | URL | Purpose |
|---|---|---|
| ComfyUI_IPAdapter_plus | github.com/cubiq/ComfyUI_IPAdapter_plus | IP-Adapter identity conditioning (workflows 02/03/04) |
| ComfyUI-Impact-Pack | github.com/ltdrdata/ComfyUI-Impact-Pack | FaceDetailer pipeline (workflow 05) |
| ComfyUI-Impact-Subpack | github.com/ltdrdata/ComfyUI-Impact-Subpack | UltralyticsDetectorProvider (face bbox detect) |
| ComfyUI-AnimateDiff-Evolved | github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved | F2 motion module runtime |
| ComfyUI-VideoHelperSuite | github.com/Kosinkadink/ComfyUI-VideoHelperSuite | F2 video combine/encode |

Notable pip additions: ultralytics 8.4.98 (+opencv). **Not installed:** insightface
(FaceID variants need it; py3.13 build friction — using ip-adapter-plus-face instead).

## Model manifest (downloaded 2026-07-17)

Shared models `C:\Users\aldhy\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models`:
- `clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` (h94/IP-Adapter image_encoder)
- `controlnet/control_v11p_sd15_openpose_fp16.safetensors`
- `controlnet/control_v11f1p_sd15_depth_fp16.safetensors`
- `upscale_models/RealESRGAN_x4plus.pth`
- `checkpoints/v1-5-pruned-emaonly.safetensors` (pre-existing)

Base-install models `...\ComfyUI-Installs\ComfyUI\ComfyUI\models` (folders not in shared yaml):
- `ipadapter/ip-adapter-plus_sd15.safetensors`
- `ipadapter/ip-adapter-plus-face_sd15.safetensors`
- `ultralytics/bbox/face_yolov8m.pt` (Bingsu/adetailer)

Also present (Z-Image engine, pre-existing): `diffusion_models/z_image_turbo_bf16.safetensors`,
`text_encoders/qwen_3_4b.safetensors`, `vae/ae.safetensors`.

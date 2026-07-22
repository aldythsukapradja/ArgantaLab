# Batch-download the open, ComfyUI-ready media models for the Sovereign Fabric.
# Idempotent + resumable (curl -L -C -). Ungated Comfy-Org repos — no HF login.
# Target = the Comfy Desktop SHARED models dir (matches shared_model_paths.yaml).
# Modal is intentionally OUT of scope here (owned serverless GPU, separate).
#
#   powershell -ExecutionPolicy Bypass -File tools\comfyui\download-media-models.ps1
#
# Skips any file already fully present. Safe to re-run after an interrupted sleep.

$ErrorActionPreference = 'Continue'
$Models = "$env:LOCALAPPDATA\Comfy-Desktop\ComfyUI-Shared\models"
Write-Host "Models root: $Models"

# repo-relative resolve URL -> local subfolder/filename
$Files = @(
  # --- ACE-Step 1.5 turbo, all-in-one (music). ~10GB. Fits 8GB w/ offload. ---
  @{ url='https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/checkpoints/ace_step_1.5_turbo_aio.safetensors';
     dir='checkpoints'; name='ace_step_1.5_turbo_aio.safetensors' },

  # --- Wan 2.2 TI2V-5B set (video draft tier). diffusion + vae + text encoder ---
  @{ url='https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors';
     dir='diffusion_models'; name='wan2.2_ti2v_5B_fp16.safetensors' },
  @{ url='https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors';
     dir='vae'; name='wan2.2_vae.safetensors' },
  @{ url='https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors';
     dir='text_encoders'; name='umt5_xxl_fp8_e4m3fn_scaled.safetensors' },

  # --- Wan 2.2 TI2V-5B TURBO (distilled, 4-step) GGUF — the FAST video path. ---
  # ~3.8GB, fits 8GB with room for 720p. Needs the ComfyUI-GGUF custom node
  # (install "ComfyUI-GGUF" by city96 via ComfyUI Manager). Goes in models/unet
  # (city96 convention). 4 steps / cfg 1 → ~30s clips instead of ~3min.
  # Source: https://huggingface.co/hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF
  @{ url='https://huggingface.co/hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF/resolve/main/Wan2.2-TI2V-5B-Turbo-Q5_K_M.gguf';
     dir='unet'; name='Wan2.2-TI2V-5B-Turbo-Q5_K_M.gguf' }
)

foreach ($f in $Files) {
  $destDir = Join-Path $Models $f.dir
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $dest = Join-Path $destDir $f.name
  Write-Host "`n== $($f.name)  ->  $($f.dir)"
  # -L follow redirects, -C - resume, -f fail on HTTP error (reports which file)
  & curl.exe -L -C - -f -o "$dest" $f.url
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  !! FAILED ($LASTEXITCODE) — URL may have moved. Drop the file by hand into $destDir" -ForegroundColor Yellow
  } else {
    Write-Host "  ok" -ForegroundColor Green
  }
}

Write-Host "`nDone. Restart ComfyUI so it re-scans the model folders."
Write-Host "NOT downloaded here (do later / need review):"
Write-Host "  - Stable Audio Open (SFX): GATED on HuggingFace — needs a logged-in license accept."
Write-Host "  - Hunyuan3D v2 (GLB): large, Phase O6."
Write-Host "  - Voice engines: auto-download on first use once TTS-Audio-Suite node is installed."

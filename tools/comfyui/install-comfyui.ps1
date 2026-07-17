<#
  install-comfyui.ps1 — Local ComfyUI setup for ArgantaLab (image gen, RTX 3070 Ti 8GB).

  WHAT IT DOES (idempotent — safe to re-run):
    1. Ensures 7-Zip is present (via winget) to unpack the portable build.
    2. Downloads ComfyUI Windows portable (NVIDIA) into  C:\ComfyUI  (OUTSIDE your repo).
    3. Downloads one checkpoint into C:\ComfyUI\...\models\checkpoints:
         default : Stable Diffusion 1.5 base (~4GB, fast, fits 8GB easily)
         -SDXL   : also pulls SDXL base 1.0 (~6.9GB, better quality, slower on 8GB)
    4. Writes a default text->image workflow the HQ panel can POST.

  ISOLATION CONTRACT:
    Everything lives in C:\ComfyUI, NOT in the ArgantaLab repo. It never enters git,
    never touches Vercel / Cloudflare / Supabase. It is a separate process on
    127.0.0.1:8188 using its own embedded Python. Delete C:\ComfyUI to fully remove it.

  RUN (PowerShell, no admin needed for the download; winget may prompt):
    powershell -ExecutionPolicy Bypass -File tools\comfyui\install-comfyui.ps1
    powershell -ExecutionPolicy Bypass -File tools\comfyui\install-comfyui.ps1 -SDXL

  NOTE: download URLs are pinned to ungated public hosts but are UNVERIFIED in this
  authoring environment. If one 404s, the script tells you exactly which file failed
  and where to drop a checkpoint manually — it will not silently produce a broken install.
#>

param(
  [switch]$SDXL,
  [string]$Root = 'C:\ComfyUI'
)

$ErrorActionPreference = 'Stop'
function Say($m){ Write-Host "[comfyui-setup] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[comfyui-setup] $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "[comfyui-setup] ERROR: $m" -ForegroundColor Red; exit 1 }

# --- 0. paths -------------------------------------------------------------
$dl = Join-Path $Root '_dl'
New-Item -ItemType Directory -Force -Path $Root, $dl | Out-Null
$portableDir = Join-Path $Root 'ComfyUI_windows_portable'

# --- 1. ensure 7-Zip (portable build ships as .7z) ------------------------
$sevenZip = (Get-Command 7z.exe -ErrorAction SilentlyContinue)?.Source
if (-not $sevenZip) { $sevenZip = @('C:\Program Files\7-Zip\7z.exe','C:\Program Files (x86)\7-Zip\7z.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1 }
if (-not $sevenZip) {
  Say '7-Zip not found — installing via winget...'
  try { winget install --id 7zip.7zip -e --accept-source-agreements --accept-package-agreements | Out-Null } catch { Warn "winget failed: $_" }
  $sevenZip = @('C:\Program Files\7-Zip\7z.exe','C:\Program Files (x86)\7-Zip\7z.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $sevenZip) { Die "Could not install 7-Zip. Install it from https://www.7-zip.org then re-run." }
Say "7-Zip: $sevenZip"

# --- 2. download + extract ComfyUI portable -------------------------------
function Fetch($url, $out, $minMB) {
  if ((Test-Path $out) -and ((Get-Item $out).Length / 1MB) -ge $minMB) { Say "already have $(Split-Path $out -Leaf) — skip"; return $true }
  Say "downloading $(Split-Path $out -Leaf) ..."
  try { Start-BitsTransfer -Source $url -Destination $out -ErrorAction Stop }
  catch {
    Warn "BITS failed ($_), retrying with Invoke-WebRequest ..."
    try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing } catch { Warn "download FAILED: $url"; return $false }
  }
  if ((-not (Test-Path $out)) -or ((Get-Item $out).Length / 1MB) -lt $minMB) { Warn "downloaded file too small — likely an error page: $out"; return $false }
  return $true
}

if (-not (Test-Path (Join-Path $portableDir 'run_nvidia_gpu.bat'))) {
  $archive = Join-Path $dl 'ComfyUI_windows_portable_nvidia.7z'
  $url = 'https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z'
  if (-not (Fetch $url $archive 800)) { Die "ComfyUI portable download failed. Get it manually from https://github.com/comfyanonymous/ComfyUI/releases and extract into $Root" }
  Say "extracting (this takes a minute)..."
  & $sevenZip x $archive "-o$Root" -y | Out-Null
  if (-not (Test-Path (Join-Path $portableDir 'run_nvidia_gpu.bat'))) { Die "extract did not produce run_nvidia_gpu.bat under $portableDir" }
} else { Say "ComfyUI portable already extracted — skip" }

# --- 3. checkpoints -------------------------------------------------------
$ckptDir = Join-Path $portableDir 'ComfyUI\models\checkpoints'
New-Item -ItemType Directory -Force -Path $ckptDir | Out-Null

$sd15 = Join-Path $ckptDir 'v1-5-pruned-emaonly.safetensors'
if (-not (Fetch 'https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors' $sd15 2000)) {
  Warn "SD1.5 checkpoint download failed. Drop any .safetensors checkpoint into:`n  $ckptDir`nThen re-run start-comfyui.bat."
}

if ($SDXL) {
  $sdxl = Join-Path $ckptDir 'sd_xl_base_1.0.safetensors'
  if (-not (Fetch 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors' $sdxl 5000)) {
    Warn "SDXL checkpoint download failed — SD1.5 still works. You can add SDXL manually into $ckptDir later."
  }
}

# --- 4. default API workflow (the HQ panel POSTs this to /prompt) ----------
$wf = Join-Path $Root 'default-workflow.json'
if (-not (Test-Path $wf)) {
  @'
{
  "3": {"class_type":"KSampler","inputs":{"seed":0,"steps":20,"cfg":7,"sampler_name":"euler","scheduler":"normal","denoise":1,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},
  "4": {"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"v1-5-pruned-emaonly.safetensors"}},
  "5": {"class_type":"EmptyLatentImage","inputs":{"width":512,"height":512,"batch_size":1}},
  "6": {"class_type":"CLIPTextEncode","inputs":{"text":"a scenic landscape","clip":["4",1]}},
  "7": {"class_type":"CLIPTextEncode","inputs":{"text":"lowres, bad anatomy, watermark","clip":["4",1]}},
  "8": {"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
  "9": {"class_type":"SaveImage","inputs":{"filename_prefix":"arganta","images":["8",0]}}
}
'@ | Set-Content -Path $wf -Encoding UTF8
  Say "wrote default-workflow.json"
}

Say "DONE. Launch with:  start-comfyui.bat   (from the repo root)"
Say "Server will be at http://127.0.0.1:8188"

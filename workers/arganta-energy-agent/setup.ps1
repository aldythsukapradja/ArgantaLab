# setup.ps1 — turn the energy agent on. Run once.
#
#   powershell -ExecutionPolicy Bypass -File workers\arganta-energy-agent\setup.ps1
#
# Generates the shared AGENT_TOKEN, sets it on the Worker, writes the two lines
# apps/energy needs, then prompts for your groq key. Neither secret is echoed,
# and neither is left in a variable or in shell history.

$ErrorActionPreference = 'Stop'

# Resolve paths from THIS file, so it works from any directory.
$workerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent (Split-Path -Parent $workerDir)
$envFile   = Join-Path $repoRoot 'apps\energy\.env.local'
$workerUrl = 'https://arganta-energy-agent.aldhyt-sukapradja.workers.dev'

Write-Host ''
Write-Host '  ArgantaEnergy agent — setup' -ForegroundColor Cyan
Write-Host '  ---------------------------' -ForegroundColor DarkGray
Write-Host ''

# ── 0 · make sure wrangler is logged in ─────────────────────────────────────
# Piping a value into `wrangler secret put` makes wrangler treat stdin as
# non-interactive, which skips the browser login it needs on first use. Log in
# explicitly first, as its own step, with nothing piped into it.
Write-Host '  [0/3] Checking Cloudflare login...' -ForegroundColor Yellow
npx --yes wrangler@4 whoami *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '        Not logged in — opening the browser to log in...' -ForegroundColor DarkGray
  npx --yes wrangler@4 login
  if ($LASTEXITCODE -ne 0) { Write-Host '  Login failed or was cancelled.' -ForegroundColor Red; exit 1 }
}
Write-Host '        logged in.' -ForegroundColor DarkGray

# ── 1 · AGENT_TOKEN ──────────────────────────────────────────────────────────
# A random shared secret so only your app can call your Worker. Not from
# anywhere — invented here, used in two places, never shown.
#
# Written to a temp file rather than piped in: piping into `wrangler secret put`
# is what made wrangler treat the whole run as non-interactive and refuse the
# login prompt above. A file redirect (`<`) does not have that effect.
Write-Host ''
Write-Host '  [1/3] Setting AGENT_TOKEN on the Worker...' -ForegroundColor Yellow
$token = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
$tokenFile = Join-Path $env:TEMP 'arganta-agent-token.txt'
[System.IO.File]::WriteAllText($tokenFile, $token, (New-Object System.Text.UTF8Encoding($false)))
try {
  cmd /c "npx --yes wrangler@4 secret put AGENT_TOKEN --cwd `"$workerDir`" < `"$tokenFile`""
  $putResult = $LASTEXITCODE
} finally {
  Remove-Item $tokenFile -ErrorAction SilentlyContinue
}
if ($putResult -ne 0) { Write-Host '  FAILED to set AGENT_TOKEN.' -ForegroundColor Red; exit 1 }

# ── 2 · app config ───────────────────────────────────────────────────────────
# .env* is gitignored, so this never reaches the repo.
Write-Host ''
Write-Host '  [2/3] Writing apps/energy/.env.local ...' -ForegroundColor Yellow
if (Test-Path $envFile) {
  # Drop any previous agent lines so re-running is safe.
  $kept = Get-Content $envFile | Where-Object { $_ -notmatch '^VITE_ENERGY_AGENT_' }
  Set-Content -Path $envFile -Value $kept -Encoding utf8
}
Add-Content -Path $envFile -Value "VITE_ENERGY_AGENT_URL=$workerUrl" -Encoding utf8
Add-Content -Path $envFile -Value "VITE_ENERGY_AGENT_TOKEN=$token" -Encoding utf8
Remove-Variable token
Write-Host '        done.' -ForegroundColor DarkGray

# ── 3 · GROQ_API_KEY ─────────────────────────────────────────────────────────
Write-Host ''
Write-Host '  [3/3] Now paste your groq key.' -ForegroundColor Yellow
Write-Host '        Get one free at https://console.groq.com  ->  API Keys  ->  Create API Key' -ForegroundColor DarkGray
Write-Host '        It starts with gsk_ . Nothing appears as you paste — that is correct.' -ForegroundColor DarkGray
Write-Host ''
npx --yes wrangler@4 secret put GROQ_API_KEY --cwd $workerDir
if ($LASTEXITCODE -ne 0) { Write-Host '  FAILED to set GROQ_API_KEY.' -ForegroundColor Red; exit 1 }

# ── verify ───────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '  Checking the Worker...' -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
  $health = Invoke-RestMethod -Uri "$workerUrl/v1/health" -TimeoutSec 20
  $providers = ($health.providers | ForEach-Object { $_.name }) -join ', '
  Write-Host "        providers: $providers" -ForegroundColor DarkGray
  Write-Host "        auth required: $($health.authRequired)" -ForegroundColor DarkGray
  if ($providers -match 'groq' -and $health.authRequired) {
    Write-Host ''
    Write-Host '  All set. Restart the dev server and the badge will read CORE.' -ForegroundColor Green
  } else {
    Write-Host ''
    Write-Host '  Secrets are set but the Worker has not picked them up yet — wait ~30s and re-check:' -ForegroundColor Yellow
    Write-Host "    curl $workerUrl/v1/health" -ForegroundColor DarkGray
  }
} catch {
  Write-Host '  Could not reach the Worker health endpoint (it may still be propagating).' -ForegroundColor Yellow
}
Write-Host ''

# Opens arganta-command.html, passing the Bridge token from
# tools/arganta-bridge/.env in via a URL query string (?bport=&btoken=),
# properly percent-encoded - plain batch can't escape this safely. The page
# reads it once, seeds localStorage if empty, and scrubs the URL immediately.
# Never touches git: this only reads the gitignored .env and opens a browser.
param([Parameter(Mandatory=$true)][string]$Root)

$envFile = Join-Path $Root 'tools\arganta-bridge\.env'
$token = $null
$port = '7717'

if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    if ($line -match '^BRIDGE_TOKEN=(.*)$') { $token = $Matches[1].Trim() }
    elseif ($line -match '^BRIDGE_PORT=(.*)$' -and $Matches[1].Trim()) { $port = $Matches[1].Trim() }
  }
}

$htmlPath = Join-Path $Root 'arganta-command.html'
if ($token) {
  $q = "bport=$([Uri]::EscapeDataString($port))&btoken=$([Uri]::EscapeDataString($token))"
  Start-Process "file:///$($htmlPath -replace '\\','/')?$q"
} else {
  Start-Process $htmlPath
}

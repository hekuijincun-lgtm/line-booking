param(
  [string]$Repo = "$HOME/repo/line-booking",
  [string]$ApiBase = "https://saas-api.hekuijincun.workers.dev"  # ← /api なし
)
$ErrorActionPreference='Stop'
$ui = Join-Path $Repo "booking-ui"
if (-not (Test-Path $ui)) { throw "not found: $ui" }
Push-Location $ui
try{
  $dev = @"
VITE_API_BASE=$ApiBase
VITE_LOGIN_URL=$ApiBase/auth/line/login
VITE_SLOTS_PATH=/line/slots
VITE_RESERVE_PATH=/line/reserve
VITE_MY_PATH=/line/my
"@
  $dev | Set-Content ".env.development" -Encoding UTF8
  Copy-Item ".env.development" ".env.production" -Force
  try { iwr "$ApiBase" -UseBasicParsing -TimeoutSec 10 | Out-Null } catch {}
  Write-Host "✅ .env.* updated. API_BASE = $ApiBase"
} finally { Pop-Location }

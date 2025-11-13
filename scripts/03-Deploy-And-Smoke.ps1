param(
  [ValidateSet("staging","production")] [string]$Env = "staging",
  [string]$Repo = "$HOME/repo/line-booking",
  [string]$StagingBase = "https://saas-api-staging-v4.hekuijincun.workers.dev",
  [string]$ProdBase    = "https://saas-api.hekuijincun.workers.dev"
)
$ErrorActionPreference='Stop'
$api = Join-Path $Repo "api"
$Base = if ($Env -eq "staging") { $StagingBase } else { $ProdBase }

Push-Location $api
try {
  npx -y wrangler@4.46.0 deploy --env=$Env
  $today = (Get-Date).ToString('yyyy-MM-dd')

  Write-Host "🌐 Base: $Base"
  $s1 = iwr "$Base/line/slots?date=$today" -UseBasicParsing -TimeoutSec 20
  Write-Host "GET /line/slots -> $($s1.StatusCode)"

  $body = @{ slotId = "S-$today-1"; name = "Kazuki" } | ConvertTo-Json -Compress
  $s2 = iwr "$Base/line/reserve" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 20
  Write-Host "POST /line/reserve -> $($s2.StatusCode)"

  if ($s1.StatusCode -like "2*" -and $s2.StatusCode -like "2*") {
    Write-Host "✅ Smoke OK ($Env)"
  } else {
    throw "❌ Smoke failed ($Env)"
  }
} finally { Pop-Location }

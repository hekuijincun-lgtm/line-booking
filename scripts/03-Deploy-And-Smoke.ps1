param(
  [ValidateSet("staging","production")] [string]$Env = "staging",
  [string]$Repo = "$HOME/repo/line-booking",
  [string]$StagingBase = "https://saas-api-staging-v4.hekuijincun.workers.dev",
  [string]$ProdBase    = "https://saas-api-v4.hekuijincun.workers.dev",
  [string]$BaseOverride = "",
  [switch]$SkipDeploy
)
$ErrorActionPreference='Stop'
$api  = Join-Path $Repo "api"
$Base = if ($BaseOverride) { $BaseOverride } else { if ($Env -eq "staging") { $StagingBase } else { $ProdBase } }

Push-Location $api
try {
  if (-not $SkipDeploy) {
    if (-not (npm pkg get dependencies.zod | Select-String -Quiet '\^')) { npm i zod | Out-Null }
    npx -y wrangler@4.46.0 deploy --env=$Env
  }
  $today = (Get-Date).ToString('yyyy-MM-dd')

  $s1 = iwr "$Base/line/slots?date=$today" -UseBasicParsing -TimeoutSec 20
  $body = @{ slotId = "S-$today-1"; name = "Kazuki" } | ConvertTo-Json -Compress
  $s2 = iwr "$Base/line/reserve" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 20

  "🌐 Base: $Base"
  "GET /line/slots -> $($s1.StatusCode)"
  "POST /line/reserve -> $($s2.StatusCode)"
  if ($s1.StatusCode -like "2*" -and $s2.StatusCode -like "2*") { "✅ Smoke OK ($Env)" } else { throw "❌ Smoke NG ($Env)" }
}
finally { Pop-Location }

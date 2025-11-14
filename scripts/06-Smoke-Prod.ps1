param([string]$Base="https://saas-api-v4.hekuijincun.workers.dev")
$ErrorActionPreference='Stop'
$today=(Get-Date).ToString('yyyy-MM-dd')
$s1 = iwr "$Base/line/slots?date=$today" -UseBasicParsing -TimeoutSec 15
$body = @{ slotId="S-$today-1"; name="Kazuki" } | ConvertTo-Json -Compress
$s2 = iwr "$Base/line/reserve" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
"🌐 Base=$Base"
"GET /line/slots -> $($s1.StatusCode)"
"POST /line/reserve -> $($s2.StatusCode)"
if ($s1.StatusCode -like "2*" -and $s2.StatusCode -like "2*") { "✅ Smoke OK (prod)" } else { throw "❌ Smoke NG (prod)" }

param(
    [switch]$OpenBrowser  # つけるとブラウザも開く
)

Write-Host "=== Kazuki Booking UI / API Smoke ===" -ForegroundColor Cyan

# API ベース
$stgApi  = "https://saas-api-staging-v4.hekuijincun.workers.dev"
$prodApi = "https://saas-api.hekuijincun.workers.dev"

# UI ベース（Pages）
$stgUiBase  = "https://85283f05.booking-ui-4pk.pages.dev"
$prodUiBase = "https://30a0ab95.booking-ui-4pk.pages.dev"

# 1) API /line/slots チェック
$apiTargets = @(
    "$stgApi/line/slots",
    "$prodApi/line/slots"
)

Write-Host "`n--- API /line/slots ---" -ForegroundColor Yellow
foreach ($u in $apiTargets) {
    Write-Host "GET $u" -ForegroundColor Cyan
    try {
        $res = Invoke-RestMethod -Uri $u -Method GET -TimeoutSec 10
        Write-Host "✅ OK: $u" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ NG: $u" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

# 2) UI（stg/prod, esthe テンプレ込み）チェック
$stgUiEsthe  = "$($stgUiBase)?template=esthe"
$prodUiEsthe = "$($prodUiBase)?template=esthe"

$uiTargets = @(
    $stgUiBase,
    $stgUiEsthe,
    $prodUiBase,
    $prodUiEsthe
)

Write-Host "`n--- Booking UI (Pages) ---" -ForegroundColor Yellow
foreach ($u in $uiTargets) {
    Write-Host "🌐 Checking UI: $u" -ForegroundColor Cyan
    try {
        $res = Invoke-WebRequest -Uri $u -Method GET -TimeoutSec 10
        Write-Host ("✅ {0} -> {1}" -f $u, $res.StatusCode) -ForegroundColor Green
    }
    catch {
        Write-Host "❌ UI NG: $u" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

# 3) オプションでブラウザを開く（人間の目視用）
if ($OpenBrowser) {
    Write-Host "`n🔍 Opening UIs in Edge..." -ForegroundColor Yellow
    foreach ($u in @($stgUiBase, $stgUiEsthe)) {
        Start-Process "msedge.exe" $u
    }
}

Write-Host "`n=== Smoke finished ===" -ForegroundColor Cyan

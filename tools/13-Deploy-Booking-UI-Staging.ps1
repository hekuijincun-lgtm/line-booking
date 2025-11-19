param(
    [switch]$SkipBuild  # ビルド済みのときに使う
)

Write-Host "=== Deploy booking-ui to Cloudflare Pages (staging) ===" -ForegroundColor Cyan

$repoRoot = "$HOME/repo/line-booking"
$uiRoot   = Join-Path $repoRoot "booking-ui"

if (-not (Test-Path $uiRoot)) {
    Write-Host "❌ booking-ui フォルダが見つかりません: $uiRoot" -ForegroundColor Red
    exit 1
}

Set-Location $uiRoot

# 1) env は staging API に寄せておく（ビルド時に埋め込み）
$apiBase = "https://saas-api-staging-v4.hekuijincun.workers.dev"
$envProdPath = Join-Path $uiRoot ".env.production"

@"
VITE_BOOKING_API_BASE=$apiBase
"@ | Set-Content -Path $envProdPath -Encoding UTF8

Write-Host "✅ .env.production を更新: VITE_BOOKING_API_BASE=$apiBase" -ForegroundColor Green

# 2) build
if (-not $SkipBuild) {
    Write-Host "🛠  npm run build を実行します..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm run build でエラーが発生しました" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚪ build はスキップ (--SkipBuild)" -ForegroundColor Yellow
}

# 3) wrangler pages deploy で staging へ反映
$distPath = Join-Path $uiRoot "dist"
if (-not (Test-Path $distPath)) {
    Write-Host "❌ dist フォルダがありません。build が失敗している可能性があります。" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Deploy to Cloudflare Pages (project: booking-ui-4pk, branch: staging)..." -ForegroundColor Cyan

npx wrangler@4.46.0 pages deploy $distPath `
  --project-name "booking-ui-4pk" `
  --branch "staging"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ wrangler pages deploy でエラー" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deploy finished. Check:" -ForegroundColor Green
Write-Host "   https://85283f05.booking-ui-4pk.pages.dev" -ForegroundColor Green
Write-Host "   https://85283f05.booking-ui-4pk.pages.dev?template=esthe" -ForegroundColor Green

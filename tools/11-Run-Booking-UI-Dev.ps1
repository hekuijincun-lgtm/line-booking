param(
    [switch]$NoInstall,   # 依存インストールをスキップしたいとき用
    [switch]$NoBrowser    # ブラウザ自動起動を止めたいとき用
)

Write-Host "=== Run Booking UI Dev (Luxe Hair Tokyo) ===" -ForegroundColor Cyan

$repoRoot = "$HOME/repo/line-booking"
$uiRoot   = Join-Path $repoRoot "booking-ui"

if (-not (Test-Path $uiRoot)) {
    Write-Host "❌ booking-ui フォルダが見つかりません: $uiRoot" -ForegroundColor Red
    exit 1
}

Set-Location $uiRoot

# 1) .env.development を staging-v4 API に固定
$envDevPath = Join-Path $uiRoot ".env.development"
$apiBase    = "https://saas-api-staging-v4.hekuijincun.workers.dev"

@"
VITE_BOOKING_API_BASE=$apiBase
"@ | Set-Content -Path $envDevPath -Encoding UTF8

Write-Host "✅ .env.development を更新: VITE_BOOKING_API_BASE=$apiBase" -ForegroundColor Green

# 2) 依存インストール（必要なら）
if (-not $NoInstall) {
    if (-not (Test-Path (Join-Path $uiRoot "node_modules"))) {
        Write-Host "📦 npm install を実行します..." -ForegroundColor Yellow
        npm install
    }
    else {
        Write-Host "📦 node_modules は既に存在するので npm install はスキップします" -ForegroundColor DarkYellow
    }
}

# 3) dev サーバ起動
Write-Host "▶ npm run dev を起動します（停止するには Ctrl + C）" -ForegroundColor Cyan
$devUrl = "http://localhost:5173"

# Vite はポート使用済みなら 5174, 5175... にずれるので、
# 一旦デフォルトURLだけ覚えておいてブラウザオープン時に使う
$env:VITE_BOOKING_API_BASE = $apiBase

# 非同期でブラウザを開く
if (-not $NoBrowser) {
    Start-Sleep -Seconds 2
    Start-Process "msedge.exe" $devUrl
    Write-Host "🌐 Edge で $devUrl を開きました（ポートがずれた場合はコンソール表示を確認）" -ForegroundColor Green
}

# dev サーバはフォアグラウンドで動かしたいので、最後に npm run dev
npm run dev

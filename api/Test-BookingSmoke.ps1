param(
  [string]$BaseUrl = "https://saas-api-v4.hekuijincun.workers.dev",
  [string]$Source  = "booking-smoke"
)

Write-Host "🔍 Booking API smoke test..." -ForegroundColor Cyan

$today = Get-Date -Format "yyyy-MM-dd"
Write-Host "  • date = $today"

# 1) 今日のスロット取得
try {
  $slots = Invoke-RestMethod "$BaseUrl/line/slots?date=$today"
} catch {
  Write-Host "✖ /line/slots エラー:" -ForegroundColor Red
  $_ | Out-String | Write-Host
  exit 1
}

if (-not $slots.slots -or $slots.slots.Count -eq 0) {
  Write-Host "⚠ スロットが 0 件でした。予約テストはスキップします。" -ForegroundColor Yellow
  exit 0
}

$first = $slots.slots[0]
Write-Host "  • first slot:" -ForegroundColor DarkCyan
$first | ConvertTo-Json -Depth 6 | Write-Host

# 2) slotId 抽出（StrictMode 対応）
$slotId = $null

# slotId プロパティがあれば優先
$slotId = $first | Select-Object -ExpandProperty slotId -ErrorAction SilentlyContinue

# なければ id を使う
if (-not $slotId) {
  $slotId = $first | Select-Object -ExpandProperty id -ErrorAction Stop
}

Write-Host "  • slotId = $slotId" -ForegroundColor Green

# 3) 予約ボディ作成
$body = @{
  slotId = $slotId
  name   = "Smoke Test from PowerShell"
  menu   = "テストメニュー"
  note   = "API煙テスト from PowerShell"
  source = $Source
} | ConvertTo-Json -Depth 5

Write-Host "  • POST /line/reserve ..." -ForegroundColor Cyan

# 4) /line/reserve に送信
try {
  $res = Invoke-RestMethod "$BaseUrl/line/reserve" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
} catch {
  Write-Host "✖ /line/reserve エラー:" -ForegroundColor Red
  $_ | Out-String | Write-Host
  exit 1
}

Write-Host ""
Write-Host "✅ Smoke OK" -ForegroundColor Green
$res | ConvertTo-Json -Depth 6 | Write-Host

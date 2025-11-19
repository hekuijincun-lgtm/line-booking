param(
    [string]$Env = "staging"
)

$baseUrl = if ($Env -eq "production") {
    "https://saas-api.hekuijincun.workers.dev"
} else {
    "https://saas-api-staging-v4.hekuijincun.workers.dev"
}

Write-Host "=== Reserve -> LINE Notify smoke ($Env) ===" -ForegroundColor Cyan
Write-Host "BASE: $baseUrl" -ForegroundColor DarkCyan

# 1) /line/slots からスロット1件取る
$slotsUri = "$baseUrl/line/slots"
Write-Host "▶ GET $slotsUri" -ForegroundColor Yellow

$slotsRes = Invoke-RestMethod -Method Get -Uri $slotsUri

# 期待形式: { slots: [ { id, date, time, ... }, ... ] }
$firstSlot = $slotsRes.slots | Select-Object -First 1

if (-not $firstSlot) {
    Write-Host "❌ slots が空です" -ForegroundColor Red
    return
}

Write-Host "✅ Slot picked: id=$($firstSlot.id) date=$($firstSlot.date) time=$($firstSlot.time)" -ForegroundColor Green

# 2) /line/reserve で予約を作る
$reserveUri = "$baseUrl/line/reserve"
Write-Host "▶ POST $reserveUri" -ForegroundColor Yellow

$body = @{
    slotId = $firstSlot.id
    name   = "テスト予約（PowerShell）"
    menu   = "テストメニュー"
    note   = "LINE Notify smoke test"
} | ConvertTo-Json -Depth 5

$reserveRes = Invoke-RestMethod -Method Post -Uri $reserveUri -Body $body -ContentType "application/json"

# 期待形式: { ok: true, id: "..." } or { data: { id: "..." } }
$reserveId = $reserveRes.id
if (-not $reserveId -and $reserveRes.data) {
    $reserveId = $reserveRes.data.id
}

if (-not $reserveId) {
    Write-Host "❌ 予約レスポンスから reserveId を取得できませんでした" -ForegroundColor Red
    $reserveRes | Format-List | Out-String | Write-Host
    return
}

Write-Host "✅ Reserved: id=$reserveId" -ForegroundColor Green

# 3) /line/notify を叩いて LINE 通知を投げる
$notifyScript = Join-Path $PSScriptRoot "20-Test-LineNotify.ps1"
if (-not (Test-Path $notifyScript)) {
    Write-Host "❌ 20-Test-LineNotify.ps1 が見つかりません: $notifyScript" -ForegroundColor Red
    return
}

Write-Host "▶ Call 20-Test-LineNotify.ps1 -ReserveId $reserveId -Env $Env" -ForegroundColor Cyan
& $notifyScript -ReserveId $reserveId -Env $Env

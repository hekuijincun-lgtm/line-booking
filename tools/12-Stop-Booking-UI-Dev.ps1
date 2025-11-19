Write-Host "=== Stop Booking UI Dev (Vite / node) ===" -ForegroundColor Cyan

# Vite dev サーバを全部停止
$procs = Get-Process node -ErrorAction SilentlyContinue

if (-not $procs) {
    Write-Host "ℹ️ 実行中の node プロセスはありませんでした" -ForegroundColor Yellow
    return
}

$procs | Stop-Process -Force

Write-Host ("✅ 停止した node プロセス数: {0}" -f $procs.Count) -ForegroundColor Green

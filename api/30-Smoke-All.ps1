param(
    [string]$UiBaseUrl = "https://b520b87f.booking-ui-4pk.pages.dev"
)

$ErrorActionPreference = 'Stop'

Write-Host "=== Smoke All (API + UI) ===" -ForegroundColor Cyan
Write-Host " UiBaseUrl : $UiBaseUrl`n"

# 1) API側のスモーク（stg + prod）
Write-Host ">> Booking API Smoke (stg + prod)..." -ForegroundColor Yellow
pwsh ./Invoke-BookingSmokeAll.ps1
if ($LASTEXITCODE -ne 0) {
    throw "Invoke-BookingSmokeAll failed with exit code $LASTEXITCODE"
}

# 2) UI側のスモーク
Write-Host "`n>> Booking UI Smoke..." -ForegroundColor Yellow
pwsh ./Test-BookingUi.ps1 -BaseUrl $UiBaseUrl
if ($LASTEXITCODE -ne 0) {
    throw "Test-BookingUi failed with exit code $LASTEXITCODE"
}

Write-Host "`n✅ Smoke All (API + UI) completed." -ForegroundColor Green

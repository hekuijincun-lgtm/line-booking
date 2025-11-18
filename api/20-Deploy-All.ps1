param(
    [switch]$AllowDirty,
    [switch]$SkipWorkers,
    [switch]$SkipUI,
    [string]$UiBaseUrl = "https://b520b87f.booking-ui-4pk.pages.dev"
)

$ErrorActionPreference = 'Stop'

Write-Host "=== Deploy All (Workers + Booking UI) ===" -ForegroundColor Cyan
Write-Host " AllowDirty : $AllowDirty"
Write-Host " SkipWorkers: $SkipWorkers"
Write-Host " SkipUI     : $SkipUI"
Write-Host " UiBaseUrl  : $UiBaseUrl`n"

if (-not $SkipWorkers) {
    Write-Host ">> Deploying Workers + Smoke..." -ForegroundColor Yellow
    $workersArgs = @()
    if ($AllowDirty) { $workersArgs += '-AllowDirty' }

    pwsh ./Deploy-WorkersV4-And-Smoke.fixall-v4.3.ps1 @workersArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy-WorkersV4-And-Smoke failed with exit code $LASTEXITCODE"
    }
}

if (-not $SkipUI) {
    Write-Host "`n>> Deploying Booking UI (Pages)..." -ForegroundColor Yellow
    pwsh ./10-Deploy-Booking-UI.ps1
    if ($LASTEXITCODE -ne 0) {
        throw "10-Deploy-Booking-UI failed with exit code $LASTEXITCODE"
    }

    Write-Host "`n>> Booking UI Smoke Test..." -ForegroundColor Yellow
    pwsh ./Test-BookingUi.ps1 -BaseUrl $UiBaseUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Test-BookingUi failed with exit code $LASTEXITCODE"
    }
}

Write-Host "`n✅ Deploy All + UI Smoke completed." -ForegroundColor Green

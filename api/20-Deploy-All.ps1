param(
    [switch]$AllowDirty,
    [switch]$SkipWorkers,
    [switch]$SkipUI
)

$ErrorActionPreference = 'Stop'

Write-Host "=== Deploy All (Workers + Booking UI) ===" -ForegroundColor Cyan
Write-Host " AllowDirty : $AllowDirty"
Write-Host " SkipWorkers: $SkipWorkers"
Write-Host " SkipUI     : $SkipUI`n"

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
}

Write-Host "`n✅ Deploy All completed." -ForegroundColor Green

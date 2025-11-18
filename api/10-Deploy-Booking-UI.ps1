param(
    [string]$ProjectName = 'booking-ui',
    [string]$ProjectDir,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not $ProjectDir) {
    # このスクリプトが置いてある api フォルダから ../booking-ui を指す
    $ProjectDir = Join-Path $PSScriptRoot '..\booking-ui'
}

Write-Host "=== Deploy Booking UI (Cloudflare Pages) ===" -ForegroundColor Cyan
Write-Host " Project : $ProjectName"
Write-Host " Dir     : $ProjectDir"
Write-Host " DryRun  : $DryRun`n"

if (-not (Test-Path $ProjectDir)) {
    throw "ProjectDir not found: $ProjectDir"
}

Push-Location $ProjectDir
try {
    if ($DryRun) {
        Write-Host "[DryRun] npm run build"
        Write-Host "[DryRun] npx wrangler pages deploy dist --project-name=$ProjectName"
        return
    }

    Write-Host ">> npm run build" -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
    }

    Write-Host ">> npx wrangler pages deploy dist --project-name=$ProjectName" -ForegroundColor Yellow
    npx wrangler pages deploy dist --project-name=$ProjectName
    if ($LASTEXITCODE -ne 0) {
        throw "wrangler pages deploy failed with exit code $LASTEXITCODE"
    }

    Write-Host "`n✅ Booking UI deploy completed." -ForegroundColor Green
}
finally {
    Pop-Location
}

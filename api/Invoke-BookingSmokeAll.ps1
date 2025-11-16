param(
  [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

function Write-Title($text) {
  if ($Quiet) { return }
  Write-Host ""
  Write-Host "=== $text ===" -ForegroundColor Cyan
}

# 1) staging
Write-Title "Booking smoke (staging)"
.\Test-BookingSmoke.ps1 `
  -BaseUrl "https://saas-api-staging-v4.hekuijincun.workers.dev" `
  -Source  "booking-smoke-stg"

# 2) production
Write-Title "Booking smoke (production)"
.\Test-BookingSmoke.ps1 `
  -BaseUrl "https://saas-api-v4.hekuijincun.workers.dev" `
  -Source  "booking-smoke-prod"

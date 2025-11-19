[CmdletBinding()]
param(
    [string]$RepoRoot = "$HOME/repo/line-booking"
)

$ErrorActionPreference = "Stop"

$workflowsDir = Join-Path $RepoRoot ".github/workflows"
if (-not (Test-Path $workflowsDir)) {
    Write-Host "📁 Create workflows dir: $workflowsDir"
    New-Item -ItemType Directory -Path $workflowsDir -Force | Out-Null
}

$wfPath = Join-Path $workflowsDir "booking-template-smoke.yml"

$yml = @"
name: Booking Template Smoke

on:
  push:
    branches: [ "master" ]
  workflow_dispatch:

jobs:
  template-smoke:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PowerShell
        uses: PowerShell/PowerShell@v1
        with:
          pwsh-version: "7.4.x"

      - name: Template smoke (staging)
        shell: pwsh
        run: |
          cd `$Env:GITHUB_WORKSPACE
          ./tools/04-Test-BookingTemplates.ps1 -BaseUrl "https://85283f05.booking-ui-4pk.pages.dev"
"@

Write-Host "📝 Writing workflow: $wfPath"
$yml | Set-Content -Path $wfPath -Encoding UTF8

Write-Host "✅ booking-template-smoke.yml を作成しました"
Write-Host "   - push master & 手動実行でテンプレスモークが走ります"

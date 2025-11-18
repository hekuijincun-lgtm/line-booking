param(
  [switch]$DryRun,
  [switch]$SkipSmoke,
  [switch]$AllowDirty
)
if (-not (Get-Command Assert-GitClean -ErrorAction SilentlyContinue)) {
  function Assert-GitClean {
    param(
      [Parameter(Mandatory)][string]$RepoDir,
      [switch]$AllowDirty
    )

    try {
      Push-Location $RepoDir
      $por = (& git status --porcelain 2>$null) | Out-String
    }
    finally {
      Pop-Location
    }

    if (-not $AllowDirty -and -not [string]::IsNullOrWhiteSpace($por)) {
      throw "Git working tree is dirty. Commit or stash changes, or pass -AllowDirty."
    }
  }
}


Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# スクリプト自身の場所を $here にして相対パスを安定化
$here = Split-Path -Parent $PSCommandPath
Set-Location $here
Write-Host "🚀 Deploy script executing in $here" -ForegroundColor Cyan

Import-Module "C:\Users\mesom\repo\line-booking\modules\BookingSafeOps\BookingSafeOps.psm1" -Force

# ---------- 安全チェック ----------
if (-not $AllowDirty) {
  Assert-GitClean -RepoDir $here
} else {
  Write-Host "⚠ Git Clean チェックをスキップ (-AllowDirty)" -ForegroundColor Yellow
}

Assert-SecretsPresent -Names @(
  "LINE_CHANNEL_SECRET__staging",
  "LINE_CHANNEL_ACCESS_TOKEN__staging",
  "LINE_CHANNEL_SECRET__production",
  "LINE_CHANNEL_ACCESS_TOKEN__production"
)

# ---------- deploy logic ----------
if ($DryRun) {
  Write-Host "🔍 DryRun モード: デプロイは実行されません (検証のみ)" -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "▶ Deploy (staging)..." -ForegroundColor Cyan
  npx wrangler deploy --env=staging

  Write-Host ""
  Write-Host "▶ Deploy (production)..." -ForegroundColor Cyan
  npx wrangler deploy --env=production
}

# ---------- デプロイ後の Smoke ----------
if (-not $SkipSmoke) {
  Write-Host ""
  Write-Host "▶ BookingSmoke (stg + prod)..." -ForegroundColor Cyan
  & "$here\Invoke-BookingSmokeAll.ps1" -Quiet
  Write-Host "✅ BookingSmokeAll 完了" -ForegroundColor Green
} else {
  Write-Host "⏭ Smoke テストは Skip されました (-SkipSmoke 指定)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Deploy スクリプト完了" -ForegroundColor Green





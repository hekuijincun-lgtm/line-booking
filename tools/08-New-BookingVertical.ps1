param(
  [Parameter(Mandatory)]
  [ValidatePattern("^[a-z0-9-]+$")]
  [string]$Id,                      # 例: "hair-salon", "nail"

  [Parameter(Mandatory)]
  [string]$Title,                   # UI のタイトル

  [Parameter(Mandatory)]
  [string]$Subtitle,                # サブタイトル

  [ValidateSet("staging","production")]
  [string]$Env = "staging",

  [switch]$AllowDirty               # Git 汚れてても実行したいとき
)

Write-Host "=== New Booking Vertical ==="
Write-Host "Id       : $Id"
Write-Host "Title    : $Title"
Write-Host "Subtitle : $Subtitle"
Write-Host "Env      : $Env"
Write-Host "================================`n"

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"

if (-not (Test-Path $UiDir)) {
  throw "UI ディレクトリが見つかりません: $UiDir"
}

# 既存チェック
$dslPath = Join-Path $UiDir ("booking-ui-{0}.json" -f $Id)
if (Test-Path $dslPath) {
  throw "booking-ui-$Id.json は既に存在します。別の Id を指定してね。"
}

# 1) DSL テンプレ生成
& (Join-Path $RepoDir "tools/07-Add-BookingTemplate.ps1") `
  -NewId $Id `
  -NewTitle $Title `
  -NewSubtitle $Subtitle

if (-not (Test-Path $dslPath)) {
  throw "DSL の生成に失敗しました: $dslPath"
}

Write-Host "✅ DSL created: $dslPath`n"

# 2) main.js 再生成（multi-template 対応）
& (Join-Path $RepoDir "tools/07-Generate-BookingUiMain-MultiTemplate.ps1") -Env $Env

Write-Host "✅ main.js regenerated (multi-template)`n"

# 3) Pages デプロイ + Smoke
& (Join-Path $RepoDir "tools/01-NextStep-BookingUI.ps1") -Env $Env -AllowDirty:$AllowDirty

# 4) URL 表示 -------------------------------------------------------------

$baseProd = "https://kazukigroup.org/booking"
$baseStg  = $null

$urlsScriptPath = Join-Path $RepoDir "tools/05-Show-BookingUiUrls.ps1"

if (Test-Path $urlsScriptPath) {
  # 05 のソースコードから staging URL をパースする
  $content = Get-Content $urlsScriptPath -Raw
  $m = [regex]::Match($content, '"staging"\s*=\s*"([^"]+)"')
  if ($m.Success) {
    $baseStg = $m.Groups[1].Value
  }
}

$baseUrl = if ($Env -eq "production") {
  $baseProd
} else {
  if ($baseStg) { $baseStg }
  else { "<staging URL は 05-Show-BookingUiUrls.ps1 で確認してね>" }
}

Write-Host ""
Write-Host "🎯 New template URL:"
Write-Host ("    {0}?template={1}" -f $baseUrl, $Id)
Write-Host "================================`n"

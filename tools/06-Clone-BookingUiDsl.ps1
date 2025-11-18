param(
  [Parameter(Mandatory)][string]$Source,        # 例: "booking-ui.json"
  [Parameter(Mandatory)][string]$NewId,         # 例: "hair-salon"
  [Parameter(Mandatory)][string]$NewTitle,      # 例: "Kazuki Hair Booking"
  [Parameter(Mandatory)][string]$NewSubtitle    # 例: "カット・カラー・トリートメントのご予約"
)

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"

if (-not (Test-Path $UiDir)) {
  throw "UIディレクトリが見つかりません: $UiDir"
}

$srcPath = Join-Path $UiDir $Source
if (-not (Test-Path $srcPath)) {
  throw "Source DSL が見つかりません: $srcPath"
}

Write-Host "RepoDir : $RepoDir"
Write-Host "UiDir   : $UiDir"
Write-Host "Source  : $srcPath"
Write-Host "NewId   : $NewId"
Write-Host "NewTitle: $NewTitle"
Write-Host "NewSub  : $NewSubtitle"
Write-Host ""

# 元DSLを読み込み
$json = Get-Content $srcPath -Raw | ConvertFrom-Json

# page 情報を差し替え
if (-not $json.page) {
  throw "DSL 内に page セクションがありません。"
}

$json.page.id       = $NewId
$json.page.title    = $NewTitle
$json.page.subtitle = $NewSubtitle

# 出力ファイル名: booking-ui-<NewId>.json
$baseName = "booking-ui-$NewId.json"
$dstPath  = Join-Path $UiDir $baseName

# JSON へ戻して保存
$json | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $dstPath

Write-Host "✅ DSL をクローンしました: $dstPath"
Write-Host ""

param(
  [string]$Base = "booking-ui.json",  # ← Mandatory 外した
  [Parameter(Mandatory)][string]$NewId,
  [Parameter(Mandatory)][string]$NewTitle,
  [Parameter(Mandatory)][string]$NewSubtitle
)

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"

$basePath = Join-Path $UiDir $Base

if (-not (Test-Path $basePath)) {
  throw "Base DSL が見つかりません: $basePath"
}

$json = Get-Content $basePath -Raw | ConvertFrom-Json

$json.page.id       = $NewId
$json.page.title    = $NewTitle
$json.page.subtitle = $NewSubtitle

$outFile = Join-Path $UiDir ("booking-ui-$NewId.json")
$json | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $outFile

Write-Host "✨ New Template DSL Created: $outFile"

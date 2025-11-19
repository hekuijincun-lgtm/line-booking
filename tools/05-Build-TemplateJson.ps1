[CmdletBinding()]
param(
    [string]$RepoRoot = "$HOME/repo/line-booking"
)

$ErrorActionPreference = "Stop"

# YAMLモジュールの確認＆ロード
if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    Write-Host "📦 Installing module: powershell-yaml (CurrentUser scope)"
    Install-Module -Name powershell-yaml -Scope CurrentUser -Force -ErrorAction Stop
}
Import-Module powershell-yaml -ErrorAction Stop

$uiRoot      = Join-Path $RepoRoot "booking-ui"
$tplDir      = Join-Path $uiRoot "templates"
$publicDir   = Join-Path $uiRoot "public"
$jsonOutDir  = Join-Path $publicDir "templates"

if (-not (Test-Path $tplDir)) {
    throw "テンプレディレクトリが見つからない: $tplDir"
}

if (-not (Test-Path $jsonOutDir)) {
    Write-Host "📁 Create json output dir: $jsonOutDir"
    New-Item -ItemType Directory -Path $jsonOutDir -Force | Out-Null
}

$files = Get-ChildItem $tplDir -Filter "*.yaml" -File
if (-not $files) {
    Write-Host "⚠️ YAML テンプレが見つからない: $tplDir"
    return
}

foreach ($f in $files) {
    Write-Host "🔄 Converting $($f.Name)..."

    $yamlText = Get-Content $f.FullName -Raw
    $obj      = $yamlText | ConvertFrom-Yaml

    # slug がなければファイル名から推測
    $slug = $obj.slug
    if (-not $slug -or $slug.Trim() -eq "") {
        $slug = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
        $obj.slug = $slug
    }

    $outPath = Join-Path $jsonOutDir "$slug.json"
    $obj | ConvertTo-Json -Depth 10 | Set-Content -Path $outPath -Encoding UTF8

    Write-Host "✅ $($f.Name) -> templates/$slug.json"
}

Write-Host ""
Write-Host "🎉 全テンプレ JSON 変換完了"
Write-Host "   出力先: $jsonOutDir"

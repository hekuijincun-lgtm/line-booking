[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BaseUrl,   # 例: "https://85283f05.booking-ui-4pk.pages.dev"

    [string]$RepoRoot = "$HOME/repo/line-booking"
)

$ErrorActionPreference = "Stop"

$uiRoot    = Join-Path $RepoRoot "booking-ui"
$tplDir    = Join-Path $uiRoot "templates"
$indexPath = Join-Path $tplDir "index.json"

if (-not (Test-Path $indexPath)) {
    throw "テンプレ一覧 index.json が見つからない: $indexPath"
}

$index = Get-Content $indexPath -Raw | ConvertFrom-Json

if (-not $index -or $index.Count -eq 0) {
    throw "テンプレが1件も登録されていない: $indexPath"
}

$failed = @()

foreach ($tpl in $index) {
    $slug = $tpl.slug
    if (-not $slug -or $slug.Trim() -eq "") {
        continue
    }

    $url  = "$BaseUrl/?template=$slug"

    Write-Host "🔎 Testing template '$slug' => $url"

    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
        if ($res.StatusCode -ne 200) {
            Write-Warning "❌ $slug -> HTTP $($res.StatusCode)"
            $failed += $slug
            continue
        }

        if ($res.Content -notmatch $slug) {
            Write-Warning "⚠️ $slug -> HTML 内に slug らしき文字列が見つからないかも"
        } else {
            Write-Host "✅ $slug OK"
        }
    }
    catch {
        Write-Warning "❌ $slug -> $($_.Exception.Message)"
        $failed += $slug
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ 失敗したテンプレ:"
    $failed | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host ""
Write-Host "🎉 全テンプレ スモークテスト成功"
exit 0

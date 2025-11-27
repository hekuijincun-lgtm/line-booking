param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string[]]$templates = @(
    "hair-owner-lp-soft",
    "lash-owner-lp-soft",
    "brow-owner-lp-soft"
)
)

$ErrorActionPreference = "Stop"

# BaseUrl の末尾スラッシュを整える
if ($BaseUrl.EndsWith("/")) {
    $BaseUrl = $BaseUrl.TrimEnd("/")
}

Write-Host "🌐 LPスモークテスト開始: BaseUrl = $BaseUrl" -ForegroundColor Cyan

$failed = @()

foreach ($tpl in $Templates) {
    $url = "$BaseUrl/?template=$tpl"
    Write-Host "🔎 チェック中: $url"

    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20

        if ($res.StatusCode -ne 200) {
            Write-Host "⚠️  $tpl のステータスコードが 200 以外: $($res.StatusCode)" -ForegroundColor Yellow
            $failed += $tpl
            continue
        }

        # ざっくりHTML長さチェック（完全に空じゃなければOKとする）
     if ([string]::IsNullOrWhiteSpace($res.Content) -or $res.Content.Length -lt 200) {

            Write-Host "⚠️  $tpl のコンテンツが怪しい（長さ: $($res.Content.Length)）" -ForegroundColor Yellow
            $failed += $tpl
            continue
        }

        Write-Host "✅  $tpl OK (HTTP 200 & content length = $($res.Content.Length))" -ForegroundColor Green
    }
    catch {
        Write-Host "❌  $tpl の取得に失敗: $($_.Exception.Message)" -ForegroundColor Red
        $failed += $tpl
    }
}

if ($failed.Count -gt 0) {
    $list = $failed -join ", "
    throw "LPスモークテスト失敗: $list"
}

Write-Host "🎉 全LPテンプレートのスモークテスト成功！" -ForegroundColor Green

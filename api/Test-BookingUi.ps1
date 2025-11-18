param(
    [string]$BaseUrl = "https://b520b87f.booking-ui-4pk.pages.dev"
)

$ErrorActionPreference = 'Stop'

# 念のため末尾の / を削る（https://xxx/ → https://xxx）
$BaseUrl = $BaseUrl.TrimEnd('/')

$templates = @('esthe','hair','lash','demo-check')

Write-Host "=== Booking UI Smoke Test ===" -ForegroundColor Cyan
Write-Host " BaseUrl   : $BaseUrl"
Write-Host " Templates : $($templates -join ', ')"
Write-Host ""

foreach ($t in $templates) {
    # 文字列フォーマットで厳密に組み立てる
    $url = '{0}?template={1}' -f $BaseUrl, $t

    Write-Host ">> GET $url" -ForegroundColor Yellow

    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        if ($res.StatusCode -eq 200) {
            Write-Host "   ✅ $t OK (StatusCode: $($res.StatusCode))" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠ $t Unexpected status: $($res.StatusCode)" -ForegroundColor DarkYellow
        }
    }
    catch {
        Write-Host "   ❌ $t ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "UI Smoke Test finished." -ForegroundColor Cyan

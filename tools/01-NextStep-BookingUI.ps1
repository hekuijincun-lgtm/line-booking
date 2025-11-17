param(
  [ValidateSet("staging", "production")]
  [string]$Env = "staging",

  [switch]$DryRun,
  [switch]$AllowDirty
)

<#
  01-NextStep-BookingUI.ps1
  目的:
    - line-booking リポの予約UIを編集 → Pagesデプロイ → スモークテストまで
    - 「次の一手」を 1 本の PowerShell フローにまとめる
#>

# --- 0) 共通パス & API_BASE 設定 -------------------------------------------------

$RepoDir = Join-Path $HOME "repo" | Join-Path -ChildPath "line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"

$ApiBaseMap = @{
  "staging"    = "https://saas-api-staging-v4.hekuijincun.workers.dev"
  "production" = "https://saas-api-v4.hekuijincun.workers.dev"
}

$API_BASE = $ApiBaseMap[$Env]

Write-Host "RepoDir : $RepoDir"
Write-Host "UiDir   : $UiDir"
Write-Host "Env     : $Env"
Write-Host "API_BASE: $API_BASE"
Write-Host ""

# --- 1) Gitクリーンチェック -------------------------------------------------------

Set-Location $RepoDir

if (-not (Get-Command Assert-GitClean -ErrorAction SilentlyContinue)) {
  function Assert-GitClean {
    param(
      [Parameter(Mandatory)][string]$RepoDir,
      [switch]$AllowDirty
    )
    try {
      Push-Location $RepoDir
      $por = (& git status --porcelain 2>$null) | Out-String
    } finally {
      Pop-Location
    }
    if (-not $AllowDirty -and -not [string]::IsNullOrWhiteSpace($por)) {
      throw "Git working tree is dirty. Commit or stash changes, or pass -AllowDirty."
    }
  }
}

Assert-GitClean -RepoDir $RepoDir -AllowDirty:$AllowDirty
Write-Host "✅ Git clean check OK."
Write-Host ""

# --- 2) UI 作業ディレクトリ準備 ---------------------------------------------------

if (-not (Test-Path $UiDir)) {
  Write-Host "UIディレクトリが無いので作成: $UiDir"
  New-Item -ItemType Directory -Path $UiDir | Out-Null
}

Set-Location $UiDir
Write-Host "📂 Now at UI dir: $UiDir"
Write-Host ""

# --- 3) 予約UI 雛形生成（index/style/main） ---------------------------------------

if (-not (Test-Path "index.html")) {
  @'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>Kazuki Booking - 予約</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <div id="app">
    <!-- ここにカレンダー＋空き枠＋予約フォーム＋LINEログインを描画 -->
  </div>
  <script>
    window.API_BASE = "__API_BASE_PLACEHOLDER__";
  </script>
  <script src="./main.js"></script>
</body>
</html>
'@ | Set-Content -Encoding UTF8 -Path "index.html"

  Write-Host "🆕 index.html をテンプレから作成しました。"
}

if (-not (Test-Path "style.css")) {
  @'
/* Kazuki Booking 共通テーマ: 白 × 深青 × 金 */
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f5f7fb;
  color: #101624;
}

#app {
  max-width: 420px;
  margin: 32px auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 18px 45px rgba(10, 20, 40, 0.16);
}
'@ | Set-Content -Encoding UTF8 -Path "style.css"

  Write-Host "🆕 style.css をテンプレから作成しました。"
}

if (-not (Test-Path "main.js")) {
  @'
// TODO: /line/slots & /line/reserve を叩くロジックをここに実装
console.log("Kazuki Booking UI booting...");
console.log("API_BASE =", window.API_BASE);
'@ | Set-Content -Encoding UTF8 -Path "main.js"

  Write-Host "🆕 main.js をテンプレから作成しました。"
}

Write-Host ""
Write-Host "🧩 VSCode / エディタで UI を作り込んでください。"
Write-Host ""

# --- 4) API_BASE を index.html に差し込む -----------------------------------------

(Get-Content "index.html" -Raw).
  Replace("__API_BASE_PLACEHOLDER__", $API_BASE) |
  Set-Content -Encoding UTF8 -Path "index.html"

Write-Host "🔗 index.html 内の API_BASE を置換しました: $API_BASE"
Write-Host ""

if ($DryRun) {
  Write-Warning "DryRun 指定のため、ここで終了します。（デプロイとスモークは実行しない）"
  return
}

# --- 5) Cloudflare Pages へデプロイ ----------------------------------------------

Set-Location $RepoDir

Write-Host "🚀 Cloudflare Pages へデプロイ開始..."

$npx = "npx"
& $npx wrangler pages deploy "booking-ui-static" --project-name "booking-ui"
if ($LASTEXITCODE -ne 0) {
  throw "wrangler pages deploy が失敗しました。ログを確認してね。"
}

Write-Host "✅ Pages デプロイ完了。"
Write-Host ""

# --- 6) 簡易スモークテスト -------------------------------------------------------

$UiUrlMap = @{
  # staging: 最新デプロイURL（毎回変わるならここを更新）
  "staging"    = "https://0a3ced21.booking-ui-4pk.pages.dev"
  "production" = "https://kazukigroup.org/booking"
}

$UiUrl = $UiUrlMap[$Env]

Write-Host "🩺 Smoke test: $UiUrl"

try {
  $res = Invoke-WebRequest -Uri $UiUrl -UseBasicParsing -TimeoutSec 15
  if ($res.StatusCode -eq 200) {
    Write-Host "✅ Smoke OK: $($res.StatusCode)"
  } else {
    Write-Warning "⚠ ステータスコード: $($res.StatusCode)"
  }
} catch {
  Write-Warning "❌ Smoke 失敗: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "🎉 『予約UIを作ってデプロイして確認する』一連の流れが PowerShell 1本で回った！"


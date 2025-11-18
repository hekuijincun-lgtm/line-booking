param(
  [ValidateSet("staging", "production")]
  [string]$Env = "staging"
)

# --- 0) パス設定 -------------------------------------------------------------

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"
$CssPath = Join-Path $UiDir "style.css"

Write-Host "RepoDir : $RepoDir"
Write-Host "UiDir   : $UiDir"
Write-Host "CssPath : $CssPath"
Write-Host "Env     : $Env"
Write-Host ""

if (-not (Test-Path $UiDir)) {
  throw "UIディレクトリが見つかりません: $UiDir"
}

Set-Location $UiDir
Write-Host "📂 Now at UI dir: $UiDir"
Write-Host ""

# --- 1) Kazuki Booking テーマCSS -------------------------------------------

$css = @"
:root {
  --kb-bg: #f5f7fb;
  --kb-bg-card: #ffffff;
  --kb-text-main: #101624;
  --kb-text-muted: #707b96;
  --kb-primary: #16325c;      /* 深めのネイビー */
  --kb-primary-soft: #e1e7f5;
  --kb-accent: #d5aa3b;       /* ゴールド */
  --kb-danger: #d64545;
  --kb-radius-lg: 18px;
  --kb-shadow-soft: 0 18px 45px rgba(10, 20, 40, 0.16);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif;
  background: radial-gradient(circle at top, #f8fafc 0, #edf2ff 42%, #e2e8f0 100%);
  color: var(--kb-text-main);
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
}

/* コンテナ */

.kb-container {
  width: 100%;
  max-width: 420px;
  background: var(--kb-bg-card);
  border-radius: var(--kb-radius-lg);
  box-shadow: var(--kb-shadow-soft);
  padding: 20px 18px 22px;
  position: relative;
  overflow: hidden;
}

/* ヘッダー */

.kb-header {
  position: relative;
  padding: 10px 8px 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(22, 50, 92, 0.08);
}

.kb-header::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(22, 50, 92, 0.16), transparent 46%);
  opacity: 0.9;
  mix-blend-mode: multiply;
  pointer-events: none;
  border-radius: 0 0 60% 0;
}

.kb-title {
  position: relative;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--kb-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.kb-title::before {
  content: "";
  width: 5px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--kb-accent), #f3d27e);
}

.kb-subtitle {
  position: relative;
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--kb-text-muted);
}

/* セクション共通 */

.kb-section {
  padding: 10px 8px 6px;
}

.kb-section-title {
  margin: 0 0 8px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--kb-primary);
}

/* フォーム */

.kb-section-form {
  padding-top: 4px;
  padding-bottom: 0;
}

.kb-field {
  margin-bottom: 8px;
}

.kb-label {
  display: block;
  font-size: 0.74rem;
  color: var(--kb-text-muted);
  margin-bottom: 3px;
}

.kb-input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(22, 50, 92, 0.14);
  padding: 8px 10px;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s;
  background-color: #f9fafb;
}

.kb-input:focus {
  border-color: var(--kb-primary);
  box-shadow: 0 0 0 1px rgba(22, 50, 92, 0.06);
  background-color: #ffffff;
}

/* スロット */

.kb-section-slots {
  padding-top: 8px;
}

.kb-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.kb-slot-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.kb-slot {
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 0.8rem;
  border: none;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.12s ease, background-color 0.12s ease, color 0.12s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.kb-slot-available {
  background: #ffffff;
  color: var(--kb-primary);
  box-shadow: 0 0 0 1px rgba(22, 50, 92, 0.12);
}

.kb-slot-available:hover {
  background: var(--kb-primary-soft);
  transform: translateY(-1px);
  box-shadow: 0 4px 18px rgba(10, 20, 40, 0.12);
}

.kb-slot-full {
  background: #edf2f7;
  color: var(--kb-text-muted);
  cursor: default;
  box-shadow: none;
}

/* 再読み込みボタン */

.kb-reload-btn {
  border-radius: 999px;
  border: none;
  font-size: 0.72rem;
  padding: 5px 10px;
  cursor: pointer;
  background: rgba(22, 50, 92, 0.06);
  color: var(--kb-primary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.15s ease, transform 0.08s ease;
}

.kb-reload-btn:hover {
  background: rgba(22, 50, 92, 0.12);
  transform: translateY(-0.5px);
}

/* テキスト系 */

.kb-text-muted {
  font-size: 0.78rem;
  color: var(--kb-text-muted);
}

/* ステータス */

.kb-section-status {
  padding-top: 4px;
}

.kb-status {
  font-size: 0.78rem;
  border-radius: 10px;
  padding: 7px 9px;
  margin-bottom: 6px;
}

.kb-status-success {
  background: #e6f4ea;
  color: #166534;
}

.kb-status-error {
  background: #fef2f2;
  color: var(--kb-danger);
}

/* フッター */

.kb-footer {
  border-top: 1px dashed rgba(22, 50, 92, 0.1);
  margin-top: 4px;
  padding: 7px 6px 2px;
}

.kb-footer-text {
  margin: 0;
  font-size: 0.7rem;
  color: var(--kb-text-muted);
  text-align: right;
}

/* エラー時のルート */

.kb-error-root {
  padding: 20px 14px;
  font-size: 0.8rem;
  background: #fef2f2;
  color: var(--kb-danger);
  border-radius: var(--kb-radius-lg);
}

/* スマホ微調整 */

@media (max-width: 480px) {
  #app {
    padding: 20px 8px;
  }

  .kb-container {
    padding: 16px 14px 18px;
    border-radius: 16px;
  }

  .kb-slot-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }

  .kb-slot {
    font-size: 0.76rem;
    padding: 6px 8px;
  }
}
"@

# --- 2) style.css に書き出し ------------------------------------------------

$css | Set-Content -Encoding UTF8 -Path $CssPath

Write-Host "✅ style.css を Kazuki Booking テーマで生成しました: $CssPath"
Write-Host ""

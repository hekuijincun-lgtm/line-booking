param([string]$Repo = "$HOME/repo/line-booking")
$ErrorActionPreference='Stop'
$api = Join-Path $Repo "api"; $src = Join-Path $api "src"
$idx = Join-Path $src "index.ts"; $rest= Join-Path $src "booking-ui-rest.ts"
if (-not (Test-Path $idx)) { throw "not found: $idx" }

# バックアップ
$bak = "$idx.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"; Copy-Item $idx $bak -Force

# tryHandle の重複除去→import 先頭追加
$raw = Get-Content $idx -Raw -Encoding UTF8
$raw = $raw -replace 'import\s*\{\s*tryHandleBookingUiREST\s*\}\s*from\s*"\./booking-ui-rest"\s*;\s*',''
$raw = $raw -replace 'const\s+maybe\s*=\s*await\s*tryHandleBookingUiREST\([\s\S]*?\);\s*if\s*\(maybe\)\s*return\s*maybe;\s*',''
$raw = "import { tryHandleBookingUiREST } from ""./booking-ui-rest"";`r`n$raw"

# export default app; → wrap、他パターンは fetch先頭に注入
if ($raw -match '(?m)^export\s+default\s+app\s*;\s*$') {
  $replacement = @'
const __orig = app;
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const maybe = await tryHandleBookingUiREST(request as Request, env as any);
    if (maybe) return maybe;
    return __orig.fetch(request, env, ctx);
  }
};

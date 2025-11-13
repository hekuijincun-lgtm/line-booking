param([string]$Repo = "$HOME/repo/line-booking")
$ErrorActionPreference='Stop'

$api = Join-Path $Repo "api"
$src = Join-Path $api "src"
$idx = Join-Path $src "index.ts"
$rest= Join-Path $src "booking-ui-rest.ts"

if (!(Test-Path $idx)) { throw "not found: $idx" }

# 1) booking-ui-rest.ts が無ければ作成
if (!(Test-Path $rest)) {
@"
import { z } from "zod";

export interface Env { LINE_BOOKING: KVNamespace; }

const qDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function json(body: any, status = 200, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*", ...extraHeaders }
  });
}

export async function tryHandleBookingUiREST(request: Request, env: Env): Promise<Response | undefined> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/line/slots") {
    const date = url.searchParams.get("date") ?? "";
    if (!qDate.safeParse(date).success) return json({ error: "bad date" }, 400);

    let slots: any[] | null = null;
    try {
      const raw = await env.LINE_BOOKING.get(\`slots:\${date}\`, "json");
      if (raw && Array.isArray(raw)) slots = raw as any[];
    } catch {}

    if (!slots) {
      const base = new Date(\`\${date}T00:00:00+09:00\`).getTime();
      const mk = (h: number) => new Date(base + h * 3600_000).toISOString();
      slots = [
        { id: \`S-\${date}-1\`, start: mk(10), end: mk(11), capacity: 1, remaining: 1 },
        { id: \`S-\${date}-2\`, start: mk(12), end: mk(13), capacity: 1, remaining: 1 },
        { id: \`S-\${date}-3\`, start: mk(15), end: mk(16), capacity: 1, remaining: 1 },
      ];
    }
    return json({ slots });
  }

  if (request.method === "POST" && url.pathname === "/line/reserve") {
    const ReserveSchema = z.object({
      slotId: z.string().min(1),
      name:   z.string().min(1),
      phone:  z.string().optional().nullable(),
      note:   z.string().optional().nullable(),
    });
    const body = await request.json().catch(() => ({}));
    const parsed = ReserveSchema.safeParse(body);
    if (!parsed.success) return json({ error: "bad body", issues: parsed.error.issues }, 400);

    const id = crypto.randomUUID();
    const rec = { id, ...parsed.data, createdAt: new Date().toISOString(), status: "reserved" };
    await env.LINE_BOOKING.put(\`resv:\${id}\`, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 7 });
    return json({ ok: true, id });
  }

  return undefined;
}
"@ | Set-Content -Encoding UTF8 $rest
}

# 2) index.ts を強制ラップ
$raw = Get-Content $idx -Raw -Encoding UTF8
$bak = "$idx.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $idx $bak -Force

# import 追加（重複回避）
if ($raw -notmatch 'tryHandleBookingUiREST') {
  $raw = "import { tryHandleBookingUiREST } from ""./booking-ui-rest"";`r`n$raw"
}

$done = $false

# (A) export default app.fetch; → ラッパー化
if (-not $done -and $raw -match 'export\s+default\s+app\.fetch\s*;?') {
  $raw = $raw -replace 'export\s+default\s+app\.fetch\s*;?',
"export default {
  async fetch(request: Request, env: any, ctx: any) {
    const maybe = await tryHandleBookingUiREST(request, env);
    if (maybe) return maybe;
    return app.fetch(request, env, ctx);
  }
};"
  $done = $true
}

# (B) export default app; → app.fetch を呼ぶラッパー
if (-not $done -and $raw -match 'export\s+default\s+app\s*;?') {
  $raw = $raw -replace 'export\s+default\s+app\s*;?',
"export default {
  async fetch(request: Request, env: any, ctx: any) {
    const maybe = await tryHandleBookingUiREST(request, env);
    if (maybe) return maybe;
    return (app as any).fetch(request, env, ctx);
  }
};"
  $done = $true
}

# (C) 既存の fetch 本体の先頭に差し込み（複数パターン）
$patterns = @(
  '(export\s+default\s*{\s*fetch\s*:\s*async\s*\([\s\S]*?\)\s*=>\s*{\s*)',
  '(export\s+default\s*{\s*async\s+fetch\s*\([\s\S]*?\)\s*{\s*)',
  '(export\s+default\s*{\s*fetch\s*\([\s\S]*?\)\s*{\s*)',
  '(async\s+function\s+fetch\s*\([\s\S]*?\)\s*{\s*)',
  '(function\s+fetch\s*\([\s\S]*?\)\s*{\s*)'
)
foreach ($p in $patterns) {
  if ($done) { break }
  if ($raw -match $p) {
    $raw = [regex]::Replace($raw, $p, {
      param($m)
      $m.Groups[1].Value + "const maybe = await tryHandleBookingUiREST(request as Request, env as any); if (maybe) return maybe;`r`n"
    }, 1)
    $done = $true
  }
}

if (-not $done) {
  throw "fetch 構造の特定に失敗。index.ts の fetch 先頭に↓を手動貼付:
const maybe = await tryHandleBookingUiREST(request as Request, env as any); if (maybe) return maybe;"
}

Set-Content $idx -Value $raw -Encoding UTF8
Write-Host "✅ Force-wrapped. backup: $bak"

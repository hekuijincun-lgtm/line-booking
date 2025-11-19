[CmdletBinding()]
param(
    [string]$RepoRoot = "$HOME/repo/line-booking"
)

$ErrorActionPreference = "Stop"

$uiRoot     = Join-Path $RepoRoot "booking-ui"
$srcDir     = Join-Path $uiRoot "src"
$configPath = Join-Path $srcDir "template-config.ts"

if (-not (Test-Path $srcDir)) {
    throw "src ディレクトリが見つからない: $srcDir"
}

if (Test-Path $configPath) {
    $bak = "${configPath}.bak"
    Copy-Item $configPath $bak -Force
    Write-Host "📦 Backup existing template-config.ts -> $bak"
}

$ts = @"
/**
 * Kazuki Booking - TemplateConfig (JSON backend)
 *  - PowerShell が YAML => JSON に変換
 *  - フロントは /templates/<slug>.json を fetch するだけ
 */

export type TemplateFeatureItem = {
  title: string;
  description: string;
};

export type TemplateSection = {
  type: string;
  title: string;
  items: TemplateFeatureItem[];
};

export type TemplateHero = {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  ctaLabel: string;
};

export type TemplateBrand = {
  primary: string;
  accent: string;
  surface: string;
};

export type TemplateMeta = {
  tags: string[];
  note: string;
};

export type TemplateConfig = {
  name: string;
  slug: string;
  brand: TemplateBrand;
  layout: {
    hero: TemplateHero;
    sections: TemplateSection[];
  };
  meta: TemplateMeta;
};

export async function loadTemplateConfig(slug: string): Promise<TemplateConfig> {
  if (!slug) {
    throw new Error("loadTemplateConfig: slug is required");
  }

  const res = await fetch(`/templates/${slug}.json`, {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `loadTemplateConfig: failed to load template '${slug}': HTTP ${res.status}`
    );
  }

  const data = (await res.json()) as TemplateConfig;
  if (!data.slug) {
    data.slug = slug;
  }

  return data;
}
"@

Write-Host "📝 Writing new template-config.ts: $configPath"
$ts | Set-Content -Path $configPath -Encoding UTF8

Write-Host "✅ template-config.ts を JSON フェッチ実装に更新しました"
Write-Host "   - YAML -> JSON は tools\\05-Build-TemplateJson.ps1 で生成してください"

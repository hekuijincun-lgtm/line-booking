param([string[]]$Files)
$ErrorActionPreference = "Stop"
if (-not $Files -or $Files.Count -eq 0) {
  $base = $env:GITHUB_BASE_REF
  if ($base) { $Files = git diff --name-only "origin/$base...HEAD" 2>$null }
  if (-not $Files -or $Files.Count -eq 0) { $Files = git ls-files }
}
$Files = $Files | % { ($_ -replace '\\','/') -replace '^\./','' } |
         ? { $_ -match '\.(ts|tsx|js|mjs|cjs)$' -and $_ -notmatch '(^|/)node_modules/|(^|/)dist/|(^|/)build/' }
$bad = @()
foreach($f in $Files){
  if(-not (Test-Path $f)){ continue }
  $lines = Get-Content $f -Encoding UTF8
  for($i=0;$i -lt $lines.Count;$i++){
    if($lines[$i] -match '^\s*`{3,}' -or $lines[$i] -match '^\s*`(?!`)'){ $bad += "{0}:{1}" -f $f, ($i+1) }
  }
}
if($bad.Count){ Write-Host "❌ Backtick fence / stray backtick detected:" -ForegroundColor Red; $bad | % { Write-Host "  $_" -ForegroundColor Red }; exit 1 }
Write-Host "✅ No backtick issues"

param(
  [ValidateSet("staging", "production", "both")]
  [string]$Target = "both"
)

$urls = @{
  "staging"    = "https://85283f05.booking-ui-4pk.pages.dev"  # ← 今の最新をメモ
  "production" = "https://kazukigroup.org/booking"
}

Write-Host ""
Write-Host "==== Kazuki Booking UI URLs ===="

if ($Target -eq "staging" -or $Target -eq "both") {
  Write-Host ("staging   : " + $urls["staging"])
}

if ($Target -eq "production" -or $Target -eq "both") {
  Write-Host ("production: " + $urls["production"])
}

Write-Host "================================"
Write-Host ""





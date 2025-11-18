param(
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

$root   = "$HOME/repo/line-booking/booking-ui"

Write-Host "🔧 Booking UI deploy script" -ForegroundColor Cyan
Write-Host "  Root: $root" -ForegroundColor DarkGray

Set-Location $root

# 1) build
Write-Host "▶ npm run build" -ForegroundColor Yellow
npm run build

# 2) deploy (git 汚れ許可オプション)
$dirtyFlag = $AllowDirty.IsPresent ? "--commit-dirty=true" : ""
Write-Host "▶ wrangler pages deploy dist $dirtyFlag" -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name=booking-ui $dirtyFlag

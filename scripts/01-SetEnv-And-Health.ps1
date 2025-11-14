param(
  [string]C:\Users\mesom\repo\line-booking = "C:\Users\mesom\repo\line-booking",
  [string] = "https://saas-api-v4.hekuijincun.workers.dev"
)
$ErrorActionPreference='Stop'
$ui = Join-Path $Repo "booking-ui"
if (-not (Test-Path $ui)) { throw "not found: $ui" }
Push-Location $ui
try{
@"
VITE_API_BASE=$ApiBase
VITE_LOGIN_URL=$ApiBase/auth/line/login
VITE_SLOTS_PATH=/line/slots
VITE_RESERVE_PATH=/line/reserve
VITE_MY_PATH=/line/my

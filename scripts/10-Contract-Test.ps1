param([string]$Base="https://saas-api-staging-v4.hekuijincun.workers.dev")
$ErrorActionPreference='Stop'
$today=(Get-Date).ToString('yyyy-MM-dd')
$res = iwr "$Base/line/slots?date=$today" -UseBasicParsing | ConvertFrom-Json
if (-not $res.slots -or -not $res.slots[0].id -or -not $res.slots[0].start) { throw "slots payload contract broken" }
"✅ Contract OK"

param(
    [Parameter(Mandatory = $true)]
    [string]$ReserveId,

    [string]$Env = "staging"
)

$baseUrl = if ($Env -eq "production") {
    "https://saas-api.hekuijincun.workers.dev"
} else {
    "https://saas-api-staging-v4.hekuijincun.workers.dev"
}

$uri = "$baseUrl/line/notify"

Write-Host "▶ POST $uri (reserveId = $ReserveId)" -ForegroundColor Cyan

$body = @{ reserveId = $ReserveId } | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod -Method Post -Uri $uri -Body $body -ContentType "application/json"

Write-Host "✅ Response:" -ForegroundColor Green
$response | Format-List

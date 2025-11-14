param([ValidateSet("staging","production")]$Env="staging",[string]$Repo="$HOME/repo/line-booking")
$ErrorActionPreference='Stop'
Set-Location $Repo
if (-not (Test-Path ".git")) { throw "not a git repo: $Repo" }
git revert --no-edit HEAD
pwsh -NoProfile -File "scripts/03-Deploy-And-Smoke.ps1" -Env $Env

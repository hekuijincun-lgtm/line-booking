# BookingSafeOps.psm1

function Assert-ContentCmdlets {
  $set = (Get-Command Set-Content -ErrorAction SilentlyContinue)
  $get = (Get-Command Get-Content -ErrorAction SilentlyContinue)
  if ($set.Source -ne 'Microsoft.PowerShell.Management' -or $get.Source -ne 'Microsoft.PowerShell.Management') {
    throw "Set-Content/Get-Content の解決先が想定外です（sc.exe 衝突対策）。フル修飾呼び出しを使ってください。"
  }
}

function Write-File {
  param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string]$Content)
  $dir = [IO.Path]::GetDirectoryName($Path)
  if ($dir -and -not (Test-Path $dir)) { [void](New-Item -Force -ItemType Directory -Path $dir) }
  [void](New-Item -Force -ItemType File -Path $Path)
  Microsoft.PowerShell.Management\Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}
function Read-Text  { param([Parameter(Mandatory)][string]$Path) Microsoft.PowerShell.Management\Get-Content -LiteralPath $Path -Raw -Encoding UTF8 }
function Write-Text { param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string]$Text)
  $dir = [IO.Path]::GetDirectoryName($Path)
  if ($dir -and -not (Test-Path $dir)) { [void](New-Item -Force -ItemType Directory -Path $dir) }
  Microsoft.PowerShell.Management\Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8
}

Export-ModuleMember -Function Assert-ContentCmdlets, Write-File, Read-Text, Write-Text

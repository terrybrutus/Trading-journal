param(
  [string]$OutputPath = "dist/quantum-tradingview-capture-extension.zip"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionPath = Join-Path $repoRoot "extension"
$distPath = Join-Path $repoRoot "dist"
$resolvedOutput = Join-Path $repoRoot $OutputPath

if (-not (Test-Path -LiteralPath $extensionPath)) {
  throw "Extension folder not found: $extensionPath"
}

New-Item -ItemType Directory -Force -Path $distPath | Out-Null
if (Test-Path -LiteralPath $resolvedOutput) {
  Remove-Item -LiteralPath $resolvedOutput -Force
}

Compress-Archive -Path (Join-Path $extensionPath "*") -DestinationPath $resolvedOutput -Force
Get-Item -LiteralPath $resolvedOutput | Select-Object FullName, Length, LastWriteTime

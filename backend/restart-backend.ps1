param(
    [int] $Port
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stopScript = Join-Path $scriptDir 'stop-backend.ps1'
$startScript = Join-Path $scriptDir 'start-backend.ps1'

if (-not (Test-Path $stopScript)) {
    Write-Host "[backend] Missing script: $stopScript"
    exit 1
}

if (-not (Test-Path $startScript)) {
    Write-Host "[backend] Missing script: $startScript"
    exit 1
}

Write-Host '[backend] Stopping backend...'
if ($PSBoundParameters.ContainsKey('Port')) {
    & $stopScript -Port $Port
} else {
    & $stopScript
}

Start-Sleep -Milliseconds 500

Write-Host '[backend] Starting backend...'
if ($PSBoundParameters.ContainsKey('Port')) {
    & $startScript -Port $Port
} else {
    & $startScript
}

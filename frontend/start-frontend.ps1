param(
    [int] $Port = 4200
)

$ErrorActionPreference = 'Stop'

function Get-ListeningProcess {
    param([int] $TargetPort)

    $connection = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) {
        return $null
    }

    return Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$existingProcess = Get-ListeningProcess -TargetPort $Port

if ($existingProcess) {
    if ($existingProcess.Name -in @('node', 'node.exe')) {
        Write-Host "[frontend] Stopping stale Node process $($existingProcess.ProcessId) on port $Port..."
        Stop-Process -Id $existingProcess.ProcessId -Force
        Start-Sleep -Seconds 1
    } else {
        Write-Host "[frontend] Port $Port is already used by process '$($existingProcess.Name)' with PID $($existingProcess.ProcessId)."
        Write-Host '[frontend] Stop that process manually or choose another port with -Port.'
        exit 1
    }
}

$npmCommandInfo = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommandInfo) {
    $npmCommand = $npmCommandInfo.Source
}

if (-not $npmCommand) {
    $npmCommandInfo = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCommandInfo) {
        $npmCommand = $npmCommandInfo.Source
    }
}

if (-not $npmCommand) {
    Write-Host '[frontend] npm was not found in PATH.'
    exit 1
}

Write-Host "[frontend] Starting Angular dev server on port $Port..."
Push-Location $scriptDir
try {
    & $npmCommand 'start' '--' '--port' $Port '--host' 'localhost'
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
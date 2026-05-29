param(
    [int] $Port = 4200
)

$ErrorActionPreference = 'Stop'

$connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $connection) {
    Write-Host "[frontend] Nothing listening on port $Port."
    exit 0
}

$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue

if (-not $process) {
    Write-Host "[frontend] No process details found for PID $($connection.OwningProcess) on port $Port."
    exit 1
}

if ($process.Name -notin @('node', 'node.exe')) {
    Write-Host "[frontend] Port $Port is owned by '$($process.Name)' (PID $($connection.OwningProcess)); not stopping it."
    exit 1
}

try {
    Stop-Process -Id $connection.OwningProcess -Force
    Write-Host "[frontend] Stopped process $($connection.OwningProcess) on port $Port."
    exit 0
} catch {
    Write-Host "[frontend] Failed to stop process $($connection.OwningProcess) on port ${Port}: $($_.Exception.Message)"
    exit 1
}
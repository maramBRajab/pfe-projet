param(
    [int] $Port
)

$ErrorActionPreference = 'Stop'

function Resolve-BackendPort {
    param([int] $RequestedPort)

    if ($RequestedPort) {
        return $RequestedPort
    }

    if ($env:BACKEND_PORT) {
        return [int] $env:BACKEND_PORT
    }

    if ($env:SERVER_PORT) {
        return [int] $env:SERVER_PORT
    }

    return 8082
}

$resolvedPort = Resolve-BackendPort -RequestedPort $Port
$connection = Get-NetTCPConnection -LocalPort $resolvedPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $connection) {
    Write-Host "[backend] Nothing listening on port $resolvedPort."
    exit 0
}

$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue

if (-not $process) {
    Write-Host "[backend] No process details found for PID $($connection.OwningProcess) on port $resolvedPort."
    exit 1
}

if ($process.Name -notin @('java', 'java.exe')) {
    Write-Host "[backend] Port $resolvedPort is owned by '$($process.Name)' (PID $($connection.OwningProcess)); not stopping it."
    exit 1
}

try {
    Stop-Process -Id $connection.OwningProcess -Force
    Write-Host "[backend] Stopped Java process $($connection.OwningProcess) on port $resolvedPort."
    exit 0
} catch {
    Write-Host "[backend] Failed to stop Java process $($connection.OwningProcess) on port ${resolvedPort}: $($_.Exception.Message)"
    exit 1
}
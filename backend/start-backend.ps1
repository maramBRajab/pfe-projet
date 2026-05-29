param(
    [int] $Port
)

$ErrorActionPreference = 'Stop'

function Get-PropertyValue {
    param(
        [string[]] $Lines,
        [string] $Key
    )

    $line = $Lines | Where-Object {
        $_ -match '^\s*[^#]' -and $_ -match ('^\s*' + [regex]::Escape($Key) + '\s*=')
    } | Select-Object -First 1

    if (-not $line) {
        return $null
    }

    return (($line -split '=', 2)[1]).Trim()
}

function Get-PostgresCliPath {
    $fixedCandidates = @(
        'C:\Program Files\PostgreSQL\15\bin\psql.exe',
        'C:\Program Files\PostgreSQL\16\bin\psql.exe',
        'C:\Program Files\PostgreSQL\14\bin\psql.exe',
        'C:\Program Files (x86)\PostgreSQL\15\bin\psql.exe'
    )

    foreach ($candidate in $fixedCandidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $wildcardCandidates = @(Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' })

    foreach ($candidate in $wildcardCandidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Ensure-ConfiguredDatabase {
    param([string] $BackendDir)

    $propertiesPath = Join-Path $BackendDir 'src\main\resources\application.properties'
    if (-not (Test-Path $propertiesPath)) {
        return
    }

    $properties = Get-Content $propertiesPath
    $jdbcUrl = Get-PropertyValue -Lines $properties -Key 'spring.datasource.url'
    $dbUser = Get-PropertyValue -Lines $properties -Key 'spring.datasource.username'
    $dbPassword = Get-PropertyValue -Lines $properties -Key 'spring.datasource.password'

    if (-not $jdbcUrl -or -not $dbUser) {
        return
    }

    if ($jdbcUrl -notmatch '^jdbc:postgresql://(?<host>[^:/?#]+)(:(?<port>\d+))?/(?<database>[^?]+)') {
        Write-Host '[backend] Datasource URL is not a supported PostgreSQL URL. Skipping database bootstrap.'
        return
    }

    $dbHost = $Matches.host
    $dbPort = if ($Matches.port) { $Matches.port } else { '5432' }
    $dbName = $Matches.database
    $psqlPath = Get-PostgresCliPath

    if (-not $psqlPath) {
        Write-Host '[backend] PostgreSQL CLI not found. Create the database manually if it does not exist.'
        return
    }

    $env:PGPASSWORD = $dbPassword
    try {
        $databaseExists = & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
        if (($databaseExists | Out-String).Trim() -eq '1') {
            Write-Host "[backend] Database '$dbName' already exists."
            return
        }

        Write-Host "[backend] Creating missing database '$dbName'..."
        & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$dbName\";"
        Write-Host "[backend] Database '$dbName' created successfully."
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

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

function Get-ListeningProcess {
    param([int] $TargetPort)

    $connection = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) {
        return $null
    }

    return Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
}

$resolvedPort = Resolve-BackendPort -RequestedPort $Port
$env:SERVER_PORT = [string] $resolvedPort

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mavenWrapper = Join-Path $scriptDir 'mvnw.cmd'
$pomFile = Join-Path $scriptDir 'pom.xml'
$existingProcess = Get-ListeningProcess -TargetPort $resolvedPort

Ensure-ConfiguredDatabase -BackendDir $scriptDir

if ($existingProcess) {
    if ($existingProcess.Name -in @('java', 'java.exe')) {
        Write-Host "[backend] Stopping stale Java process $($existingProcess.ProcessId) on port $resolvedPort..."
        Stop-Process -Id $existingProcess.ProcessId -Force
        Start-Sleep -Seconds 1
    } else {
        Write-Host "[backend] Port $resolvedPort is already used by process '$($existingProcess.Name)' with PID $($existingProcess.ProcessId)."
        Write-Host '[backend] Stop that process manually or choose another port with -Port, BACKEND_PORT or SERVER_PORT.'
        exit 1
    }
}

Write-Host "[backend] Starting Spring Boot on port $resolvedPort..."
Push-Location $scriptDir
try {
    & $mavenWrapper '-f' $pomFile 'spring-boot:run' "-Dspring-boot.run.jvmArguments=-Dserver.port=$resolvedPort"
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
$ErrorActionPreference = 'Stop'
$taskNode = Get-Command node -ErrorAction SilentlyContinue
$taskNodePath = if ($taskNode) { $taskNode.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $taskNodePath)) { throw '没有找到 Node.js，请安装 Node.js 后再运行。' }
$taskDataPath = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Path $taskDataPath -Force | Out-Null
Add-Type -AssemblyName System.Net.Http
$taskHttpHandler = New-Object System.Net.Http.HttpClientHandler
$taskHttpHandler.UseProxy = $false
$taskHttpClient = New-Object System.Net.Http.HttpClient($taskHttpHandler)
$taskHttpClient.Timeout = [TimeSpan]::FromSeconds(2)
function Test-WebsiteReady {
    try {
        $taskStatus = $taskHttpClient.GetStringAsync('http://127.0.0.1:4173/api/status').GetAwaiter().GetResult() | ConvertFrom-Json
        return ($null -ne $taskStatus.configured)
    } catch { return $false }
}
try {
    if (-not (Test-WebsiteReady)) {
        $taskServerPath = Join-Path $PSScriptRoot 'server.cjs'
        Start-Process -FilePath $taskNodePath -ArgumentList ('"' + $taskServerPath + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskDataPath 'server.log') -RedirectStandardError (Join-Path $taskDataPath 'server-error.log') | Out-Null
        for ($taskAttempt = 0; $taskAttempt -lt 15; $taskAttempt++) {
            Start-Sleep -Milliseconds 400
            if (Test-WebsiteReady) { break }
        }
    }
    if (-not (Test-WebsiteReady)) { throw ('启动失败，请查看：' + (Join-Path $taskDataPath 'server-error.log')) }
    Write-Host '网站已启动：http://127.0.0.1:4173'
    Start-Process 'http://127.0.0.1:4173'
} finally {
    $taskHttpClient.Dispose()
    $taskHttpHandler.Dispose()
}

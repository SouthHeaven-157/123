$ErrorActionPreference = 'Stop'
$previewNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $previewNode) { throw '请先配置 Node.js。' }
Write-Host '浏览器打开 http://127.0.0.1:4174 ，按 Ctrl+C 结束服务。'
& $previewNode.Source (Join-Path $PSScriptRoot 'server.cjs')

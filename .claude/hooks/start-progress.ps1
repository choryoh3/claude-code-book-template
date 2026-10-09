# UserPromptSubmit: 進捗バーのウィンドウを開く(既存があれば作り直す)
$ErrorActionPreference = 'SilentlyContinue'
$null = [Console]::In.ReadToEnd()
$pidFile = Join-Path $env:TEMP 'claude-progress.pid'
if (Test-Path $pidFile) {
  Stop-Process -Id ([int](Get-Content $pidFile)) -Force
  Remove-Item $pidFile -Force
}
$script = Join-Path $PSScriptRoot 'progress-bar.ps1'
$p = Start-Process powershell -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$script`""
$p.Id | Set-Content $pidFile
exit 0

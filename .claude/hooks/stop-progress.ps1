# Stop / SessionEnd: 進捗バーのウィンドウを閉じる
$ErrorActionPreference = 'SilentlyContinue'
$null = [Console]::In.ReadToEnd()
$pidFile = Join-Path $env:TEMP 'claude-progress.pid'
if (Test-Path $pidFile) {
  Stop-Process -Id ([int](Get-Content $pidFile)) -Force
  Remove-Item $pidFile -Force
}
exit 0

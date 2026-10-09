# 作業中アニメーション表示用ウィンドウのメインループ(Stop フックで kill される)
$ErrorActionPreference = 'SilentlyContinue'
$esc = [char]27
$Host.UI.RawUI.WindowTitle = 'Claude Code 作業中...'
try { $Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(80, 4) } catch {}
$width = 60
$trail = 10
$spinner = '⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::Write("$esc[?25l$esc[2J")   # カーソル非表示・画面クリア

function Get-Rgb([double]$deg) {
  $h = (($deg % 360) + 360) % 360 / 60
  $x = 1 - [math]::Abs(($h % 2) - 1)
  switch ([math]::Floor($h)) {
    0 { $r,$g,$b = 1,$x,0 } 1 { $r,$g,$b = $x,1,0 } 2 { $r,$g,$b = 0,1,$x }
    3 { $r,$g,$b = 0,$x,1 } 4 { $r,$g,$b = $x,0,1 } default { $r,$g,$b = 1,0,$x }
  }
  "{0};{1};{2}" -f [int](80 + $r * 175), [int](80 + $g * 175), [int](80 + $b * 175)
}

$start = Get-Date
$n = 0
while ($true) {
  $span = $width - 1
  $t = ($n * 2) % ($span * 2)
  if ($t -le $span) { $head = $t; $dir = 1 } else { $head = $span * 2 - $t; $dir = -1 }
  $bar = New-Object System.Text.StringBuilder
  for ($x = 0; $x -le $span; $x++) {
    $dist = ($head - $x) * $dir
    if ($dist -ge 0 -and $dist -le $trail) {
      $glyph = if ($dist -eq 0) { '█' } elseif ($dist -lt 3) { '▓' } elseif ($dist -lt 6) { '▒' } else { '░' }
      [void]$bar.Append("$esc[38;2;$(Get-Rgb ($n * 12 + $x * 6))m$glyph")
    } else {
      [void]$bar.Append("$esc[90m░")
    }
  }
  $sp = $spinner[$n % $spinner.Count]
  $secs = [int]((Get-Date) - $start).TotalSeconds
  $c1 = Get-Rgb ($n * 24); $c2 = Get-Rgb ($n * 24 + 180)
  [Console]::Write("$esc[H`n $esc[38;2;$($c1)m$sp$esc[0m [$($bar.ToString())$esc[0m] $esc[38;2;$($c2)m$sp 作業中… ${secs}s$esc[0m   ")
  $n++
  Start-Sleep -Milliseconds 50
}

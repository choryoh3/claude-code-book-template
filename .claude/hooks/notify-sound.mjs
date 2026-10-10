// Stop / Notification: Claude の作業完了（または確認待ち）を音で知らせる。
// 使い方: node notify-sound.mjs done      … 作業が終わったとき「チーン」
//         node notify-sound.mjs attention … 許可の確認などで人の操作が必要なとき（短い音）
// 無効にする: 環境変数 CLAUDE_SOUND_OFF=1 / 音を変える: CLAUDE_CHIME_FILE=C:\path\to\sound.wav
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const kind = process.argv[2] === 'attention' ? 'attention' : 'done'
if (process.env.CLAUDE_SOUND_OFF === '1') process.exit(0)

/** 音を鳴らす子プロセスを切り離して起動する（hook 自体はすぐ終了させ、Claude を待たせない） */
function playInBackground(command, args) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
  child.on('error', () => {}) // 再生手段が無い環境でも hook を失敗させない
  child.unref()
}

function playOnWindows() {
  const media = `${process.env.SystemRoot ?? 'C:\\Windows'}\\Media`
  const defaultSound = kind === 'done' ? 'chimes.wav' : 'ding.wav'
  const candidates = [
    process.env.CLAUDE_CHIME_FILE,
    `${media}\\${defaultSound}`,
    `${media}\\notify.wav`,
  ]
  const soundFile = candidates.find((file) => file && existsSync(file))

  // wav があれば再生、無ければビープ音で代用する
  const script = soundFile
    ? `(New-Object Media.SoundPlayer '${soundFile}').PlaySync()`
    : '[console]::Beep(880,250); [console]::Beep(1320,400)'
  playInBackground('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
}

if (process.platform === 'win32') {
  playOnWindows()
} else if (process.platform === 'darwin') {
  playInBackground('afplay', [`/System/Library/Sounds/${kind === 'done' ? 'Glass' : 'Ping'}.aiff`])
} else {
  process.stdout.write('\u0007') // その他の OS は端末のベル音
}

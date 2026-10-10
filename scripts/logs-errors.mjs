// 直近のエラー/警告ログを一覧表示する調査用スクリプト。
// 使い方: pnpm logs:errors [件数=20]
// ログは logs/*.log に 1 行 1 JSON（pino）で出力されている前提。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const LOG_DIR = 'logs'
const PINO_LEVEL_WARN = 40 // pino: 40=warn, 50=error, 60=fatal
const limit = Number(process.argv[2] ?? 20)

/** logs/ 配下の全ログファイルから、警告以上の行を取り出す */
function collectProblemEntries() {
  let files = []
  try {
    files = readdirSync(LOG_DIR).filter((name) => name.endsWith('.log'))
  } catch {
    console.error(`${LOG_DIR}/ が見つかりません。サーバーを起動するとログが作られます。`)
    process.exit(0)
  }

  const entries = []
  for (const file of files) {
    for (const line of readFileSync(join(LOG_DIR, file), 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        if (entry.level >= PINO_LEVEL_WARN) entries.push({ file, ...entry })
      } catch {
        // JSON ではない行（起動時の素のメッセージなど）は無視する
      }
    }
  }
  return entries
}

const recent = collectProblemEntries()
  .sort((a, b) => a.time - b.time)
  .slice(-limit)

if (recent.length === 0) console.log('警告・エラーのログはありません。')

for (const e of recent) {
  const time = new Date(e.time).toISOString()
  console.log(`[${time}] ${e.file} level=${e.level} requestId=${e.requestId ?? '-'} ${e.msg ?? ''}`)
  if (e.err?.message) console.log(`    ${e.err.message}`)
}

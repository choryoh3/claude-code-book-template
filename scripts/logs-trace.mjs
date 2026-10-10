// 1 つの requestId に紐づく全ログを時系列で表示する調査用スクリプト。
// 使い方: pnpm logs:trace <requestId>
// エラー応答の JSON に含まれる requestId を渡すと、そのリクエストの処理の流れを追える。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const LOG_DIR = 'logs'
const requestId = process.argv[2]

if (!requestId) {
  console.error('使い方: pnpm logs:trace <requestId>')
  process.exit(1)
}

let files = []
try {
  files = readdirSync(LOG_DIR).filter((name) => name.endsWith('.log'))
} catch {
  console.error(`${LOG_DIR}/ が見つかりません。`)
  process.exit(0)
}

const matched = []
for (const file of files) {
  for (const line of readFileSync(join(LOG_DIR, file), 'utf8').split('\n')) {
    // 先に文字列で絞ってから JSON を解釈する（大きなログでも速くするため）
    if (!line.includes(requestId)) continue
    try {
      const entry = JSON.parse(line)
      if (entry.requestId === requestId) matched.push({ file, ...entry })
    } catch {
      // JSON ではない行は無視する
    }
  }
}

matched.sort((a, b) => a.time - b.time)

if (matched.length === 0) console.log(`requestId=${requestId} のログは見つかりませんでした。`)

for (const e of matched) {
  const { file, time, level, msg, requestId: _id, pid: _pid, hostname: _host, ...rest } = e
  console.log(`[${new Date(time).toISOString()}] ${file} level=${level} ${msg ?? ''}`)
  if (Object.keys(rest).length > 0) console.log(`    ${JSON.stringify(rest)}`)
}

// PreToolUse (Bash): 危険なコマンドをブロックする
import { existsSync, statSync } from 'node:fs'
import { absolute, deny, readInput } from './lib.mjs'

const input = await readInput()
const cmd = String(input.tool_input?.command ?? '')

// /db-reset コマンドが、ユーザー確認後に作成する一時フラグ（10 分で失効）
function dbResetAllowed() {
  const flag = absolute('.claude/.db-reset-allowed')
  return existsSync(flag) && Date.now() - statSync(flag).mtimeMs < 10 * 60 * 1000
}

const rules = [
  {
    test: /\brm\s+(?:-\w*\s+)*-\w*(?:r\w*f|f\w*r)\b|\brm\s+.*--recursive|\brmdir\s+\/s|Remove-Item\b.*-Recurse/i,
    msg: '再帰的な削除（rm -rf 等）はブロックされています。対象を絞って個別に削除するか、ユーザーに実行を依頼してください。',
  },
  {
    test: /\bgit\s+push\b.*(?:--force(?!-with-lease)|\s-f\b)/,
    msg: 'git push --force はブロックされています。',
  },
  {
    // DB 全体の作り直し・全マイグレーションの巻き戻し・スキーマ削除
    test: /\bdb:reset\b|\bnode-pg-migrate\b.*\bdown\b.*--count\s+(?:0|all)|\bDROP\s+SCHEMA\b/i,
    allow: dbResetAllowed,
    msg: 'DB のリセット系の操作は /db-reset コマンド経由でのみ実行できます。',
  },
  {
    test: /\bDROP\s+DATABASE\b/i,
    msg: 'DROP DATABASE はブロックされています。',
  },
]

for (const rule of rules) {
  if (rule.test.test(cmd) && !(rule.allow && rule.allow())) deny(`[guard-bash] ${rule.msg}`)
}

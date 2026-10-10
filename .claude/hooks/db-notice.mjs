// PostToolUse (Edit|Write): マイグレーション SQL を作成・編集したときに、次にやることを通知する
import { deny, readInput, toRelative } from './lib.mjs'

const input = await readInput()
const rel = toRelative(input.tool_input?.file_path)

if (rel?.startsWith('packages/db/migrations/') && rel.endsWith('.sql')) {
  deny(
    'マイグレーションを書きました。次の順に実行してください: ' +
      '`pnpm db:migrate`（適用）→ `pnpm db:codegen`（Kysely の型を再生成）→ seed と docs/test-data.md の更新。' +
      '(skill: db-migration)',
  )
}

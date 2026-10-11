// `pnpm db:migrate` の本体。SQL マイグレーションを適用する。
// 使い方: tsx src/cli/migrate.ts up | down

import process from 'node:process'
import { runMigrations } from '../migrations'

const direction = process.argv[2] === 'down' ? 'down' : 'up'

console.log(`マイグレーションを実行します（${direction}）`)
const count = await runMigrations(direction)
console.log(
  count === 0 ? '適用するマイグレーションはありませんでした。' : `${count} 件を実行しました。`,
)

if (direction === 'up') {
  console.log('次は `pnpm db:codegen` で Kysely の型を最新にしてください。')
}

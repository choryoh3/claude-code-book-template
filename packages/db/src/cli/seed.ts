// `pnpm db:seed` の本体。テストデータを投入する（既存データは全て消して入れ直す）。
import process from 'node:process'
import { runSeed } from '../../seed'
import { closeDb, getDb } from '../index'

try {
  console.log('テストデータを投入します（既存データは削除されます）')
  const summary = await runSeed(getDb())

  console.log('投入しました:')
  for (const [table, count] of Object.entries(summary)) {
    console.log(`  ${table.padEnd(20)} ${String(count).padStart(5)} 件`)
  }
  console.log('ログイン情報は docs/test-data.md を参照してください。')
} catch (error) {
  console.error('テストデータの投入に失敗しました。DB は変更されていません。')
  console.error(error)
  process.exitCode = 1
} finally {
  await closeDb()
}

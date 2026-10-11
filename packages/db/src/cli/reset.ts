// `pnpm db:reset` の本体。開発 DB を「空の状態」から作り直す: 全テーブル削除 → マイグレーション → seed。
// ⚠ 全データが消える。Claude Code からは /db-reset（ユーザー確認つき）経由でのみ実行する（hooks が直接実行をブロックする）。
import process from 'node:process'
import { sql } from 'kysely'
import { runSeed } from '../../seed'
import { getDatabaseUrl } from '../config'
import { closeDb, getDb } from '../index'
import { runMigrations } from '../migrations'

/** この名前の接続先だけを「手元の開発 DB」とみなす */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** 本番・共有 DB を誤って消さないための確認。手元の DB 以外なら止める */
function assertSafeTarget() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production では db:reset を実行できません')
  }
  const { hostname, pathname } = new URL(getDatabaseUrl())
  if (!LOCAL_HOSTS.has(hostname) && process.env.ALLOW_REMOTE_DB_RESET !== '1') {
    throw new Error(
      `接続先 ${hostname}${pathname} は手元の DB ではありません。本当に消すなら ALLOW_REMOTE_DB_RESET=1 を付けて実行してください`,
    )
  }
}

try {
  assertSafeTarget()
  console.log('開発 DB を初期化します（全データが消えます）')

  // 1) 全テーブルを削除（スキーマごと作り直す。マイグレーションの記録も消える）
  await sql`DROP SCHEMA public CASCADE`.execute(getDb())
  await sql`CREATE SCHEMA public`.execute(getDb())

  // 2) マイグレーションを最初から適用
  const migrated = await runMigrations('up')
  console.log(`マイグレーション ${migrated} 件を適用しました`)

  // 3) テストデータを投入
  const summary = await runSeed(getDb())
  console.log('投入しました:', JSON.stringify(summary))
  console.log(
    '次は `pnpm db:codegen` で型が最新か確認してください。ログイン情報は docs/test-data.md です。',
  )
} catch (error) {
  console.error('db:reset に失敗しました')
  console.error(error)
  process.exitCode = 1
} finally {
  await closeDb()
}

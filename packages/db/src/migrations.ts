// SQL マイグレーション（packages/db/migrations/*.sql）を適用・取り消す。
// 実体は node-pg-migrate。どの SQL をどの順で実行済みかは、DB の pgmigrations テーブルが記録している。

import { fileURLToPath } from 'node:url'
import { runner } from 'node-pg-migrate'
import { getDatabaseUrl } from './config'

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url))

/**
 * マイグレーションを実行する。
 * - up  : まだ適用していないものを全て適用する
 * - down: 直近の 1 つだけを取り消す（Down Migration を実行）
 * @returns 今回実行したマイグレーションの数
 */
export async function runMigrations(direction: 'up' | 'down'): Promise<number> {
  const executed = await runner({
    databaseUrl: getDatabaseUrl(),
    dir: MIGRATIONS_DIR,
    direction,
    count: direction === 'up' ? Number.POSITIVE_INFINITY : 1,
    migrationsTable: 'pgmigrations',
    // 全部成功するか、全部取り消されるか（途中で止まった中途半端な状態を作らない）
    singleTransaction: true,
    log: (message) => console.log(`  ${message}`),
  })
  return executed.length
}

// 全テストの前に 1 回だけ動く準備: テスト用 DB（xclone_test）を作り、空の状態から全マイグレーションを適用する。
// 本番と同じ SQL マイグレーションで作るので、「テストでは動くが本番の DB では動かない」を防げる。

import process from 'node:process'
import { createDb, runMigrations, sql } from '@xclone/db'

/** テスト用 DB の名前は必ず _test で終わること（開発用の DB を誤って消さないための安全装置） */
export function assertTestDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1)
  if (!name.endsWith('_test')) {
    throw new Error(
      `テスト用の DB 名は「_test」で終わる必要があります（現在: ${name}）。開発用の DB を消さないための確認です`,
    )
  }
  return name
}

export async function setup() {
  const url = process.env.DATABASE_URL ?? ''
  const name = assertTestDatabase(url)

  // 1) DB が無ければ作る（作成は、同じサーバーの管理用 DB「postgres」に接続して行う）
  const maintenanceUrl = new URL(url)
  maintenanceUrl.pathname = '/postgres'
  const maintenance = createDb(maintenanceUrl.toString())
  try {
    const { rows } = await sql<{ exists: boolean }>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${name}) AS exists
    `.execute(maintenance)
    if (!rows[0]?.exists) await sql`CREATE DATABASE ${sql.id(name)}`.execute(maintenance)
  } finally {
    await maintenance.destroy()
  }

  // 2) 中身を空にして、全マイグレーションを適用する（前回の残りやスキーマの変更を確実に反映するため）
  const testDb = createDb(url)
  try {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(testDb)
    await sql`CREATE SCHEMA public`.execute(testDb)
  } finally {
    await testDb.destroy()
  }
  await runMigrations('up')
}

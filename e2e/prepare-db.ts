// E2E 用の DB（xclone_e2e）を、空の状態から作り直す。API サーバーを起動する直前に実行される（playwright.config.ts）。
// 開発用の DB（xclone）は使わない: E2E はユーザーや投稿を作るので、開発中のデータを汚さないため。

import process from 'node:process'
import { createDb, runMigrations, sql } from '@xclone/db'

async function prepareE2eDatabase(url: string): Promise<string> {
  const name = new URL(url).pathname.slice(1)

  // 安全装置: 名前が _e2e で終わる DB 以外は消さない（開発用・本番の DB を誤って作り直さないため）
  if (!name.endsWith('_e2e')) {
    throw new Error(`E2E 用の DB 名は「_e2e」で終わる必要があります（現在: ${name}）`)
  }

  // 1) DB が無ければ作る（同じサーバーの管理用 DB「postgres」に接続して作成する）
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

  // 2) 中身を空にして、最新のマイグレーションを適用する（毎回まっさらな状態からテストする）
  const e2eDb = createDb(url)
  try {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(e2eDb)
    await sql`CREATE SCHEMA public`.execute(e2eDb)
  } finally {
    await e2eDb.destroy()
  }
  await runMigrations('up')
  return name
}

prepareE2eDatabase(process.env.DATABASE_URL ?? '')
  .then((name) => console.log(`E2E 用の DB（${name}）を準備しました`))
  .catch((error: unknown) => {
    console.error('E2E 用の DB の準備に失敗しました', error)
    process.exit(1)
  })

import type { DB } from './generated/db'
// @xclone/db の入口。Kysely のインスタンス（DB への窓口）と、型を公開する。
// user/server と admin/server はここから `getDb()` を使って、同じ DB に SQL を発行する。
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { getDatabaseUrl } from './config'

// --- 型の変換（pg ドライバの既定の挙動を、アプリで扱いやすいものにする） ---
// count(*) などの bigint は既定だと文字列で返る。件数は十分小さいので number にする。
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value))
// date 型は既定だと「サーバーのタイムゾーンの 0 時」の Date になりズレやすい。'YYYY-MM-DD' の文字列のまま扱う。
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

export type Database = Kysely<DB>

/** 新しい接続プールを作る。通常は `getDb()` を使い、テストなど別 DB が必要なときだけ直接呼ぶ */
export function createDb(connectionString: string = getDatabaseUrl()): Database {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 10 }) }),
  })
}

let sharedDb: Database | undefined

/** アプリ全体で共有する DB（初回の呼び出し時に接続プールを作る） */
export function getDb(): Database {
  sharedDb ??= createDb()
  return sharedDb
}

/** 共有の接続プールを閉じる（サーバーの終了時・スクリプトの最後に呼ぶ） */
export async function closeDb(): Promise<void> {
  if (!sharedDb) return
  await sharedDb.destroy()
  sharedDb = undefined
}

export type { DB } from './generated/db'
export { sql } from 'kysely'
export type { Insertable, Selectable, Updateable } from 'kysely'

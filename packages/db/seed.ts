// テストデータ（seed）の入口。`pnpm db:seed` で実行される。
//
// 動作確認に必要な「あらゆる状態」のデータを DB に入れる。内容の一覧・ログイン情報は docs/test-data.md。
// - 何度実行しても同じ結果（乱数の種と ID を固定。日付は実行日 or SEED_BASE_DATE を基準にする）
// - 実行のたびに既存データを全て消してから入れ直す（マイグレーションの記録は消さない）
// - すべて 1 つのトランザクション。途中で失敗したら何も変更されない
//
// データの作り方は seed/ 以下に役割ごとに分けてある:
//   users.ts 利用者 / posts.ts 投稿 / social.ts フォロー・反応 / notifications.ts 通知 / moderation.ts 通報・監査ログ・DAU

import type { Insertable, Transaction } from 'kysely'
import type { Database } from './src'
import type { DB } from './src/generated/db'
import bcrypt from 'bcrypt'
import { sql } from 'kysely'
import { resolveBaseDate, toDateString } from './seed/clock'
import { buildModeration } from './seed/moderation'
import { buildNotifications } from './seed/notifications'
import { buildPosts } from './seed/posts'
import { createRandom } from './seed/random'
import { buildSocial } from './seed/social'
import { ADMIN_PASSWORD, buildUsers, USER_PASSWORD } from './seed/users'

/** パスワードのハッシュ化の強度。アプリ本体（認証）と同じ値にして、ログインの動作を本番と揃える */
const BCRYPT_COST = 10

/** 全データを消す対象のテーブル（pgmigrations は含めない） */
const SEEDED_TABLES = [
  'audit_logs',
  'reports',
  'notifications',
  'bookmarks',
  'reposts',
  'likes',
  'follows',
  'post_hashtags',
  'hashtags',
  'posts',
  'daily_active_users',
  'refresh_tokens',
  'users',
] as const

/** 実行結果の要約（テーブルごとの投入件数） */
export type SeedSummary = Record<string, number>

/** 行が 0 件のときは INSERT しない（Kysely は空の values を受け付けないため） */
async function insertRows<T extends keyof DB>(
  trx: Transaction<DB>,
  table: T,
  rows: Insertable<DB[T]>[],
): Promise<number> {
  if (rows.length > 0)
    await trx
      .insertInto(table)
      .values(rows as never)
      .execute()
  return rows.length
}

export async function runSeed(db: Database): Promise<SeedSummary> {
  const base = resolveBaseDate()
  const random = createRandom()

  // パスワードのハッシュは「全員同じ」なので、2 回だけ計算する（31 回計算すると遅い）
  const hashes = {
    user: await bcrypt.hash(USER_PASSWORD, BCRYPT_COST),
    admin: await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST),
  }

  // 依存の順番で作る: ユーザー → 投稿 → フォロー・反応 → 通知 → 通報・監査ログ・DAU
  const { rows: userRows, users } = buildUsers(base, random, hashes)
  const { rows: postRows, posts, hashtagRows, postHashtagRows } = buildPosts(base, random, users)
  const social = buildSocial(base, random, users, posts)
  const notificationRows = buildNotifications(users, posts, social.events)
  const moderation = buildModeration(base, random, users, posts)

  const summary: SeedSummary = {}
  await db.transaction().execute(async (trx) => {
    // 1) 既存データを全削除（外部キーの順序を気にしなくてよいよう CASCADE）
    await sql`TRUNCATE TABLE ${sql.raw(SEEDED_TABLES.join(', '))} RESTART IDENTITY CASCADE`.execute(
      trx,
    )

    // 2) 親のテーブルから順に投入
    summary.users = await insertRows(trx, 'users', userRows)
    summary.hashtags = await insertRows(trx, 'hashtags', hashtagRows)
    summary.posts = await insertRows(trx, 'posts', postRows)
    summary.post_hashtags = await insertRows(trx, 'post_hashtags', postHashtagRows)
    summary.follows = await insertRows(trx, 'follows', social.follows)
    summary.likes = await insertRows(trx, 'likes', social.likes)
    summary.reposts = await insertRows(trx, 'reposts', social.reposts)
    summary.bookmarks = await insertRows(trx, 'bookmarks', social.bookmarks)
    summary.notifications = await insertRows(trx, 'notifications', notificationRows)
    summary.reports = await insertRows(trx, 'reports', moderation.reports)
    summary.audit_logs = await insertRows(trx, 'audit_logs', moderation.auditLogs)
    summary.daily_active_users = await insertRows(
      trx,
      'daily_active_users',
      moderation.dailyActiveUsers,
    )
  })

  console.log(`基準日: ${toDateString(base)}`)
  return summary
}

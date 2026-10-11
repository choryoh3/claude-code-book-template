// タイムライン: 「フォロー中」（時系列）と「おすすめ」（簡易スコアリング）。

import type { Database } from '@xclone/db'
import type { CursorPageQuery, PostPage } from '@xclone/shared'
import type { UserSummaryRow } from '../mappers'
import { sql } from '@xclone/db'
import { z } from 'zod'
import { dbTimestampSchema, decodeCursor, paginate } from '../lib/cursor'
import { toUserSummary } from '../mappers'
import { hydrateFeed, hydrateInOrder } from '../queries/posts'

/** リポストではない行の「リポストした人」の代わりに使う値（並び順と cursor の比較を NULL 無しで行うため） */
/** おすすめを読み進められる件数の上限（深い OFFSET は重くなるため） */
const MAX_OFFSET = 1000

const NO_REPOSTER = '00000000-0000-0000-0000-000000000000'

const followingCursorSchema = z.object({ t: dbTimestampSchema, p: z.uuid(), r: z.uuid() })

interface FeedRow {
  post_id: string
  reposter_key: string
  cursor_at: string
  reposter_id: string | null
  reposter_handle: string | null
  reposter_display_name: string | null
  reposter_avatar_url: string | null
}

/**
 * フォロー中のタイムライン: 自分とフォロー中の人の投稿（リプライを除く）と、その人たちのリポストを、新しい順に並べる。
 * 並び順のキーは（出来事の時刻, 投稿 ID, リポストした人）。リポストは「リポストした時刻」で並ぶ。
 */
export async function followingTimeline(
  db: Database,
  viewerId: string,
  query: CursorPageQuery,
): Promise<PostPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor, followingCursorSchema) : undefined

  const { rows } = await sql<FeedRow>`
    WITH authors AS (
      SELECT ${viewerId}::uuid AS user_id
      UNION
      SELECT followee_id FROM follows WHERE follower_id = ${viewerId}
    ),
    feed AS (
      SELECT p.id AS post_id, ${NO_REPOSTER}::uuid AS reposter_key, p.created_at AS activity_at
      FROM posts p
      WHERE p.author_id IN (SELECT user_id FROM authors)
        AND p.status = 'visible' AND p.reply_to_id IS NULL
      UNION ALL
      SELECT r.post_id, r.user_id, r.created_at
      FROM reposts r
      JOIN posts p ON p.id = r.post_id
      WHERE r.user_id IN (SELECT user_id FROM authors) AND p.status = 'visible'
    )
    SELECT
      f.post_id, f.reposter_key, f.activity_at::text AS cursor_at,
      u.id AS reposter_id, u.handle AS reposter_handle,
      u.display_name AS reposter_display_name, u.avatar_url AS reposter_avatar_url
    FROM feed f
    LEFT JOIN users u ON u.id = f.reposter_key
    ${
      cursor
        ? sql`WHERE (f.activity_at, f.post_id, f.reposter_key) < (${cursor.t}::timestamptz, ${cursor.p}::uuid, ${cursor.r}::uuid)`
        : sql``
    }
    ORDER BY f.activity_at DESC, f.post_id DESC, f.reposter_key DESC
    LIMIT ${query.limit + 1}
  `.execute(db)

  const page = paginate(rows, query.limit, (last) => ({
    t: last.cursor_at,
    p: last.post_id,
    r: last.reposter_key,
  }))
  const items = await hydrateFeed(
    db,
    page.items.map((row) => ({ postId: row.post_id, repostedBy: toReposter(row) })),
    viewerId,
  )
  return { items, nextCursor: page.nextCursor }
}

function toReposter(row: FeedRow) {
  if (!row.reposter_id || !row.reposter_handle || !row.reposter_display_name) return null
  const reposter: UserSummaryRow = {
    id: row.reposter_id,
    handle: row.reposter_handle,
    display_name: row.reposter_display_name,
    avatar_url: row.reposter_avatar_url,
  }
  return toUserSummary(reposter)
}

/** おすすめの対象にする期間（日） */
const FOR_YOU_WINDOW_DAYS = 7

/**
 * おすすめの cursor。スコアは時間とともに変わるので、1 ページ目を取った時刻（asOf）を固定して、
 * 同じ並びの続き（offset 件目から）を返す。
 */
const forYouCursorSchema = z.object({
  // 深く読み進めすぎると重くなるので、上限を設ける（おすすめを 1000 件より先まで読む使い方は想定しない）
  o: z.number().int().nonnegative().max(MAX_OFFSET),
  at: dbTimestampSchema,
})

/**
 * おすすめのタイムライン（簡易スコアリング）。直近 7 日の、自分以外の表示中の投稿（リプライを除く）を、
 *   スコア = (いいね + 2×リポスト + 1.5×リプライ + 1) ÷ (経過時間[時] + 2)^1.5
 * の高い順に並べる。反応が多いほど上がり、古くなるほど下がる（Hacker News の順位付けに近い考え方）。
 * 反応の件数も「1 ページ目を取った時刻（as_of）」までで数える。読んでいる途中でいいねが増えても
 * 順位が動かず、ページの境目で同じ投稿が重複したり抜けたりしないようにするため。
 */
export async function forYouTimeline(
  db: Database,
  viewerId: string,
  query: CursorPageQuery,
): Promise<PostPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor, forYouCursorSchema) : undefined
  const offset = cursor?.o ?? 0

  const { rows } = await sql<{ id: string; as_of: string }>`
    WITH params AS (
      SELECT COALESCE(${cursor?.at ?? null}::timestamptz, now()) AS as_of
    )
    SELECT p.id, params.as_of::text AS as_of
    FROM posts p, params
    WHERE p.status = 'visible'
      AND p.reply_to_id IS NULL
      AND p.author_id <> ${viewerId}
      AND p.created_at <= params.as_of
      AND p.created_at > params.as_of - make_interval(days => ${FOR_YOU_WINDOW_DAYS})
    ORDER BY
      (
        (SELECT count(*) FROM likes l WHERE l.post_id = p.id AND l.created_at <= params.as_of)
        + 2 * (SELECT count(*) FROM reposts r WHERE r.post_id = p.id AND r.created_at <= params.as_of)
        + 1.5 * (SELECT count(*) FROM posts c WHERE c.reply_to_id = p.id AND c.status = 'visible' AND c.created_at <= params.as_of)
        + 1
      ) / power(extract(epoch FROM (params.as_of - p.created_at)) / 3600 + 2, 1.5) DESC,
      p.id DESC
    OFFSET ${offset}
    LIMIT ${query.limit + 1}
  `.execute(db)

  const asOf = rows[0]?.as_of ?? cursor?.at ?? ''
  const page = paginate(rows, query.limit, () => ({ o: offset + query.limit, at: asOf }))
  return {
    items: await hydrateInOrder(
      db,
      page.items.map((row) => row.id),
      viewerId,
    ),
    nextCursor: page.nextCursor,
  }
}

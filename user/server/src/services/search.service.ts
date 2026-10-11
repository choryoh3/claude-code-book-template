// 検索（投稿・ユーザー・ハッシュタグ）とトレンド。
// 部分一致は pg_trgm の GIN インデックスを使う（日本語でも使える。docs/db-schema.md）。

import type { Database } from '@xclone/db'
import type { HashtagPage, PostPage, SearchQuery, TrendsDto, UserPage } from '@xclone/shared'
import type { UserSummaryRow } from '../mappers'
import { sql } from '@xclone/db'
import { z } from 'zod'
import { decodeCursor, paginate, timeCursorSchema } from '../lib/cursor'
import { toUserSummary } from '../mappers'
import { hydrateInOrder } from '../queries/posts'

/** LIKE の特殊文字（% _ \）を、ただの文字として扱うためにエスケープする */
const LIKE_SPECIAL_CHARS = /[\\%_]/g
function toLikePattern(keyword: string): string {
  return `%${keyword.replace(LIKE_SPECIAL_CHARS, (char) => `\\${char}`)}%`
}

/** 先頭の「#」 */
const LEADING_HASH = /^#/

/** 投稿の検索。「#タグ」の形ならハッシュタグの完全一致、それ以外は本文の部分一致（新しい順） */
export async function searchPosts(
  db: Database,
  viewerId: string,
  query: SearchQuery,
): Promise<PostPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor, timeCursorSchema) : undefined
  const isTagSearch = query.q.startsWith('#')
  const condition = isTagSearch
    ? sql`p.id IN (
        SELECT ph.post_id FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id
        WHERE h.tag = ${query.q.replace(LEADING_HASH, '').toLowerCase()}
      )`
    : sql`p.content ILIKE ${toLikePattern(query.q)} ESCAPE '\\'`

  const { rows } = await sql<{ id: string; cursor_at: string }>`
    SELECT p.id, p.created_at::text AS cursor_at
    FROM posts p
    WHERE p.status = 'visible' AND ${condition}
      ${cursor ? sql`AND (p.created_at, p.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : sql``}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ${query.limit + 1}
  `.execute(db)

  const page = paginate(rows, query.limit, (last) => ({ t: last.cursor_at, id: last.id }))
  return {
    items: await hydrateInOrder(
      db,
      page.items.map((row) => row.id),
      viewerId,
    ),
    nextCursor: page.nextCursor,
  }
}

const handleCursorSchema = z.object({ h: z.string().min(1).max(32) })

/** ユーザーの検索（ハンドル・表示名の部分一致。凍結中は除く。ハンドルの順） */
export async function searchUsers(db: Database, query: SearchQuery): Promise<UserPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor, handleCursorSchema) : undefined
  const pattern = toLikePattern(query.q.replace(LEADING_HASH, ''))

  const { rows } = await sql<UserSummaryRow>`
    SELECT u.id, u.handle, u.display_name, u.avatar_url
    FROM users u
    WHERE NOT u.is_suspended
      AND (u.handle ILIKE ${pattern} ESCAPE '\\' OR u.display_name ILIKE ${pattern} ESCAPE '\\')
      ${cursor ? sql`AND lower(u.handle) > ${cursor.h}` : sql``}
    ORDER BY lower(u.handle) ASC
    LIMIT ${query.limit + 1}
  `.execute(db)

  const page = paginate(rows, query.limit, (last) => ({ h: last.handle.toLowerCase() }))
  return { items: page.items.map(toUserSummary), nextCursor: page.nextCursor }
}

/** 読み進められる件数の上限（深い OFFSET は重くなるため） */
const MAX_OFFSET = 1000
const offsetCursorSchema = z.object({ o: z.number().int().nonnegative().max(MAX_OFFSET) })

/** ハッシュタグの検索（部分一致。投稿数の多い順） */
export async function searchTags(db: Database, query: SearchQuery): Promise<HashtagPage> {
  const offset = query.cursor ? decodeCursor(query.cursor, offsetCursorSchema).o : 0
  const pattern = toLikePattern(query.q.replace(LEADING_HASH, '').toLowerCase())

  const { rows } = await sql<{ tag: string; post_count: number }>`
    SELECT h.tag, count(p.id) AS post_count
    FROM hashtags h
    JOIN post_hashtags ph ON ph.hashtag_id = h.id
    JOIN posts p ON p.id = ph.post_id AND p.status = 'visible'
    WHERE h.tag ILIKE ${pattern} ESCAPE '\\'
    GROUP BY h.tag
    ORDER BY post_count DESC, h.tag ASC
    OFFSET ${offset}
    LIMIT ${query.limit + 1}
  `.execute(db)

  const page = paginate(rows, query.limit, () => ({ o: offset + query.limit }))
  return {
    items: page.items.map((row) => ({ tag: row.tag, postCount: row.post_count })),
    nextCursor: page.nextCursor,
  }
}

/** トレンドの集計期間（日）と件数 */
const TRENDS_WINDOW_DAYS = 7
const TRENDS_LIMIT = 10

/** トレンド: 直近 7 日に、表示中の投稿で多く使われたハッシュタグの上位 10 件 */
export async function getTrends(db: Database): Promise<TrendsDto> {
  const { rows } = await sql<{ tag: string; post_count: number }>`
    SELECT h.tag, count(*) AS post_count
    FROM post_hashtags ph
    JOIN hashtags h ON h.id = ph.hashtag_id
    JOIN posts p ON p.id = ph.post_id AND p.status = 'visible'
    WHERE ph.created_at > now() - make_interval(days => ${TRENDS_WINDOW_DAYS})
    GROUP BY h.tag
    ORDER BY post_count DESC, h.tag ASC
    LIMIT ${TRENDS_LIMIT}
  `.execute(db)
  return { items: rows.map((row) => ({ tag: row.tag, postCount: row.post_count })) }
}

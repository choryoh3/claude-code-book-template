// 投稿 ID の一覧から、画面に返す PostDto を組み立てる（タイムライン・プロフィール・検索などで共通に使う）。
//
// 一覧の取得は 2 段階に分けている:
//   1. 各機能のクエリが「どの投稿を、どの順で出すか」（ID の並び）だけを決める
//   2. この hydratePosts が、ID の一覧から表示に必要な情報をまとめて取る
// 2 は件数に関係なく SQL 1 回（N+1 にならない）。件数や「いいね済みか」は相関サブクエリで、
// それぞれ likes_post_idx などのインデックスを使う（docs/db-schema.md）。

import type { Database } from '@xclone/db'
import type { PostDto, UserSummaryDto } from '@xclone/shared'
import type { PostSummaryRow } from '../mappers'
import { sql } from '@xclone/db'
import { toPostSummary } from '../mappers'

/** hydratePosts の SQL が返す 1 行の形 */
interface HydratedPostRow extends PostSummaryRow {
  reply_to_id: string | null
  author_id: string
  author_handle: string
  author_display_name: string
  author_avatar_url: string | null
  quote_id: string | null
  quote_content: string | null
  quote_media_urls: string[] | null
  quote_status: PostSummaryRow['status'] | null
  quote_created_at: Date | null
  quote_author_id: string | null
  quote_author_handle: string | null
  quote_author_display_name: string | null
  quote_author_avatar_url: string | null
  reply_count: number
  repost_count: number
  quote_count: number
  like_count: number
  liked: boolean
  reposted: boolean
  bookmarked: boolean
}

/**
 * 投稿 ID の一覧から PostDto を作る。戻り値は ID → PostDto の Map（並び順は呼び出し側が決める）。
 * viewerId は「見ている人」。liked / reposted / bookmarked の判定に使う。
 */
export async function hydratePosts(
  db: Database,
  ids: string[],
  viewerId: string,
): Promise<Map<string, PostDto>> {
  if (ids.length === 0) return new Map()

  const { rows } = await sql<HydratedPostRow>`
    SELECT
      p.id, p.content, p.media_urls, p.status, p.created_at, p.reply_to_id,
      a.id AS author_id, a.handle AS author_handle, a.display_name AS author_display_name, a.avatar_url AS author_avatar_url,
      q.id AS quote_id, q.content AS quote_content, q.media_urls AS quote_media_urls,
      q.status AS quote_status, q.created_at AS quote_created_at,
      qa.id AS quote_author_id, qa.handle AS quote_author_handle,
      qa.display_name AS quote_author_display_name, qa.avatar_url AS quote_author_avatar_url,
      (SELECT count(*) FROM posts c WHERE c.reply_to_id = p.id AND c.status = 'visible') AS reply_count,
      (SELECT count(*) FROM reposts r WHERE r.post_id = p.id) AS repost_count,
      (SELECT count(*) FROM posts c WHERE c.quote_of_id = p.id AND c.status = 'visible') AS quote_count,
      (SELECT count(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ${viewerId}) AS liked,
      EXISTS (SELECT 1 FROM reposts r WHERE r.post_id = p.id AND r.user_id = ${viewerId}) AS reposted,
      EXISTS (SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = ${viewerId}) AS bookmarked
    FROM posts p
    JOIN users a ON a.id = p.author_id
    LEFT JOIN posts q ON q.id = p.quote_of_id
    LEFT JOIN users qa ON qa.id = q.author_id
    WHERE p.id = ANY(${ids}::uuid[])
  `.execute(db)

  return new Map(rows.map((row) => [row.id, toPostDto(row)]))
}

/** 1 行を PostDto に変換する。削除済み・非表示の投稿は中身を空にする（toPostSummary） */
function toPostDto(row: HydratedPostRow): PostDto {
  const author = {
    id: row.author_id,
    handle: row.author_handle,
    display_name: row.author_display_name,
    avatar_url: row.author_avatar_url,
  }
  return {
    ...toPostSummary(row, author),
    replyToId: row.reply_to_id,
    quoteOf: toQuotedPost(row),
    replyCount: row.reply_count,
    repostCount: row.repost_count,
    quoteCount: row.quote_count,
    likeCount: row.like_count,
    liked: row.liked,
    reposted: row.reposted,
    bookmarked: row.bookmarked,
    repostedBy: null,
  }
}

/** 引用元の投稿（引用投稿でなければ null） */
function toQuotedPost(row: HydratedPostRow): PostDto['quoteOf'] {
  if (!row.quote_id || !row.quote_author_id || !row.quote_status || !row.quote_created_at)
    return null
  return toPostSummary(
    {
      id: row.quote_id,
      content: row.quote_content ?? '',
      media_urls: row.quote_media_urls ?? [],
      status: row.quote_status,
      created_at: row.quote_created_at,
    },
    {
      id: row.quote_author_id,
      handle: row.quote_author_handle ?? '',
      display_name: row.quote_author_display_name ?? '',
      avatar_url: row.quote_author_avatar_url,
    },
  )
}

/** 1 件の投稿を PostDto で返す（無ければ undefined） */
export async function findPost(
  db: Database,
  id: string,
  viewerId: string,
): Promise<PostDto | undefined> {
  return (await hydratePosts(db, [id], viewerId)).get(id)
}

/** 「ID と、リポストした人」の並びを、その順のまま PostDto の配列にする（タイムライン用） */
export async function hydrateFeed(
  db: Database,
  entries: { postId: string; repostedBy: UserSummaryDto | null }[],
  viewerId: string,
): Promise<PostDto[]> {
  const posts = await hydratePosts(db, [...new Set(entries.map((entry) => entry.postId))], viewerId)
  return entries.flatMap((entry) => {
    const post = posts.get(entry.postId)
    return post ? [{ ...post, repostedBy: entry.repostedBy }] : []
  })
}

/** ID の並びを、その順のまま PostDto の配列にする */
export async function hydrateInOrder(
  db: Database,
  ids: string[],
  viewerId: string,
): Promise<PostDto[]> {
  return hydrateFeed(
    db,
    ids.map((postId) => ({ postId, repostedBy: null })),
    viewerId,
  )
}

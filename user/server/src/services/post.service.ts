// 投稿: 作成（リプライ・引用・画像・ハッシュタグ・メンション）・詳細・リプライ一覧・削除・反応（いいね等）・ブックマーク一覧。

import type { Database } from '@xclone/db'
import type {
  CreatePostInput,
  CursorPageQuery,
  PostDetailDto,
  PostDto,
  PostPage,
} from '@xclone/shared'
import type { AppDeps } from '../deps'
import type { NewNotification } from './notification.service'
import { sql } from '@xclone/db'
import { ERROR_CODES, extractHashtags, extractMentions } from '@xclone/shared'
import { forbidden, notFound } from '../errors'
import { decodeCursor, paginate, timeCursorSchema } from '../lib/cursor'
import { assertOwnMediaUrls } from '../lib/media-url'
import { findPost, hydrateInOrder } from '../queries/posts'
import { deliverNotifications, insertNotifications } from './notification.service'

const postNotFound = () => notFound('この投稿は存在しません', ERROR_CODES.POST_NOT_FOUND)

/** 表示中の投稿を探す（無い・削除済み・非表示なら 404）。リプライ先・引用元・反応の対象の確認に使う */
async function findVisiblePost(db: Database, postId: string) {
  const post = await db
    .selectFrom('posts')
    .select(['id', 'author_id'])
    .where('id', '=', postId)
    .where('status', '=', 'visible')
    .executeTakeFirst()
  if (!post) throw postNotFound()
  return post
}

// ---------------------------------------------------------------- 作成
/**
 * 投稿を作成する。1 つのトランザクションで次を行い、コミット後に通知を届ける:
 *   1. 投稿を保存  2. ハッシュタグを登録して紐づけ  3. 通知を作成（リプライ先・引用元・メンションされた人）
 */
export async function createPost(
  deps: AppDeps,
  authorId: string,
  input: CreatePostInput,
): Promise<PostDto> {
  const { db } = deps
  // 画像はこのサーバーにアップロードした画像だけ（外部 URL・javascript: を保存させない）
  assertOwnMediaUrls(input.mediaUrls)
  const replyTarget = input.replyToId ? await findVisiblePost(db, input.replyToId) : undefined
  const quoteTarget = input.quoteOfId ? await findVisiblePost(db, input.quoteOfId) : undefined

  const { postId, notificationIds } = await db.transaction().execute(async (trx) => {
    const post = await trx
      .insertInto('posts')
      .values({
        author_id: authorId,
        content: input.content,
        media_urls: input.mediaUrls,
        reply_to_id: replyTarget?.id ?? null,
        quote_of_id: quoteTarget?.id ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    await attachHashtags(trx, post.id, input.content)

    const notifications: NewNotification[] = []
    if (replyTarget)
      notifications.push({
        recipientId: replyTarget.author_id,
        actorId: authorId,
        type: 'reply',
        postId: post.id,
      })
    if (quoteTarget)
      notifications.push({
        recipientId: quoteTarget.author_id,
        actorId: authorId,
        type: 'quote',
        postId: post.id,
      })
    for (const mentionedId of await findMentionedUserIds(trx, input.content)) {
      // リプライ先の人には「リプライ」の通知が行くので、メンションの通知は重ねない
      if (mentionedId !== replyTarget?.author_id) {
        notifications.push({
          recipientId: mentionedId,
          actorId: authorId,
          type: 'mention',
          postId: post.id,
        })
      }
    }
    return { postId: post.id, notificationIds: await insertNotifications(trx, notifications) }
  })

  await deliverNotifications(deps, notificationIds)
  const created = await findPost(db, postId, authorId)
  if (!created) throw postNotFound()
  return created
}

/** 本文のハッシュタグを登録し（既存ならそのまま使う）、投稿と紐づける */
async function attachHashtags(db: Database, postId: string, content: string): Promise<void> {
  const tags = extractHashtags(content)
  if (tags.length === 0) return

  // 1) 無いタグだけ作る。既にあるタグの行には触らない
  //    （「同じ値で更新」すると、人気のタグの行がロックされ、そのタグを含む投稿どうしが順番待ちになるため）
  await db
    .insertInto('hashtags')
    .values(tags.map((tag) => ({ tag })))
    .onConflict((oc) => oc.column('tag').doNothing())
    .execute()
  // 2) 既存・新規をまとめて ID を取り出す
  const hashtags = await db.selectFrom('hashtags').select('id').where('tag', 'in', tags).execute()

  await db
    .insertInto('post_hashtags')
    .values(hashtags.map((hashtag) => ({ post_id: postId, hashtag_id: hashtag.id })))
    .execute()
}

/** 本文でメンションされた（実在する）ユーザーの ID */
async function findMentionedUserIds(db: Database, content: string): Promise<string[]> {
  const handles = extractMentions(content)
  if (handles.length === 0) return []
  const users = await db
    .selectFrom('users')
    .select('id')
    .where((eb) => eb(eb.fn('lower', ['handle']), 'in', handles))
    .execute()
  return users.map((user) => user.id)
}

// ---------------------------------------------------------------- 表示
/** 投稿詳細（投稿 + リプライの最初のページ）。削除済み・非表示でも「削除されました」の表示用に返す */
export async function getPostDetail(
  db: Database,
  postId: string,
  viewerId: string,
  query: CursorPageQuery,
): Promise<PostDetailDto> {
  const post = await findPost(db, postId, viewerId)
  if (!post) throw postNotFound()
  return { post, replies: await listReplies(db, postId, viewerId, query) }
}

/** リプライ一覧（古い順。会話の流れのとおりに読めるように） */
export async function listReplies(
  db: Database,
  postId: string,
  viewerId: string,
  query: CursorPageQuery,
): Promise<PostPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor, timeCursorSchema) : undefined
  const { rows } = await sql<{ id: string; cursor_at: string }>`
    SELECT p.id, p.created_at::text AS cursor_at
    FROM posts p
    WHERE p.reply_to_id = ${postId} AND p.status = 'visible'
      ${cursor ? sql`AND (p.created_at, p.id) > (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : sql``}
    ORDER BY p.created_at ASC, p.id ASC
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

// ---------------------------------------------------------------- 削除
/** 自分の投稿を削除する（行は残し、状態を「削除済み」にする。リプライや通報の参照を壊さないため） */
export async function deletePost(db: Database, userId: string, postId: string): Promise<void> {
  const post = await db
    .selectFrom('posts')
    .select(['author_id', 'status'])
    .where('id', '=', postId)
    .executeTakeFirst()
  if (!post || post.status === 'deleted') throw postNotFound()
  if (post.author_id !== userId) throw forbidden('自分の投稿だけを削除できます')

  await db
    .updateTable('posts')
    .set({ status: 'deleted', status_changed_at: new Date() })
    .where('id', '=', postId)
    .execute()
}

// ---------------------------------------------------------------- 反応（いいね・リポスト・ブックマーク）
export type ReactionKind = 'like' | 'repost' | 'bookmark'

const REACTION_TABLES = { like: 'likes', repost: 'reposts', bookmark: 'bookmarks' } as const

/**
 * 反応を付ける（on=true）/ 外す（on=false）。何度押しても結果は同じ（冪等）。
 * いいね・リポストを新しく付けたときだけ、投稿者に通知する（ブックマークは本人しか知らないので通知しない）。
 * @returns 反応後の投稿（件数と、見ている人の反応の状態が更新されたもの）
 */
export async function setReaction(
  deps: AppDeps,
  userId: string,
  postId: string,
  kind: ReactionKind,
  on: boolean,
): Promise<PostDto> {
  const { db } = deps
  const post = await findVisiblePost(db, postId)
  const table = REACTION_TABLES[kind]

  if (on) {
    const notificationIds = await db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto(table)
        .values({ user_id: userId, post_id: postId })
        .onConflict((oc) => oc.doNothing())
        .returning('post_id')
        .executeTakeFirst()
      if (!inserted || kind === 'bookmark') return []
      return insertNotifications(trx, [
        { recipientId: post.author_id, actorId: userId, type: kind, postId },
      ])
    })
    await deliverNotifications(deps, notificationIds)
  } else {
    await db.deleteFrom(table).where('user_id', '=', userId).where('post_id', '=', postId).execute()
  }

  const updated = await findPost(db, postId, userId)
  if (!updated) throw postNotFound()
  return updated
}

/** ブックマーク一覧（新しく保存した順） */
export async function listBookmarks(
  db: Database,
  userId: string,
  query: CursorPageQuery,
): Promise<PostPage> {
  const cursor = query.cursor ? decodeCursor(query.cursor, timeCursorSchema) : undefined
  const { rows } = await sql<{ id: string; cursor_at: string }>`
    SELECT p.id, b.created_at::text AS cursor_at
    FROM bookmarks b JOIN posts p ON p.id = b.post_id
    WHERE b.user_id = ${userId} AND p.status = 'visible'
      ${cursor ? sql`AND (b.created_at, p.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : sql``}
    ORDER BY b.created_at DESC, p.id DESC
    LIMIT ${query.limit + 1}
  `.execute(db)

  const page = paginate(rows, query.limit, (last) => ({ t: last.cursor_at, id: last.id }))
  return {
    items: await hydrateInOrder(
      db,
      page.items.map((row) => row.id),
      userId,
    ),
    nextCursor: page.nextCursor,
  }
}

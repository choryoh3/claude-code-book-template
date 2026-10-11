// ユーザー: 自分の情報・プロフィール・プロフィールの更新・フォロー・フォロー一覧・プロフィールの各タブ。

import type { Database } from '@xclone/db'
import type {
  CurrentUserDto,
  CursorPageQuery,
  PostPage,
  UpdateProfileInput,
  UserPage,
  UserProfileDto,
} from '@xclone/shared'
import type { AppDeps } from '../deps'
import type { UserSummaryRow } from '../mappers'
import { sql } from '@xclone/db'
import { ERROR_CODES } from '@xclone/shared'
import { badRequest, notFound } from '../errors'
import { decodeCursor, paginate, timeCursorSchema } from '../lib/cursor'
import { assertOwnMediaUrls } from '../lib/media-url'
import { toIso, toUserSummary } from '../mappers'
import { hydrateInOrder } from '../queries/posts'
import { deliverNotifications, insertNotifications } from './notification.service'

const userNotFound = () => notFound('このアカウントは存在しません', ERROR_CODES.USER_NOT_FOUND)

/** ログイン中の自分の情報 */
export async function getCurrentUser(db: Database, userId: string): Promise<CurrentUserDto> {
  const user = await db
    .selectFrom('users')
    .select(['id', 'handle', 'display_name', 'avatar_url', 'email', 'role'])
    .where('id', '=', userId)
    .executeTakeFirst()
  if (!user) throw userNotFound()
  return { ...toUserSummary(user), email: user.email, role: user.role }
}

/** ハンドル名がまだ使われていないか（登録画面の入力中の確認） */
export async function isHandleAvailable(db: Database, handle: string): Promise<boolean> {
  const found = await db
    .selectFrom('users')
    .select('id')
    .where((eb) => eb(eb.fn('lower', ['handle']), '=', handle.toLowerCase()))
    .executeTakeFirst()
  return !found
}

interface ProfileRow extends UserSummaryRow {
  bio: string
  header_url: string | null
  created_at: Date
  is_suspended: boolean
  follower_count: number
  following_count: number
  post_count: number
  is_following: boolean
}

/** プロフィール（フォロー数などの集計と、見ている人がフォローしているか） */
export async function getProfile(
  db: Database,
  handle: string,
  viewerId: string,
): Promise<UserProfileDto> {
  const { rows } = await sql<ProfileRow>`
    SELECT
      u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.header_url, u.created_at, u.is_suspended,
      (SELECT count(*) FROM follows f WHERE f.followee_id = u.id) AS follower_count,
      (SELECT count(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
      (SELECT count(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'visible') AS post_count,
      EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${viewerId} AND f.followee_id = u.id) AS is_following
    FROM users u
    WHERE lower(u.handle) = lower(${handle})
  `.execute(db)

  const row = rows[0]
  if (!row) throw userNotFound()

  // 凍結中のアカウントは、画面に「このアカウントは凍結されています」だけを出す仕様（U-05）。
  // 隠すのを画面任せにせず、API でも自己紹介・画像・件数を返さない
  if (row.is_suspended && row.id !== viewerId) {
    return {
      ...toUserSummary({ ...row, avatar_url: null }),
      bio: '',
      headerUrl: null,
      createdAt: toIso(row.created_at),
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      isSuspended: true,
      isFollowing: false,
      isSelf: false,
    }
  }
  return {
    ...toUserSummary(row),
    bio: row.bio,
    headerUrl: row.header_url,
    createdAt: toIso(row.created_at),
    followerCount: row.follower_count,
    followingCount: row.following_count,
    postCount: row.post_count,
    isSuspended: row.is_suspended,
    isFollowing: row.is_following,
    isSelf: row.id === viewerId,
  }
}

/** プロフィールの更新（送られた項目だけ）。更新後のプロフィールを返す */
export async function updateProfile(
  db: Database,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfileDto> {
  assertOwnMediaUrls([input.avatarUrl, input.headerUrl])
  const changes = {
    ...(input.displayName !== undefined && { display_name: input.displayName }),
    ...(input.bio !== undefined && { bio: input.bio }),
    ...(input.avatarUrl !== undefined && { avatar_url: input.avatarUrl }),
    ...(input.headerUrl !== undefined && { header_url: input.headerUrl }),
  }
  if (Object.keys(changes).length > 0) {
    await db.updateTable('users').set(changes).where('id', '=', userId).execute()
  }
  const { handle } = await getCurrentUser(db, userId)
  return getProfile(db, handle, userId)
}

/** ハンドル名からユーザーを探す（見つからなければ 404） */
async function findUserIdByHandle(db: Database, handle: string): Promise<string> {
  return (await findUserByHandle(db, handle)).id
}

/** ハンドル名からユーザーと凍結の状態を探す（見つからなければ 404） */
async function findUserByHandle(db: Database, handle: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'is_suspended'])
    .where((eb) => eb(eb.fn('lower', ['handle']), '=', handle.toLowerCase()))
    .executeTakeFirst()
  if (!user) throw userNotFound()
  return user
}

/** 凍結中のユーザーの一覧（投稿・フォロー）は空で返す（プロフィールと同じく、中身を見せない） */
const EMPTY_PAGE = { items: [], nextCursor: null }

/** フォローする（すでにフォロー中なら何もしない）。フォローされた人に通知する */
export async function follow(
  deps: AppDeps,
  viewerId: string,
  handle: string,
): Promise<UserProfileDto> {
  const targetId = await findUserIdByHandle(deps.db, handle)
  if (targetId === viewerId) throw badRequest('自分自身はフォローできません')

  const notificationIds = await deps.db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('follows')
      .values({ follower_id: viewerId, followee_id: targetId })
      .onConflict((oc) => oc.doNothing())
      .returning('follower_id')
      .executeTakeFirst()
    // 新しくフォローしたときだけ通知する（連打で通知が増えないように）
    return inserted
      ? insertNotifications(trx, [
          { recipientId: targetId, actorId: viewerId, type: 'follow', postId: null },
        ])
      : []
  })
  await deliverNotifications(deps, notificationIds)
  return getProfile(deps.db, handle, viewerId)
}

/** フォローを解除する（フォローしていなければ何もしない） */
export async function unfollow(
  db: Database,
  viewerId: string,
  handle: string,
): Promise<UserProfileDto> {
  const targetId = await findUserIdByHandle(db, handle)
  await db
    .deleteFrom('follows')
    .where('follower_id', '=', viewerId)
    .where('followee_id', '=', targetId)
    .execute()
  return getProfile(db, handle, viewerId)
}

/** フォロワー一覧（direction=followers）/ フォロー中一覧（direction=following）。フォローした日時の新しい順 */
export async function listFollows(
  db: Database,
  handle: string,
  direction: 'followers' | 'following',
  query: CursorPageQuery,
): Promise<UserPage> {
  const target = await findUserByHandle(db, handle)
  if (target.is_suspended) return EMPTY_PAGE
  const targetId = target.id
  // followers: 「target をフォローしている人」= follower 側の人を並べる。following はその逆
  const [matchColumn, userColumn] =
    direction === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id']
  const cursor = query.cursor ? decodeCursor(query.cursor, timeCursorSchema) : undefined

  const { rows } = await sql<UserSummaryRow & { cursor_at: string }>`
    SELECT u.id, u.handle, u.display_name, u.avatar_url, f.created_at::text AS cursor_at
    FROM follows f
    JOIN users u ON u.id = f.${sql.ref(userColumn)}
    WHERE f.${sql.ref(matchColumn)} = ${targetId}
      ${cursor ? sql`AND (f.created_at, u.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : sql``}
    ORDER BY f.created_at DESC, u.id DESC
    LIMIT ${query.limit + 1}
  `.execute(db)

  const page = paginate(rows, query.limit, (last) => ({ t: last.cursor_at, id: last.id }))
  return { items: page.items.map(toUserSummary), nextCursor: page.nextCursor }
}

/** プロフィールのタブ（投稿 / 返信 / メディア / いいね）で出す投稿の条件 */
export type ProfileTab = 'posts' | 'replies' | 'media' | 'likes'

/** プロフィールの各タブの投稿一覧（新しい順・cursor ページネーション） */
export async function listProfilePosts(
  db: Database,
  handle: string,
  tab: ProfileTab,
  viewerId: string,
  query: CursorPageQuery,
): Promise<PostPage> {
  const target = await findUserByHandle(db, handle)
  if (target.is_suspended) return EMPTY_PAGE
  const userId = target.id
  const cursor = query.cursor ? decodeCursor(query.cursor, timeCursorSchema) : undefined
  const limit = query.limit + 1

  // 「いいね」タブは「いいねした日時」の順、それ以外は「投稿した日時」の順に並べる
  const { rows } =
    tab === 'likes'
      ? await sql<{ id: string; cursor_at: string }>`
          SELECT p.id, l.created_at::text AS cursor_at
          FROM likes l JOIN posts p ON p.id = l.post_id
          WHERE l.user_id = ${userId} AND p.status = 'visible'
            ${cursor ? sql`AND (l.created_at, p.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : sql``}
          ORDER BY l.created_at DESC, p.id DESC
          LIMIT ${limit}
        `.execute(db)
      : await sql<{ id: string; cursor_at: string }>`
          SELECT p.id, p.created_at::text AS cursor_at
          FROM posts p
          WHERE p.author_id = ${userId} AND p.status = 'visible'
            ${tab === 'posts' ? sql`AND p.reply_to_id IS NULL` : sql``}
            ${tab === 'replies' ? sql`AND p.reply_to_id IS NOT NULL` : sql``}
            ${tab === 'media' ? sql`AND cardinality(p.media_urls) > 0` : sql``}
            ${cursor ? sql`AND (p.created_at, p.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : sql``}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ${limit}
        `.execute(db)

  const page = paginate(rows, query.limit, (last) => ({ t: last.cursor_at, id: last.id }))
  const items = await hydrateInOrder(
    db,
    page.items.map((row) => row.id),
    viewerId,
  )
  return { items, nextCursor: page.nextCursor }
}

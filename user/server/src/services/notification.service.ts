// 通知: 作成・一覧・未読件数・既読化。作成した通知は Notifier でリアルタイムに届ける（skill: realtime-socket）。
//
// 作成の流れ: 操作（いいね等）と同じトランザクションで insertNotifications → コミット後に deliverNotifications。
// 「DB に保存してから送る」ので、送信に失敗しても通知一覧の API で後から取り戻せる。

import type { Database } from '@xclone/db'
import type { NotificationDto, NotificationListQuery, NotificationPage } from '@xclone/shared'
import type { AppDeps } from '../deps'
import type { PostSummaryRow } from '../mappers'
import { sql } from '@xclone/db'
import { decodeCursor, paginate, timeCursorSchema } from '../lib/cursor'
import { logger } from '../logger'
import { toIso, toPostSummary, toUserSummary } from '../mappers'

export interface NewNotification {
  recipientId: string
  actorId: string
  type: NotificationDto['type']
  postId: string | null
}

/**
 * 通知を保存する（トランザクションの中で呼ぶ）。自分の操作による通知と、同じ内容の重複は除く。
 * @returns 作成した通知の ID（コミット後に deliverNotifications に渡す）
 */
export async function insertNotifications(
  db: Database,
  items: NewNotification[],
): Promise<string[]> {
  const seen = new Set<string>()
  const rows = items.filter((item) => {
    const key = `${item.recipientId}:${item.type}:${item.postId ?? ''}`
    if (item.recipientId === item.actorId || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (rows.length === 0) return []

  // 同じ人が同じ操作を「外して・また付けて」を繰り返しても、通知を増やさない（通知の連打を防ぐ）
  const existing = await db
    .selectFrom('notifications')
    .select(['recipient_id', 'actor_id', 'type', 'post_id'])
    .where((eb) =>
      eb.or(
        rows.map((row) =>
          eb.and([
            eb('recipient_id', '=', row.recipientId),
            eb('actor_id', '=', row.actorId),
            eb('type', '=', row.type),
            row.postId === null ? eb('post_id', 'is', null) : eb('post_id', '=', row.postId),
          ]),
        ),
      ),
    )
    .execute()
  const existingKeys = new Set(
    existing.map((row) => `${row.recipient_id}:${row.actor_id}:${row.type}:${row.post_id ?? ''}`),
  )
  const fresh = rows.filter(
    (row) => !existingKeys.has(`${row.recipientId}:${row.actorId}:${row.type}:${row.postId ?? ''}`),
  )
  if (fresh.length === 0) return []

  const inserted = await db
    .insertInto('notifications')
    .values(
      fresh.map((row) => ({
        recipient_id: row.recipientId,
        actor_id: row.actorId,
        type: row.type,
        post_id: row.postId,
      })),
    )
    .returning('id')
    .execute()
  return inserted.map((row) => row.id)
}

/** 保存済みの通知を、受け取る人の画面へ送る（新しい通知 + 最新の未読件数） */
export async function deliverNotifications(
  { db, notifier }: AppDeps,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  try {
    const notifications = await fetchNotifications(
      db,
      sql`n.id = ANY(${ids}::uuid[])`,
      'ASC',
      ids.length,
    )
    for (const { recipientId, dto } of notifications) notifier.sendNotification(recipientId, dto)

    // 未読件数は、受け取る人の分をまとめて 1 回の SQL で数える（1 人ずつ数えると N+1 になる）
    const recipientIds = [...new Set(notifications.map((item) => item.recipientId))]
    for (const [recipientId, count] of await countUnreadByRecipient(db, recipientIds)) {
      notifier.sendUnreadCount(recipientId, count)
    }
  } catch (error) {
    // 配信の失敗で、元の操作（いいね等）を失敗扱いにはしない。通知は DB にあるので一覧から取り戻せる
    logger.warn({ err: error }, 'notification.deliver.failed')
  }
}

/** 通知一覧（新しい順・cursor ページネーション） */
export async function listNotifications(
  db: Database,
  userId: string,
  query: NotificationListQuery,
): Promise<NotificationPage> {
  const conditions = [sql`n.recipient_id = ${userId}`]
  if (query.filter === 'mentions') conditions.push(sql`n.type = 'mention'`)
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor, timeCursorSchema)
    conditions.push(sql`(n.created_at, n.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)`)
  }

  const rows = await fetchNotifications(
    db,
    sql.join(conditions, sql` AND `),
    'DESC',
    query.limit + 1,
  )
  const page = paginate(rows, query.limit, (last) => ({ t: last.cursorAt, id: last.dto.id }))
  return { items: page.items.map((row) => row.dto), nextCursor: page.nextCursor }
}

/** 未読件数（未読だけの部分インデックス notifications_unread_idx を使う） */
export async function countUnread(db: Database, userId: string): Promise<number> {
  const row = await db
    .selectFrom('notifications')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('recipient_id', '=', userId)
    .where('is_read', '=', false)
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

/** 複数の人の未読件数をまとめて数える（未読が 0 の人も 0 として含める） */
async function countUnreadByRecipient(
  db: Database,
  userIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map(userIds.map((id) => [id, 0]))
  if (userIds.length === 0) return counts
  const rows = await db
    .selectFrom('notifications')
    .select((eb) => ['recipient_id', eb.fn.countAll<number>().as('count')])
    .where('recipient_id', 'in', userIds)
    .where('is_read', '=', false)
    .groupBy('recipient_id')
    .execute()
  for (const row of rows) counts.set(row.recipient_id, Number(row.count))
  return counts
}

/** 自分宛ての通知をすべて既読にする。開いている他のタブのバッジも 0 にする */
export async function markAllRead({ db, notifier }: AppDeps, userId: string): Promise<number> {
  await db
    .updateTable('notifications')
    .set({ is_read: true })
    .where('recipient_id', '=', userId)
    .where('is_read', '=', false)
    .execute()
  notifier.sendUnreadCount(userId, 0)
  return 0
}

// ---------------------------------------------------------------- 内部: 通知の取得と DTO への変換
interface NotificationRow {
  id: string
  recipient_id: string
  type: NotificationDto['type']
  is_read: boolean
  created_at: Date
  /** cursor 用。created_at を精度を落とさずに文字列で取り出したもの（lib/cursor.ts 参照） */
  cursor_at: string
  actor_id: string
  actor_handle: string
  actor_display_name: string
  actor_avatar_url: string | null
  post_id: string | null
  post_content: string | null
  post_media_urls: string[] | null
  post_status: PostSummaryRow['status'] | null
  post_created_at: Date | null
  post_author_id: string | null
  post_author_handle: string | null
  post_author_display_name: string | null
  post_author_avatar_url: string | null
}

/** 通知を、実行した人・対象の投稿（とその投稿者）と一緒に 1 回の SQL で取る */
async function fetchNotifications(
  db: Database,
  where: ReturnType<typeof sql>,
  order: 'ASC' | 'DESC',
  limit: number,
) {
  const { rows } = await sql<NotificationRow>`
    SELECT
      n.id, n.recipient_id, n.type, n.is_read, n.created_at, n.created_at::text AS cursor_at,
      a.id AS actor_id, a.handle AS actor_handle, a.display_name AS actor_display_name, a.avatar_url AS actor_avatar_url,
      p.id AS post_id, p.content AS post_content, p.media_urls AS post_media_urls,
      p.status AS post_status, p.created_at AS post_created_at,
      pa.id AS post_author_id, pa.handle AS post_author_handle,
      pa.display_name AS post_author_display_name, pa.avatar_url AS post_author_avatar_url
    FROM notifications n
    JOIN users a ON a.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    LEFT JOIN users pa ON pa.id = p.author_id
    WHERE ${where}
    ORDER BY n.created_at ${sql.raw(order)}, n.id ${sql.raw(order)}
    LIMIT ${limit}
  `.execute(db)
  return rows.map((row) => ({
    recipientId: row.recipient_id,
    cursorAt: row.cursor_at,
    dto: toNotificationDto(row),
  }))
}

function toNotificationDto(row: NotificationRow): NotificationDto {
  const actor = {
    id: row.actor_id,
    handle: row.actor_handle,
    display_name: row.actor_display_name,
    avatar_url: row.actor_avatar_url,
  }
  const hasPost = row.post_id && row.post_status && row.post_created_at && row.post_author_id
  return {
    id: row.id,
    type: row.type,
    actor: toUserSummary(actor),
    post: hasPost
      ? toPostSummary(
          {
            id: row.post_id ?? '',
            content: row.post_content ?? '',
            media_urls: row.post_media_urls ?? [],
            status: row.post_status ?? 'deleted',
            created_at: row.post_created_at ?? new Date(0),
          },
          {
            id: row.post_author_id ?? '',
            handle: row.post_author_handle ?? '',
            display_name: row.post_author_display_name ?? '',
            avatar_url: row.post_author_avatar_url,
          },
        )
      : null,
    isRead: row.is_read,
    createdAt: toIso(row.created_at),
  }
}

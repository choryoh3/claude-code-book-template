// seed の通知: 実際に起きた出来事（いいね・リポスト・フォロー・リプライ・引用・メンション）から作る。
// 受信者ごとに「直近の N 件」だけを入れる（全件入れるとデータが膨らむため）。新しいものを未読にする。
import type { Insertable } from 'kysely'
import type { Notifications, NotificationType } from '../src/generated/db'
import type { SeedEvent, SeedPost, SeedUser } from './types'
import { stableUuid } from './random'

/** 受信者ごとに残す通知の件数。alice は一覧・無限スクロール・未読バッジの確認用に多めにする */
const KEEP_PER_RECIPIENT: Record<string, number> = { alice: 30, bob: 14, carol: 14 }
const KEEP_DEFAULT = 2
/** 受信者ごとの未読件数（新しいほうから数える） */
const UNREAD_PER_RECIPIENT: Record<string, number> = { alice: 8, bob: 3, carol: 3 }
const UNREAD_DEFAULT = 1

const MENTION_PATTERN = /@(\w{3,15})/g

/** 通知になる前の「候補」 */
interface Candidate {
  recipientId: string
  actorId: string
  type: NotificationType
  postId: string | null
  at: Date
}

export function buildNotifications(
  users: SeedUser[],
  posts: SeedPost[],
  events: SeedEvent[],
): Insertable<Notifications>[] {
  const userByHandle = new Map(users.map((user) => [user.handle, user]))
  const userById = new Map(users.map((user) => [user.id, user]))
  const postById = new Map(posts.map((post) => [post.id, post]))
  const candidates: Candidate[] = []

  // 1) いいね・リポスト・フォロー（social.ts が作った出来事）
  for (const event of events) {
    candidates.push({
      recipientId: event.recipientId,
      actorId: event.actorId,
      type: event.type,
      postId: event.postId,
      at: event.at,
    })
  }

  // 2) リプライ・引用・メンション（投稿そのものから作る）
  for (const post of posts) {
    if (post.status !== 'visible') continue

    const parent = post.replyToId ? postById.get(post.replyToId) : undefined
    if (parent) {
      candidates.push({
        recipientId: parent.authorId,
        actorId: post.authorId,
        type: 'reply',
        postId: post.id,
        at: post.createdAt,
      })
    }

    const quoted = post.quoteOfId ? postById.get(post.quoteOfId) : undefined
    if (quoted) {
      candidates.push({
        recipientId: quoted.authorId,
        actorId: post.authorId,
        type: 'quote',
        postId: post.id,
        at: post.createdAt,
      })
    }

    for (const match of post.content.matchAll(MENTION_PATTERN)) {
      const mentioned = userByHandle.get(match[1] ?? '')
      // リプライ先の人には「リプライ」の通知が行くので、メンションの通知は重ねない
      if (!mentioned || mentioned.id === parent?.authorId) continue
      candidates.push({
        recipientId: mentioned.id,
        actorId: post.authorId,
        type: 'mention',
        postId: post.id,
        at: post.createdAt,
      })
    }
  }

  // 3) 絞り込み: 自分宛て・管理者宛て・対象の投稿が表示できないものを除き、受信者ごとに直近だけ残す
  const valid = candidates.filter((candidate) => {
    const recipient = userById.get(candidate.recipientId)
    if (!recipient || recipient.role === 'admin' || candidate.recipientId === candidate.actorId)
      return false
    const post = candidate.postId ? postById.get(candidate.postId) : undefined
    return candidate.postId === null || post?.status === 'visible'
  })

  // 受信者ごとにまとめる
  const byRecipient = new Map<string, Candidate[]>()
  for (const candidate of valid) {
    const list = byRecipient.get(candidate.recipientId) ?? []
    list.push(candidate)
    byRecipient.set(candidate.recipientId, list)
  }

  // 受信者ごとに、新しいものから N 件残し、さらに新しいほうの数件を未読にする
  const selected: { candidate: Candidate; isRead: boolean }[] = []
  for (const [recipientId, list] of byRecipient) {
    const handle = userById.get(recipientId)?.handle ?? ''
    const newestFirst = [...list].sort((a, b) => b.at.getTime() - a.at.getTime())
    const kept = newestFirst.slice(0, KEEP_PER_RECIPIENT[handle] ?? KEEP_DEFAULT)
    const unreadCount = UNREAD_PER_RECIPIENT[handle] ?? UNREAD_DEFAULT
    kept.forEach((candidate, index) => selected.push({ candidate, isRead: index >= unreadCount }))
  }

  // 古い順に並べて DB の行にする（同じ時刻なら ID で順序を固定し、毎回同じ結果にする）
  return selected
    .map(({ candidate, isRead }) => ({
      at: candidate.at,
      row: {
        id: stableUuid(
          `notification:${candidate.recipientId}:${candidate.actorId}:${candidate.type}:${candidate.postId ?? ''}`,
        ),
        recipient_id: candidate.recipientId,
        actor_id: candidate.actorId,
        type: candidate.type,
        post_id: candidate.postId,
        is_read: isRead,
        created_at: candidate.at,
      } satisfies Insertable<Notifications>,
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.row.id.localeCompare(b.row.id))
    .map(({ row }) => row)
}

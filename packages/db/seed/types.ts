// seed の各ファイルで共有する型。
// DB に入れる行（Insertable）とは別に、「あとで関連づけるために覚えておく情報」をここで定義する。

import type { PostStatus } from '../src/generated/db'

/** seed で作ったユーザー（投稿・フォローなどを作るとき、誰が誰かを参照するために使う） */
export interface SeedUser {
  id: string
  handle: string
  role: 'user' | 'admin'
  createdAt: Date
  isSuspended: boolean
}

/** seed で作った投稿 */
export interface SeedPost {
  id: string
  authorId: string
  authorHandle: string
  content: string
  mediaUrls: string[]
  replyToId: string | null
  quoteOfId: string | null
  status: PostStatus
  statusChangedAt: Date | null
  createdAt: Date
}

/** 「誰かが何かをした」という出来事（いいね・リポスト・フォローなど）。通知の元になる */
export interface SeedEvent {
  type: 'like' | 'repost' | 'follow'
  actorId: string
  /** 対象の投稿（フォローのときは null） */
  postId: string | null
  /** 通知を受け取る人 */
  recipientId: string
  at: Date
}

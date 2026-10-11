// DB の行（snake_case）を、画面に返す DTO（camelCase、packages/shared の型）に変換する関数。
// DB の行をそのまま返さない（password_hash などの流出を防ぎ、DB の構造の変更が画面に波及しないようにする）。

import type { PostSummaryDto, UserSummaryDto } from '@xclone/shared'

/** Date を ISO 8601 の文字列に（API の日時は文字列で受け渡す） */
export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export interface UserSummaryRow {
  id: string
  handle: string
  display_name: string
  avatar_url: string | null
}

export function toUserSummary(row: UserSummaryRow): UserSummaryDto {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }
}

export interface PostSummaryRow {
  id: string
  content: string
  media_urls: string[]
  status: PostSummaryDto['status']
  created_at: Date
}

/**
 * 投稿の最小情報（引用元・通知の対象など）。
 * 削除済み・非表示の投稿は、本文と画像を空にして status だけを返す（中身を漏らさない）。
 */
export function toPostSummary(row: PostSummaryRow, author: UserSummaryRow): PostSummaryDto {
  const isVisible = row.status === 'visible'
  return {
    id: row.id,
    author: toUserSummary(author),
    content: isVisible ? row.content : '',
    mediaUrls: isVisible ? row.media_urls : [],
    status: row.status,
    createdAt: toIso(row.created_at),
  }
}

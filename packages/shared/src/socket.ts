// Socket.IO のイベント名と、送受信するデータの型。
// server と client が同じ型で `Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>` を作ることで、
// イベント名の打ち間違いや、データの形のズレをコンパイル時に見つけられる（skill: realtime-socket）。

import type { NotificationDto, UnreadCountDto } from './schemas/notification'
import { z } from 'zod'
import { notificationDtoSchema, unreadCountDtoSchema } from './schemas/notification'

/** イベント名。文字列を直接書かず、必ずこの定数を使う */
export const SOCKET_EVENTS = {
  /** server → client: 新しい通知が届いた */
  NOTIFICATION_NEW: 'notification:new',
  /** server → client: 未読件数が変わった（再接続時にも送る） */
  NOTIFICATION_UNREAD_COUNT: 'notification:unread-count',
  /** client → server: 通知を既読にした */
  NOTIFICATION_MARK_READ: 'notification:mark-read',
} as const

// ---------------------------------------------------------------- 送受信するデータ
export const notificationNewPayloadSchema = z.object({ notification: notificationDtoSchema })
export type NotificationNewPayload = z.infer<typeof notificationNewPayloadSchema>

export const unreadCountPayloadSchema = unreadCountDtoSchema

// ---------------------------------------------------------------- Socket.IO に渡す型
/** サーバーからクライアントへ送るイベント */
export interface ServerToClientEvents {
  'notification:new': (payload: { notification: NotificationDto }) => void
  'notification:unread-count': (payload: UnreadCountDto) => void
}

/** クライアントからサーバーへ送るイベント */
export interface ClientToServerEvents {
  /** 通知を既読にする。完了したら ack で結果と最新の未読件数を返す */
  'notification:mark-read': (ack: (result: { ok: boolean; unreadCount: number }) => void) => void
}

/** 接続ごとにサーバーが覚えておく情報（認証ミドルウェアが設定する） */
export interface SocketData {
  userId: string
}

/**
 * ユーザーごとの room 名。接続したら自分の room に入り、通知はこの room へ送る。
 * 複数のタブ・端末で開いていても、全部に届く。
 */
export function userRoom(userId: string): string {
  return `user:${userId}`
}

// 通知をリアルタイムに届ける窓口。service はこの Notifier を通して送るだけで、Socket.IO を直接触らない。
// （テストでは送信内容を記録するだけの Notifier に差し替えられる）

import type {
  ClientToServerEvents,
  NotificationDto,
  ServerToClientEvents,
  SocketData,
} from '@xclone/shared'
import type { Server } from 'socket.io'
import { SOCKET_EVENTS, userRoom } from '@xclone/shared'

export interface Notifier {
  /** 新しい通知を、その人の画面（開いている全てのタブ）に送る */
  sendNotification: (userId: string, notification: NotificationDto) => void
  /** 未読件数を送る（バッジの更新） */
  sendUnreadCount: (userId: string, count: number) => void
}

/** 何もしない Notifier（Socket.IO を使わない場面用） */
export const noopNotifier: Notifier = {
  sendNotification: () => {},
  sendUnreadCount: () => {},
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

/** Socket.IO を使う Notifier。ユーザーごとの room（user:<id>）に送る */
export function createSocketNotifier(io: RealtimeServer): Notifier {
  return {
    sendNotification: (userId, notification) => {
      io.to(userRoom(userId)).emit(SOCKET_EVENTS.NOTIFICATION_NEW, { notification })
    },
    sendUnreadCount: (userId, count) => {
      io.to(userRoom(userId)).emit(SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT, { count })
    },
  }
}

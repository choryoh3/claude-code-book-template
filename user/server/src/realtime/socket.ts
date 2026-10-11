// Socket.IO（リアルタイム通知）の設定（skill: realtime-socket）。
// - 接続時に access token を検証し、凍結中・無効なトークンは接続を拒否する
// - 接続したら自分の room（user:<id>）に入る。通知はこの room に送られる（notifier.ts）
// - 接続直後に未読件数を送る（切断中に届いた通知があっても、バッジが正しくなるように）

import type { Server as HttpServer } from 'node:http'
import type { AppDeps } from '../deps'
import type { RealtimeServer } from './notifier'
import { SOCKET_EVENTS, userRoom } from '@xclone/shared'
import { Server } from 'socket.io'
import { config } from '../config'
import { AppError } from '../errors'
import { logger } from '../logger'
import { authenticate, authenticateUserId } from '../middlewares/auth'
import { countUnread, markAllRead } from '../services/notification.service'

/** HTTP サーバーに Socket.IO を取り付ける（接続時の認証つき） */
export function createRealtimeServer(httpServer: HttpServer, db: AppDeps['db']): RealtimeServer {
  const io: RealtimeServer = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  })

  // 接続時の認証。失敗したら接続を拒否する（画面側には connect_error として届く）
  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth.token
      const auth = await authenticate(db, typeof token === 'string' ? token : undefined)
      socket.data.userId = auth.userId
      next()
    } catch (error) {
      next(error instanceof Error ? error : new Error('認証に失敗しました'))
    }
  })
  return io
}

/** 接続後の処理（room への参加・未読件数の送信・既読化の受付）を登録する */
export function registerRealtimeHandlers(io: RealtimeServer, deps: AppDeps): void {
  io.on('connection', async (socket) => {
    const { userId } = socket.data
    try {
      await socket.join(userRoom(userId))
      logger.debug({ userId }, 'socket.connected')
      socket.emit(SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT, {
        count: await countUnread(deps.db, userId),
      })
    } catch (error) {
      logger.warn({ err: error, userId }, 'socket.connection.setup.failed')
    }

    // ⚠ 画面から届くデータは型どおりとは限らない（ack を付けずに送られることもある）。
    // ここで例外が外に漏れると「処理されない Promise の失敗」となり、Node はプロセスごと止まってしまう。
    // そのため ack が関数かを確かめ、処理全体を try で包んで、どんな失敗も外に出さない。
    socket.on(SOCKET_EVENTS.NOTIFICATION_MARK_READ, async (ack: unknown) => {
      const reply =
        typeof ack === 'function'
          ? (ack as (result: { ok: boolean; unreadCount: number }) => void)
          : undefined
      try {
        // 接続後に凍結された場合に備えて、操作のたびにアカウントの状態を確かめる
        await authenticateUserId(deps.db, userId)
        reply?.({ ok: true, unreadCount: await markAllRead(deps, userId) })
      } catch (error) {
        logger.warn({ err: error, userId }, 'socket.mark-read.failed')
        reply?.({ ok: false, unreadCount: -1 })
        if (error instanceof AppError && error.httpStatus === 403) socket.disconnect(true)
      }
    })
  })
}

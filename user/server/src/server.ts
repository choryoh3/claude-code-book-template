// HTTP サーバー + Express アプリ + Socket.IO を 1 つに組み立てる。
// main.ts（本番・開発の起動）とテスト（Socket.IO を含めた結合テスト）の両方がこれを使う。

import type { Database } from '@xclone/db'
import type { AppDeps } from './deps'
import { createServer } from 'node:http'
import { createApp } from './app'
import { createSocketNotifier } from './realtime/notifier'
import { createRealtimeServer, registerRealtimeHandlers } from './realtime/socket'

export function createUserServer(db: Database) {
  const httpServer = createServer()
  const io = createRealtimeServer(httpServer, db)
  const deps: AppDeps = { db, notifier: createSocketNotifier(io) }

  registerRealtimeHandlers(io, deps)
  httpServer.on('request', createApp(deps))

  /** 新しい接続の受付をやめ、つながっている Socket.IO と HTTP を閉じる */
  async function close(): Promise<void> {
    await io.close() // HTTP サーバーも一緒に閉じる
  }

  return { httpServer, io, deps, close }
}

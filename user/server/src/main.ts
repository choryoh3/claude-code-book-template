// user/server の起動（`pnpm dev` / `pnpm start`）。
// 終了の合図（Ctrl+C など）を受けたら、処理中のリクエストを片付けてから DB の接続を閉じる。

import process from 'node:process'
import { closeDb, getDb } from '@xclone/db'
import { config } from './config'
import { logger } from './logger'
import { createUserServer } from './server'

const server = createUserServer(getDb())

server.httpServer.listen(config.port, () => {
  logger.info(
    { port: config.port },
    `user-server が起動しました: http://localhost:${config.port}/api/health`,
  )
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'user-server を終了します')
  await server.close()
  await closeDb()
  process.exit(0)
}

// 安全網: どこかで処理されなかった Promise の失敗があっても、サーバー全体を止めずにログに残す。
// （Node は既定では、これが 1 つでもあるとプロセスを終了してしまう。原因はログの requestId から追う）
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled.rejection')
})

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

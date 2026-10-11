// Express アプリの組み立て（ミドルウェアの順番が大事なので、上から順に読むと処理の流れになる）。
// テストでは、この createApp に別の DB や Notifier を渡して使う（サーバーを起動せずに Supertest で叩ける）。

import type { AppDeps } from './deps'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config'
import { errorHandler, notFoundHandler } from './middlewares/error-handler'
import { accessLogMiddleware, requestContextMiddleware } from './middlewares/request-context'
import { createApiRouter } from './routes'

export function createApp(deps: AppDeps): express.Express {
  const app = express()
  app.disable('x-powered-by') // 使っている技術を外に知らせない
  app.set('trust proxy', 'loopback') // 開発用の proxy（Vite）経由でも、利用者の IP を正しく取る

  // 1) 安全のための HTTP ヘッダー。画像は別オリジン（画面:5173）から読まれるので、その読み込みは許可する
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  // 2) 画面（別オリジン）からの呼び出しを許可する。Cookie（refresh token）を送れるよう credentials も許可
  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  // 3) requestId の付与とアクセスログ（これより後の全てのログに requestId が付く）
  app.use(requestContextMiddleware)
  app.use(accessLogMiddleware)
  // 4) 本文（JSON）と Cookie の読み取り
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  // 5) アップロードされた画像の配信と、API 本体
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: false }))
  app.use('/api', createApiRouter(deps))

  // 6) どこにも当てはまらない URL と、エラーの変換（必ず最後）
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

// すべてのリクエストに requestId を付け、終わったら 1 行の「アクセスログ」を出すミドルウェア。

import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { currentContext, requestContext } from '../context'
import { logger } from '../logger'

/** 外から渡された requestId は、安全な形（英数字とハイフン、64 文字まで）のときだけ引き継ぐ */
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id')
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()

  // 応答のヘッダーにも入れる（画面のエラー表示や問い合わせで使える）
  res.setHeader('X-Request-Id', requestId)
  requestContext.run({ requestId }, () => next())
}

/** リクエストの完了時に「メソッド・パス・状態・所要時間」を 1 行で記録する */
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = performance.now()

  res.on('finish', () => {
    const entry = {
      method: req.method,
      // クエリ文字列は含めない（検索語などの個人的な内容をログに残さないため）
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
      userId: currentContext()?.userId,
    }
    if (res.statusCode >= 500) logger.error(entry, 'request.failed')
    else if (res.statusCode >= 400) logger.warn(entry, 'request.rejected')
    else logger.info(entry, 'request.completed')
  })
  next()
}

// DAU（1 日に利用したユーザー数）を数えるため、ログイン中のユーザーの「今日の利用」を記録するミドルウェア。
// 1 ユーザー 1 日 1 行（daily_active_users）。同じ日の 2 回目以降は、メモリの記録で DB へのアクセスを省く。

import type { Database } from '@xclone/db'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { logger } from '../logger'

export function createActivityTracker(db: Database): RequestHandler {
  let today = ''
  const recorded = new Set<string>()

  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.auth?.userId
    if (!userId) return next()

    const date = new Date().toISOString().slice(0, 10)
    if (date !== today) {
      // 日付が変わったら、記録済みの一覧をリセットする（メモリが増え続けないように）
      today = date
      recorded.clear()
    }

    if (!recorded.has(userId)) {
      recorded.add(userId)
      try {
        await db
          .insertInto('daily_active_users')
          .values({ active_date: date, user_id: userId })
          .onConflict((oc) => oc.doNothing())
          .execute()
      } catch (error) {
        // 利用記録は「集計用」なので、失敗しても本来の操作は止めない（ログに残して調査できるようにする）
        recorded.delete(userId)
        logger.warn({ err: error }, 'activity.record.failed')
      }
    }
    next()
  }
}

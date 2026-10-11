// 通知・検索・トレンド・通報の controller。

import type { UnreadCountDto } from '@xclone/shared'
import type { Request, Response } from 'express'
import type { AppDeps } from '../deps'
import { createReportSchema, notificationListQuerySchema, searchQuerySchema } from '@xclone/shared'
import { getAuth } from '../middlewares/auth'
import * as notificationService from '../services/notification.service'
import * as reportService from '../services/report.service'
import * as searchService from '../services/search.service'

export function createMiscController(deps: AppDeps) {
  const { db } = deps

  return {
    /** GET /notifications?filter=all|mentions */
    async notifications(req: Request, res: Response) {
      const query = notificationListQuerySchema.parse(req.query)
      res.json(await notificationService.listNotifications(db, getAuth(req).userId, query))
    },

    /** GET /notifications/unread-count */
    async unreadCount(req: Request, res: Response) {
      const body: UnreadCountDto = {
        count: await notificationService.countUnread(db, getAuth(req).userId),
      }
      res.json(body)
    },

    /** POST /notifications/read — すべて既読にする */
    async markRead(req: Request, res: Response) {
      const body: UnreadCountDto = {
        count: await notificationService.markAllRead(deps, getAuth(req).userId),
      }
      res.json(body)
    },

    /** GET /search?q=&type=posts|users|tags — 種類に応じて PostPage / UserPage / HashtagPage を返す */
    async search(req: Request, res: Response) {
      const query = searchQuerySchema.parse(req.query)
      if (query.type === 'users') {
        res.json(await searchService.searchUsers(db, query))
        return
      }
      if (query.type === 'tags') {
        res.json(await searchService.searchTags(db, query))
        return
      }
      res.json(await searchService.searchPosts(db, getAuth(req).userId, query))
    },

    /** GET /trends */
    async trends(_req: Request, res: Response) {
      res.json(await searchService.getTrends(db))
    },

    /** POST /reports — 通報 */
    async report(req: Request, res: Response) {
      const input = createReportSchema.parse(req.body)
      res.status(201).json(await reportService.createReport(db, getAuth(req).userId, input))
    },
  }
}

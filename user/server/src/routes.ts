// URL と処理（controller）の対応表。ここを読めば、この API でできることが一覧できる。
// すべて `/api` の下にぶら下がる（app.ts）。一覧と入出力の型は docs/api/user.md。

import type { AppDeps } from './deps'
import { sql } from '@xclone/db'
import { ERROR_CODES } from '@xclone/shared'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { config } from './config'
import { createAuthController } from './controllers/auth.controller'
import { uploadImage, uploadMedia } from './controllers/media.controller'
import { createMiscController } from './controllers/misc.controller'
import { createPostController } from './controllers/post.controller'
import { createUserController } from './controllers/user.controller'
import { AppError } from './errors'
import { createActivityTracker } from './middlewares/activity'
import { createRequireAuth } from './middlewares/auth'

export function createApiRouter(deps: AppDeps): Router {
  const auth = createAuthController(deps)
  const users = createUserController(deps)
  const posts = createPostController(deps)
  const misc = createMiscController(deps)

  /** 画像のアップロードの回数制限（1 分あたり・IP ごと）。ディスクを使い切られないようにする */
  const mediaRateLimit = rateLimit({
    windowMs: 60_000,
    limit: config.mediaRateLimitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(ERROR_CODES.TOO_MANY_REQUESTS, 429, 'しばらくしてからお試しください')),
  })

  /** ログイン・登録の総当たり攻撃を防ぐ（1 分あたり・IP ごと） */
  const authRateLimit = rateLimit({
    windowMs: 60_000,
    limit: config.authRateLimitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(ERROR_CODES.TOO_MANY_REQUESTS, 429, 'しばらくしてからお試しください')),
  })

  // ---------------------------------------------------------------- ログイン不要
  const router = Router()
  router.get('/health', async (_req, res) => {
    await sql`SELECT 1`.execute(deps.db) // DB に繋がるかも確認する
    res.json({ status: 'ok' })
  })
  router.post('/auth/register', authRateLimit, auth.register)
  router.post('/auth/login', authRateLimit, auth.login)
  router.post('/auth/refresh', auth.refresh)
  router.post('/auth/logout', auth.logout)
  router.get('/users/availability', users.availability)

  // ---------------------------------------------------------------- ここから下はログイン必須
  const authed = Router()
  authed.use(createRequireAuth(deps.db), createActivityTracker(deps.db))

  authed.get('/me', users.me)
  authed.patch('/me', users.updateMe)

  authed.get('/users/:handle', users.profile)
  authed.get('/users/:handle/posts', users.posts)
  authed.get('/users/:handle/replies', users.replies)
  authed.get('/users/:handle/media', users.media)
  authed.get('/users/:handle/likes', users.likes)
  authed.get('/users/:handle/followers', users.followers)
  authed.get('/users/:handle/following', users.following)
  authed.post('/users/:handle/follow', users.follow)
  authed.delete('/users/:handle/follow', users.unfollow)

  authed.post('/posts', posts.create)
  authed.get('/posts/:id', posts.detail)
  authed.get('/posts/:id/replies', posts.replies)
  authed.delete('/posts/:id', posts.remove)
  authed.post('/posts/:id/like', posts.like)
  authed.delete('/posts/:id/like', posts.unlike)
  authed.post('/posts/:id/repost', posts.repost)
  authed.delete('/posts/:id/repost', posts.unrepost)
  authed.post('/posts/:id/bookmark', posts.bookmark)
  authed.delete('/posts/:id/bookmark', posts.unbookmark)

  authed.get('/timeline/following', posts.followingTimeline)
  authed.get('/timeline/for-you', posts.forYouTimeline)
  authed.get('/bookmarks', posts.bookmarks)

  authed.get('/notifications', misc.notifications)
  authed.get('/notifications/unread-count', misc.unreadCount)
  authed.post('/notifications/read', misc.markRead)

  authed.get('/search', misc.search)
  authed.get('/trends', misc.trends)
  authed.post('/reports', misc.report)
  authed.post('/media', mediaRateLimit, uploadImage, uploadMedia)

  router.use(authed)
  return router
}

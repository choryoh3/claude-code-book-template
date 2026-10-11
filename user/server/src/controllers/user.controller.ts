// ユーザー・プロフィール・フォローの controller。

import type { HandleAvailabilityResponse } from '@xclone/shared'
import type { Request, Response } from 'express'
import type { AppDeps } from '../deps'
import type { ProfileTab } from '../services/user.service'
import {
  cursorPageQuerySchema,
  handleAvailabilityQuerySchema,
  handleSchema,
  updateProfileSchema,
} from '@xclone/shared'
import { z } from 'zod'
import { getAuth } from '../middlewares/auth'
import * as userService from '../services/user.service'

const handleParamsSchema = z.object({ handle: handleSchema })

export function createUserController(deps: AppDeps) {
  const { db } = deps

  /** プロフィールの各タブ（投稿 / 返信 / メディア / いいね）の handler を作る */
  const profileTab = (tab: ProfileTab) => async (req: Request, res: Response) => {
    const { handle } = handleParamsSchema.parse(req.params)
    const query = cursorPageQuerySchema.parse(req.query)
    res.json(await userService.listProfilePosts(db, handle, tab, getAuth(req).userId, query))
  }

  return {
    /** GET /me — ログイン中の自分 */
    async me(req: Request, res: Response) {
      res.json(await userService.getCurrentUser(db, getAuth(req).userId))
    },

    /** PATCH /me — プロフィールの更新 */
    async updateMe(req: Request, res: Response) {
      const input = updateProfileSchema.parse(req.body)
      res.json(await userService.updateProfile(db, getAuth(req).userId, input))
    },

    /** GET /users/availability?handle= — ハンドル名が使えるか（ログイン不要） */
    async availability(req: Request, res: Response) {
      const { handle } = handleAvailabilityQuerySchema.parse(req.query)
      const body: HandleAvailabilityResponse = {
        available: await userService.isHandleAvailable(db, handle),
      }
      res.json(body)
    },

    /** GET /users/:handle — プロフィール */
    async profile(req: Request, res: Response) {
      const { handle } = handleParamsSchema.parse(req.params)
      res.json(await userService.getProfile(db, handle, getAuth(req).userId))
    },

    posts: profileTab('posts'),
    replies: profileTab('replies'),
    media: profileTab('media'),
    likes: profileTab('likes'),

    /** GET /users/:handle/followers */
    async followers(req: Request, res: Response) {
      const { handle } = handleParamsSchema.parse(req.params)
      res.json(
        await userService.listFollows(
          db,
          handle,
          'followers',
          cursorPageQuerySchema.parse(req.query),
        ),
      )
    },

    /** GET /users/:handle/following */
    async following(req: Request, res: Response) {
      const { handle } = handleParamsSchema.parse(req.params)
      res.json(
        await userService.listFollows(
          db,
          handle,
          'following',
          cursorPageQuerySchema.parse(req.query),
        ),
      )
    },

    /** POST /users/:handle/follow — フォローして、更新後のプロフィールを返す */
    async follow(req: Request, res: Response) {
      const { handle } = handleParamsSchema.parse(req.params)
      res.json(await userService.follow(deps, getAuth(req).userId, handle))
    },

    /** DELETE /users/:handle/follow — フォロー解除 */
    async unfollow(req: Request, res: Response) {
      const { handle } = handleParamsSchema.parse(req.params)
      res.json(await userService.unfollow(db, getAuth(req).userId, handle))
    },
  }
}

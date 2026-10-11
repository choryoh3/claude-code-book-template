// 投稿・反応・タイムライン・ブックマークの controller。

import type { Request, Response } from 'express'
import type { AppDeps } from '../deps'
import type { ReactionKind } from '../services/post.service'
import { createPostSchema, cursorPageQuerySchema, idSchema } from '@xclone/shared'
import { z } from 'zod'
import { getAuth } from '../middlewares/auth'
import * as postService from '../services/post.service'
import * as timelineService from '../services/timeline.service'

const idParamsSchema = z.object({ id: idSchema })

export function createPostController(deps: AppDeps) {
  const { db } = deps

  /** 反応（いいね・リポスト・ブックマーク）を付ける / 外す handler を作る */
  const reaction = (kind: ReactionKind, on: boolean) => async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params)
    res.json(await postService.setReaction(deps, getAuth(req).userId, id, kind, on))
  }

  return {
    /** POST /posts — 投稿（リプライは replyToId、引用は quoteOfId を指定） */
    async create(req: Request, res: Response) {
      const input = createPostSchema.parse(req.body)
      res.status(201).json(await postService.createPost(deps, getAuth(req).userId, input))
    },

    /** GET /posts/:id — 投稿詳細（リプライの最初のページつき） */
    async detail(req: Request, res: Response) {
      const { id } = idParamsSchema.parse(req.params)
      const query = cursorPageQuerySchema.parse(req.query)
      res.json(await postService.getPostDetail(db, id, getAuth(req).userId, query))
    },

    /** GET /posts/:id/replies — リプライの続き */
    async replies(req: Request, res: Response) {
      const { id } = idParamsSchema.parse(req.params)
      const query = cursorPageQuerySchema.parse(req.query)
      res.json(await postService.listReplies(db, id, getAuth(req).userId, query))
    },

    /** DELETE /posts/:id — 自分の投稿を削除 */
    async remove(req: Request, res: Response) {
      const { id } = idParamsSchema.parse(req.params)
      await postService.deletePost(db, getAuth(req).userId, id)
      res.status(204).end()
    },

    like: reaction('like', true),
    unlike: reaction('like', false),
    repost: reaction('repost', true),
    unrepost: reaction('repost', false),
    bookmark: reaction('bookmark', true),
    unbookmark: reaction('bookmark', false),

    /** GET /bookmarks */
    async bookmarks(req: Request, res: Response) {
      res.json(
        await postService.listBookmarks(
          db,
          getAuth(req).userId,
          cursorPageQuerySchema.parse(req.query),
        ),
      )
    },

    /** GET /timeline/following */
    async followingTimeline(req: Request, res: Response) {
      const query = cursorPageQuerySchema.parse(req.query)
      res.json(await timelineService.followingTimeline(db, getAuth(req).userId, query))
    },

    /** GET /timeline/for-you */
    async forYouTimeline(req: Request, res: Response) {
      const query = cursorPageQuerySchema.parse(req.query)
      res.json(await timelineService.forYouTimeline(db, getAuth(req).userId, query))
    },
  }
}

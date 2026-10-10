// <Feature> の controller。
// 役割は「HTTP の入出力の変換」だけ。ビジネスロジックは service に置く。
import type { Request, Response } from 'express'
// import { createPostSchema } from '@xclone/shared'
// import * as postService from '../services/post.service'
// import { toPostDto } from '../mappers/post.mapper'

/** POST /posts — 投稿を作成する */
export async function createPost(req: Request, res: Response) {
  // 1. 入力を検証する（不正なら ZodError → エラーミドルウェアが 400 に変換）
  // const input = createPostSchema.parse(req.body)

  // 2. ビジネスロジックを実行する（Express 5 は async の例外を自動で処理する）
  // const post = await postService.create(req.user.id, input)

  // 3. DB モデルを DTO に変換して返す（passwordHash などの流出を防ぐ）
  // res.status(201).json(toPostDto(post))
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: '未実装です' } })
}

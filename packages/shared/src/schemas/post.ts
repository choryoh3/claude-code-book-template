// 投稿に関する契約: 作成・表示（DTO）・タイムライン。

import { z } from 'zod'
import { MAX_POST_LENGTH, MAX_POST_MEDIA, POST_STATUSES } from '../constants'
import { messages } from '../messages'
import { cursorPageQuerySchema, cursorPageSchema, idSchema, isoDateTimeSchema } from './common'
import { uploadedImageUrlSchema } from './media'
import { userSummaryDtoSchema } from './user'

// ---------------------------------------------------------------- リクエスト
/**
 * 投稿の作成 `POST /posts`。
 * - 本文は 280 文字まで。画像は 4 枚まで。本文も画像も無い投稿は作れない
 * - replyToId（リプライ先）と quoteOfId（引用元）は同時に指定できない
 */
export const createPostSchema = z
  .object({
    content: z.string().max(MAX_POST_LENGTH, messages.postTooLong).default(''),
    mediaUrls: z
      .array(uploadedImageUrlSchema)
      .max(MAX_POST_MEDIA, messages.tooManyMedia)
      .default([]),
    replyToId: idSchema.optional(),
    quoteOfId: idSchema.optional(),
  })
  .refine((post) => post.content.trim().length > 0 || post.mediaUrls.length > 0, {
    error: messages.postEmpty,
    path: ['content'],
  })
  .refine((post) => !(post.replyToId && post.quoteOfId), {
    error: messages.replyAndQuote,
    path: ['quoteOfId'],
  })
export type CreatePostInput = z.infer<typeof createPostSchema>

/** 投稿の一覧（タイムライン・プロフィールの各タブ・ブックマークなど）の問い合わせ */
export const postListQuerySchema = cursorPageQuerySchema
export type PostListQuery = z.infer<typeof postListQuerySchema>

// ---------------------------------------------------------------- レスポンス（DTO）
/**
 * 引用元や通知に埋め込む、投稿の最小情報。
 * 削除済み・非表示の投稿は、本文を空にして status だけを返す（中身を漏らさない）。
 */
export const postSummaryDtoSchema = z.object({
  id: idSchema,
  author: userSummaryDtoSchema,
  content: z.string(),
  mediaUrls: z.array(z.string()),
  status: z.enum(POST_STATUSES),
  createdAt: isoDateTimeSchema,
})
export type PostSummaryDto = z.infer<typeof postSummaryDtoSchema>

/** 投稿カードに表示する投稿の全情報。viewer（見ている人）の操作状態（liked など）を含む */
export const postDtoSchema = postSummaryDtoSchema.extend({
  replyToId: idSchema.nullable(),
  /** 引用投稿のとき、元の投稿（無ければ null） */
  quoteOf: postSummaryDtoSchema.nullable(),
  replyCount: z.number().int().nonnegative(),
  repostCount: z.number().int().nonnegative(),
  quoteCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  /** 見ている人が、いいね・リポスト・ブックマークしているか */
  liked: z.boolean(),
  reposted: z.boolean(),
  bookmarked: z.boolean(),
  /**
   * タイムラインにリポストとして表示されたとき、リポストした人（「○○さんがリポストしました」用）。
   * リポストでなければ null。
   */
  repostedBy: userSummaryDtoSchema.nullable(),
})
export type PostDto = z.infer<typeof postDtoSchema>

/** 投稿の一覧の結果（cursor ページネーション） */
export const postPageSchema = cursorPageSchema(postDtoSchema)
export type PostPage = z.infer<typeof postPageSchema>

/** 投稿詳細: 投稿本体と、リプライの一覧 */
export const postDetailDtoSchema = z.object({
  post: postDtoSchema,
  replies: postPageSchema,
})
export type PostDetailDto = z.infer<typeof postDetailDtoSchema>

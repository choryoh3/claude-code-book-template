// 検索・トレンドに関する契約。

import { z } from 'zod'
import { SEARCH_QUERY_MAX_LENGTH } from '../constants'
import { messages } from '../messages'
import { cursorPageQuerySchema, cursorPageSchema } from './common'
import { userSummaryDtoSchema } from './user'

/** 検索の種類: 投稿 / ユーザー / ハッシュタグ */
export const SEARCH_TYPES = ['posts', 'users', 'tags'] as const

/** 検索の問い合わせ `GET /search?q=&type=`。前後の空白は無視する */
export const searchQuerySchema = cursorPageQuerySchema.extend({
  q: z
    .string(messages.required('検索ワード'))
    .trim()
    .min(1, messages.required('検索ワード'))
    .max(SEARCH_QUERY_MAX_LENGTH, messages.maxLength('検索ワード', SEARCH_QUERY_MAX_LENGTH)),
  type: z.enum(SEARCH_TYPES).default('posts'),
})
export type SearchQuery = z.infer<typeof searchQuerySchema>

/** ハッシュタグ 1 件（#を除いた小文字）と、その投稿数 */
export const hashtagDtoSchema = z.object({
  tag: z.string(),
  postCount: z.number().int().nonnegative(),
})
export type HashtagDto = z.infer<typeof hashtagDtoSchema>

/** ユーザー検索の結果 */
export const userPageSchema = cursorPageSchema(userSummaryDtoSchema)
export type UserPage = z.infer<typeof userPageSchema>

/** ハッシュタグ検索の結果 */
export const hashtagPageSchema = cursorPageSchema(hashtagDtoSchema)
export type HashtagPage = z.infer<typeof hashtagPageSchema>

/** トレンド（直近で投稿が多いタグ。上位 10 件） */
export const trendsDtoSchema = z.object({ items: z.array(hashtagDtoSchema) })
export type TrendsDto = z.infer<typeof trendsDtoSchema>

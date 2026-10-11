// 通知に関する契約。一覧の取得（REST）と、リアルタイム配信（Socket.IO）で同じ DTO を使う。
import { z } from 'zod'
import { NOTIFICATION_TYPES } from '../constants'
import { cursorPageQuerySchema, cursorPageSchema, idSchema, isoDateTimeSchema } from './common'
import { postSummaryDtoSchema } from './post'
import { userSummaryDtoSchema } from './user'

/** 通知 1 件。type が follow のときは post が null */
export const notificationDtoSchema = z.object({
  id: idSchema,
  type: z.enum(NOTIFICATION_TYPES),
  /** 操作した人 */
  actor: userSummaryDtoSchema,
  /** 対象の投稿（フォロー以外） */
  post: postSummaryDtoSchema.nullable(),
  isRead: z.boolean(),
  createdAt: isoDateTimeSchema,
})
export type NotificationDto = z.infer<typeof notificationDtoSchema>

/** 通知一覧の問い合わせ `GET /notifications`。filter=mentions でメンションだけに絞る */
export const notificationListQuerySchema = cursorPageQuerySchema.extend({
  filter: z.enum(['all', 'mentions']).default('all'),
})
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>

export const notificationPageSchema = cursorPageSchema(notificationDtoSchema)
export type NotificationPage = z.infer<typeof notificationPageSchema>

/** 未読の件数（左ナビのバッジ用） */
export const unreadCountDtoSchema = z.object({ count: z.number().int().nonnegative() })
export type UnreadCountDto = z.infer<typeof unreadCountDtoSchema>

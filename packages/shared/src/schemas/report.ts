// 通報に関する契約。ユーザーが送り（user/server）、管理者が処理する（admin/server）。

import { z } from 'zod'
import {
  ADMIN_NOTE_MAX_LENGTH,
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
} from '../constants'
import { messages } from '../messages'
import { idSchema, isoDateTimeSchema } from './common'
import { postSummaryDtoSchema } from './post'
import { userSummaryDtoSchema } from './user'

/** 通報の送信 `POST /reports`。対象は「投稿」か「ユーザー」のどちらか（targetId はその ID） */
export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS, '理由を選択してください'),
  detail: z
    .string()
    .max(REPORT_DETAIL_MAX_LENGTH, messages.maxLength('補足', REPORT_DETAIL_MAX_LENGTH))
    .default(''),
})
export type CreateReportInput = z.infer<typeof createReportSchema>

/** 通報を受け付けたときの応答（201） */
export const reportCreatedDtoSchema = z.object({ id: idSchema })
export type ReportCreatedDto = z.infer<typeof reportCreatedDtoSchema>

/** 管理者が見る通報 1 件 */
export const reportDtoSchema = z.object({
  id: idSchema,
  targetType: z.enum(REPORT_TARGET_TYPES),
  /** 通報された投稿 / ユーザー（どちらか一方） */
  targetPost: postSummaryDtoSchema.nullable(),
  targetUser: userSummaryDtoSchema.nullable(),
  reason: z.enum(REPORT_REASONS),
  detail: z.string(),
  reporter: userSummaryDtoSchema,
  status: z.enum(REPORT_STATUSES),
  adminNote: z.string(),
  handledBy: userSummaryDtoSchema.nullable(),
  handledAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
})
export type ReportDto = z.infer<typeof reportDtoSchema>

/** 管理者による通報の更新 `PATCH /admin/reports/:id` */
export const updateReportSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  adminNote: z
    .string()
    .max(ADMIN_NOTE_MAX_LENGTH, messages.maxLength('対応メモ', ADMIN_NOTE_MAX_LENGTH))
    .default(''),
})
export type UpdateReportInput = z.infer<typeof updateReportSchema>

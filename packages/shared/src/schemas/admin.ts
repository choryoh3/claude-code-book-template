// 管理者アプリ（admin/server・admin/client）の契約。
// 管理者の変更操作は、操作と同一トランザクションで監査ログに記録される（.claude/rules/admin-security.md）。
// 表は「◯ページ目へ移動」できる必要があるため、ページ番号方式（page / pageSize）を使う。

import { z } from 'zod'
import {
  ADMIN_REASON_MAX_LENGTH,
  AUDIT_ACTIONS,
  POST_STATUSES,
  STATS_PERIOD_DAYS,
  STATS_PERIOD_DEFAULT,
  USER_ROLES,
} from '../constants'
import { messages } from '../messages'
import { idSchema, isoDateTimeSchema, pageQuerySchema, pageSchema } from './common'
import { postSummaryDtoSchema } from './post'
import { loginSchema, userSummaryDtoSchema } from './user'

// ---------------------------------------------------------------- 認証
/** 管理者ログイン `POST /admin/auth/login`（入力は一般ユーザーと同じ形。エンドポイントと JWT のシークレットが別） */
export const adminLoginSchema = loginSchema
export type AdminLoginInput = z.infer<typeof adminLoginSchema>

// ---------------------------------------------------------------- 操作の理由（凍結・非表示・削除など）
/** 管理者が操作の理由を入力する欄。監査ログに記録される */
export const adminReasonSchema = z.object({
  reason: z
    .string(messages.required('理由'))
    .trim()
    .min(1, messages.required('理由'))
    .max(ADMIN_REASON_MAX_LENGTH, messages.maxLength('理由', ADMIN_REASON_MAX_LENGTH)),
})
export type AdminReasonInput = z.infer<typeof adminReasonSchema>

// ---------------------------------------------------------------- ユーザー管理
export const adminUserListQuerySchema = pageQuerySchema.extend({
  /** ハンドル・表示名・メールの部分一致 */
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'suspended']).default('all'),
  role: z.enum(['all', ...USER_ROLES]).default('all'),
})
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>

export const adminUserDtoSchema = userSummaryDtoSchema.extend({
  email: z.string(),
  role: z.enum(USER_ROLES),
  isSuspended: z.boolean(),
  suspendedAt: isoDateTimeSchema.nullable(),
  suspendedReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  lastLoginAt: isoDateTimeSchema.nullable(),
})
export type AdminUserDto = z.infer<typeof adminUserDtoSchema>

export const adminUserPageSchema = pageSchema(adminUserDtoSchema)
export type AdminUserPage = z.infer<typeof adminUserPageSchema>

/** ロール変更 `PATCH /admin/users/:id/role`（自分自身・最後の管理者は変更できない） */
export const changeRoleSchema = z.object({ role: z.enum(USER_ROLES) })
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>

// ---------------------------------------------------------------- 投稿管理
export const adminPostListQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', ...POST_STATUSES]).default('all'),
})
export type AdminPostListQuery = z.infer<typeof adminPostListQuerySchema>

/** 管理画面の投稿表の 1 行。非表示・削除済みも本文を確認できる（一般向けの DTO と違い、中身を隠さない） */
export const adminPostDtoSchema = postSummaryDtoSchema.extend({
  reportCount: z.number().int().nonnegative(),
})
export type AdminPostDto = z.infer<typeof adminPostDtoSchema>

export const adminPostPageSchema = pageSchema(adminPostDtoSchema)
export type AdminPostPage = z.infer<typeof adminPostPageSchema>

// ---------------------------------------------------------------- 通報管理
export const adminReportListQuerySchema = pageQuerySchema.extend({
  status: z.enum(['all', 'open', 'in_progress', 'resolved']).default('open'),
})
export type AdminReportListQuery = z.infer<typeof adminReportListQuerySchema>

// ---------------------------------------------------------------- 監査ログ
/** 監査ログの絞り込み。期間は日付（YYYY-MM-DD）で指定する */
export const auditLogQuerySchema = pageQuerySchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  adminId: idSchema.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
})
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>

export const auditLogDtoSchema = z.object({
  id: idSchema,
  admin: userSummaryDtoSchema,
  action: z.enum(AUDIT_ACTIONS),
  targetType: z.string(),
  targetId: idSchema.nullable(),
  /** 変更前後・理由など（秘密値は含まれない） */
  detail: z.record(z.string(), z.unknown()),
  ip: z.string().nullable(),
  createdAt: isoDateTimeSchema,
})
export type AuditLogDto = z.infer<typeof auditLogDtoSchema>

export const auditLogPageSchema = pageSchema(auditLogDtoSchema)
export type AuditLogPage = z.infer<typeof auditLogPageSchema>

// ---------------------------------------------------------------- ダッシュボード（統計）
/** `GET /admin/stats?days=`。選べる期間は 7 / 14 / 30 日 */
export const statsQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine(
      (days): days is (typeof STATS_PERIOD_DAYS)[number] =>
        (STATS_PERIOD_DAYS as readonly number[]).includes(days),
      {
        error: `期間は ${STATS_PERIOD_DAYS.join(' / ')} 日から選んでください`,
      },
    )
    .default(STATS_PERIOD_DEFAULT),
})
export type StatsQuery = z.infer<typeof statsQuerySchema>

/** 1 日ぶんの数字 */
export const dailyStatDtoSchema = z.object({
  /** YYYY-MM-DD */
  date: z.iso.date(),
  /** その日に利用したユーザー数（DAU） */
  dau: z.number().int().nonnegative(),
  posts: z.number().int().nonnegative(),
  signups: z.number().int().nonnegative(),
})
export type DailyStatDto = z.infer<typeof dailyStatDtoSchema>

export const statsDtoSchema = z.object({
  days: z.number().int().positive(),
  /** 今日の数字（指標カード用） */
  today: dailyStatDtoSchema,
  /** 前日の数字（「前日比」の計算用） */
  yesterday: dailyStatDtoSchema,
  /** 古い順の日次データ（グラフ用）。データが無い日は 0 で埋める */
  series: z.array(dailyStatDtoSchema),
  /** 未対応の通報の件数 */
  openReports: z.number().int().nonnegative(),
})
export type StatsDto = z.infer<typeof statsDtoSchema>

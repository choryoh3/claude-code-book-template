// API のエラー応答の形と、エラーコード。
// エラーコードは「安定した識別子」で、画面の分岐・ログの検索・不具合調査に使う（.claude/rules/observability.md）。
// 文言（message）は変わってよいが、コードは変えない。

import { z } from 'zod'

export const ERROR_CODES = {
  // 共通
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // 認証
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  HANDLE_TAKEN: 'HANDLE_TAKEN',
  // 投稿・ユーザー
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ALREADY_REPORTED: 'ALREADY_REPORTED',
  // 管理
  LAST_ADMIN: 'LAST_ADMIN',
  CANNOT_MODIFY_SELF: 'CANNOT_MODIFY_SELF',
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** エラー応答: `{ error: { code, message, requestId } }`。利用者が問い合わせるとき requestId を伝えられる */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(Object.values(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]),
    message: z.string(),
    requestId: z.string(),
    /** 入力エラーのとき、項目ごとのメッセージ（キーは項目名） */
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
})
export type ErrorResponse = z.infer<typeof errorResponseSchema>

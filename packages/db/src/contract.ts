// DB の列挙型（自動生成された型）と、packages/shared の列挙の定数が「完全に一致している」ことを、型で保証する。
//
// どちらかを変えて食い違うと、この下の `Assert` が型エラーになり、`pnpm typecheck` が失敗する
// （例: DB の enum に値を足したのに、shared の定数に足し忘れた）。実行時には何も起きない。
import type {
  AUDIT_ACTIONS,
  NOTIFICATION_TYPES,
  POST_STATUSES,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  USER_ROLES,
} from '@xclone/shared'
import type {
  AuditAction,
  NotificationType,
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserRole,
} from './generated/db'

/** 2 つの型が完全に同じなら true */
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
/** true でなければ型エラーにする */
type Assert<T extends true> = T

export type EnumContract = [
  Assert<Equal<(typeof USER_ROLES)[number], UserRole>>,
  Assert<Equal<(typeof POST_STATUSES)[number], PostStatus>>,
  Assert<Equal<(typeof NOTIFICATION_TYPES)[number], NotificationType>>,
  Assert<Equal<(typeof REPORT_TARGET_TYPES)[number], ReportTargetType>>,
  Assert<Equal<(typeof REPORT_REASONS)[number], ReportReason>>,
  Assert<Equal<(typeof REPORT_STATUSES)[number], ReportStatus>>,
  Assert<Equal<(typeof AUDIT_ACTIONS)[number], AuditAction>>,
]

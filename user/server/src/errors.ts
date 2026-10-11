// アプリのエラー。service や controller はこれを throw し、エラーミドルウェアが HTTP の応答に変換する。
// code（ERROR_CODES）は画面の分岐・ログ検索に使う安定した識別子、message は利用者に見せる日本語の文言。

import type { ErrorCode } from '@xclone/shared'
import { ERROR_CODES } from '@xclone/shared'

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    message: string,
    /** 入力エラーのとき、項目ごとのメッセージ */
    readonly fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/** 400: 入力が正しくない */
export function badRequest(message: string, fields?: Record<string, string[]>): AppError {
  return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, message, fields)
}

/** 401: ログインしていない・トークンが無効 */
export function unauthorized(
  message = 'ログインが必要です',
  code: ErrorCode = ERROR_CODES.UNAUTHORIZED,
): AppError {
  return new AppError(code, 401, message)
}

/** 403: ログインはしているが、この操作は許可されていない */
export function forbidden(
  message = 'この操作は許可されていません',
  code: ErrorCode = ERROR_CODES.FORBIDDEN,
): AppError {
  return new AppError(code, 403, message)
}

/** 404: 見つからない */
export function notFound(message: string, code: ErrorCode = ERROR_CODES.NOT_FOUND): AppError {
  return new AppError(code, 404, message)
}

/** 409: すでに存在する（重複） */
export function conflict(message: string, code: ErrorCode): AppError {
  return new AppError(code, 409, message)
}

/** PostgreSQL の「一意制約違反」（同じ値がすでにある）かどうか */
export function isUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

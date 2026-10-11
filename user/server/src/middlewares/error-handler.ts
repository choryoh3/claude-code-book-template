// エラーを HTTP の応答に変換する最後のミドルウェア。応答の形はいつも
//   { error: { code, message, requestId, fields? } }
// （packages/shared の errorResponseSchema）。想定外のエラーはスタックトレースつきでログに残し、500 を返す。

import type { ErrorResponse } from '@xclone/shared'
import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODES } from '@xclone/shared'
import multer from 'multer'
import { ZodError } from 'zod'
import { currentContext } from '../context'
import { AppError } from '../errors'
import { logger } from '../logger'

type ErrorBody = ErrorResponse['error']

/** Zod の検証エラーを「項目ごとのメッセージ」に変換する（例 { content: ['投稿は280文字以内…'] }） */
function zodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(fields[key] ??= []).push(issue.message)
  }
  return fields
}

/** エラーに付いている HTTP の状態コード（body-parser などのエラーは status / statusCode を持つ） */
function readHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const value =
    'status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined
  return typeof value === 'number' ? value : undefined
}

/**
 * PostgreSQL の「入力の形式が正しくない」エラー（22007 日時の形式・22008 日時の範囲・22P02 文字の表現）。
 * 普段は Zod の検証で防いでいるが、すり抜けたものを 500 にしないための安全網。
 */
const DB_INVALID_INPUT_CODES = new Set(['22007', '22008', '22P02'])
function isInvalidInputFromDb(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    DB_INVALID_INPUT_CODES.has(error.code)
  )
}

/** エラーの種類ごとに、状態コードと応答の中身を決める */
function toErrorResponse(error: unknown): { status: number; body: Omit<ErrorBody, 'requestId'> } {
  if (error instanceof AppError) {
    return {
      status: error.httpStatus,
      body: { code: error.code, message: error.message, fields: error.fields },
    }
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? '入力が正しくありません'
    return {
      status: 400,
      body: { code: ERROR_CODES.VALIDATION_ERROR, message, fields: zodFields(error) },
    }
  }
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE' ? 'ファイルが大きすぎます' : 'ファイルを受け取れませんでした'
    return { status: 400, body: { code: ERROR_CODES.VALIDATION_ERROR, message } }
  }
  // express.json() が JSON を読めなかったとき
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    return {
      status: 400,
      body: { code: ERROR_CODES.VALIDATION_ERROR, message: 'JSON の形式が正しくありません' },
    }
  }
  // express.json() などが付けた 4xx（本文が大きすぎる 413 など）は、その状態コードのまま返す
  const status = readHttpStatus(error)
  if (status !== undefined && status >= 400 && status < 500) {
    const message =
      status === 413 ? '送信データが大きすぎます' : 'リクエストの形式が正しくありません'
    return { status, body: { code: ERROR_CODES.VALIDATION_ERROR, message } }
  }
  // DB が「値の形式が正しくない」と判断したもの（不正な日時・数値など）は、利用者の入力の問題なので 400
  if (isInvalidInputFromDb(error)) {
    return {
      status: 400,
      body: { code: ERROR_CODES.VALIDATION_ERROR, message: '入力の形式が正しくありません' },
    }
  }
  return {
    status: 500,
    body: { code: ERROR_CODES.INTERNAL_ERROR, message: 'サーバーでエラーが発生しました' },
  }
}

// Express はエラー処理のミドルウェアを「引数が 4 つ」で見分けるので、使わない next も宣言する
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const { status, body } = toErrorResponse(error)

  // 想定外のエラーだけ、原因調査のためにスタックトレースつきで記録する（想定内のものはアクセスログで足りる）
  if (status >= 500)
    logger.error({ err: error, path: req.originalUrl.split('?')[0] }, 'unhandled.error')

  const requestId = currentContext()?.requestId ?? 'unknown'
  res.status(status).json({ error: { ...body, requestId } } satisfies ErrorResponse)
}

/** どのルートにも当てはまらなかったとき */
export function notFoundHandler(_req: Request, res: Response) {
  const requestId = currentContext()?.requestId ?? 'unknown'
  res.status(404).json({
    error: { code: ERROR_CODES.NOT_FOUND, message: 'ページが見つかりません', requestId },
  } satisfies ErrorResponse)
}

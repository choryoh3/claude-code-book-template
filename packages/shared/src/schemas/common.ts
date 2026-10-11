// 複数の機能で使う共通のスキーマ（ID・日時・ページネーション）。
import { z } from 'zod'
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants'

/** ID（UUID） */
export const idSchema = z.uuid()

/** 日時。API では ISO 8601 の文字列（例 2026-10-11T03:00:00.000Z）で受け渡す */
export const isoDateTimeSchema = z.iso.datetime()

/** 1 ページあたりの件数（クエリ文字列は文字列で届くので数値に変換する） */
const limitSchema = z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT)

/**
 * cursor ページネーションの問い合わせ（タイムライン・通知・一覧など）。
 * cursor は「ここから後ろ」を指す目印で、サーバーが返した nextCursor をそのまま渡す。
 */
export const cursorPageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: limitSchema,
})
export type CursorPageQuery = z.infer<typeof cursorPageQuerySchema>

/** cursor ページネーションの結果。nextCursor が null なら最後のページ */
export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  })
}

/**
 * ページ番号方式の問い合わせ（管理画面の表。「◯ページ目」へ移動できる必要があるため cursor ではなく page を使う）。
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
})
export type PageQuery = z.infer<typeof pageQuerySchema>

/** ページ番号方式の結果。total は条件に一致した全件数 */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
}

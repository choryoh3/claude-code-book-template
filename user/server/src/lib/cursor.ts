// cursor ページネーションの「目印」を、画面に渡せる文字列に変換する（中身は JSON を base64url にしたもの）。
// 画面は受け取った nextCursor を、次のリクエストにそのまま渡すだけ（中身を気にしなくてよい）。

import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { badRequest } from '../errors'

export function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** cursor を元に戻して形を検証する。壊れた・改ざんされた cursor は 400 */
export function decodeCursor<T>(cursor: string, schema: z.ZodType<T>): T {
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
  } catch {
    throw badRequest('cursor の形式が正しくありません')
  }
}

/** DB の時刻を文字列にしたものの形（例 2026-10-11 12:34:56.123456+09） */
const DB_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/

/**
 * cursor に入れる時刻。形が違えば、DB に渡す前に 400 にする
 * （そのまま DB に渡すと、DB のエラー = 500 になり、誰でもエラーログを増やせてしまうため）。
 */
export const dbTimestampSchema = z.string().max(64).regex(DB_TIMESTAMP_PATTERN)

/**
 * 「時刻 + ID」の目印（新しい順の一覧で使う）。
 * t には DB の時刻を `created_at::text` で取り出した文字列をそのまま入れる。
 * ⚠ JavaScript の Date（ミリ秒まで）に変換すると、DB の時刻（マイクロ秒まで）より粗くなり、
 *   同じミリ秒の中にある行を読み飛ばしてしまうため、文字列のまま受け渡す。
 */
export const timeCursorSchema = z.object({ t: dbTimestampSchema, id: z.uuid() })
export type TimeCursor = z.infer<typeof timeCursorSchema>

/**
 * 「1 件多く取得して、次のページがあるかを判定する」ための仕上げ。
 * rows は limit + 1 件まで取得しておく。limit 件を超えていれば、最後の行から nextCursor を作る。
 */
export function paginate<T>(rows: T[], limit: number, toCursor: (last: T) => object) {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items.at(-1)
  return { items, nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null }
}

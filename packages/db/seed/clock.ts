// seed 用の日時の基準。「今日」から何日前・何時間前、という相対的な日時を作る。
import process from 'node:process'

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/**
 * 基準日（UTC の 0 時）。
 * - 既定: 実行した日。ダッシュボードの「直近 14 日」などが、いつ実行しても今日を基準に並ぶ
 * - 固定したいとき: 環境変数 SEED_BASE_DATE=2026-10-11（E2E テストなど、毎回同じ結果が欲しいとき）
 * 同じ基準日なら、乱数の種が同じなのでデータは完全に一致する。
 */
export function resolveBaseDate(): Date {
  const fixed = process.env.SEED_BASE_DATE
  if (fixed) {
    const date = new Date(`${fixed}T00:00:00Z`)
    if (Number.isNaN(date.getTime()))
      throw new TypeError(`SEED_BASE_DATE が日付として読めません: ${fixed}`)
    return date
  }
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** 基準日の n 日前（同じ時刻）の日時 */
export function daysBefore(base: Date, days: number): Date {
  return new Date(base.getTime() - days * MS_PER_DAY)
}

/** 日時に分を足した日時 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE)
}

/** 日時に時間を足した日時 */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR)
}

/** 2 つの日時のうち早いほう。「基準日より未来にならないように」丸めるのに使う */
export function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

/** 'YYYY-MM-DD' の文字列（daily_active_users の日付に使う） */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

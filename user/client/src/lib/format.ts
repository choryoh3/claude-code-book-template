// 日時・数値の表示用の変換（画面仕様書の共通仕様「日時」に合わせる）。
//   一覧: 相対時刻（今 / 5分 / 3時間 / 10月11日 / 2025年10月11日）
//   詳細: 絶対時刻（2026年10月11日 14:30）

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 一覧用の相対時刻。now はテストで固定できるように引数にしている */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const diff = now.getTime() - date.getTime()

  if (diff < MINUTE) return '今'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/** 詳細用の絶対時刻（例 2026年10月11日 14:30） */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

/** 「3.0万」の「.0」を消すため（「3万」と表示する） */
const TRAILING_ZERO = /\.0$/

/** 件数の表示（1万以上は「1.2万」）。0 は空にする（X と同じく、数字を出さない） */
export function formatCount(count: number): string {
  if (count <= 0) return ''
  if (count >= 10_000) return `${(count / 10_000).toFixed(1).replace(TRAILING_ZERO, '')}万`
  return count.toLocaleString('ja-JP')
}

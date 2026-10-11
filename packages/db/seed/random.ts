// seed 用の「毎回同じ結果になる」乱数と ID の生成。
// 目的: `pnpm db:seed` を何度実行しても、同じ基準日なら全く同じデータになるようにする（再現性）。
import { createHash } from 'node:crypto'

/** seed の乱数の種。変えるとデータ全体が変わるので、むやみに変更しない */
export const SEED_VALUE = 20261011

export interface Random {
  /** 0 以上 1 未満の小数 */
  next: () => number
  /** min 以上 max 以下の整数 */
  int: (min: number, max: number) => number
  /** 確率 p（0〜1）で true */
  chance: (p: number) => boolean
  /** 配列から 1 つ選ぶ（空配列では使えない） */
  pick: <T>(items: readonly T[]) => T
  /** 配列をシャッフルした新しい配列を返す（元の配列は変更しない） */
  shuffle: <T>(items: readonly T[]) => T[]
}

/** mulberry32: 小さくて速い、種が同じなら同じ列を返す疑似乱数 */
export function createRandom(seed: number = SEED_VALUE): Random {
  let state = seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))

  const pick = <T>(items: readonly T[]): T => {
    // items が空でないことは呼び出し側が保証する。添字は必ず範囲内なので T として扱える
    return items[int(0, items.length - 1)] as T
  }

  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[result[i], result[j]] = [result[j] as T, result[i] as T]
    }
    return result
  }

  return { next, int, chance: (p) => next() < p, pick, shuffle }
}

/**
 * キー文字列から「いつも同じ」UUID を作る。
 * 例: stableUuid('user:alice') は何度実行しても同じ値。seed の再実行でも ID が変わらず、
 * ブックマークした URL や E2E テストが壊れない。
 */
export function stableUuid(key: string): string {
  const hex = createHash('md5').update(key).digest('hex')
  // UUID v4 の形式（バージョン 4・バリアント 8〜b）に整える
  const variant = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

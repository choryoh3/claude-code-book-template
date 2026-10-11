// ページネーション・検索・管理画面の入力チェックのテスト。

import { describe, expect, it } from 'vitest'
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, STATS_PERIOD_DEFAULT } from '../constants'
import { adminReasonSchema, statsQuerySchema } from './admin'
import { cursorPageQuerySchema, pageQuerySchema } from './common'
import { searchQuerySchema } from './search'

describe('cursorPageQuerySchema / pageQuerySchema', () => {
  it('クエリ文字列（文字列）の limit を数値に変換し、省略時は既定値にする', () => {
    expect(cursorPageQuerySchema.parse({ limit: '10' }).limit).toBe(10)
    expect(cursorPageQuerySchema.parse({}).limit).toBe(PAGE_SIZE_DEFAULT)
  })

  it('1 ページの件数の上限を超える指定は拒否する', () => {
    expect(cursorPageQuerySchema.safeParse({ limit: String(PAGE_SIZE_MAX + 1) }).success).toBe(
      false,
    )
    expect(pageQuerySchema.safeParse({ pageSize: '0' }).success).toBe(false)
  })

  it('ページ番号は 1 から。省略すると 1 ページ目', () => {
    expect(pageQuerySchema.parse({}).page).toBe(1)
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false)
  })
})

describe('searchQuerySchema', () => {
  it('検索ワードの前後の空白は無視し、空なら拒否する', () => {
    expect(searchQuerySchema.parse({ q: '  vue  ' }).q).toBe('vue')
    expect(searchQuerySchema.safeParse({ q: '   ' }).success).toBe(false)
  })

  it('検索の種類は省略すると投稿', () => {
    expect(searchQuerySchema.parse({ q: 'vue' }).type).toBe('posts')
    expect(searchQuerySchema.safeParse({ q: 'vue', type: 'unknown' }).success).toBe(false)
  })
})

describe('statsQuerySchema', () => {
  it('期間は 7 / 14 / 30 日のどれか。省略すると 14 日', () => {
    expect(statsQuerySchema.parse({}).days).toBe(STATS_PERIOD_DEFAULT)
    expect(statsQuerySchema.parse({ days: '30' }).days).toBe(30)
    expect(statsQuerySchema.safeParse({ days: '10' }).success).toBe(false)
  })
})

describe('adminReasonSchema', () => {
  it('操作の理由は必須（空白だけも不可）。前後の空白は取り除く', () => {
    expect(adminReasonSchema.safeParse({ reason: '' }).success).toBe(false)
    expect(adminReasonSchema.safeParse({ reason: '   ' }).success).toBe(false)
    expect(adminReasonSchema.parse({ reason: ' スパム ' }).reason).toBe('スパム')
  })
})

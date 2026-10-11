import { describe, expect, it } from 'vitest'
import { splitContent } from './content'
import { formatCount, formatRelativeTime } from './format'

describe('splitContent（本文を部品に分ける）', () => {
  it('ハッシュタグ・メンション・URL と、ふつうの文字に分ける', () => {
    expect(splitContent('こんにちは @alice さん #Vue 見て https://example.com/a?b=1 です')).toEqual(
      [
        { type: 'text', value: 'こんにちは ' },
        { type: 'mention', value: '@alice', handle: 'alice' },
        { type: 'text', value: ' さん ' },
        { type: 'hashtag', value: '#Vue', tag: 'vue' },
        { type: 'text', value: ' 見て ' },
        { type: 'url', value: 'https://example.com/a?b=1' },
        { type: 'text', value: ' です' },
      ],
    )
  })

  it('日本語のハッシュタグも 1 つのタグにする', () => {
    expect(splitContent('#開発日記')).toEqual([
      { type: 'hashtag', value: '#開発日記', tag: '開発日記' },
    ])
  })

  it('3 文字未満の @ はメンションにしない（ハンドルの最小文字数に合わせる）', () => {
    expect(splitContent('@ab')).toEqual([{ type: 'text', value: '@ab' }])
  })

  it('本文中の HTML のタグも、ただの文字として扱う（画面で実行されない）', () => {
    expect(splitContent('<script>alert(1)</script>')).toEqual([
      { type: 'text', value: '<script>alert(1)</script>' },
    ])
  })

  it('改行を含む本文もそのまま保つ', () => {
    expect(splitContent('1行目\n2行目')).toEqual([{ type: 'text', value: '1行目\n2行目' }])
  })
})

describe('formatRelativeTime（一覧の相対時刻）', () => {
  const now = new Date('2026-10-11T12:00:00')

  it.each([
    ['2026-10-11T11:59:30', '今'],
    ['2026-10-11T11:55:00', '5分'],
    ['2026-10-11T09:00:00', '3時間'],
    ['2026-10-01T09:00:00', '10月1日'],
    ['2025-12-31T09:00:00', '2025年12月31日'],
  ])('%s → %s', (iso, expected) => {
    expect(formatRelativeTime(new Date(iso).toISOString(), now)).toBe(expected)
  })
})

describe('formatCount（件数の表示）', () => {
  it('0 は表示しない・1 万以上は「万」で短くする', () => {
    expect(formatCount(0)).toBe('')
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(12_000)).toBe('1.2万')
    expect(formatCount(30_000)).toBe('3万')
  })
})

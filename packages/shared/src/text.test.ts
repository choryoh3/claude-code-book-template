import { describe, expect, it } from 'vitest'
import { extractHashtags, extractMentions } from './text'

describe('extractHashtags', () => {
  it('# を除いた小文字のタグを、出現順に返す', () => {
    expect(extractHashtags('今日は #Vue と #Pinia を勉強した')).toEqual(['vue', 'pinia'])
  })

  it('同じタグ（大文字小文字違いを含む）は 1 つにまとめる', () => {
    expect(extractHashtags('#Vue #vue #VUE')).toEqual(['vue'])
  })

  it('日本語のタグも取り出せる', () => {
    expect(extractHashtags('#開発日記 #勉強中')).toEqual(['開発日記', '勉強中'])
  })

  it('改行をまたいでも取り出せる', () => {
    expect(extractHashtags('1行目 #a\n2行目 #b')).toEqual(['a', 'b'])
  })

  it('# だけ・タグが無い本文では空の配列を返す', () => {
    expect(extractHashtags('# だけ')).toEqual([])
    expect(extractHashtags('タグなし')).toEqual([])
  })
})

describe('extractMentions', () => {
  it('@ を除いた小文字のハンドルを返す', () => {
    expect(extractMentions('@Alice さん、@bob も見て')).toEqual(['alice', 'bob'])
  })

  it('同じハンドルは 1 つにまとめる', () => {
    expect(extractMentions('@alice @Alice')).toEqual(['alice'])
  })

  it('3 文字未満のハンドルは対象外（ハンドルの最小文字数に合わせる）', () => {
    expect(extractMentions('@ab は対象外、@abc は対象')).toEqual(['abc'])
  })

  it('メンションが無ければ空の配列を返す', () => {
    expect(extractMentions('メンションなし')).toEqual([])
  })
})

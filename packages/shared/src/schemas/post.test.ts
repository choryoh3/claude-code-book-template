// 投稿の入力チェック（文字数・画像の枚数と URL・リプライと引用）のテスト。

import { describe, expect, it } from 'vitest'
import { MAX_POST_LENGTH, MAX_POST_MEDIA } from '../constants'
import { messages } from '../messages'
import { createPostSchema } from './post'

/** アップロードした画像の URL の形（POST /media が返す形） */
const URL_SAMPLE = 'http://localhost:3000/uploads/0b1f6f0e-1c52-4a8d-9d3a-1f2b3c4d5e6f.png'
const UUID_SAMPLE = '0b1f6f0e-1c52-4a8d-9d3a-1f2b3c4d5e6f'

/** 失敗した検証から、エラーメッセージの一覧を取り出す */
function errorMessages(input: unknown): string[] {
  const result = createPostSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('createPostSchema', () => {
  it('280 文字ちょうどの投稿は受け付ける', () => {
    const result = createPostSchema.safeParse({ content: 'あ'.repeat(MAX_POST_LENGTH) })
    expect(result.success).toBe(true)
  })

  it('281 文字の投稿は、日本語のメッセージで拒否する', () => {
    expect(errorMessages({ content: 'あ'.repeat(MAX_POST_LENGTH + 1) })).toContain(
      messages.postTooLong,
    )
  })

  it('本文が空でも、画像があれば受け付ける', () => {
    const result = createPostSchema.safeParse({ content: '', mediaUrls: [URL_SAMPLE] })
    expect(result.success).toBe(true)
  })

  it('本文も画像も無い投稿は拒否する（空白だけの本文も同じ）', () => {
    expect(errorMessages({ content: '' })).toContain(messages.postEmpty)
    expect(errorMessages({ content: '   ' })).toContain(messages.postEmpty)
  })

  it('画像は 4 枚まで。5 枚は拒否する', () => {
    const urls = (n: number) => Array.from({ length: n }).fill(URL_SAMPLE)
    expect(
      createPostSchema.safeParse({ content: 'a', mediaUrls: urls(MAX_POST_MEDIA) }).success,
    ).toBe(true)
    expect(errorMessages({ content: 'a', mediaUrls: urls(MAX_POST_MEDIA + 1) })).toContain(
      messages.tooManyMedia,
    )
  })

  it('画像の URL の形式が不正なら拒否する', () => {
    expect(errorMessages({ content: 'a', mediaUrls: ['not-a-url'] })).toContain(
      messages.invalidMediaUrl,
    )
  })

  it('アップロードした画像以外の URL（外部の画像・javascript:・data:）は拒否する', () => {
    const rejected = [
      'https://tracker.example.com/pixel.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'ftp://localhost/uploads/0b1f6f0e-1c52-4a8d-9d3a-1f2b3c4d5e6f.png',
    ]
    for (const url of rejected) {
      expect(errorMessages({ content: 'a', mediaUrls: [url] })).toContain(messages.invalidMediaUrl)
    }
  })

  it('リプライと引用を同時に指定することはできない', () => {
    const input = { content: 'a', replyToId: UUID_SAMPLE, quoteOfId: UUID_SAMPLE }
    expect(errorMessages(input)).toContain(messages.replyAndQuote)
  })

  it('省略した項目には既定値が入る（画像は空の配列）', () => {
    const result = createPostSchema.parse({ content: 'こんにちは' })
    expect(result.mediaUrls).toEqual([])
  })
})

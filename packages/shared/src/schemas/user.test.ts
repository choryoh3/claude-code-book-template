import { describe, expect, it } from 'vitest'
import { messages } from '../messages'
import { loginSchema, registerSchema, updateProfileSchema } from './user'

const VALID_REGISTER = {
  displayName: 'Alice',
  handle: 'alice_01',
  email: 'alice@example.com',
  password: 'Password1',
}

function registerErrors(overrides: Record<string, unknown>): string[] {
  const result = registerSchema.safeParse({ ...VALID_REGISTER, ...overrides })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('registerSchema', () => {
  it('正しい入力は受け付ける', () => {
    expect(registerSchema.safeParse(VALID_REGISTER).success).toBe(true)
  })

  it('ハンドルは 3〜15 文字の半角英数字と _ だけ', () => {
    expect(registerErrors({ handle: 'ab' })).toContain(messages.minLength('ハンドル名', 3))
    expect(registerErrors({ handle: 'a'.repeat(16) })).toContain(
      messages.maxLength('ハンドル名', 15),
    )
    expect(registerErrors({ handle: 'あいう' })).toContain(messages.invalidHandle)
    expect(registerErrors({ handle: 'has space' })).toContain(messages.invalidHandle)
    expect(registerErrors({ handle: 'a'.repeat(15) })).toEqual([])
  })

  it('パスワードは 8 文字以上で、英字と数字を含む', () => {
    expect(registerErrors({ password: 'Pass1' })).toContain(messages.invalidPassword) // 短い
    expect(registerErrors({ password: 'onlyletters' })).toContain(messages.invalidPassword) // 数字なし
    expect(registerErrors({ password: '12345678' })).toContain(messages.invalidPassword) // 英字なし
    expect(registerErrors({ password: 'Password1' })).toEqual([])
  })

  it('パスワードが 72 文字を超えると拒否する（bcrypt は 72 バイトまでしか見ないため）', () => {
    expect(registerErrors({ password: `a1${'x'.repeat(71)}` })).toContain(messages.passwordTooLong)
  })

  it('メールアドレスの形式が不正なら拒否する', () => {
    expect(registerErrors({ email: 'not-an-email' })).toContain(messages.invalidEmail)
  })

  it('表示名の前後の空白は取り除き、空なら拒否する', () => {
    expect(registerSchema.parse({ ...VALID_REGISTER, displayName: '  Alice  ' }).displayName).toBe(
      'Alice',
    )
    expect(registerErrors({ displayName: '   ' })).toContain(messages.required('表示名'))
  })
})

describe('loginSchema', () => {
  it('パスワードの強さは検証しない（登録時の規則が変わっても、既存ユーザーがログインできるように）', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'weak' }).success).toBe(true)
  })

  it('パスワードが空なら拒否する', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('送った項目だけを検証する（空のオブジェクトも可）', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true)
    expect(updateProfileSchema.safeParse({ bio: '自己紹介' }).success).toBe(true)
  })

  it('自己紹介は 160 文字まで', () => {
    expect(updateProfileSchema.safeParse({ bio: 'あ'.repeat(160) }).success).toBe(true)
    expect(updateProfileSchema.safeParse({ bio: 'あ'.repeat(161) }).success).toBe(false)
  })

  it('アイコン・ヘッダーは URL か null（削除）を受け付ける', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: null }).success).toBe(true)
    expect(updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false)
  })
})

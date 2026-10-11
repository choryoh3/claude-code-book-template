import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureApiAuth } from '@/api/client'
import { errorResponse, jsonResponse, makeAuthResponse } from '@/test/fixtures'
import { useAuthStore } from './auth'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  configureApiAuth(null)
  vi.unstubAllGlobals()
})

describe('useAuthStore', () => {
  it('ログインに成功すると、access token と自分の情報をメモリに持つ', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse('token-a')))
    const auth = useAuthStore()

    await auth.login({ email: 'alice@example.com', password: 'Password#123' })

    expect(auth.accessToken).toBe('token-a')
    expect(auth.user?.handle).toBe('alice')
    expect(auth.isAuthenticated).toBe(true)
  })

  it('access token を localStorage に保存しない（XSS で盗まれないように）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse('secret-token')))
    const auth = useAuthStore()

    await auth.login({ email: 'alice@example.com', password: 'Password#123' })

    expect(JSON.stringify({ ...localStorage })).not.toContain('secret-token')
  })

  it('ログインに失敗したら、ログイン状態にならない', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'INVALID_CREDENTIALS', '正しくありません'))
    const auth = useAuthStore()

    await expect(auth.login({ email: 'a@example.com', password: 'x' })).rejects.toThrow(
      '正しくありません',
    )
    expect(auth.isAuthenticated).toBe(false)
  })

  it('ログアウトは、サーバーへの通知に失敗しても画面のログイン状態を消す', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeAuthResponse()))
      .mockRejectedValueOnce(new TypeError('offline'))
    const auth = useAuthStore()
    await auth.login({ email: 'alice@example.com', password: 'Password#123' })

    await auth.logout().catch(() => {})

    expect(auth.accessToken).toBeNull()
    expect(auth.status).toBe('guest')
  })

  it('起動時の restore は Cookie の refresh token でログイン状態を復元する（1 回だけ）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse('restored')))
    const auth = useAuthStore()

    await auth.restore()
    await auth.restore()

    expect(auth.accessToken).toBe('restored')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/auth/refresh')
  })

  it('restore に失敗したら未ログイン（guest）になる', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'TOKEN_EXPIRED', '期限切れ'))
    const auth = useAuthStore()

    await auth.restore()

    expect(auth.status).toBe('guest')
  })

  it('refresh が同時に呼ばれても、通信は 1 回にまとめる', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse()))
    const auth = useAuthStore()

    const results = await Promise.all([auth.refresh(), auth.refresh(), auth.refresh()])

    expect(results).toEqual([true, true, true])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

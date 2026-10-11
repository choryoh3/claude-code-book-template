import { postDtoSchema } from '@xclone/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorResponse, jsonResponse, makePost } from '@/test/fixtures'
import { ApiError, apiRequest, configureApiAuth } from './client'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  configureApiAuth(null)
  vi.unstubAllGlobals()
})

/** fetch に渡された n 回目の引数（URL と設定） */
function call(n: number) {
  const [url, init] = fetchMock.mock.calls[n] ?? []
  return {
    url: String(url),
    init: init ?? {},
    headers: (init?.headers ?? {}) as Record<string, string>,
  }
}

describe('apiRequest', () => {
  it('/api を付けた URL に送り、クエリの undefined・空の項目は付けない', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await apiRequest('/search', { query: { q: 'vue', cursor: undefined, type: '' } })

    expect(call(0).url).toBe('/api/search?q=vue')
  })

  it('ログイン中なら Authorization ヘッダーに access token を付ける', async () => {
    configureApiAuth({
      getAccessToken: () => 'token-1',
      refresh: vi.fn(),
      onSessionExpired: vi.fn(),
    })
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiRequest('/me')

    expect(call(0).headers.Authorization).toBe('Bearer token-1')
  })

  it('本文は JSON で送り、応答はスキーマで検証した値を返す', async () => {
    const post = makePost()
    fetchMock.mockResolvedValue(jsonResponse(post, 201))

    const result = await apiRequest('/posts', {
      method: 'POST',
      body: { content: 'a' },
      schema: postDtoSchema,
    })

    expect(call(0).headers['Content-Type']).toBe('application/json')
    expect(call(0).init.body).toBe('{"content":"a"}')
    expect(result).toEqual(post)
  })

  it('401 のときは refresh を 1 回だけ試し、成功したら同じリクエストを送り直す', async () => {
    let token = 'old'
    const refresh = vi.fn(async () => {
      token = 'new'
      return true
    })
    configureApiAuth({ getAccessToken: () => token, refresh, onSessionExpired: vi.fn() })
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'TOKEN_EXPIRED', '期限切れ'))
      .mockResolvedValueOnce(jsonResponse({}))

    await apiRequest('/me')

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(call(1).headers.Authorization).toBe('Bearer new')
  })

  it('refresh にも失敗したら、ログアウト扱いにして 401 のエラーを投げる（無限に再試行しない）', async () => {
    const onSessionExpired = vi.fn()
    configureApiAuth({
      getAccessToken: () => 'old',
      refresh: vi.fn(async () => false),
      onSessionExpired,
    })
    fetchMock.mockResolvedValue(errorResponse(401, 'TOKEN_EXPIRED', '期限切れ'))

    await expect(apiRequest('/me')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' })
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retryOnUnauthorized が false なら refresh を試さない（ログイン・refresh 自身）', async () => {
    const refresh = vi.fn(async () => true)
    configureApiAuth({ getAccessToken: () => null, refresh, onSessionExpired: vi.fn() })
    fetchMock.mockResolvedValue(
      errorResponse(401, 'INVALID_CREDENTIALS', 'メールアドレスまたはパスワードが正しくありません'),
    )

    await expect(
      apiRequest('/auth/login', { method: 'POST', retryOnUnauthorized: false }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'メールアドレスまたはパスワードが正しくありません',
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('エラー応答を ApiError（code・message・requestId）に変換する', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'POST_NOT_FOUND', 'この投稿は存在しません'))

    const error = await apiRequest('/posts/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'POST_NOT_FOUND', requestId: 'req-test' })
  })

  it('通信そのものに失敗したら NETWORK_ERROR にする', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(apiRequest('/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
  })

  it('204（本文なし）は undefined を返す', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiRequest('/posts/x', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

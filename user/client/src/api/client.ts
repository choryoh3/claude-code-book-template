// API 通信の土台（fetch のラッパー）。各機能の API 関数（api/*.ts）はすべてここを通す。
//
// やっていること:
//   1. URL の組み立て（/api + パス + クエリ）と JSON の送受信
//   2. ログイン中なら Authorization: Bearer <access token> を付ける
//   3. 401（access token の期限切れ）が返ったら、refresh を「1 回だけ」試して、もう一度送る
//      （それでもダメならログアウト扱い。無限ループにしない: .claude/rules/vue-client.md）
//   4. 応答を shared の Zod スキーマで検証する（サーバーとの約束が崩れていたらすぐ気づけるように）
//   5. エラー応答（{ error: { code, message, requestId } }）を ApiError に変換する

import type { ErrorCode } from '@xclone/shared'
import type { z } from 'zod'
import { errorResponseSchema } from '@xclone/shared'

const API_BASE = '/api'

/** API のエラー。画面は code で分岐し、message をそのまま表示できる */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly requestId?: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** ログイン状態とのつなぎ（auth store が configureApiAuth で登録する） */
export interface ApiAuthHandlers {
  /** 今の access token（無ければ null） */
  getAccessToken: () => string | null
  /** refresh token で access token を取り直す。成功したら true */
  refresh: () => Promise<boolean>
  /** refresh にも失敗したとき（ログアウト扱いにする） */
  onSessionExpired: () => void
}

let authHandlers: ApiAuthHandlers | null = null

export function configureApiAuth(handlers: ApiAuthHandlers | null) {
  authHandlers = handlers
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** JSON で送る本文 */
  body?: unknown
  /** ファイルを送るとき（multipart/form-data） */
  formData?: FormData
  /** クエリ文字列（undefined の項目は付けない） */
  query?: Record<string, string | number | undefined>
  /** 応答の検証に使う Zod スキーマ（204 など本文が無いときは省略） */
  schema?: z.ZodType<T>
  /** 401 のとき refresh を試すか（refresh 自身やログインでは試さない） */
  retryOnUnauthorized?: boolean
}

function buildUrl(path: string, query?: RequestOptions<unknown>['query']): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return `${API_BASE}${path}${search ? `?${search}` : ''}`
}

function send(path: string, options: RequestOptions<unknown>): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = authHandlers?.getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData // Content-Type（境界の文字列つき）はブラウザに任せる
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'same-origin', // refresh token の Cookie を送る（同じオリジンのときだけ）
  })
}

/** エラー応答を ApiError に変換する。形が想定外なら一般的なメッセージにする */
async function toApiError(response: Response): Promise<ApiError> {
  const parsed = errorResponseSchema.safeParse(await response.json().catch(() => null))
  if (parsed.success) {
    const { code, message, requestId, fields } = parsed.data.error
    return new ApiError(response.status, code, message, requestId, fields)
  }
  return new ApiError(response.status, 'INTERNAL_ERROR', 'サーバーでエラーが発生しました')
}

/** API を呼ぶ。成功したら（schema があれば検証した）本文を返し、失敗したら ApiError を投げる */
export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  let response: Response
  try {
    response = await send(path, options)
    const canRetry = options.retryOnUnauthorized !== false && authHandlers !== null
    if (response.status === 401 && canRetry) {
      // access token の期限切れかもしれない → refresh を 1 回だけ試して、送り直す
      if (await authHandlers?.refresh()) {
        response = await send(path, options)
      } else {
        authHandlers?.onSessionExpired()
      }
    }
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '通信できませんでした。接続を確認してください')
  }

  if (!response.ok) throw await toApiError(response)
  if (!options.schema || response.status === 204) return undefined as T
  return options.schema.parse(await response.json())
}

/** 画面に出すエラーメッセージ（ApiError 以外は一般的な文言） */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : '読み込みに失敗しました。時間をおいて再度お試しください'
}

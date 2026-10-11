// refresh token を入れる Cookie の設定。

import type { CookieOptions, Response } from 'express'
import { REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS } from '@xclone/shared'
import { config } from '../config'

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript から読めない（XSS で盗まれにくい）
  secure: config.isProduction, // 本番は HTTPS のときだけ送る
  sameSite: 'lax', // 他サイトからのリクエストには付けない（CSRF 対策）
  path: '/api/auth', // 認証の API にだけ送る（それ以外の API には不要）
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  })
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions)
}

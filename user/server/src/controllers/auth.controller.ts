// 認証の controller。入力を検証 → service を呼ぶ → refresh token を Cookie に入れて応答する。

import type { Request, Response } from 'express'
import type { AppDeps } from '../deps'
import { loginSchema, REFRESH_COOKIE_NAME, registerSchema } from '@xclone/shared'
import { clearRefreshCookie, setRefreshCookie } from '../lib/cookies'
import * as authService from '../services/auth.service'

/** トークンを発行した端末の情報 */
function clientMeta(req: Request): authService.ClientMeta {
  return { userAgent: req.header('user-agent'), ip: req.ip }
}

/** Cookie から refresh token を取り出す */
function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME]
  return typeof value === 'string' ? value : undefined
}

export function createAuthController({ db }: AppDeps) {
  return {
    /** POST /auth/register — 登録して、そのままログイン状態にする */
    async register(req: Request, res: Response) {
      const input = registerSchema.parse(req.body)
      const result = await authService.register(db, input, clientMeta(req))
      setRefreshCookie(res, result.refreshToken)
      res.status(201).json(result.response)
    },

    /** POST /auth/login */
    async login(req: Request, res: Response) {
      const input = loginSchema.parse(req.body)
      const result = await authService.login(db, input, clientMeta(req))
      setRefreshCookie(res, result.refreshToken)
      res.json(result.response)
    },

    /** POST /auth/refresh — Cookie の refresh token で、新しいトークンを発行する（ページの再読み込み時など） */
    async refresh(req: Request, res: Response) {
      try {
        const result = await authService.refresh(db, readRefreshCookie(req), clientMeta(req))
        setRefreshCookie(res, result.refreshToken)
        res.json(result.response)
      } catch (error) {
        clearRefreshCookie(res) // 使えない Cookie は消しておく（次回から無駄に送らない）
        throw error
      }
    },

    /** POST /auth/logout */
    async logout(req: Request, res: Response) {
      await authService.logout(db, readRefreshCookie(req))
      clearRefreshCookie(res)
      res.status(204).end()
    },
  }
}

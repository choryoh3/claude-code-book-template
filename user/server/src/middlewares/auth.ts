// 認証ミドルウェア: access token を検証し、ログイン中のユーザーを req.auth に入れる。
// 凍結されたユーザーは、ログイン済みでも 403 にする（管理者の凍結がすぐに効くよう、毎回 DB で確認する）。

import type { Database } from '@xclone/db'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ERROR_CODES } from '@xclone/shared'
import { currentContext } from '../context'
import { forbidden, unauthorized } from '../errors'
import { verifyAccessToken } from '../lib/tokens'

const BEARER_PREFIX = 'Bearer '

/** Authorization: Bearer <token> から token を取り出す */
function readBearerToken(req: Request): string | undefined {
  const header = req.header('authorization')
  return header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : undefined
}

/**
 * ログインしているユーザーを確認し、使えるアカウントか（存在する・凍結されていない）を DB で確かめる。
 * Socket.IO の接続時にも同じ確認をする（realtime/socket.ts）。
 */
export async function authenticate(db: Database, token: string | undefined) {
  if (!token) throw unauthorized()
  const { userId } = await verifyAccessToken(token)
  return authenticateUserId(db, userId)
}

/**
 * そのユーザーが今も使える状態か（存在する・凍結されていない）を DB で確かめる。
 * 接続を保ったままの Socket.IO で、操作のたびに凍結を反映させるためにも使う。
 */
export async function authenticateUserId(db: Database, userId: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'role', 'is_suspended'])
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!user) throw unauthorized('アカウントが見つかりません')
  if (user.is_suspended)
    throw forbidden('このアカウントは凍結されています', ERROR_CODES.ACCOUNT_SUSPENDED)
  return { userId: user.id, role: user.role }
}

/** ログイン必須のルートに付けるミドルウェア */
export function createRequireAuth(db: Database): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.auth = await authenticate(db, readBearerToken(req))
    // ログに userId を自動で付けるため、リクエストの文脈にも入れる
    const context = currentContext()
    if (context) context.userId = req.auth.userId
    next()
  }
}

/** controller でログイン中のユーザーを取り出す（requireAuth を付け忘れたルートでは 401 になる） */
export function getAuth(req: Request) {
  if (!req.auth) throw unauthorized()
  return req.auth
}

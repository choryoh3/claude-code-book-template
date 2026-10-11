// ログイン状態を表すトークン（docs/adr/0004-jwt-auth-strategy.md）。
// - access token : 短命（15 分）の JWT。画面はメモリにだけ持ち、API を呼ぶときに Authorization ヘッダーで送る
// - refresh token: 長命（30 日）のランダムな文字列。httpOnly Cookie で渡し、DB には「ハッシュ」だけを保存する

import { createHash, randomBytes } from 'node:crypto'
import { ACCESS_TOKEN_TTL_SECONDS, ERROR_CODES, USER_ROLES } from '@xclone/shared'
import { errors, jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'
import { config } from '../config'
import { unauthorized } from '../errors'

/** 管理者用のトークンと取り違えないよう、発行者と利用者（audience）を明記する */
const ISSUER = 'xclone-user-server'
const AUDIENCE = 'xclone-user'
const secretKey = new TextEncoder().encode(config.jwtAccessSecret)

const payloadSchema = z.object({ sub: z.uuid(), role: z.enum(USER_ROLES) })

export interface AccessTokenPayload {
  userId: string
  role: (typeof USER_ROLES)[number]
}

/** access token（JWT）を発行する */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey)
}

/** access token を検証して中身を返す。期限切れ・改ざん・別用途のトークンは 401 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { issuer: ISSUER, audience: AUDIENCE })
    const parsed = payloadSchema.parse(payload)
    return { userId: parsed.sub, role: parsed.role }
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw unauthorized('ログインの有効期限が切れました', ERROR_CODES.TOKEN_EXPIRED)
    }
    throw unauthorized('ログイン情報が正しくありません')
  }
}

/** refresh token を新しく作る（推測できない 32 バイトの乱数） */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

/** refresh token のハッシュ（DB にはこれだけを保存する。DB が漏れても token そのものは分からない） */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// 認証: 登録・ログイン・トークンの更新（refresh）・ログアウト（docs/adr/0004-jwt-auth-strategy.md）。
//
// refresh token は使うたびに新しいものへ交換する（ローテーション）。
// すでに交換済み（失効済み）の token が使われたら「盗まれた可能性がある」とみなし、その人の token を全て失効させる。

import type { Database } from '@xclone/db'
import type { AuthResponse, LoginInput, RegisterInput } from '@xclone/shared'
import { ACCESS_TOKEN_TTL_SECONDS, ERROR_CODES, REFRESH_TOKEN_TTL_SECONDS } from '@xclone/shared'
import { conflict, forbidden, isUniqueViolation, unauthorized } from '../errors'
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/password'
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../lib/tokens'
import { getCurrentUser } from './user.service'

/**
 * 交換済みの refresh token が使われても「盗用」とみなさない猶予（秒）。
 * 複数のタブが同時に再読み込みすると、同じ token で refresh が重なるため（docs/adr/0004）。
 */
const CONCURRENT_REFRESH_GRACE_SECONDS = 10

/** トークンを発行した端末の情報（不審なログインの調査用に refresh_tokens に残す） */
export interface ClientMeta {
  userAgent?: string
  ip?: string
}

/** 認証の結果。refreshToken は controller が Cookie に入れ、応答の本文（response）には含めない */
export interface AuthResult {
  response: AuthResponse
  refreshToken: string
}

/** アカウント登録。登録したらそのままログイン状態にする */
export async function register(
  db: Database,
  input: RegisterInput,
  meta: ClientMeta,
): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password)
  try {
    // ユーザーの保存とトークンの発行は 1 つのトランザクション
    // （トークンの発行だけ失敗して「ユーザーだけ残る → 再登録すると EMAIL_TAKEN」になるのを防ぐ）
    return await db.transaction().execute(async (trx) => {
      const user = await trx
        .insertInto('users')
        .values({
          handle: input.handle,
          email: input.email,
          password_hash: passwordHash,
          display_name: input.displayName,
        })
        .returning(['id', 'role'])
        .executeTakeFirstOrThrow()
      return issueTokens(trx, user, meta)
    })
  } catch (error) {
    // メール・ハンドルの重複は DB の一意制約で検出する（「確認してから登録」だと同時の登録で漏れるため）
    if (isUniqueViolation(error)) {
      if (error.constraint === 'users_email_lower_key') {
        throw conflict('このメールアドレスはすでに使われています', ERROR_CODES.EMAIL_TAKEN)
      }
      throw conflict('このハンドル名はすでに使われています', ERROR_CODES.HANDLE_TAKEN)
    }
    throw error
  }
}

/** ログイン。失敗の理由（メールが無い / パスワード違い）は区別せずに返す（アカウントの存在を漏らさない） */
export async function login(
  db: Database,
  input: LoginInput,
  meta: ClientMeta,
): Promise<AuthResult> {
  const user = await db
    .selectFrom('users')
    .select(['id', 'role', 'password_hash', 'is_suspended'])
    .where((eb) => eb(eb.fn('lower', ['email']), '=', input.email.toLowerCase()))
    .executeTakeFirst()

  const isValid = user
    ? await verifyPassword(input.password, user.password_hash)
    : await verifyAgainstDummy(input.password)
  if (!user || !isValid) {
    throw unauthorized(
      'メールアドレスまたはパスワードが正しくありません',
      ERROR_CODES.INVALID_CREDENTIALS,
    )
  }
  // 凍結の判定は「パスワードが正しいとき」だけ（他人が凍結の有無を調べられないように）
  if (user.is_suspended) {
    throw forbidden('このアカウントは凍結されています', ERROR_CODES.ACCOUNT_SUSPENDED)
  }

  await db
    .updateTable('users')
    .set({ last_login_at: new Date() })
    .where('id', '=', user.id)
    .execute()
  return issueTokens(db, user, meta)
}

/** refresh token を使って、新しい access token と refresh token を発行する */
export async function refresh(
  db: Database,
  rawToken: string | undefined,
  meta: ClientMeta,
): Promise<AuthResult> {
  if (!rawToken) throw unauthorized('ログインが必要です', ERROR_CODES.TOKEN_EXPIRED)

  // ⚠ トランザクションの中で例外を投げると、それまでの変更（失効の記録）も取り消されてしまう。
  // そのため「全て失効させるべき」と判定した場合は、結果として返し、トランザクションの外で失効させてから例外にする。
  const outcome = await db.transaction().execute(async (trx) => {
    const stored = await trx
      .selectFrom('refresh_tokens as t')
      .innerJoin('users as u', 'u.id', 't.user_id')
      .select(['t.id', 't.user_id', 't.expires_at', 't.revoked_at', 'u.role', 'u.is_suspended'])
      .where('t.token_hash', '=', hashRefreshToken(rawToken))
      .forUpdate()
      .executeTakeFirst()

    if (!stored) throw unauthorized('ログインが必要です', ERROR_CODES.TOKEN_EXPIRED)
    if (stored.revoked_at) {
      // 交換した直後（数秒以内）の再使用は、複数のタブが同時に再読み込みしただけのことが多い（正当な利用）。
      // その場合は全端末をログアウトさせず、この要求だけを断る（ブラウザには新しい Cookie が届いている）
      const secondsSinceRevoked = (Date.now() - stored.revoked_at.getTime()) / 1000
      if (secondsSinceRevoked <= CONCURRENT_REFRESH_GRACE_SECONDS) {
        throw unauthorized('もう一度お試しください', ERROR_CODES.TOKEN_EXPIRED)
      }
      // それより後の再使用は、盗まれた token が使われた可能性がある
      return { kind: 'reused', userId: stored.user_id } as const
    }
    if (stored.expires_at < new Date())
      throw unauthorized('ログインの有効期限が切れました', ERROR_CODES.TOKEN_EXPIRED)
    if (stored.is_suspended) return { kind: 'suspended', userId: stored.user_id } as const

    // 古い token を失効させ、新しい token を発行する（ローテーション）
    await trx
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('id', '=', stored.id)
      .execute()
    return {
      kind: 'rotated',
      result: await issueTokens(trx, { id: stored.user_id, role: stored.role }, meta),
    } as const
  })

  if (outcome.kind === 'rotated') return outcome.result

  // 盗用の疑い・凍結: その人の有効な token を全て失効させる（確定させてから例外にする）
  await revokeAllTokens(db, outcome.userId)
  if (outcome.kind === 'suspended') {
    throw forbidden('このアカウントは凍結されています', ERROR_CODES.ACCOUNT_SUSPENDED)
  }
  throw unauthorized('もう一度ログインしてください', ERROR_CODES.TOKEN_EXPIRED)
}

/** ログアウト。この端末の refresh token を失効させる（無い・不正な token でもエラーにしない） */
export async function logout(db: Database, rawToken: string | undefined): Promise<void> {
  if (!rawToken) return
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('token_hash', '=', hashRefreshToken(rawToken))
    .where('revoked_at', 'is', null)
    .execute()
}

/** その人の有効な refresh token を全て失効させる（凍結・強制ログアウト・盗用の疑い） */
export async function revokeAllTokens(db: Database, userId: string): Promise<void> {
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute()
}

/** access token と refresh token を発行する。refresh token はハッシュだけを DB に保存する */
async function issueTokens(
  db: Database,
  user: { id: string; role: 'user' | 'admin' },
  meta: ClientMeta,
): Promise<AuthResult> {
  const refreshToken = generateRefreshToken()
  await db
    .insertInto('refresh_tokens')
    .values({
      user_id: user.id,
      token_hash: hashRefreshToken(refreshToken),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      user_agent: meta.userAgent?.slice(0, 500) ?? null,
      ip: meta.ip ?? null,
    })
    .execute()

  return {
    refreshToken,
    response: {
      accessToken: await signAccessToken({ userId: user.id, role: user.role }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: await getCurrentUser(db, user.id),
    },
  }
}

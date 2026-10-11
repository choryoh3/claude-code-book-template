// ユーザーに関する契約: 登録・ログイン・プロフィール。
import { z } from 'zod'
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USER_ROLES,
} from '../constants'
import { messages } from '../messages'
import { idSchema, isoDateTimeSchema } from './common'

// ---------------------------------------------------------------- 入力項目（登録・ログイン・プロフィールで共通）
export const handleSchema = z
  .string(messages.required('ハンドル名'))
  .min(HANDLE_MIN_LENGTH, messages.minLength('ハンドル名', HANDLE_MIN_LENGTH))
  .max(HANDLE_MAX_LENGTH, messages.maxLength('ハンドル名', HANDLE_MAX_LENGTH))
  .regex(HANDLE_PATTERN, messages.invalidHandle)

export const emailSchema = z
  .string(messages.required('メールアドレス'))
  .max(EMAIL_MAX_LENGTH, messages.maxLength('メールアドレス', EMAIL_MAX_LENGTH))
  .pipe(z.email(messages.invalidEmail))

/** 新しく決めるパスワード: 8〜72 文字で、英字と数字を含む（ログイン時の照合には使わない） */
export const newPasswordSchema = z
  .string(messages.required('パスワード'))
  .min(PASSWORD_MIN_LENGTH, messages.invalidPassword)
  .max(PASSWORD_MAX_LENGTH, messages.passwordTooLong)
  .regex(/[A-Z]/i, messages.invalidPassword)
  .regex(/\d/, messages.invalidPassword)

export const displayNameSchema = z
  .string(messages.required('表示名'))
  .trim()
  .min(1, messages.required('表示名'))
  .max(DISPLAY_NAME_MAX_LENGTH, messages.maxLength('表示名', DISPLAY_NAME_MAX_LENGTH))

export const bioSchema = z
  .string()
  .max(BIO_MAX_LENGTH, messages.maxLength('自己紹介', BIO_MAX_LENGTH))

// ---------------------------------------------------------------- リクエスト
/** アカウント登録 */
export const registerSchema = z.object({
  displayName: displayNameSchema,
  handle: handleSchema,
  email: emailSchema,
  password: newPasswordSchema,
})
export type RegisterInput = z.infer<typeof registerSchema>

/** ログイン（パスワードの強さは検証しない。登録時の規則が将来変わっても、既存ユーザーがログインできるように） */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string(messages.required('パスワード'))
    .min(1, messages.required('パスワード'))
    .max(PASSWORD_MAX_LENGTH),
})
export type LoginInput = z.infer<typeof loginSchema>

/** ハンドル名の重複確認 `GET /users/availability?handle=` */
export const handleAvailabilityQuerySchema = z.object({ handle: handleSchema })
export const handleAvailabilityResponseSchema = z.object({ available: z.boolean() })
export type HandleAvailabilityResponse = z.infer<typeof handleAvailabilityResponseSchema>

/** プロフィールの更新 `PATCH /me`（送った項目だけを更新する） */
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema,
    bio: bioSchema,
    avatarUrl: z.url(messages.invalidUrl).nullable(),
    headerUrl: z.url(messages.invalidUrl).nullable(),
  })
  .partial()
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ---------------------------------------------------------------- レスポンス（DTO）
/** ユーザーの最小情報（投稿カード・通知・一覧の行に使う） */
export const userSummaryDtoSchema = z.object({
  id: idSchema,
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type UserSummaryDto = z.infer<typeof userSummaryDtoSchema>

/** プロフィール画面用。viewer（見ている人）との関係も含む */
export const userProfileDtoSchema = userSummaryDtoSchema.extend({
  bio: z.string(),
  headerUrl: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  postCount: z.number().int().nonnegative(),
  /** 凍結中のアカウント（画面は「このアカウントは凍結されています」だけを表示する） */
  isSuspended: z.boolean(),
  /** 見ている人がこのユーザーをフォローしているか */
  isFollowing: z.boolean(),
  /** 見ている人がこのユーザー本人か（「プロフィールを編集」ボタンの出し分け） */
  isSelf: z.boolean(),
})
export type UserProfileDto = z.infer<typeof userProfileDtoSchema>

/** ログイン中の自分自身の情報 */
export const currentUserDtoSchema = userSummaryDtoSchema.extend({
  email: z.string(),
  role: z.enum(USER_ROLES),
})
export type CurrentUserDto = z.infer<typeof currentUserDtoSchema>

/** ログイン・登録・refresh の成功時の応答。refresh token は httpOnly Cookie で渡すので、ここには含めない */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  /** access token の有効期間（秒） */
  expiresIn: z.number().int().positive(),
  user: currentUserDtoSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

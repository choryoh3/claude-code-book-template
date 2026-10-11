// 入力チェックのエラーメッセージ（日本語）。画面にそのまま表示される文言なので、
// docs/screens/specs/common.mjs の「メッセージ一覧」と一致させること。
import {
  MAX_POST_LENGTH,
  MAX_POST_MEDIA,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './constants'

export const messages = {
  /** MSG-005: {項目}は必須です */
  required: (label: string) => `${label}は必須です`,
  /** MSG-006: {項目}は{n}文字以内で入力してください */
  maxLength: (label: string, max: number) => `${label}は${max}文字以内で入力してください`,
  minLength: (label: string, min: number) => `${label}は${min}文字以上で入力してください`,
  invalidEmail: 'メールアドレスの形式が正しくありません',
  invalidHandle: 'ハンドル名は半角英数字と _ だけが使えます',
  /** MSG-007 */
  invalidPassword: `パスワードは${PASSWORD_MIN_LENGTH}文字以上で、英字と数字を含めてください`,
  passwordTooLong: `パスワードは${PASSWORD_MAX_LENGTH}文字以内で入力してください`,
  /** MSG-008 */
  postTooLong: `投稿は${MAX_POST_LENGTH}文字以内で入力してください`,
  /** MSG-009 */
  tooManyMedia: `画像は${MAX_POST_MEDIA}枚まで添付できます`,
  postEmpty: '本文または画像を入力してください',
  replyAndQuote: 'リプライと引用は同時に指定できません',
  invalidUrl: 'URL の形式が正しくありません',
} as const

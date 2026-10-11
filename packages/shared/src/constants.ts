// 画面（client）とサーバー（server）が共有する定数。
// 文字数の上限などの「約束事」は、ここ 1 か所だけで決める（画面とサーバーで食い違わないようにするため）。
//
// ⚠ DB のカラムの制約（packages/db/migrations）とも一致させること。
//   列挙型は packages/db/src/contract.ts が「DB の型と一致しているか」を型検査で保証している。

// ---------------------------------------------------------------- 文字数・個数の上限
/** 投稿の最大文字数 */
export const MAX_POST_LENGTH = 280
/** 1 投稿に添付できる画像の最大枚数 */
export const MAX_POST_MEDIA = 4

export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 15
/** ハンドル名（@ の後ろ）に使える文字: 半角英数字と _ */
export const HANDLE_PATTERN = /^\w+$/

export const DISPLAY_NAME_MAX_LENGTH = 50
export const BIO_MAX_LENGTH = 160
export const EMAIL_MAX_LENGTH = 254

export const PASSWORD_MIN_LENGTH = 8
/** bcrypt が扱えるのは先頭 72 バイトまで。それ以降は無視されてしまうため、上限で弾く */
export const PASSWORD_MAX_LENGTH = 72

export const REPORT_DETAIL_MAX_LENGTH = 500
export const ADMIN_NOTE_MAX_LENGTH = 1000
/** 管理者が操作の理由として入力する文字数の上限（凍結・非表示・削除など） */
export const ADMIN_REASON_MAX_LENGTH = 500
export const SEARCH_QUERY_MAX_LENGTH = 100

// ---------------------------------------------------------------- ページネーション
export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 50

// ---------------------------------------------------------------- 画像
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const HEADER_MAX_BYTES = 5 * 1024 * 1024

// ---------------------------------------------------------------- 列挙（DB の enum と同じ値）
export const USER_ROLES = ['user', 'admin'] as const
export const POST_STATUSES = ['visible', 'hidden', 'deleted'] as const
export const NOTIFICATION_TYPES = ['like', 'repost', 'follow', 'reply', 'mention', 'quote'] as const
export const REPORT_TARGET_TYPES = ['post', 'user'] as const
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'other'] as const
/** 未対応 / 対応中 / 完了 */
export const REPORT_STATUSES = ['open', 'in_progress', 'resolved'] as const
export const AUDIT_ACTIONS = [
  'user_suspend',
  'user_unsuspend',
  'force_logout',
  'role_change',
  'post_hide',
  'post_unhide',
  'post_delete',
  'report_update',
] as const

// ---------------------------------------------------------------- 管理画面
/** ダッシュボードで選べる集計期間（日） */
export const STATS_PERIOD_DAYS = [7, 14, 30] as const
export const STATS_PERIOD_DEFAULT = 14

// ---------------------------------------------------------------- 認証（秒）
/** access token の有効期間（短命。メモリにだけ持つ） */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
/** refresh token の有効期間 */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
/** refresh token を入れる Cookie の名前（ユーザー用 / 管理者用で分ける） */
export const REFRESH_COOKIE_NAME = 'xclone_refresh'
export const ADMIN_REFRESH_COOKIE_NAME = 'xclone_admin_refresh'

// seed のユーザー: 管理者 2 人、確認用の名前付き 5 人、ボリューム用の 25 人（合計 32 人）。
// 一覧は docs/test-data.md と一致させること（変更したら両方を更新する）。
import type { Insertable } from 'kysely'
import type { Users } from '../src/generated/db'
import type { Random } from './random'
import type { SeedUser } from './types'
import { daysBefore } from './clock'
import { stableUuid } from './random'

/** 一般ユーザー共通のパスワード（開発専用の公開情報） */
export const USER_PASSWORD = 'Password#123'
/** 管理者のパスワード（開発専用の公開情報） */
export const ADMIN_PASSWORD = 'Admin#12345'

/** dave が凍結されたのは何日前か（通報・監査ログ・DAU の日付をこれに合わせる） */
export const DAVE_SUSPENDED_DAYS_AGO = 2

/** ボリューム用ユーザーの数（user06〜user30） */
const VOLUME_USER_COUNT = 25

/** 名前付きユーザーの定義。何日前に登録したか（registeredDaysAgo）も含む */
interface NamedUser {
  handle: string
  displayName: string
  bio: string
  role: 'user' | 'admin'
  registeredDaysAgo: number
  avatar: boolean
  suspendedReason?: string
  suspendedDaysAgo?: number
}

const NAMED_USERS: NamedUser[] = [
  {
    handle: 'admin',
    displayName: 'Admin',
    bio: '運営チーム（管理者）',
    role: 'admin',
    registeredDaysAgo: 40,
    avatar: false,
  },
  {
    handle: 'admin2',
    displayName: 'Admin 2',
    bio: '運営チーム（管理者）',
    role: 'admin',
    registeredDaysAgo: 40,
    avatar: false,
  },
  {
    handle: 'alice',
    displayName: 'Alice',
    bio: 'Vue と TypeScript が好きなエンジニア。毎日少しずつ学習中 #vue #typescript',
    role: 'user',
    registeredDaysAgo: 28,
    avatar: true,
  },
  {
    handle: 'bob',
    displayName: 'Bob',
    bio: 'バックエンド担当。PostgreSQL と Express が好き #postgres',
    role: 'user',
    registeredDaysAgo: 26,
    avatar: true,
  },
  {
    handle: 'carol',
    displayName: 'Carol',
    bio: '写真と旅行が好き。毎日の風景を投稿します',
    role: 'user',
    registeredDaysAgo: 25,
    avatar: true,
  },
  {
    handle: 'dave',
    displayName: 'Dave',
    bio: '',
    role: 'user',
    registeredDaysAgo: 20,
    avatar: false,
    suspendedReason: '嫌がらせ投稿の繰り返し（通報 2 件）',
    suspendedDaysAgo: DAVE_SUSPENDED_DAYS_AGO,
  },
  { handle: 'eve', displayName: 'Eve', bio: '', role: 'user', registeredDaysAgo: 1, avatar: false },
]

/** ボリューム用ユーザーの自己紹介（なしも含めて変化をつける） */
const VOLUME_BIOS = [
  '',
  'はじめました。よろしくお願いします',
  'コーヒーと散歩が好きです',
  'フロントエンドを勉強中 #勉強中',
  '週末は料理をしています',
  '読書と映画の感想を書きます',
]

export interface BuiltUsers {
  rows: Insertable<Users>[]
  users: SeedUser[]
}

interface PasswordHashes {
  user: string
  admin: string
}

/** ユーザー全員の DB 行と、あとで参照するための SeedUser の一覧を作る */
export function buildUsers(base: Date, random: Random, hashes: PasswordHashes): BuiltUsers {
  const rows: Insertable<Users>[] = []
  const users: SeedUser[] = []

  const add = (user: NamedUser) => {
    const id = stableUuid(`user:${user.handle}`)
    const createdAt = daysBefore(base, user.registeredDaysAgo)
    const isSuspended = user.suspendedReason !== undefined
    const isAdmin = user.role === 'admin'

    // 最終ログイン: 登録日より前にならないようにする。凍結ユーザーは凍結の直前まで使っていた
    const pickLastLogin = () => {
      const daysAgo = isSuspended ? (user.suspendedDaysAgo ?? 0) + 1 : random.int(0, 2)
      const lastLogin = daysBefore(base, daysAgo)
      return lastLogin < createdAt ? createdAt : lastLogin
    }

    rows.push({
      id,
      handle: user.handle,
      email: `${user.handle}@example.com`,
      password_hash: isAdmin ? hashes.admin : hashes.user,
      display_name: user.displayName,
      bio: user.bio,
      // アバターは外部の画像サービス（同じ文字列なら同じ画像を返す）。オフラインでは表示されないだけで影響はない
      avatar_url: user.avatar ? `https://picsum.photos/seed/avatar-${user.handle}/200` : null,
      header_url: user.avatar ? `https://picsum.photos/seed/header-${user.handle}/900/300` : null,
      role: user.role,
      is_suspended: isSuspended,
      suspended_at: isSuspended ? daysBefore(base, user.suspendedDaysAgo ?? 0) : null,
      suspended_reason: user.suspendedReason ?? null,
      last_login_at: pickLastLogin(),
      created_at: createdAt,
      // 更新日時は「最後にアカウントの状態が変わった時刻」（凍結なら凍結した時刻、それ以外は登録時刻）
      updated_at: isSuspended ? daysBefore(base, user.suspendedDaysAgo ?? 0) : createdAt,
    })
    users.push({ id, handle: user.handle, role: user.role, createdAt, isSuspended })
  }

  NAMED_USERS.forEach(add)

  // ボリューム用: user06 〜 user30（一覧・無限スクロール・検索の確認用）
  for (let n = 6; n < 6 + VOLUME_USER_COUNT; n++) {
    const number = String(n).padStart(2, '0')
    add({
      handle: `user${number}`,
      displayName: `User ${number}`,
      bio: random.pick(VOLUME_BIOS),
      role: 'user',
      registeredDaysAgo: random.int(2, 29),
      avatar: random.chance(0.3),
    })
  }

  return { rows, users }
}

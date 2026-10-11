// API テストの共通部品: テスト用のアプリ、DB の初期化、ユーザーの作成、ログイン済みのリクエスト。

import type { AuthResponse, NotificationDto, RegisterInput } from '@xclone/shared'
import type { Test } from 'supertest'
import type { Notifier } from '../src/realtime/notifier'
import process from 'node:process'
import { getDb, sql } from '@xclone/db'
import request from 'supertest'
import { createApp } from '../src/app'
import { assertTestDatabase } from './global-setup'

export const db = getDb()

/** 送った通知を記録するだけの Notifier（「誰に何が届いたか」をテストで確かめる） */
export function createRecordingNotifier() {
  const notifications: { userId: string; notification: NotificationDto }[] = []
  const unreadCounts: { userId: string; count: number }[] = []
  const notifier: Notifier = {
    sendNotification: (userId, notification) => notifications.push({ userId, notification }),
    sendUnreadCount: (userId, count) => unreadCounts.push({ userId, count }),
  }
  return { notifier, notifications, unreadCounts }
}

/** テスト用のアプリ（サーバーは起動せず、Supertest から直接呼ぶ） */
export function createTestApp() {
  const recorder = createRecordingNotifier()
  return { app: createApp({ db, notifier: recorder.notifier }), ...recorder }
}
export type TestApp = ReturnType<typeof createTestApp>['app']

const TABLES = [
  'audit_logs',
  'reports',
  'notifications',
  'bookmarks',
  'reposts',
  'likes',
  'follows',
  'post_hashtags',
  'hashtags',
  'posts',
  'daily_active_users',
  'refresh_tokens',
  'users',
]

/** 全テーブルを空にする（各テストの前に呼び、テスト同士でデータを共有しない） */
export async function resetDb(): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL ?? '')
  await sql`TRUNCATE TABLE ${sql.raw(TABLES.join(', '))} RESTART IDENTITY CASCADE`.execute(db)
}

let userSequence = 0

/** テスト用ユーザーの登録情報（呼ぶたびに別のユーザーになる） */
export function newUserInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  userSequence += 1
  return {
    displayName: `テスト${userSequence}`,
    handle: `tester${userSequence}`,
    email: `tester${userSequence}@example.com`,
    password: 'Password123',
    ...overrides,
  }
}

export interface TestUser {
  id: string
  handle: string
  accessToken: string
  /** refresh token の Cookie（"name=value" の形） */
  refreshCookie: string
  input: RegisterInput
}

/** Set-Cookie ヘッダーから refresh token の Cookie を取り出す */
export function extractRefreshCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  const found = cookies.find((cookie) => cookie.startsWith('xclone_refresh='))
  return found?.split(';')[0] ?? ''
}

/** API でユーザーを登録し、ログイン済みの状態（トークン）を返す */
export async function registerUser(
  app: TestApp,
  overrides: Partial<RegisterInput> = {},
): Promise<TestUser> {
  const input = newUserInput(overrides)
  const res = await request(app).post('/api/auth/register').send(input).expect(201)
  const body = res.body as AuthResponse
  return {
    id: body.user.id,
    handle: body.user.handle,
    accessToken: body.accessToken,
    refreshCookie: extractRefreshCookie(res.headers['set-cookie']),
    input,
  }
}

/** ログイン済みのリクエストを作る（Authorization ヘッダーつき） */
export function as(
  // Express アプリでも、起動済みの HTTP サーバー（Socket.IO つきの結合テスト）でも渡せる
  app: Parameters<typeof request>[0],
  user: Pick<TestUser, 'accessToken'>,
) {
  const withAuth = (test: Test) => test.set('Authorization', `Bearer ${user.accessToken}`)
  return {
    get: (url: string) => withAuth(request(app).get(url)),
    post: (url: string) => withAuth(request(app).post(url)),
    patch: (url: string) => withAuth(request(app).patch(url)),
    delete: (url: string) => withAuth(request(app).delete(url)),
  }
}

/** ユーザーを凍結する（管理者アプリの代わりに DB を直接変更する） */
export async function suspendUser(userId: string): Promise<void> {
  await db
    .updateTable('users')
    .set({ is_suspended: true, suspended_at: new Date() })
    .where('id', '=', userId)
    .execute()
}

/**
 * 「このサーバーにアップロードした画像」の形の URL（投稿の画像やアイコンに指定できるのはこの形だけ）。
 * n を変えると別の URL になる。
 */
export function uploadedImageUrl(n = 1): string {
  return `http://localhost:3000/uploads/00000000-0000-4000-8000-${String(n).padStart(12, '0')}.png`
}

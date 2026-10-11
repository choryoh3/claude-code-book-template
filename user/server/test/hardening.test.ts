// コードレビュー（Phase 3）で見つかった問題の回帰テスト。直した不具合が戻ってこないことを保証する。

import { Buffer } from 'node:buffer'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  as,
  createTestApp,
  db,
  extractRefreshCookie,
  registerUser,
  resetDb,
  suspendUser,
  uploadedImageUrl,
} from './helpers'

let testApp = createTestApp()

beforeEach(async () => {
  await resetDb()
  testApp = createTestApp()
})

describe('画像の URL は、このサーバーにアップロードした画像だけ', () => {
  it('外部のサイトの URL（形はアップロードと同じでも）は投稿に使えない', async () => {
    const alice = await registerUser(testApp.app)
    const external = 'https://tracker.example.com/uploads/00000000-0000-4000-8000-000000000001.png'

    const res = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: 'a', mediaUrls: [external] })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('画像は、アップロードした画像を指定してください')
  })

  it('javascript: の URL はアイコンに使えない（XSS の防止）', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .patch('/api/me')
      .send({ avatarUrl: 'javascript:alert(1)' })

    expect(res.status).toBe(400)
  })

  it('このサーバーの URL ならアイコンに使え、null で削除できる', async () => {
    const alice = await registerUser(testApp.app)

    const set = await as(testApp.app, alice)
      .patch('/api/me')
      .send({ avatarUrl: uploadedImageUrl() })
    const removed = await as(testApp.app, alice).patch('/api/me').send({ avatarUrl: null })

    expect(set.body.avatarUrl).toBe(uploadedImageUrl())
    expect(removed.body.avatarUrl).toBeNull()
  })
})

describe('壊れた入力は 500 ではなく 400 にする', () => {
  it('時刻の形が不正な cursor は 400（DB に渡さない）', async () => {
    const alice = await registerUser(testApp.app)
    const broken = Buffer.from(
      JSON.stringify({ t: 'abc', id: '00000000-0000-4000-8000-000000000001' }),
    ).toString('base64url')

    const notifications = await as(testApp.app, alice).get(`/api/notifications?cursor=${broken}`)
    const bookmarks = await as(testApp.app, alice).get(`/api/bookmarks?cursor=${broken}`)
    const garbage = await as(testApp.app, alice).get('/api/timeline/following?cursor=%%%not-base64')

    expect(notifications.status).toBe(400)
    expect(bookmarks.status).toBe(400)
    expect(garbage.status).toBe(400)
  })

  it('大きすぎる本文は 413 を返す（500 にしない）', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: 'あ'.repeat(200_000) })

    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('refresh token の同時使用', () => {
  it('交換した直後の再使用（複数タブの同時の再読み込み）は断るだけで、新しい Cookie は使えるまま', async () => {
    const user = await registerUser(testApp.app)
    const first = await request(testApp.app)
      .post('/api/auth/refresh')
      .set('Cookie', user.refreshCookie)
      .expect(200)
    const newCookie = extractRefreshCookie(first.headers['set-cookie'])

    // 2 つ目のタブが、同じ古い Cookie で少し遅れて refresh した
    const second = await request(testApp.app)
      .post('/api/auth/refresh')
      .set('Cookie', user.refreshCookie)
    const stillValid = await request(testApp.app).post('/api/auth/refresh').set('Cookie', newCookie)

    expect(second.status).toBe(401)
    expect(stillValid.status).toBe(200) // 全端末のログアウトにはならない
  })

  it('猶予（10 秒）を過ぎてからの再使用は、盗用を疑って全て無効にする', async () => {
    const user = await registerUser(testApp.app)
    const first = await request(testApp.app)
      .post('/api/auth/refresh')
      .set('Cookie', user.refreshCookie)
      .expect(200)
    const newCookie = extractRefreshCookie(first.headers['set-cookie'])
    // 古い token が「1 分前に交換された」ことにする
    await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date(Date.now() - 60_000) })
      .where('user_id', '=', user.id)
      .where('revoked_at', 'is not', null)
      .execute()

    await request(testApp.app)
      .post('/api/auth/refresh')
      .set('Cookie', user.refreshCookie)
      .expect(401)
    const afterReuse = await request(testApp.app).post('/api/auth/refresh').set('Cookie', newCookie)

    expect(afterReuse.status).toBe(401)
  })
})

describe('凍結中のユーザーの中身は API でも見せない', () => {
  it('プロフィールは最小限の情報だけで、投稿やフォローの一覧は空', async () => {
    const alice = await registerUser(testApp.app)
    const dave = await registerUser(testApp.app)
    await as(testApp.app, dave)
      .patch('/api/me')
      .send({ bio: '見せてはいけない自己紹介' })
      .expect(200)
    await as(testApp.app, dave).post('/api/posts').send({ content: '凍結前の投稿' }).expect(201)
    await suspendUser(dave.id)

    const profile = await as(testApp.app, alice).get(`/api/users/${dave.handle}`).expect(200)
    const posts = await as(testApp.app, alice).get(`/api/users/${dave.handle}/posts`).expect(200)
    const followers = await as(testApp.app, alice)
      .get(`/api/users/${dave.handle}/followers`)
      .expect(200)

    expect(profile.body).toMatchObject({ isSuspended: true, bio: '', postCount: 0 })
    expect(posts.body).toEqual({ items: [], nextCursor: null })
    expect(followers.body).toEqual({ items: [], nextCursor: null })
  })
})

describe('通知の連打の防止', () => {
  it('いいねを付けて・外して・また付けても、通知は 1 件だけ', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const post = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '投稿' })
      .expect(201)

    for (let i = 0; i < 3; i++) {
      await as(testApp.app, bob).post(`/api/posts/${post.body.id}/like`).expect(200)
      await as(testApp.app, bob).delete(`/api/posts/${post.body.id}/like`).expect(200)
    }

    const rows = await db
      .selectFrom('notifications')
      .select('id')
      .where('recipient_id', '=', alice.id)
      .execute()
    expect(rows).toHaveLength(1)
  })
})

// 投稿（P3-3）のテスト: 作成・文字数制限・ハッシュタグ・リプライ・引用・メンション・詳細・削除。

import { beforeEach, describe, expect, it } from 'vitest'
import { as, createTestApp, db, registerUser, resetDb, uploadedImageUrl } from './helpers'

const UNKNOWN_ID = '0b1f6f0e-1c52-4a8d-9d3a-1f2b3c4d5e6f'

let testApp = createTestApp()

beforeEach(async () => {
  await resetDb()
  testApp = createTestApp() // 通知の記録を、テストごとに空にする
})

describe('pOST /api/posts', () => {
  it('投稿すると 201 で、件数 0・自分の反応なしの PostDto を返す', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice).post('/api/posts').send({ content: 'はじめての投稿' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      content: 'はじめての投稿',
      status: 'visible',
      author: { id: alice.id, handle: alice.handle },
      likeCount: 0,
      replyCount: 0,
      liked: false,
      quoteOf: null,
      repostedBy: null,
    })
  })

  it('280 文字ちょうどは投稿でき、281 文字は日本語のメッセージで 400', async () => {
    const alice = await registerUser(testApp.app)

    const ok = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: 'あ'.repeat(280) })
    const tooLong = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: 'あ'.repeat(281) })

    expect(ok.status).toBe(201)
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error.message).toBe('投稿は280文字以内で入力してください')
  })

  it('本文のハッシュタグを小文字にそろえて登録する（#Vue と #vue は同じタグ）', async () => {
    const alice = await registerUser(testApp.app)

    await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '#Vue と #vue と #開発日記' })
      .expect(201)
    await as(testApp.app, alice).post('/api/posts').send({ content: 'また #VUE' }).expect(201)

    const tags = await db.selectFrom('hashtags').select('tag').orderBy('tag').execute()
    expect(tags.map((row) => row.tag)).toEqual(['vue', '開発日記'])
  })

  it('画像は 4 枚まで添付でき、本文なしの画像だけの投稿もできる', async () => {
    const alice = await registerUser(testApp.app)
    const urls = [
      uploadedImageUrl(1),
      uploadedImageUrl(2),
      uploadedImageUrl(3),
      uploadedImageUrl(4),
    ]

    const res = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '', mediaUrls: urls })

    expect(res.status).toBe(201)
    expect(res.body.mediaUrls).toEqual(urls)
  })
})

describe('リプライ・引用・メンション', () => {
  it('リプライすると、親の返信数が増え、親の投稿者に reply 通知が届く', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const parent = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '親' })
      .expect(201)

    const reply = await as(testApp.app, bob)
      .post('/api/posts')
      .send({ content: '返信です', replyToId: parent.body.id })

    expect(reply.status).toBe(201)
    expect(reply.body.replyToId).toBe(parent.body.id)
    const detail = await as(testApp.app, alice).get(`/api/posts/${parent.body.id}`).expect(200)
    expect(detail.body.post.replyCount).toBe(1)
    expect(detail.body.replies.items.map((post: { id: string }) => post.id)).toEqual([
      reply.body.id,
    ])
    expect(testApp.notifications).toEqual([
      expect.objectContaining({
        userId: alice.id,
        notification: expect.objectContaining({ type: 'reply' }),
      }),
    ])
  })

  it('引用すると、引用元が quoteOf に入り、引用元の投稿者に quote 通知が届く', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const original = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '元の投稿' })
      .expect(201)

    const quote = await as(testApp.app, bob)
      .post('/api/posts')
      .send({ content: 'これ良い', quoteOfId: original.body.id })

    expect(quote.status).toBe(201)
    expect(quote.body.quoteOf).toMatchObject({ id: original.body.id, content: '元の投稿' })
    expect(testApp.notifications.map((sent) => sent.notification.type)).toEqual(['quote'])
  })

  it('メンションされた人に mention 通知が届く（自分自身・存在しないハンドルには届かない）', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)

    await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: `@${bob.handle} と @${alice.handle} と @nobody_here` })
      .expect(201)

    expect(testApp.notifications.map((sent) => [sent.userId, sent.notification.type])).toEqual([
      [bob.id, 'mention'],
    ])
  })

  it('リプライ先の人をメンションしても、通知は reply の 1 件だけ（重複させない）', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const parent = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '親' })
      .expect(201)

    await as(testApp.app, bob)
      .post('/api/posts')
      .send({ content: `@${alice.handle} 返信`, replyToId: parent.body.id })
      .expect(201)

    expect(testApp.notifications.map((sent) => sent.notification.type)).toEqual(['reply'])
  })

  it('存在しない投稿へのリプライは 404 POST_NOT_FOUND', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '返信', replyToId: UNKNOWN_ID })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('POST_NOT_FOUND')
  })
})

describe('詳細と削除', () => {
  it('存在しない投稿は 404、ID の形式が不正なら 400', async () => {
    const alice = await registerUser(testApp.app)

    await as(testApp.app, alice).get(`/api/posts/${UNKNOWN_ID}`).expect(404)
    await as(testApp.app, alice).get('/api/posts/not-a-uuid').expect(400)
  })

  it('自分の投稿を削除すると、詳細は「削除済み」になり本文が空になる', async () => {
    const alice = await registerUser(testApp.app)
    const post = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '消す投稿' })
      .expect(201)

    await as(testApp.app, alice).delete(`/api/posts/${post.body.id}`).expect(204)
    const detail = await as(testApp.app, alice).get(`/api/posts/${post.body.id}`)

    expect(detail.status).toBe(200)
    expect(detail.body.post).toMatchObject({ status: 'deleted', content: '', mediaUrls: [] })
  })

  it('他人の投稿は削除できず 403、削除済みをもう一度削除すると 404', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const post = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: 'alice の投稿' })
      .expect(201)

    await as(testApp.app, bob).delete(`/api/posts/${post.body.id}`).expect(403)
    await as(testApp.app, alice).delete(`/api/posts/${post.body.id}`).expect(204)
    await as(testApp.app, alice).delete(`/api/posts/${post.body.id}`).expect(404)
  })
})

// 検索・トレンド（P3-7）、通報（P3-8）、画像のアップロードのテスト。

import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { as, createTestApp, registerUser, resetDb, suspendUser } from './helpers'

const UNKNOWN_ID = '0b1f6f0e-1c52-4a8d-9d3a-1f2b3c4d5e6f'

let testApp = createTestApp()

beforeEach(async () => {
  await resetDb()
  testApp = createTestApp()
})

const ids = (body: { items: { id: string }[] }) => body.items.map((item) => item.id)

describe('検索', () => {
  it('投稿を本文の部分一致で探せる（日本語も可）', async () => {
    const alice = await registerUser(testApp.app)
    const hit = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '今日は Kysely を勉強した' })
      .expect(201)
    await as(testApp.app, alice).post('/api/posts').send({ content: '関係ない投稿' }).expect(201)

    const english = await as(testApp.app, alice).get('/api/search?q=kysely').expect(200)
    const japanese = await as(testApp.app, alice)
      .get(`/api/search?q=${encodeURIComponent('勉強')}`)
      .expect(200)

    expect(ids(english.body)).toEqual([hit.body.id])
    expect(ids(japanese.body)).toEqual([hit.body.id])
  })

  it('「%」や「_」は、すべてに一致する記号ではなく、ただの文字として探す', async () => {
    const alice = await registerUser(testApp.app)
    const percent = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '達成率 100%' })
      .expect(201)
    await as(testApp.app, alice).post('/api/posts').send({ content: '記号なし' }).expect(201)

    const res = await as(testApp.app, alice)
      .get(`/api/search?q=${encodeURIComponent('%')}`)
      .expect(200)

    expect(ids(res.body)).toEqual([percent.body.id])
  })

  it('「#タグ」で検索すると、そのハッシュタグの投稿だけが出る', async () => {
    const alice = await registerUser(testApp.app)
    const tagged = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '#Vue 楽しい' })
      .expect(201)
    await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: 'vue という単語だけ' })
      .expect(201)

    const res = await as(testApp.app, alice)
      .get(`/api/search?q=${encodeURIComponent('#vue')}`)
      .expect(200)

    expect(ids(res.body)).toEqual([tagged.body.id])
  })

  it('ユーザーをハンドル・表示名の部分一致で探せる（凍結中のユーザーは出ない）', async () => {
    const alice = await registerUser(testApp.app, { handle: 'alice_dev', displayName: 'Alice' })
    const hidden = await registerUser(testApp.app, { handle: 'alice_old', displayName: 'Old' })
    await suspendUser(hidden.id)

    const res = await as(testApp.app, alice).get('/api/search?q=alice&type=users').expect(200)

    expect(ids(res.body)).toEqual([alice.id])
  })

  it('ハッシュタグの検索とトレンドで、投稿数の多い順にタグが並ぶ', async () => {
    const alice = await registerUser(testApp.app)
    for (const content of ['#vue 1', '#vue 2', '#vite 1']) {
      await as(testApp.app, alice).post('/api/posts').send({ content }).expect(201)
    }

    const tags = await as(testApp.app, alice).get('/api/search?q=v&type=tags').expect(200)
    const trends = await as(testApp.app, alice).get('/api/trends').expect(200)

    expect(tags.body.items).toEqual([
      { tag: 'vue', postCount: 2 },
      { tag: 'vite', postCount: 1 },
    ])
    expect(trends.body.items[0]).toEqual({ tag: 'vue', postCount: 2 })
  })

  it('検索ワードが空なら 400', async () => {
    const alice = await registerUser(testApp.app)

    await as(testApp.app, alice).get('/api/search?q=%20%20').expect(400)
  })
})

describe('通報', () => {
  it('投稿を通報すると 201、同じ投稿をもう一度通報すると 409 ALREADY_REPORTED', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const target = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '通報される投稿' })
      .expect(201)
    const report = {
      targetType: 'post',
      targetId: target.body.id,
      reason: 'spam',
      detail: '宣伝です',
    }

    const first = await as(testApp.app, bob).post('/api/reports').send(report)
    const second = await as(testApp.app, bob).post('/api/reports').send(report)

    expect(first.status).toBe(201)
    expect(first.body.id).toEqual(expect.any(String))
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('ALREADY_REPORTED')
  })

  it('ユーザーを通報できる。自分自身・自分の投稿は 400、存在しない対象は 404', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const own = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '自分の投稿' })
      .expect(201)

    await as(testApp.app, alice)
      .post('/api/reports')
      .send({ targetType: 'user', targetId: bob.id, reason: 'harassment' })
      .expect(201)
    await as(testApp.app, alice)
      .post('/api/reports')
      .send({ targetType: 'user', targetId: alice.id, reason: 'other' })
      .expect(400)
    await as(testApp.app, alice)
      .post('/api/reports')
      .send({ targetType: 'post', targetId: own.body.id, reason: 'other' })
      .expect(400)
    await as(testApp.app, alice)
      .post('/api/reports')
      .send({ targetType: 'post', targetId: UNKNOWN_ID, reason: 'other' })
      .expect(404)
  })

  it('理由を選ばないと、日本語のメッセージで 400', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .post('/api/reports')
      .send({ targetType: 'user', targetId: bob.id })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('理由を選択してください')
  })
})

describe('画像のアップロード', () => {
  /** 本物の PNG の先頭（シグネチャ）+ 適当な中身 */
  const pngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32),
  ])

  it('pNG をアップロードすると 201 で URL が返り、その URL から画像を取得できる', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .post('/api/media')
      .attach('file', pngBytes, { filename: 'a.png', contentType: 'image/png' })

    expect(res.status).toBe(201)
    expect(res.body.url).toMatch(/\/uploads\/[\w-]+\.png$/)
    const path = new URL(res.body.url).pathname
    await as(testApp.app, alice).get(path).expect(200)
  })

  it('pNG と偽ったテキストファイルは、中身を確認して 400 にする', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .post('/api/media')
      .attach('file', Buffer.from('これは画像ではありません'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })

    expect(res.status).toBe(400)
  })

  it('許可していない種類（GIF）は 400', async () => {
    const alice = await registerUser(testApp.app)

    const res = await as(testApp.app, alice)
      .post('/api/media')
      .attach('file', Buffer.from('GIF89a'), { filename: 'a.gif', contentType: 'image/gif' })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('画像は jpeg・png・webp の5MB以下にしてください')
  })
})

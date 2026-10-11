// フォロー・反応（P3-4）とタイムライン（P3-5）、プロフィールのテスト。

import type { TestApp, TestUser } from './helpers'
import { beforeEach, describe, expect, it } from 'vitest'
import { as, createTestApp, registerUser, resetDb, suspendUser, uploadedImageUrl } from './helpers'

let testApp = createTestApp()

beforeEach(async () => {
  await resetDb()
  testApp = createTestApp()
})

/** 投稿して ID を返す */
async function post(
  app: TestApp,
  user: TestUser,
  content: string,
  extra: Record<string, unknown> = {},
) {
  const res = await as(app, user)
    .post('/api/posts')
    .send({ content, ...extra })
    .expect(201)
  return res.body.id as string
}

/** cursor をたどって、一覧の全ページの ID を集める */
async function collectAllPages(app: TestApp, user: TestUser, url: string, limit: number) {
  const ids: string[] = []
  let cursor: string | null = null
  do {
    const query: string = `${url}?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await as(app, user).get(query).expect(200)
    ids.push(...res.body.items.map((item: { id: string }) => item.id))
    cursor = res.body.nextCursor
  } while (cursor)
  return ids
}

describe('フォロー', () => {
  it('フォローすると、プロフィールの isFollowing とフォロワー数が変わり、相手に follow 通知が 1 回だけ届く', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)

    const first = await as(testApp.app, alice).post(`/api/users/${bob.handle}/follow`)
    await as(testApp.app, alice).post(`/api/users/${bob.handle}/follow`).expect(200) // 2 回目は何も起きない

    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ isFollowing: true, followerCount: 1 })
    expect(testApp.notifications.map((sent) => [sent.userId, sent.notification.type])).toEqual([
      [bob.id, 'follow'],
    ])
  })

  it('フォロー解除すると isFollowing が false に戻る', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    await as(testApp.app, alice).post(`/api/users/${bob.handle}/follow`).expect(200)

    const res = await as(testApp.app, alice).delete(`/api/users/${bob.handle}/follow`)

    expect(res.body).toMatchObject({ isFollowing: false, followerCount: 0 })
  })

  it('自分自身はフォローできず 400、存在しないユーザーは 404', async () => {
    const alice = await registerUser(testApp.app)

    await as(testApp.app, alice).post(`/api/users/${alice.handle}/follow`).expect(400)
    await as(testApp.app, alice).post('/api/users/nobody_here/follow').expect(404)
  })

  it('フォロワー一覧・フォロー中一覧を取得できる', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    await as(testApp.app, alice).post(`/api/users/${bob.handle}/follow`).expect(200)

    const followers = await as(testApp.app, alice)
      .get(`/api/users/${bob.handle}/followers`)
      .expect(200)
    const following = await as(testApp.app, alice)
      .get(`/api/users/${alice.handle}/following`)
      .expect(200)

    expect(followers.body.items.map((user: { id: string }) => user.id)).toEqual([alice.id])
    expect(following.body.items.map((user: { id: string }) => user.id)).toEqual([bob.id])
  })
})

describe('反応（いいね・リポスト・ブックマーク）', () => {
  it('いいねは何度押しても 1 回分で、外すと元に戻る。投稿者への通知は 1 回だけ', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const postId = await post(testApp.app, alice, 'いいねしてね')

    const liked = await as(testApp.app, bob).post(`/api/posts/${postId}/like`).expect(200)
    await as(testApp.app, bob).post(`/api/posts/${postId}/like`).expect(200)
    const unliked = await as(testApp.app, bob).delete(`/api/posts/${postId}/like`).expect(200)

    expect(liked.body).toMatchObject({ liked: true, likeCount: 1 })
    expect(unliked.body).toMatchObject({ liked: false, likeCount: 0 })
    expect(testApp.notifications.map((sent) => sent.notification.type)).toEqual(['like'])
  })

  it('自分の投稿へのいいねでは通知しない', async () => {
    const alice = await registerUser(testApp.app)
    const postId = await post(testApp.app, alice, '自分の投稿')

    await as(testApp.app, alice).post(`/api/posts/${postId}/like`).expect(200)

    expect(testApp.notifications).toEqual([])
  })

  it('削除済みの投稿には反応できない（404）', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const postId = await post(testApp.app, alice, '消える投稿')
    await as(testApp.app, alice).delete(`/api/posts/${postId}`).expect(204)

    await as(testApp.app, bob).post(`/api/posts/${postId}/like`).expect(404)
  })

  it('ブックマークすると一覧に出て、外すと消える（ブックマークは通知しない）', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const postId = await post(testApp.app, alice, '保存したい投稿')

    await as(testApp.app, bob).post(`/api/posts/${postId}/bookmark`).expect(200)
    const saved = await as(testApp.app, bob).get('/api/bookmarks').expect(200)
    await as(testApp.app, bob).delete(`/api/posts/${postId}/bookmark`).expect(200)
    const removed = await as(testApp.app, bob).get('/api/bookmarks').expect(200)

    expect(saved.body.items.map((item: { id: string }) => item.id)).toEqual([postId])
    expect(saved.body.items[0].bookmarked).toBe(true)
    expect(removed.body.items).toEqual([])
    expect(testApp.notifications).toEqual([])
  })
})

describe('タイムライン', () => {
  it('フォロー中: 自分とフォロー中の人の投稿だけが新しい順に並ぶ（リプライとフォロー外は出ない）', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const carol = await registerUser(testApp.app)
    await as(testApp.app, alice).post(`/api/users/${bob.handle}/follow`).expect(200)
    const own = await post(testApp.app, alice, 'alice の投稿')
    const bobs = await post(testApp.app, bob, 'bob の投稿')
    await post(testApp.app, carol, 'carol の投稿（フォロー外）')
    await post(testApp.app, bob, 'bob のリプライ', { replyToId: own })

    const res = await as(testApp.app, alice).get('/api/timeline/following').expect(200)

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([bobs, own])
  })

  it('フォロー中: フォローしている人のリポストが「リポストした人」つきで出る', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const carol = await registerUser(testApp.app)
    await as(testApp.app, alice).post(`/api/users/${bob.handle}/follow`).expect(200)
    const carolPost = await post(testApp.app, carol, 'carol の投稿')
    await as(testApp.app, bob).post(`/api/posts/${carolPost}/repost`).expect(200)

    const res = await as(testApp.app, alice).get('/api/timeline/following').expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({ id: carolPost, repostedBy: { id: bob.id } })
  })

  it('フォロー中: cursor でページをたどると、重複も抜けもなく全件が並ぶ', async () => {
    const alice = await registerUser(testApp.app)
    const created: string[] = []
    for (let i = 1; i <= 7; i++) created.push(await post(testApp.app, alice, `投稿 ${i}`))

    const ids = await collectAllPages(testApp.app, alice, '/api/timeline/following', 3)

    expect(ids).toEqual([...created].reverse())
  })

  it('おすすめ: 自分以外の投稿が並び、cursor でたどっても重複しない', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    await post(testApp.app, alice, 'alice（自分の投稿は出ない）')
    const bobPosts: string[] = []
    for (let i = 1; i <= 5; i++) bobPosts.push(await post(testApp.app, bob, `bob ${i}`))

    const ids = await collectAllPages(testApp.app, alice, '/api/timeline/for-you', 2)

    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...bobPosts].sort())
  })
})

describe('プロフィール', () => {
  it('プロフィールに件数と「本人かどうか」が入る', async () => {
    const alice = await registerUser(testApp.app)
    await post(testApp.app, alice, '1')
    await post(testApp.app, alice, '2')

    const self = await as(testApp.app, alice).get(`/api/users/${alice.handle}`).expect(200)

    expect(self.body).toMatchObject({
      handle: alice.handle,
      postCount: 2,
      isSelf: true,
      isSuspended: false,
    })
  })

  it('凍結中のユーザーのプロフィールは isSuspended が true になる', async () => {
    const alice = await registerUser(testApp.app)
    const dave = await registerUser(testApp.app)
    await suspendUser(dave.id)

    const res = await as(testApp.app, alice).get(`/api/users/${dave.handle}`).expect(200)

    expect(res.body.isSuspended).toBe(true)
  })

  it('タブ: 投稿 / 返信 / メディア / いいね がそれぞれの条件で分かれる', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const plain = await post(testApp.app, alice, '普通の投稿')
    const withMedia = await post(testApp.app, alice, '画像つき', {
      mediaUrls: [uploadedImageUrl()],
    })
    const reply = await post(testApp.app, alice, '返信', { replyToId: plain })
    const bobPost = await post(testApp.app, bob, 'bob の投稿')
    await as(testApp.app, alice).post(`/api/posts/${bobPost}/like`).expect(200)

    const tab = async (name: string) => {
      const res = await as(testApp.app, alice).get(`/api/users/${alice.handle}/${name}`).expect(200)
      return res.body.items.map((item: { id: string }) => item.id)
    }

    expect(await tab('posts')).toEqual([withMedia, plain])
    expect(await tab('replies')).toEqual([reply])
    expect(await tab('media')).toEqual([withMedia])
    expect(await tab('likes')).toEqual([bobPost])
  })

  it('pATCH /api/me で表示名と自己紹介を変えられる。自己紹介が 161 文字なら 400', async () => {
    const alice = await registerUser(testApp.app)

    const updated = await as(testApp.app, alice)
      .patch('/api/me')
      .send({ displayName: 'ありす', bio: 'よろしく' })
    const tooLong = await as(testApp.app, alice)
      .patch('/api/me')
      .send({ bio: 'あ'.repeat(161) })

    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({ displayName: 'ありす', bio: 'よろしく' })
    expect(tooLong.status).toBe(400)
  })
})

// 通知（P3-6）のテスト: 一覧・未読件数・既読化と、Socket.IO によるリアルタイム配信（実際にサーバーを起動して確認）。

import type { NotificationDto } from '@xclone/shared'
import type { AddressInfo } from 'node:net'
import type { Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@xclone/shared'
import { io as connect } from 'socket.io-client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUserServer } from '../src/server'
import { as, createTestApp, db, registerUser, resetDb } from './helpers'

let testApp = createTestApp()

beforeEach(async () => {
  await resetDb()
  testApp = createTestApp()
})

describe('通知の一覧と既読', () => {
  it('通知は新しい順に並び、未読件数が数えられ、まとめて既読にできる', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const postRes = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '投稿' })
      .expect(201)
    await as(testApp.app, bob).post(`/api/posts/${postRes.body.id}/like`).expect(200)
    await as(testApp.app, bob).post(`/api/users/${alice.handle}/follow`).expect(200)

    const list = await as(testApp.app, alice).get('/api/notifications').expect(200)
    const unread = await as(testApp.app, alice).get('/api/notifications/unread-count').expect(200)
    const marked = await as(testApp.app, alice).post('/api/notifications/read').expect(200)
    const after = await as(testApp.app, alice).get('/api/notifications/unread-count').expect(200)

    expect(list.body.items.map((item: NotificationDto) => item.type)).toEqual(['follow', 'like'])
    expect(list.body.items[1]).toMatchObject({
      actor: { id: bob.id },
      post: { id: postRes.body.id },
      isRead: false,
    })
    expect(unread.body).toEqual({ count: 2 })
    expect(marked.body).toEqual({ count: 0 })
    expect(after.body).toEqual({ count: 0 })
  })

  it('filter=mentions でメンションだけに絞れる', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    await as(testApp.app, bob).post(`/api/users/${alice.handle}/follow`).expect(200)
    await as(testApp.app, bob)
      .post('/api/posts')
      .send({ content: `@${alice.handle} こんにちは` })
      .expect(201)

    const res = await as(testApp.app, alice).get('/api/notifications?filter=mentions').expect(200)

    expect(res.body.items.map((item: NotificationDto) => item.type)).toEqual(['mention'])
  })

  it('cursor でページをたどると、重複なく全件が取れる', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    for (let i = 0; i < 5; i++) {
      const created = await as(testApp.app, alice)
        .post('/api/posts')
        .send({ content: `投稿${i}` })
        .expect(201)
      await as(testApp.app, bob).post(`/api/posts/${created.body.id}/like`).expect(200)
    }

    const first = await as(testApp.app, alice).get('/api/notifications?limit=3').expect(200)
    const second = await as(testApp.app, alice)
      .get(`/api/notifications?limit=3&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .expect(200)

    const ids = [...first.body.items, ...second.body.items].map((item: NotificationDto) => item.id)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
    expect(second.body.nextCursor).toBeNull()
  })

  it('通知を作ったら、受け取る人に「新しい通知」と「未読件数」が送られる', async () => {
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)

    await as(testApp.app, bob).post(`/api/users/${alice.handle}/follow`).expect(200)

    expect(testApp.notifications).toEqual([
      expect.objectContaining({
        userId: alice.id,
        notification: expect.objectContaining({ type: 'follow' }),
      }),
    ])
    expect(testApp.unreadCounts).toEqual([{ userId: alice.id, count: 1 }])
  })
})

describe('socket.IO によるリアルタイム配信', () => {
  const sockets: Socket[] = []
  let server: ReturnType<typeof createUserServer> | undefined

  /** 実際にサーバーを起動する（空いているポートを自動で選ぶ） */
  async function startServer() {
    server = createUserServer(db)
    await new Promise<void>((resolve) => server?.httpServer.listen(0, resolve))
    const { port } = server.httpServer.address() as AddressInfo
    return `http://localhost:${port}`
  }

  function open(url: string, token: string): Socket {
    const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false })
    sockets.push(socket)
    return socket
  }

  /** イベントを 1 回だけ待つ（来なければ失敗にする） */
  function waitFor<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${event} が届きませんでした`)), timeoutMs)
      socket.once(event, (payload: T) => {
        clearTimeout(timer)
        resolve(payload)
      })
    })
  }

  afterEach(async () => {
    sockets.splice(0).forEach((socket) => socket.disconnect())
    await server?.close()
    server = undefined
  })

  it('接続すると未読件数が届き、誰かがいいねすると、その場で通知が届く', async () => {
    const url = await startServer()
    const alice = await registerUser(testApp.app)
    const bob = await registerUser(testApp.app)
    const created = await as(testApp.app, alice)
      .post('/api/posts')
      .send({ content: '投稿' })
      .expect(201)

    const socket = open(url, alice.accessToken)
    const initial = await waitFor<{ count: number }>(
      socket,
      SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT,
    )
    const incoming = waitFor<{ notification: NotificationDto }>(
      socket,
      SOCKET_EVENTS.NOTIFICATION_NEW,
    )
    // 本物のサーバー（Socket.IO の Notifier つき）に対して、bob がいいねする
    await as(server!.httpServer, bob).post(`/api/posts/${created.body.id}/like`).expect(200)

    expect(initial).toEqual({ count: 0 })
    expect((await incoming).notification).toMatchObject({ type: 'like', actor: { id: bob.id } })
  })

  it('既読化のイベントを送ると、ack で未読件数 0 が返る', async () => {
    const url = await startServer()
    const alice = await registerUser(testApp.app)
    const socket = open(url, alice.accessToken)
    await waitFor(socket, SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT)

    const result = await socket.timeout(5000).emitWithAck(SOCKET_EVENTS.NOTIFICATION_MARK_READ)

    expect(result).toEqual({ ok: true, unreadCount: 0 })
  })

  it('ack を付けずに既読化のイベントを送っても、サーバーは止まらない（レビューでの重大指摘の回帰テスト）', async () => {
    const url = await startServer()
    const alice = await registerUser(testApp.app)
    const socket = open(url, alice.accessToken)
    await waitFor(socket, SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT)

    socket.emit(SOCKET_EVENTS.NOTIFICATION_MARK_READ as never) // 型を無視して、ack なしで送る
    await new Promise((resolve) => setTimeout(resolve, 300))

    // サーバーが生きていれば、HTTP も Socket.IO も応答する
    await as(server!.httpServer, alice).get('/api/me').expect(200)
    const result = await socket.timeout(5000).emitWithAck(SOCKET_EVENTS.NOTIFICATION_MARK_READ)
    expect(result).toEqual({ ok: true, unreadCount: 0 })
  })

  it('トークンが不正なら接続を拒否する', async () => {
    const url = await startServer()
    const socket = open(url, 'invalid-token')

    const error = await waitFor<Error>(socket, 'connect_error')

    expect(error.message).toBe('ログイン情報が正しくありません')
  })
})

// 認証（P3-2）のテスト: 登録・ログイン・refresh（ローテーションと盗用の検知）・ログアウト・ハンドル名の確認。

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  as,
  createTestApp,
  extractRefreshCookie,
  newUserInput,
  registerUser,
  resetDb,
  suspendUser,
} from './helpers'

const { app } = createTestApp()

beforeEach(resetDb)

describe('pOST /api/auth/register', () => {
  it('登録するとログイン状態になり、access token と refresh token の Cookie を受け取る', async () => {
    const input = newUserInput()

    const res = await request(app).post('/api/auth/register').send(input)

    expect(res.status).toBe(201)
    expect(res.body.accessToken).toEqual(expect.any(String))
    expect(res.body.user).toMatchObject({ handle: input.handle, email: input.email, role: 'user' })
    expect(JSON.stringify(res.body)).not.toContain('password') // パスワード（のハッシュ）を返さない
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/api/auth')
  })

  it('同じメールアドレス（大文字小文字違いも含む）は 409 EMAIL_TAKEN', async () => {
    const first = await registerUser(app)

    const res = await request(app)
      .post('/api/auth/register')
      .send(newUserInput({ email: first.input.email.toUpperCase() }))

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('同じハンドル名（大文字小文字違いも含む）は 409 HANDLE_TAKEN', async () => {
    const first = await registerUser(app)

    const res = await request(app)
      .post('/api/auth/register')
      .send(newUserInput({ handle: first.handle.toUpperCase() }))

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('HANDLE_TAKEN')
  })
})

describe('pOST /api/auth/login', () => {
  it('正しいメールとパスワードでログインできる', async () => {
    const user = await registerUser(app)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.input.email, password: user.input.password })

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(user.id)
    expect(extractRefreshCookie(res.headers['set-cookie'])).not.toBe('')
  })

  it('パスワード違いと、存在しないメールは、同じエラーにする（アカウントの有無を漏らさない）', async () => {
    const user = await registerUser(app)

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.input.email, password: 'Wrong12345' })
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Wrong12345' })

    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(unknown.body.error.message).toBe(wrong.body.error.message)
  })

  it('凍結中のユーザーは、パスワードが正しいときだけ「凍結されています」（403）を返す', async () => {
    const user = await registerUser(app)
    await suspendUser(user.id)

    const correct = await request(app)
      .post('/api/auth/login')
      .send({ email: user.input.email, password: user.input.password })
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.input.email, password: 'Wrong12345' })

    expect(correct.status).toBe(403)
    expect(correct.body.error.code).toBe('ACCOUNT_SUSPENDED')
    expect(wrong.status).toBe(401) // 他人が凍結の有無を調べられないように
  })
})

describe('pOST /api/auth/refresh と logout', () => {
  it('refresh token の Cookie で、新しいトークンを受け取れる（Cookie も新しいものに交換される）', async () => {
    const user = await registerUser(app)

    const res = await request(app).post('/api/auth/refresh').set('Cookie', user.refreshCookie)

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(user.id)
    const newCookie = extractRefreshCookie(res.headers['set-cookie'])
    expect(newCookie).not.toBe('')
    expect(newCookie).not.toBe(user.refreshCookie)
  })

  // 交換済みの Cookie の再使用（盗用の検知と、複数タブの同時の再読み込みの猶予）は
  // test/hardening.test.ts の「refresh token の同時使用」で確かめている（docs/adr/0004 の追記）

  it('cookie が無ければ 401 TOKEN_EXPIRED', async () => {
    const res = await request(app).post('/api/auth/refresh')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('ログアウトすると、その Cookie ではもう refresh できない', async () => {
    const user = await registerUser(app)

    await request(app).post('/api/auth/logout').set('Cookie', user.refreshCookie).expect(204)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', user.refreshCookie)

    expect(res.status).toBe(401)
  })

  it('凍結されたユーザーは refresh もできない', async () => {
    const user = await registerUser(app)
    await suspendUser(user.id)

    const res = await request(app).post('/api/auth/refresh').set('Cookie', user.refreshCookie)

    expect(res.status).toBe(403)
  })
})

describe('自分の情報とハンドル名の確認', () => {
  it('gET /api/me はログイン中の自分を返す', async () => {
    const user = await registerUser(app)

    const res = await as(app, user).get('/api/me')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: user.id, handle: user.handle, email: user.input.email })
  })

  it('gET /api/users/availability は、使われているハンドル名（大文字小文字違いも含む）なら false', async () => {
    const user = await registerUser(app)

    const taken = await request(app).get(
      `/api/users/availability?handle=${user.handle.toUpperCase()}`,
    )
    const free = await request(app).get('/api/users/availability?handle=free_name')

    expect(taken.body).toEqual({ available: false })
    expect(free.body).toEqual({ available: true })
  })
})

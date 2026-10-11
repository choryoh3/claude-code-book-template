// 土台（P3-1）のテスト: ヘルスチェック・requestId・エラー応答の形・認証の必須化・凍結・DAU の記録。

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { as, createTestApp, db, registerUser, resetDb, suspendUser } from './helpers'

const { app } = createTestApp()

beforeEach(resetDb)

describe('土台', () => {
  it('gET /api/health は DB に繋がっていれば ok を返す', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('すべての応答に X-Request-Id が付き、安全な形の requestId は引き継ぐ', async () => {
    const generated = await request(app).get('/api/health')
    const passed = await request(app).get('/api/health').set('X-Request-Id', 'trace-123')
    const unsafe = await request(app).get('/api/health').set('X-Request-Id', 'bad id with spaces')

    expect(generated.headers['x-request-id']).toMatch(/^[\w-]{36}$/)
    expect(passed.headers['x-request-id']).toBe('trace-123')
    expect(unsafe.headers['x-request-id']).not.toBe('bad id with spaces')
  })

  it('存在しない URL は 404 を、共通のエラー形式（code・message・requestId）で返す', async () => {
    const res = await request(app).get('/no-such-page')

    expect(res.status).toBe(404)
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: expect.any(String) })
    expect(res.body.error.requestId).toBe(res.headers['x-request-id'])
  })

  it('入力エラーは 400 で、項目ごとの日本語メッセージ（fields）を返す', async () => {
    const res = await request(app).post('/api/auth/register').send({ handle: 'a' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.fields.handle).toContain('ハンドル名は3文字以上で入力してください')
  })

  it('jSON として読めない本文は 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{broken')

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('JSON の形式が正しくありません')
  })
})

describe('認証の必須化', () => {
  it('トークンなし・不正なトークンでは、ログイン必須の API は 401', async () => {
    const none = await request(app).get('/api/me')
    const invalid = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid.token.value')

    expect(none.status).toBe(401)
    expect(invalid.status).toBe(401)
    expect(invalid.body.error.code).toBe('UNAUTHORIZED')
  })

  it('ログイン後に凍結されたユーザーは、有効なトークンを持っていても 403（凍結がすぐに効く）', async () => {
    const user = await registerUser(app)
    await suspendUser(user.id)

    const res = await as(app, user).get('/api/me')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ログイン中の API 利用は、その日の利用者（DAU）として 1 回だけ記録される', async () => {
    const user = await registerUser(app)

    await as(app, user).get('/api/me').expect(200)
    await as(app, user).get('/api/me').expect(200)

    const rows = await db
      .selectFrom('daily_active_users')
      .selectAll()
      .where('user_id', '=', user.id)
      .execute()
    expect(rows).toHaveLength(1)
  })
})

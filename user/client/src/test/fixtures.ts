// テスト用のサンプルデータと道具。
// 形は shared の DTO と同じ。テストごとに必要なところだけ上書きして使う（例 makePost({ liked: true })）。

import type { AuthResponse, PostDto, UserSummaryDto } from '@xclone/shared'
import { createMemoryHistory, createRouter } from 'vue-router'

export const ALICE: UserSummaryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  handle: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
}

export const BOB: UserSummaryDto = {
  id: '22222222-2222-4222-8222-222222222222',
  handle: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
}

export function makePost(overrides: Partial<PostDto> = {}): PostDto {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    author: BOB,
    content: 'こんにちは #vue',
    mediaUrls: [],
    status: 'visible',
    createdAt: '2026-10-11T03:00:00.000Z',
    replyToId: null,
    quoteOf: null,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
    likeCount: 0,
    liked: false,
    reposted: false,
    bookmarked: false,
    repostedBy: null,
    ...overrides,
  }
}

export function makeAuthResponse(accessToken = 'access-1'): AuthResponse {
  return {
    accessToken,
    expiresIn: 900,
    user: { ...ALICE, email: 'alice@example.com', role: 'user' },
  }
}

/** JSON を返す fetch の応答を作る */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** エラー応答（{ error: { code, message, requestId } }）を作る */
export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message, requestId: 'req-test' } }, status)
}

/** コンポーネントのテスト用のルーター（画面が使うルート名だけを持つ） */
export function createTestRouter() {
  const Empty = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Empty },
      { path: '/login', name: 'login', component: Empty },
      { path: '/search', name: 'search', component: Empty },
      { path: '/notifications', name: 'notifications', component: Empty },
      { path: '/bookmarks', name: 'bookmarks', component: Empty },
      { path: '/:handle/status/:postId', name: 'post', component: Empty },
      { path: '/:handle/:direction(followers|following)', name: 'follows', component: Empty },
      { path: '/:handle', name: 'profile', component: Empty },
    ],
  })
}

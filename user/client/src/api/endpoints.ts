// サーバーの API を 1 つずつ関数にしたもの。画面（store・composable）はここを呼ぶ。
// 応答の形は packages/shared のスキーマで検証する（サーバーと画面で同じ「約束」を使う）。

import type {
  CreatePostInput,
  CreateReportInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '@xclone/shared'
import {
  authResponseSchema,
  currentUserDtoSchema,
  handleAvailabilityResponseSchema,
  hashtagPageSchema,
  mediaUploadDtoSchema,
  notificationPageSchema,
  postDetailDtoSchema,
  postDtoSchema,
  postPageSchema,
  reportCreatedDtoSchema,
  trendsDtoSchema,
  unreadCountDtoSchema,
  userPageSchema,
  userProfileDtoSchema,
} from '@xclone/shared'
import { apiRequest } from './client'

/** 一覧の問い合わせ（cursor ページネーション） */
export interface PageParams {
  cursor?: string
  limit?: number
}

// ---------------------------------------------------------------- 認証
export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: input,
      schema: authResponseSchema,
      retryOnUnauthorized: false,
    }),
  login: (input: LoginInput) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: input,
      schema: authResponseSchema,
      retryOnUnauthorized: false,
    }),
  /** Cookie の refresh token で、新しい access token を取る */
  refresh: () =>
    apiRequest('/auth/refresh', {
      method: 'POST',
      schema: authResponseSchema,
      retryOnUnauthorized: false,
    }),
  logout: () => apiRequest('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
}

// ---------------------------------------------------------------- ユーザー
export type ProfileTab = 'posts' | 'replies' | 'media' | 'likes'

export const userApi = {
  me: () => apiRequest('/me', { schema: currentUserDtoSchema }),
  updateMe: (input: UpdateProfileInput) =>
    apiRequest('/me', { method: 'PATCH', body: input, schema: userProfileDtoSchema }),
  isHandleAvailable: (handle: string) =>
    apiRequest('/users/availability', {
      query: { handle },
      schema: handleAvailabilityResponseSchema,
    }),
  profile: (handle: string) =>
    apiRequest(`/users/${encodeURIComponent(handle)}`, { schema: userProfileDtoSchema }),
  posts: (handle: string, tab: ProfileTab, page: PageParams = {}) =>
    apiRequest(`/users/${encodeURIComponent(handle)}/${tab}`, {
      query: { ...page },
      schema: postPageSchema,
    }),
  follows: (handle: string, direction: 'followers' | 'following', page: PageParams = {}) =>
    apiRequest(`/users/${encodeURIComponent(handle)}/${direction}`, {
      query: { ...page },
      schema: userPageSchema,
    }),
  follow: (handle: string) =>
    apiRequest(`/users/${encodeURIComponent(handle)}/follow`, {
      method: 'POST',
      schema: userProfileDtoSchema,
    }),
  unfollow: (handle: string) =>
    apiRequest(`/users/${encodeURIComponent(handle)}/follow`, {
      method: 'DELETE',
      schema: userProfileDtoSchema,
    }),
}

// ---------------------------------------------------------------- 投稿・タイムライン
export type ReactionKind = 'like' | 'repost' | 'bookmark'

export const postApi = {
  create: (input: CreatePostInput) =>
    apiRequest('/posts', { method: 'POST', body: input, schema: postDtoSchema }),
  detail: (id: string) => apiRequest(`/posts/${id}`, { schema: postDetailDtoSchema }),
  replies: (id: string, page: PageParams = {}) =>
    apiRequest(`/posts/${id}/replies`, { query: { ...page }, schema: postPageSchema }),
  remove: (id: string) => apiRequest(`/posts/${id}`, { method: 'DELETE' }),
  /** 反応を付ける（on=true）/ 外す。更新後の投稿が返る */
  react: (id: string, kind: ReactionKind, on: boolean) =>
    apiRequest(`/posts/${id}/${kind}`, { method: on ? 'POST' : 'DELETE', schema: postDtoSchema }),
  followingTimeline: (page: PageParams = {}) =>
    apiRequest('/timeline/following', { query: { ...page }, schema: postPageSchema }),
  forYouTimeline: (page: PageParams = {}) =>
    apiRequest('/timeline/for-you', { query: { ...page }, schema: postPageSchema }),
  bookmarks: (page: PageParams = {}) =>
    apiRequest('/bookmarks', { query: { ...page }, schema: postPageSchema }),
}

// ---------------------------------------------------------------- 通知
export const notificationApi = {
  list: (filter: 'all' | 'mentions', page: PageParams = {}) =>
    apiRequest('/notifications', { query: { filter, ...page }, schema: notificationPageSchema }),
  unreadCount: () => apiRequest('/notifications/unread-count', { schema: unreadCountDtoSchema }),
  markAllRead: () =>
    apiRequest('/notifications/read', { method: 'POST', schema: unreadCountDtoSchema }),
}

// ---------------------------------------------------------------- 検索・トレンド
export const searchApi = {
  posts: (q: string, page: PageParams = {}) =>
    apiRequest('/search', { query: { q, type: 'posts', ...page }, schema: postPageSchema }),
  users: (q: string, page: PageParams = {}) =>
    apiRequest('/search', { query: { q, type: 'users', ...page }, schema: userPageSchema }),
  tags: (q: string, page: PageParams = {}) =>
    apiRequest('/search', { query: { q, type: 'tags', ...page }, schema: hashtagPageSchema }),
  trends: () => apiRequest('/trends', { schema: trendsDtoSchema }),
}

// ---------------------------------------------------------------- 通報・画像
export const reportApi = {
  create: (input: CreateReportInput) =>
    apiRequest('/reports', { method: 'POST', body: input, schema: reportCreatedDtoSchema }),
}

export const mediaApi = {
  /** 画像を 1 枚アップロードして、その URL を返す */
  upload: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { url } = await apiRequest('/media', {
      method: 'POST',
      formData,
      schema: mediaUploadDtoSchema,
    })
    return url
  },
}

// 画面の URL と、表示するページの対応（画面仕様書の U-01〜U-12）。
// ページは「開いたときに読み込む」（遅延 import）ので、最初の表示が速くなる。

import type { RouteLocationNormalized } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // --- ログイン不要（ログイン済みならホームへ） ---
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { guestOnly: true, bareLayout: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/pages/SignupPage.vue'),
      meta: { guestOnly: true, bareLayout: true },
    },

    // --- ログインが必要 ---
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/pages/SearchPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/pages/NotificationsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/bookmarks',
      name: 'bookmarks',
      component: () => import('@/pages/BookmarksPage.vue'),
      meta: { requiresAuth: true },
    },
    // /:handle 系は、上の固定の URL より後に置く（/search などがユーザー名と間違われないように）
    {
      path: '/:handle/status/:postId',
      name: 'post',
      component: () => import('@/pages/PostDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:handle/:direction(followers|following)',
      name: 'follows',
      component: () => import('@/pages/FollowListPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:handle',
      name: 'profile',
      component: () => import('@/pages/ProfilePage.vue'),
      meta: { requiresAuth: true },
    },
  ],
  // ページを移動したら一番上へ。「戻る」のときは元の位置へ
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

/**
 * ページを開く前の確認（ナビゲーションガード）:
 * - 最初の 1 回だけ、Cookie からログイン状態を復元する
 * - ログインが必要な画面に未ログインで来たら、ログイン画面へ（ログイン後に元の画面へ戻れるよう redirect を付ける）
 * - ログイン済みでログイン画面に来たら、ホームへ
 */
export async function authGuard(to: RouteLocationNormalized) {
  const auth = useAuthStore()
  await auth.restore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }
  return true
}

router.beforeEach(authGuard)

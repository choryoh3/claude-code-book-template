// ログイン状態の store。
//
// - access token は「メモリ（この store）」にだけ持つ。localStorage には保存しない（XSS で盗まれにくくするため。ADR 0004）
// - ページを再読み込みするとメモリは消えるので、起動時に restore() で refresh token（httpOnly Cookie）から取り直す
// - refresh は同時に何度も呼ばれても、実際の通信は 1 回にまとめる（複数の API が同時に 401 になったときのため）

import type { AuthResponse, CurrentUserDto, LoginInput, RegisterInput } from '@xclone/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { configureApiAuth } from '@/api/client'
import { authApi } from '@/api/endpoints'

/** ログイン状態: 確認前 / ログイン中 / 未ログイン */
export type AuthStatus = 'unknown' | 'authenticated' | 'guest'

export const useAuthStore = defineStore('auth', () => {
  // --- state ---
  const accessToken = ref<string | null>(null)
  const user = ref<CurrentUserDto | null>(null)
  const status = ref<AuthStatus>('unknown')

  // --- getters ---
  const isAuthenticated = computed(() => status.value === 'authenticated')

  // --- actions ---
  /** ログイン・登録・refresh の結果を反映する */
  function setSession(response: AuthResponse) {
    accessToken.value = response.accessToken
    user.value = response.user
    status.value = 'authenticated'
  }

  /** ログイン状態を消す（ログアウト・セッション切れ） */
  function clearSession() {
    accessToken.value = null
    user.value = null
    status.value = 'guest'
  }

  async function login(input: LoginInput) {
    setSession(await authApi.login(input))
  }

  async function register(input: RegisterInput) {
    setSession(await authApi.register(input))
  }

  /** ログアウト。サーバーへの通知に失敗しても、画面のログイン状態は必ず消す */
  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }

  let refreshing: Promise<boolean> | null = null

  /** refresh token で access token を取り直す。同時に呼ばれたら 1 回の通信を共有する */
  function refresh(): Promise<boolean> {
    refreshing ??= authApi
      .refresh()
      .then((response) => {
        setSession(response)
        return true
      })
      .catch(() => {
        clearSession()
        return false
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  /** 起動時に 1 回だけ、Cookie からログイン状態を復元する（ルーターのガードが呼ぶ） */
  async function restore() {
    if (status.value !== 'unknown') return
    await refresh()
  }

  /** プロフィール編集のあと、表示名やアイコンを反映する */
  function updateUser(patch: Partial<CurrentUserDto>) {
    if (user.value) user.value = { ...user.value, ...patch }
  }

  // API 通信の土台（api/client.ts）に、トークンの取り出し方と refresh の方法を教える
  configureApiAuth({
    getAccessToken: () => accessToken.value,
    refresh,
    onSessionExpired: clearSession,
  })

  return {
    accessToken,
    user,
    status,
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
    restore,
    clearSession,
    updateUser,
  }
})

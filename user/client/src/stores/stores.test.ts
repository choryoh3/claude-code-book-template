import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { authGuard } from '@/router'
import { errorResponse, jsonResponse, makeAuthResponse } from '@/test/fixtures'
import { useAuthStore } from './auth'
import { useConfirmStore } from './confirm'
import { useNotificationStore } from './notifications'
import { THEME_STORAGE_KEY, useThemeStore } from './theme'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('authGuard（ページを開く前の確認）', () => {
  /** ガードに渡す「行き先」の最小限の形 */
  function to(meta: Record<string, boolean>, fullPath = '/bookmarks') {
    return { meta, fullPath } as never
  }

  it('未ログインでログインが必要な画面を開くと、ログイン画面へ（元の画面を redirect に入れる）', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'TOKEN_EXPIRED', '期限切れ'))

    expect(await authGuard(to({ requiresAuth: true }))).toEqual({
      name: 'login',
      query: { redirect: '/bookmarks' },
    })
  })

  it('ログイン状態を Cookie から復元できたら、そのまま開ける', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse()))

    expect(await authGuard(to({ requiresAuth: true }))).toBe(true)
  })

  it('ログイン済みでログイン画面を開くと、ホームへ', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse()))

    expect(await authGuard(to({ guestOnly: true }, '/login'))).toEqual({ name: 'home' })
  })

  it('ログイン状態の確認（refresh）は最初の 1 回だけ', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeAuthResponse()))

    await authGuard(to({ requiresAuth: true }))
    await authGuard(to({ requiresAuth: true }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(useAuthStore().isAuthenticated).toBe(true)
  })
})

describe('useNotificationStore', () => {
  it('未読が 0 ならバッジを出さず、100 件以上は「99+」にする', () => {
    const store = useNotificationStore()
    expect(store.badgeLabel).toBeNull()

    store.setUnreadCount(5)
    expect(store.badgeLabel).toBe('5')

    store.setUnreadCount(150)
    expect(store.badgeLabel).toBe('99+')
  })

  it('届いた通知を新しい順にため、takeIncoming で取り出すと空になる', () => {
    const store = useNotificationStore()
    const base = {
      actor: { id: 'a', handle: 'bob', displayName: 'Bob', avatarUrl: null },
      post: null,
      isRead: false,
    }
    store.receive({ ...base, id: '1', type: 'follow', createdAt: '2026-10-11T00:00:00.000Z' })
    store.receive({ ...base, id: '2', type: 'follow', createdAt: '2026-10-11T00:01:00.000Z' })

    expect(store.takeIncoming().map((item) => item.id)).toEqual(['2', '1'])
    expect(store.incoming).toEqual([])
  })
})

describe('useConfirmStore', () => {
  it('ask は「実行」で true、「キャンセル」で false を返し、ダイアログを閉じる', async () => {
    const confirm = useConfirmStore()

    const accepted = confirm.ask({ title: '削除しますか？', confirmLabel: '削除' })
    expect(confirm.request?.title).toBe('削除しますか？')
    confirm.answer(true)
    await expect(accepted).resolves.toBe(true)
    expect(confirm.request).toBeNull()

    const canceled = confirm.ask({ title: '破棄しますか？', confirmLabel: '破棄' })
    confirm.answer(false)
    await expect(canceled).resolves.toBe(false)
  })

  it('前の確認が開いたまま次を開いたら、前の確認はキャンセル扱いになる', async () => {
    const confirm = useConfirmStore()

    const first = confirm.ask({ title: '1つ目', confirmLabel: 'OK' })
    confirm.ask({ title: '2つ目', confirmLabel: 'OK' })

    await expect(first).resolves.toBe(false)
    expect(confirm.request?.title).toBe('2つ目')
  })
})

describe('useThemeStore', () => {
  it('ダークを選ぶと <html> に dark クラスが付き、選んだテーマを保存する', async () => {
    const theme = useThemeStore()

    theme.setPreference('dark')
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('ライトを選ぶと dark クラスが外れる', async () => {
    const theme = useThemeStore()
    theme.setPreference('dark')
    await nextTick()

    theme.setPreference('light')
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

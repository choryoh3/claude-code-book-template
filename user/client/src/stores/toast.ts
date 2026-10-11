// トースト（画面下部に数秒だけ出る短いお知らせ）の store。
// 「投稿しました」「通報しました」などの成功・失敗の報告に使う（画面仕様書の共通仕様）。

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error'
}

/** 表示しておく時間（ミリ秒） */
const DISPLAY_MS = 4000

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  /** トーストを出す。一定時間で自動的に消える */
  function show(message: string, kind: Toast['kind'] = 'success') {
    const id = nextId++
    toasts.value = [...toasts.value, { id, message, kind }]
    setTimeout(dismiss, DISPLAY_MS, id)
  }

  return {
    toasts,
    show,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    dismiss,
  }
})

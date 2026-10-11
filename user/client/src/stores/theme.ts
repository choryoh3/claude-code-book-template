// テーマ（ライト / ダーク / システムに従う）の store。
// 色の定義は packages/ui/src/tokens.css にあり、<html class="dark"> を付け外しするだけで全画面が切り替わる（ADR 0005）。
// 選んだテーマは localStorage に保存する（見た目の好みだけで、秘密情報ではないため）。

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

/** index.html の「ちらつき防止」スクリプトと同じキー */
export const THEME_STORAGE_KEY = 'xclone:theme'

function readSaved(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system' // 保存領域が使えない環境（プライベートモードなど）でも動くように
  }
}

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readSaved())

  /** 今の設定に従って、<html> に dark クラスを付け外しする */
  function apply() {
    const isDark = preference.value === 'dark' || (preference.value === 'system' && prefersDark())
    document.documentElement.classList.toggle('dark', isDark)
  }

  function setPreference(value: ThemePreference) {
    preference.value = value
  }

  watch(
    preference,
    (value) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, value)
      } catch {
        // 保存できなくても、今の画面には反映する
      }
      apply()
    },
    { immediate: true },
  )

  // 「システムに従う」のとき、OS の設定が変わったら追従する
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', apply)
  }

  return { preference, setPreference, apply }
})

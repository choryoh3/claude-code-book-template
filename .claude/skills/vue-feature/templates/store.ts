// <Feature> の状態管理 store。
// サーバーとのやり取りはこの store の action に集約し、コンポーネントからは直接 fetch しない。
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
// import type { PostDto } from '@xclone/shared'
// import { fetchPosts } from '@/api/posts'

export const useFeatureStore = defineStore('feature', () => {
  // --- state ---
  const items = ref<unknown[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  // --- getters（派生値は computed。state を二重に持たない）---
  const isEmpty = computed(() => !isLoading.value && items.value.length === 0)

  // --- actions ---
  /** 一覧を取得して state に反映する。失敗時は errorMessage にユーザー向け文言を入れる */
  async function load() {
    isLoading.value = true
    errorMessage.value = null
    try {
      // items.value = await fetchPosts()
    } catch {
      errorMessage.value = '読み込みに失敗しました。時間をおいて再度お試しください。'
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, errorMessage, isEmpty, load }
})

// 画面のどこからでも開くダイアログ（投稿・通報）の開閉と、「投稿した」ことの通知を扱う store。
// ダイアログ本体は AppLayout に 1 つだけ置き、ここで開く・閉じるを切り替える。

import type { PostDto, PostSummaryDto } from '@xclone/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 通報の対象（ダイアログの見出しに「@alice さんの投稿」などと出すための表示名つき） */
export interface ReportTarget {
  type: 'post' | 'user'
  id: string
  label: string
}

export const useUiStore = defineStore('ui', () => {
  const isComposeOpen = ref(false)
  /** 引用投稿のとき、引用元 */
  const quoteTarget = ref<PostSummaryDto | null>(null)
  const reportTarget = ref<ReportTarget | null>(null)
  /** 最後に投稿した内容（ホームのタイムラインが先頭に足すために見る） */
  const lastCreatedPost = ref<PostDto | null>(null)

  function openCompose(quote: PostSummaryDto | null = null) {
    quoteTarget.value = quote
    isComposeOpen.value = true
  }

  function closeCompose() {
    isComposeOpen.value = false
    quoteTarget.value = null
  }

  function openReport(target: ReportTarget) {
    reportTarget.value = target
  }

  function closeReport() {
    reportTarget.value = null
  }

  function notifyPostCreated(post: PostDto) {
    lastCreatedPost.value = post
  }

  return {
    isComposeOpen,
    quoteTarget,
    reportTarget,
    lastCreatedPost,
    openCompose,
    closeCompose,
    openReport,
    closeReport,
    notifyPostCreated,
  }
})

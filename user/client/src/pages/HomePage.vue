<script setup lang="ts">
// ホーム（画面仕様書 U-03）。「おすすめ」「フォロー中」のタブ、投稿フォーム、タイムライン（無限スクロール）。
// 選んでいるタブは URL の ?tab= に入れる（再読み込み・戻るで同じタブに戻れるように）。

import type { PostDto } from '@xclone/shared'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { postApi } from '@/api/endpoints'
import PageHeader from '@/components/common/PageHeader.vue'
import TabBar from '@/components/common/TabBar.vue'
import PostComposer from '@/components/post/PostComposer.vue'
import PostList from '@/components/post/PostList.vue'
import { usePostList } from '@/composables/usePostList'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'

type Tab = 'for-you' | 'following'
const TABS: { value: Tab; label: string }[] = [
  { value: 'for-you', label: 'おすすめ' },
  { value: 'following', label: 'フォロー中' },
]

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const toast = useToastStore()

/** 既定は「フォロー中」（画面仕様書 U-03） */
const tab = computed<Tab>({
  get: () => (route.query.tab === 'for-you' ? 'for-you' : 'following'),
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
})

const list = usePostList((cursor) =>
  tab.value === 'for-you'
    ? postApi.forYouTimeline({ cursor })
    : postApi.followingTimeline({ cursor }),
)

onMounted(list.reload)
watch(tab, list.reload)

/** 自分の投稿は、先頭にすぐ出す（再読み込みしなくても見えるように） */
function onPosted(post: PostDto) {
  list.prepend([post])
  toast.success('投稿しました')
}

// 投稿ダイアログ（左ナビの「ポストする」）から投稿したときも、先頭に足す
watch(
  () => ui.lastCreatedPost,
  (post) => {
    if (post && !post.replyToId) list.prepend([post])
  },
)

const emptyText = computed(() =>
  tab.value === 'following'
    ? 'まだ投稿がありません。ユーザーをフォローしてみましょう'
    : 'まだおすすめの投稿がありません',
)
</script>

<template>
  <PageHeader title="ホーム">
    <TabBar v-model="tab" :tabs="TABS" />
  </PageHeader>

  <div class="border-b border-border px-4 py-3">
    <PostComposer @posted="onPosted" />
  </div>

  <PostList :list="list" :empty-text="emptyText" />
</template>

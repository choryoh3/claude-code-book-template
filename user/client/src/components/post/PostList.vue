<script setup lang="ts">
// 投稿の一覧（タイムライン・プロフィールのタブ・ブックマーク・検索結果で共通）。
// 一覧の状態（読み込み・エラー・空・続きの読み込み）は useCursorList が持ち、ここは表示だけを担当する。

import type { PostDto } from '@xclone/shared'
import type { useCursorList } from '@/composables/useCursorList'
import InfiniteScrollSentinel from '@/components/common/InfiniteScrollSentinel.vue'
import ListStatus from '@/components/common/ListStatus.vue'
import { postKey } from '@/composables/usePostList'
import PostCard from './PostCard.vue'

const props = defineProps<{
  list: ReturnType<typeof useCursorList<PostDto>>
  emptyText: string
}>()

/**
 * 投稿が更新されたら、同じ投稿 ID の行をすべて置き換える。
 * タイムラインでは同じ投稿が「本人の投稿」と「誰かのリポスト」で 2 回並ぶことがあるため。
 * 「○○さんがリポストしました」（repostedBy）は行ごとの情報なので、それぞれ元の値を残す。
 */
function onChange(updated: PostDto) {
  props.list.mapItems((item) =>
    item.id === updated.id ? { ...updated, repostedBy: item.repostedBy } : item,
  )
}

/** 削除された投稿を、リポストの行も含めて一覧から取り除く */
function onRemoved(postId: string) {
  props.list.filterItems((item) => item.id !== postId)
}
</script>

<template>
  <section aria-label="投稿の一覧">
    <PostCard
      v-for="post in list.items.value"
      :key="postKey(post)"
      :post="post"
      @change="onChange"
      @removed="onRemoved"
    />
    <ListStatus
      :is-loading="list.isLoading.value"
      :is-first-load="!list.isLoaded.value"
      :error-text="list.errorText.value"
      :is-empty="list.isEmpty.value"
      :empty-text="emptyText"
      @retry="list.retry"
    />
    <InfiniteScrollSentinel v-if="list.hasMore.value" @visible="list.loadMore" />
  </section>
</template>

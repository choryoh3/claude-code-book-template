<script setup lang="ts">
// 検索（画面仕様書 U-09）。検索前はトレンドを、検索後は「投稿 / ユーザー / タグ」のタブで結果を出す。
// 検索ワードとタブは URL（?q=&type=）に入れる（再読み込み・共有・戻るで同じ結果に戻れるように）。

import type { HashtagDto, UserSummaryDto } from '@xclone/shared'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchApi } from '@/api/endpoints'
import InfiniteScrollSentinel from '@/components/common/InfiniteScrollSentinel.vue'
import ListStatus from '@/components/common/ListStatus.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import TabBar from '@/components/common/TabBar.vue'
import TrendList from '@/components/common/TrendList.vue'
import PostList from '@/components/post/PostList.vue'
import UserRow from '@/components/user/UserRow.vue'
import { useCursorList } from '@/composables/useCursorList'
import { usePostList } from '@/composables/usePostList'

type SearchType = 'posts' | 'users' | 'tags'
const TABS: { value: SearchType; label: string }[] = [
  { value: 'posts', label: 'ポスト' },
  { value: 'users', label: 'ユーザー' },
  { value: 'tags', label: 'タグ' },
]

const route = useRoute()
const router = useRouter()

const q = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const type = computed<SearchType>({
  get: () => TABS.find((tab) => tab.value === route.query.type)?.value ?? 'posts',
  set: (value) => router.replace({ query: { ...route.query, type: value } }),
})

const posts = usePostList((cursor) => searchApi.posts(q.value, { cursor }))
const users = useCursorList<UserSummaryDto>(
  (cursor) => searchApi.users(q.value, { cursor }),
  (user) => user.id,
)
const tags = useCursorList<HashtagDto>(
  (cursor) => searchApi.tags(q.value, { cursor }),
  (tag) => tag.tag,
)

/** 今のタブの一覧を読み直す */
function search() {
  if (!q.value) return
  if (type.value === 'users') users.reload()
  else if (type.value === 'tags') tags.reload()
  else posts.reload()
}

// 検索前に出すトレンド
const trends = ref<HashtagDto[]>([])
onMounted(async () => {
  search()
  try {
    trends.value = (await searchApi.trends()).items
  } catch {
    // トレンドは補助的な情報なので、失敗しても検索は使える
  }
})
watch([q, type], search)

const emptyText = computed(() => `「${q.value}」に一致する結果はありません`)
</script>

<template>
  <div class="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
    <div class="px-4 py-2">
      <SearchBox :key="q" :initial-query="q" />
    </div>
    <TabBar v-if="q" v-model="type" :tabs="TABS" />
  </div>

  <section v-if="!q" aria-label="トレンド">
    <h2 class="px-4 pt-3 pb-1 text-xl font-extrabold">トレンド</h2>
    <TrendList :trends="trends" />
  </section>

  <template v-else-if="type === 'posts'">
    <PostList :list="posts" :empty-text="emptyText" />
  </template>

  <template v-else-if="type === 'users'">
    <UserRow v-for="user in users.items.value" :key="user.id" :user="user" />
    <ListStatus
      :is-loading="users.isLoading.value"
      :is-first-load="!users.isLoaded.value"
      :error-text="users.errorText.value"
      :is-empty="users.isEmpty.value"
      :empty-text="emptyText"
      @retry="users.retry"
    />
    <InfiniteScrollSentinel v-if="users.hasMore.value" @visible="users.loadMore" />
  </template>

  <template v-else>
    <RouterLink
      v-for="tag in tags.items.value"
      :key="tag.tag"
      :to="{ name: 'search', query: { q: `#${tag.tag}`, type: 'posts' } }"
      class="block border-b border-border px-4 py-3 hover:bg-surface-hover"
    >
      <span class="block font-bold">#{{ tag.tag }}</span>
      <span class="block text-sm text-text-muted">{{ tag.postCount }} 件のポスト</span>
    </RouterLink>
    <ListStatus
      :is-loading="tags.isLoading.value"
      :is-first-load="!tags.isLoaded.value"
      :error-text="tags.errorText.value"
      :is-empty="tags.isEmpty.value"
      :empty-text="emptyText"
      @retry="tags.retry"
    />
    <InfiniteScrollSentinel v-if="tags.hasMore.value" @visible="tags.loadMore" />
  </template>
</template>

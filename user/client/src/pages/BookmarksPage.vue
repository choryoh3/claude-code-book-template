<script setup lang="ts">
// ブックマーク（画面仕様書 U-10）。保存した投稿を、新しく保存した順に並べる。
// ブックマークを外した投稿は、一覧から消す。

import type { PostDto } from '@xclone/shared'
import { onMounted, watch } from 'vue'
import { postApi } from '@/api/endpoints'
import PageHeader from '@/components/common/PageHeader.vue'
import PostList from '@/components/post/PostList.vue'
import { usePostList } from '@/composables/usePostList'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const list = usePostList((cursor) => postApi.bookmarks({ cursor }))
onMounted(list.reload)

/** 外したもの（bookmarked が false になったもの）を一覧から取り除く */
watch(list.items, (items: PostDto[]) => {
  if (items.some((post) => !post.bookmarked)) list.filterItems((post) => post.bookmarked)
})
</script>

<template>
  <PageHeader title="ブックマーク" :subtitle="auth.user ? `@${auth.user.handle}` : undefined" />
  <PostList :list="list" empty-text="保存した投稿はありません" />
</template>

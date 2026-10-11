<script setup lang="ts">
// 投稿詳細（画面仕様書 U-04）。投稿を大きく表示し、返信フォームと、リプライ（古い順）を並べる。

import type { PostDto } from '@xclone/shared'
import { ERROR_CODES } from '@xclone/shared'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, errorMessage } from '@/api/client'
import { postApi } from '@/api/endpoints'
import ListStatus from '@/components/common/ListStatus.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PostCard from '@/components/post/PostCard.vue'
import PostComposer from '@/components/post/PostComposer.vue'
import PostList from '@/components/post/PostList.vue'
import { usePostList } from '@/composables/usePostList'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const postId = String(route.params.postId)

const post = ref<PostDto | null>(null)
const isLoading = ref(true)
const errorText = ref<string | null>(null)

const replies = usePostList((cursor) => postApi.replies(postId, { cursor }))

async function load() {
  isLoading.value = true
  errorText.value = null
  try {
    post.value = (await postApi.detail(postId)).post
    await replies.reload()
  } catch (error) {
    errorText.value =
      error instanceof ApiError && error.code === ERROR_CODES.POST_NOT_FOUND
        ? 'この投稿は存在しません'
        : errorMessage(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

/** 返信したら、一覧の最後（古い順なので末尾）に足し、返信数を増やす */
function onReplied(reply: PostDto) {
  replies.append([reply])
  if (post.value) post.value = { ...post.value, replyCount: post.value.replyCount + 1 }
  toast.success('返信しました')
}

/** 主役の投稿を削除したら、前の画面へ戻る */
function onRemoved() {
  router.back()
}
</script>

<template>
  <PageHeader title="ポスト" show-back />

  <ListStatus
    :is-loading="isLoading"
    :error-text="errorText"
    :is-empty="false"
    empty-text=""
    is-first-load
    @retry="load"
  />

  <template v-if="post && !isLoading">
    <PostCard :post="post" detail @change="post = $event" @removed="onRemoved" />

    <div v-if="post.status === 'visible'" class="border-b border-border px-4 py-3">
      <PostComposer :reply-to="post" placeholder="返信をポスト" @posted="onReplied" />
    </div>

    <PostList :list="replies" empty-text="最初の返信を書きましょう" />
  </template>
</template>

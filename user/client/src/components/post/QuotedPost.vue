<script setup lang="ts">
// 引用元の投稿（投稿の中に、枠で囲んで埋め込む）。削除済み・非表示なら、その旨だけを出す。

import type { PostSummaryDto } from '@xclone/shared'
import { Avatar } from '@xclone/ui'
import { formatRelativeTime } from '@/lib/format'
import PostContent from './PostContent'
import PostMedia from './PostMedia.vue'

defineProps<{ post: PostSummaryDto }>()
</script>

<template>
  <div
    v-if="post.status !== 'visible'"
    class="mt-3 rounded-card border border-border p-3 text-sm text-text-muted"
  >
    この投稿は表示できません
  </div>
  <RouterLink
    v-else
    :to="{ name: 'post', params: { handle: post.author.handle, postId: post.id } }"
    class="mt-3 block rounded-card border border-border p-3 hover:bg-surface-hover"
    @click.stop
  >
    <div class="flex items-center gap-1 text-sm">
      <Avatar
        :src="post.author.avatarUrl"
        :name="post.author.displayName"
        size="sm"
        class="size-5"
      />
      <span class="font-bold">{{ post.author.displayName }}</span>
      <span class="text-text-muted"
        >@{{ post.author.handle }} · {{ formatRelativeTime(post.createdAt) }}</span
      >
    </div>
    <PostContent v-if="post.content" :content="post.content" class="mt-1 text-sm" />
    <PostMedia :urls="post.mediaUrls" />
  </RouterLink>
</template>

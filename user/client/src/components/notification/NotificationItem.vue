<script setup lang="ts">
// 通知の 1 行（画面仕様書 U-08）。種類のアイコン + 実行した人 + 内容 + 時刻。未読は背景を薄い青にする。
// クリックすると、フォローならその人のプロフィール、それ以外は対象の投稿へ移動する。

import type { NotificationDto } from '@xclone/shared'
import type { Component } from 'vue'
import { AtSign, Heart, MessageCircle, Quote, Repeat2, UserPlus } from '@lucide/vue'
import { Avatar } from '@xclone/ui'
import { computed } from 'vue'
import { formatRelativeTime } from '@/lib/format'

const props = defineProps<{ notification: NotificationDto }>()

/** 種類ごとのアイコン・色・文言 */
const KINDS: Record<NotificationDto['type'], { icon: Component; color: string; text: string }> = {
  like: { icon: Heart, color: 'text-like', text: 'さんがあなたのポストをいいねしました' },
  repost: { icon: Repeat2, color: 'text-repost', text: 'さんがあなたのポストをリポストしました' },
  follow: { icon: UserPlus, color: 'text-accent', text: 'さんにフォローされました' },
  reply: { icon: MessageCircle, color: 'text-accent', text: 'さんが返信しました' },
  mention: { icon: AtSign, color: 'text-accent', text: 'さんがあなたについてポストしました' },
  quote: { icon: Quote, color: 'text-repost', text: 'さんがあなたのポストを引用しました' },
}

const kind = computed(() => KINDS[props.notification.type])
const target = computed(() => {
  const { post, actor } = props.notification
  return post
    ? { name: 'post', params: { handle: post.author.handle, postId: post.id } }
    : { name: 'profile', params: { handle: actor.handle } }
})
</script>

<template>
  <RouterLink
    :to="target"
    class="flex gap-3 border-b border-border px-4 py-3 hover:bg-surface-hover"
    :class="{ 'bg-accent/5': !notification.isRead }"
    :data-unread="!notification.isRead || undefined"
  >
    <component
      :is="kind.icon"
      class="mt-1 size-7 shrink-0"
      :class="kind.color"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1">
      <Avatar
        :src="notification.actor.avatarUrl"
        :name="notification.actor.displayName"
        size="sm"
      />
      <p class="mt-2">
        <span class="font-bold">{{ notification.actor.displayName }}</span
        >{{ kind.text }}
        <time :datetime="notification.createdAt" class="text-text-muted">
          · {{ formatRelativeTime(notification.createdAt) }}</time
        >
      </p>
      <p v-if="notification.post?.content" class="mt-1 line-clamp-3 text-text-muted">
        {{ notification.post.content }}
      </p>
      <p
        v-else-if="notification.post && notification.post.status !== 'visible'"
        class="mt-1 text-text-muted"
      >
        この投稿は削除されました
      </p>
    </div>
  </RouterLink>
</template>

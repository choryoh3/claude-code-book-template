<script setup lang="ts">
// 投稿ダイアログ（左ナビの「ポストする」・スマホの投稿ボタン・「引用」から開く）。

import type { PostDto } from '@xclone/shared'
import { Dialog } from '@xclone/ui'
import { computed } from 'vue'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import PostComposer from './PostComposer.vue'

const ui = useUiStore()
const toast = useToastStore()

/** v-model:open で開閉する（閉じたら引用元もリセットする） */
const isOpen = computed({
  get: () => ui.isComposeOpen,
  set: (value) => (value ? ui.openCompose(ui.quoteTarget) : ui.closeCompose()),
})

function onPosted(post: PostDto) {
  ui.notifyPostCreated(post)
  ui.closeCompose()
  toast.success('投稿しました')
}
</script>

<template>
  <Dialog v-model:open="isOpen" :title="ui.quoteTarget ? '引用してポスト' : 'ポストする'">
    <PostComposer :quote="ui.quoteTarget" autofocus @posted="onPosted" />
  </Dialog>
</template>

<script setup lang="ts">
// 一覧の下に出す「状態」の表示（画面仕様書の共通仕様: 読み込み中 / エラー / 空 を必ず出す）。
//   読み込み中 → スケルトン（投稿カードの形の灰色の箱）
//   エラー     → メッセージと「再試行」ボタン
//   空         → emptyText（例「まだ投稿がありません」）

import { Button } from '@xclone/ui'

defineProps<{
  isLoading: boolean
  errorText: string | null
  isEmpty: boolean
  emptyText: string
  /** 1 件目より前の読み込み中か（スケルトンを多めに出す） */
  isFirstLoad?: boolean
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="isLoading" role="status" aria-label="読み込み中">
    <div
      v-for="n in isFirstLoad ? 5 : 1"
      :key="n"
      class="flex animate-pulse gap-3 border-b border-border p-4"
    >
      <div class="size-10 shrink-0 rounded-full bg-surface-hover" />
      <div class="flex-1 space-y-2">
        <div class="h-3 w-1/3 rounded bg-surface-hover" />
        <div class="h-3 w-full rounded bg-surface-hover" />
        <div class="h-3 w-2/3 rounded bg-surface-hover" />
      </div>
    </div>
  </div>
  <div
    v-else-if="errorText"
    class="flex flex-col items-center gap-3 px-4 py-8 text-center"
    role="alert"
  >
    <p class="text-text-muted">
      {{ errorText }}
    </p>
    <Button variant="secondary" size="sm" @click="emit('retry')"> 再試行 </Button>
  </div>
  <p v-else-if="isEmpty" class="px-4 py-10 text-center text-text-muted">
    {{ emptyText }}
  </p>
</template>

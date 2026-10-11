<script setup lang="ts">
// 画面上部の見出し（スクロールしても上に貼り付く）。戻るボタンと、タブなどを入れる場所（default スロット）がある。

import { ArrowLeft } from '@lucide/vue'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{ title: string; subtitle?: string; showBack?: boolean }>(), {
  subtitle: undefined,
  showBack: false,
})

const router = useRouter()

/** 直前の画面へ戻る。履歴が無ければ（URL を直接開いたとき）ホームへ */
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'home' })
}
</script>

<template>
  <div class="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
    <div class="flex h-14 items-center gap-6 px-4">
      <button
        v-if="showBack"
        type="button"
        class="rounded-full p-2 hover:bg-surface-hover"
        aria-label="戻る"
        @click="goBack"
      >
        <ArrowLeft class="size-5" aria-hidden="true" />
      </button>
      <div class="min-w-0">
        <h1 class="truncate text-xl font-bold">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="truncate text-xs text-text-muted">
          {{ subtitle }}
        </p>
      </div>
    </div>
    <slot />
  </div>
</template>

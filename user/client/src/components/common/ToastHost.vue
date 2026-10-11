<script setup lang="ts">
// トーストの表示場所（画面下部）。読み上げソフトにも伝わるよう role="status" にする。

import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 sm:bottom-6"
    role="status"
    aria-live="polite"
  >
    <div
      v-for="item in toast.toasts"
      :key="item.id"
      class="pointer-events-auto rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg"
      :class="item.kind === 'error' ? 'bg-red-600' : 'bg-accent'"
    >
      {{ item.message }}
    </div>
  </div>
</template>

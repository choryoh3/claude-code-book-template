<script setup lang="ts">
// 無限スクロールの「目印」。一覧の末尾に置き、画面に見えたら visible を発生させる（続きを読み込む合図）。
// IntersectionObserver は「要素が画面に入ったか」をブラウザが教えてくれる仕組み（スクロールのたびに計算しなくてよい）。

import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{ visible: [] }>()
const target = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!target.value || typeof IntersectionObserver === 'undefined') return
  // 末尾の 300px 手前で読み込みを始める（スクロールが止まらないように少し早めに）
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) emit('visible')
    },
    { rootMargin: '0px 0px 300px 0px' },
  )
  observer.observe(target.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="target" aria-hidden="true" class="h-px" />
</template>

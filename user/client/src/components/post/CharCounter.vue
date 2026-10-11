<script setup lang="ts">
// 文字数カウンタ（円形のリング）。X と同じく:
//   ふだん: 青いリングが文字数に応じて伸びる
//   残り 20 文字以下: 黄色になり、残りの文字数を表示
//   上限を超えた: 赤になり、超えた文字数をマイナスで表示（投稿ボタンは押せない）

import { computed } from 'vue'

const props = defineProps<{ count: number; max: number }>()

/** 残りの文字数がこれ以下になったら警告する */
const WARNING_THRESHOLD = 20
const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const remaining = computed(() => props.max - props.count)
const state = computed(() => {
  if (remaining.value < 0) return 'over'
  if (remaining.value <= WARNING_THRESHOLD) return 'warning'
  return 'normal'
})
/** リングの伸び具合（0〜1）。上限を超えても 1 で止める */
const progress = computed(() => Math.min(props.count / props.max, 1))
const strokeClass = computed(
  () =>
    ({ normal: 'stroke-accent', warning: 'stroke-yellow-500', over: 'stroke-red-600' })[
      state.value
    ],
)
</script>

<template>
  <div class="flex items-center gap-1" :data-state="state">
    <svg viewBox="0 0 24 24" class="size-6 -rotate-90" aria-hidden="true">
      <circle cx="12" cy="12" :r="RADIUS" fill="none" class="stroke-border" stroke-width="2" />
      <circle
        cx="12"
        cy="12"
        :r="RADIUS"
        fill="none"
        :class="strokeClass"
        stroke-width="2"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="CIRCUMFERENCE * (1 - progress)"
      />
    </svg>
    <span
      v-if="state !== 'normal'"
      class="text-sm tabular-nums"
      :class="state === 'over' ? 'text-red-600' : 'text-text-muted'"
    >
      {{ remaining }}
    </span>
    <span class="sr-only">残り {{ remaining }} 文字</span>
  </div>
</template>

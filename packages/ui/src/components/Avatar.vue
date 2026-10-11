<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from 'radix-vue'
import { computed } from 'vue'
import { cn } from '../lib/cn'

/**
 * ユーザーのアイコン（円形）。
 * 画像が無い・読み込めないときは、表示名の頭文字を表示する（Radix Vue の Avatar が切り替えを担当）。
 */
const props = withDefaults(
  defineProps<{
    /** 画像の URL（無ければ頭文字を表示） */
    src?: string | null
    /** 表示名。頭文字の元になり、画像の代替テキストにもなる */
    name: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { src: null, size: 'md' },
)

const SIZE_CLASSES = {
  sm: 'size-8 text-sm',
  md: 'size-10 text-base',
  lg: 'size-20 text-3xl',
} as const

/** 表示名の最初の 1 文字（絵文字などのサロゲートペアも 1 文字として数える） */
const initial = computed(() => Array.from(props.name.trim())[0]?.toUpperCase() ?? '?')
</script>

<template>
  <AvatarRoot
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-hover align-middle font-bold text-text-muted select-none',
        SIZE_CLASSES[size],
      )
    "
  >
    <AvatarImage v-if="src" :src="src" :alt="name" class="size-full object-cover" />
    <!-- 画像が読み込めるまで / 読み込めないとき（delay-ms でちらつきを防ぐ） -->
    <AvatarFallback :delay-ms="src ? 300 : 0" :aria-label="name">
      {{ initial }}
    </AvatarFallback>
  </AvatarRoot>
</template>

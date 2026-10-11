<script setup lang="ts">
// 投稿の画像（1〜4 枚）をグリッドで表示する。枚数で並べ方を変える（X と同じ）。
//   1 枚: 1 列 / 2 枚: 2 列 / 3 枚: 左に大きく 1 枚 + 右に 2 枚 / 4 枚: 2×2

import { computed } from 'vue'

const props = defineProps<{ urls: string[] }>()

const gridClass = computed(() => {
  if (props.urls.length === 1) return 'grid-cols-1'
  if (props.urls.length === 3) return 'grid-cols-2 grid-rows-2'
  return 'grid-cols-2'
})
</script>

<template>
  <div
    v-if="urls.length > 0"
    class="mt-3 grid aspect-video gap-0.5 overflow-hidden rounded-card border border-border"
    :class="gridClass"
  >
    <a
      v-for="(url, index) in urls"
      :key="url"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="block min-h-0 bg-surface-hover"
      :class="{ 'row-span-2': urls.length === 3 && index === 0 }"
      @click.stop
    >
      <img
        :src="url"
        :alt="`画像 ${index + 1}/${urls.length}`"
        loading="lazy"
        class="size-full object-cover"
      />
    </a>
  </div>
</template>

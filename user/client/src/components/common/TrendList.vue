<script setup lang="ts">
// トレンド（よく使われているハッシュタグ）の一覧。クリックするとそのタグで検索する。

import type { HashtagDto } from '@xclone/shared'

defineProps<{ trends: HashtagDto[] }>()
</script>

<template>
  <p v-if="trends.length === 0" class="px-4 py-3 text-sm text-text-muted">
    まだトレンドはありません
  </p>
  <ol v-else>
    <li v-for="(trend, index) in trends" :key="trend.tag">
      <RouterLink
        :to="{ name: 'search', query: { q: `#${trend.tag}` } }"
        class="block px-4 py-3 hover:bg-surface-hover"
      >
        <span class="block text-xs text-text-muted">{{ index + 1 }} 位 · トレンド</span>
        <span class="block font-bold">#{{ trend.tag }}</span>
        <span class="block text-xs text-text-muted">{{ trend.postCount }} 件のポスト</span>
      </RouterLink>
    </li>
  </ol>
</template>

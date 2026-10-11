<script setup lang="ts">
// 右のサイドバー: 検索ボックスとトレンド（skill: x-ui-patterns）。

import type { HashtagDto } from '@xclone/shared'
import { onMounted, ref } from 'vue'
import { searchApi } from '@/api/endpoints'
import SearchBox from '@/components/common/SearchBox.vue'
import TrendList from '@/components/common/TrendList.vue'

const trends = ref<HashtagDto[]>([])
const hasError = ref(false)

onMounted(async () => {
  try {
    trends.value = (await searchApi.trends()).items
  } catch {
    hasError.value = true // トレンドは補助的な情報なので、失敗しても画面全体は止めない
  }
})
</script>

<template>
  <div class="sticky top-0 flex flex-col gap-4 py-2">
    <SearchBox />
    <section class="overflow-hidden rounded-card border border-border">
      <h2 class="px-4 pt-3 pb-1 text-xl font-extrabold">いまどうしてる？</h2>
      <p v-if="hasError" class="px-4 py-3 text-sm text-text-muted">
        トレンドを読み込めませんでした
      </p>
      <TrendList v-else :trends="trends" />
    </section>
  </div>
</template>

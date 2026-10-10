<script setup lang="ts">
// <Feature> ページ。ルート単位の画面で、store と部品を組み立てるだけにする（ロジックは store / composable へ）。
import { onMounted } from 'vue'
import { useFeatureStore } from '@/stores/feature'

const store = useFeatureStore()

onMounted(() => store.load())
</script>

<template>
  <section class="p-4">
    <!-- 3 つの状態（読み込み中 / エラー / 空）を必ず表示する -->
    <p v-if="store.isLoading" role="status">読み込み中…</p>
    <p v-else-if="store.errorMessage" role="alert">{{ store.errorMessage }}</p>
    <p v-else-if="store.isEmpty" class="text-text-muted">まだ何もありません。</p>
    <ul v-else>
      <li v-for="(item, index) in store.items" :key="index">{{ item }}</li>
    </ul>
  </section>
</template>

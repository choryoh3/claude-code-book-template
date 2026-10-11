<script setup lang="ts">
// 検索ボックス。Enter で検索画面（/search?q=）へ移動する。

import { Search } from '@lucide/vue'
import { SEARCH_QUERY_MAX_LENGTH } from '@xclone/shared'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{ initialQuery?: string }>(), { initialQuery: '' })
const router = useRouter()
const query = ref(props.initialQuery)

function submit() {
  const q = query.value.trim()
  if (q) router.push({ name: 'search', query: { q } })
}
</script>

<template>
  <form role="search" class="relative" @submit.prevent="submit">
    <Search
      class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-muted"
      aria-hidden="true"
    />
    <input
      v-model="query"
      type="search"
      :maxlength="SEARCH_QUERY_MAX_LENGTH"
      placeholder="検索"
      aria-label="検索"
      class="w-full rounded-full border border-transparent bg-surface-hover py-3 pr-4 pl-12 outline-none focus:border-accent focus:bg-surface"
    />
  </form>
</template>

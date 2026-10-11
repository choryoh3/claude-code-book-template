<script setup lang="ts">
// 通知（画面仕様書 U-08）。「すべて」「メンション」のタブ。開いたら全て既読にして、バッジを消す。
// 画面を開いているあいだに届いた通知（Socket.IO）は、一覧の先頭に足していく。

import type { NotificationDto } from '@xclone/shared'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { notificationApi } from '@/api/endpoints'
import InfiniteScrollSentinel from '@/components/common/InfiniteScrollSentinel.vue'
import ListStatus from '@/components/common/ListStatus.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import TabBar from '@/components/common/TabBar.vue'
import NotificationItem from '@/components/notification/NotificationItem.vue'
import { useCursorList } from '@/composables/useCursorList'
import { useNotificationStore } from '@/stores/notifications'

type Filter = 'all' | 'mentions'
const TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'mentions', label: 'メンション' },
]

const route = useRoute()
const router = useRouter()
const store = useNotificationStore()

const filter = computed<Filter>({
  get: () => (route.query.filter === 'mentions' ? 'mentions' : 'all'),
  set: (value) => router.replace({ query: { ...route.query, filter: value } }),
})

const list = useCursorList<NotificationDto>(
  (cursor) => notificationApi.list(filter.value, { cursor }),
  (notification) => notification.id,
)

async function open() {
  store.takeIncoming() // 一覧を読み直すので、それまでに届いた分は捨ててよい
  await list.reload()
  store.markAllRead().catch(() => {}) // 既読にできなくても一覧は見られる（次に開いたときにまた試す）
}

onMounted(open)
watch(filter, list.reload)

/** 開いているあいだに届いた通知を、先頭に足す（メンションのタブではメンションだけ） */
watch(
  () => store.incoming.length,
  () => {
    const arrived = store
      .takeIncoming()
      .filter((item) => filter.value === 'all' || item.type === 'mention')
    if (arrived.length > 0) list.prepend(arrived)
  },
)
</script>

<template>
  <PageHeader title="通知">
    <TabBar v-model="filter" :tabs="TABS" />
  </PageHeader>

  <NotificationItem
    v-for="notification in list.items.value"
    :key="notification.id"
    :notification="notification"
  />
  <ListStatus
    :is-loading="list.isLoading.value"
    :is-first-load="!list.isLoaded.value"
    :error-text="list.errorText.value"
    :is-empty="list.isEmpty.value"
    empty-text="通知はまだありません"
    @retry="list.retry"
  />
  <InfiniteScrollSentinel v-if="list.hasMore.value" @visible="list.loadMore" />
</template>

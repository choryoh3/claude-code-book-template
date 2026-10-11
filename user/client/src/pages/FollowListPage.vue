<script setup lang="ts">
// フォロー中 / フォロワーの一覧（画面仕様書 U-07）。URL の /:handle/followers と /:handle/following で切り替える。

import type { UserSummaryDto } from '@xclone/shared'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { userApi } from '@/api/endpoints'
import InfiniteScrollSentinel from '@/components/common/InfiniteScrollSentinel.vue'
import ListStatus from '@/components/common/ListStatus.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import TabBar from '@/components/common/TabBar.vue'
import UserRow from '@/components/user/UserRow.vue'
import { useCursorList } from '@/composables/useCursorList'

type Direction = 'followers' | 'following'
const TABS: { value: Direction; label: string }[] = [
  { value: 'followers', label: 'フォロワー' },
  { value: 'following', label: 'フォロー中' },
]

const route = useRoute()
const router = useRouter()
const handle = String(route.params.handle)

/** タブを切り替えたら URL も変える（ページが作り直され、その一覧を読み込む） */
const direction = computed<Direction>({
  get: () => (route.params.direction === 'following' ? 'following' : 'followers'),
  set: (value) => router.replace({ name: 'follows', params: { handle, direction: value } }),
})

const list = useCursorList<UserSummaryDto>(
  (cursor) => userApi.follows(handle, direction.value, { cursor }),
  (user) => user.id,
)
onMounted(list.reload)
</script>

<template>
  <PageHeader :title="`@${handle}`" show-back>
    <TabBar v-model="direction" :tabs="TABS" />
  </PageHeader>

  <UserRow v-for="user in list.items.value" :key="user.id" :user="user" />
  <ListStatus
    :is-loading="list.isLoading.value"
    :is-first-load="!list.isLoaded.value"
    :error-text="list.errorText.value"
    :is-empty="list.isEmpty.value"
    empty-text="まだいません"
    @retry="list.retry"
  />
  <InfiniteScrollSentinel v-if="list.hasMore.value" @visible="list.loadMore" />
</template>

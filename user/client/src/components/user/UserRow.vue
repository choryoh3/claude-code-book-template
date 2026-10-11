<script setup lang="ts">
// ユーザーの 1 行（フォロー一覧・ユーザー検索の結果）。クリックでプロフィールへ。

import type { UserSummaryDto } from '@xclone/shared'
import { Avatar } from '@xclone/ui'

defineProps<{ user: UserSummaryDto }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'profile', params: { handle: user.handle } }"
    class="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-hover"
  >
    <Avatar :src="user.avatarUrl" :name="user.displayName" />
    <span class="min-w-0">
      <span class="block truncate font-bold">{{ user.displayName }}</span>
      <span class="block truncate text-text-muted">@{{ user.handle }}</span>
    </span>
  </RouterLink>
</template>

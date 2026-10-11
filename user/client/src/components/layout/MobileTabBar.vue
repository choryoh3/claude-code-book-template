<script setup lang="ts">
// スマホ用: 画面下部のタブバーと、右下に浮かぶ投稿ボタン（画面仕様書 U-12 の「モバイル」）。

import { Feather } from '@lucide/vue'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { useUiStore } from '@/stores/ui'
import { buildNavItems } from './nav-items'

const auth = useAuthStore()
const notifications = useNotificationStore()
const ui = useUiStore()
const items = computed(() => buildNavItems(auth.user?.handle))
</script>

<template>
  <div>
    <button
      type="button"
      class="fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      aria-label="ポストする"
      @click="ui.openCompose()"
    >
      <Feather class="size-6" aria-hidden="true" />
    </button>

    <nav
      class="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-border bg-surface"
      aria-label="メインメニュー"
    >
      <RouterLink
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        class="relative flex size-12 items-center justify-center rounded-full"
        :aria-label="item.label"
      >
        <component :is="item.icon" class="size-6" aria-hidden="true" />
        <span
          v-if="item.showsBadge && notifications.badgeLabel"
          class="absolute top-1 right-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-bold text-white"
        >
          {{ notifications.badgeLabel }}
        </span>
      </RouterLink>
    </nav>
  </div>
</template>

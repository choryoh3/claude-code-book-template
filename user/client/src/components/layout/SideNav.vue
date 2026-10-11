<script setup lang="ts">
// 左のサイドナビ（ロゴ・メニュー・投稿ボタン・アカウントメニュー）。
// 画面が狭い（1280px 未満）ときはアイコンだけになる。通知には未読件数のバッジを出す。

import type { ThemePreference } from '@/stores/theme'
import { Feather, LogOut, Moon, Sun, SunMoon } from '@lucide/vue'
import { Avatar, Button } from '@xclone/ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { useThemeStore } from '@/stores/theme'
import { useUiStore } from '@/stores/ui'
import { buildNavItems } from './nav-items'

const auth = useAuthStore()
const notifications = useNotificationStore()
const theme = useThemeStore()
const ui = useUiStore()
const router = useRouter()

const items = computed(() => buildNavItems(auth.user?.handle))
const isMenuOpen = ref(false)

/** テーマを「システム → ライト → ダーク → システム」の順に切り替える */
const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']
const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'システムに従う',
  light: 'ライト',
  dark: 'ダーク',
}
function cycleTheme() {
  const index = THEME_ORDER.indexOf(theme.preference)
  theme.setPreference(THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? 'system')
}

async function logout() {
  isMenuOpen.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <nav
    class="sticky top-0 flex h-screen w-full flex-col justify-between px-2 py-2 xl:px-3"
    aria-label="メインメニュー"
  >
    <div class="flex flex-col items-center gap-1 xl:items-stretch">
      <RouterLink
        :to="{ name: 'home' }"
        class="flex size-12 items-center justify-center rounded-full text-2xl font-black hover:bg-surface-hover"
        aria-label="ホーム"
      >
        𝕏
      </RouterLink>

      <RouterLink
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        class="group flex items-center gap-4 rounded-full p-3 text-xl hover:bg-surface-hover"
        active-class="font-bold"
        :aria-label="item.label"
      >
        <span class="relative">
          <component :is="item.icon" class="size-7" aria-hidden="true" />
          <span
            v-if="item.showsBadge && notifications.badgeLabel"
            class="absolute -top-1.5 -right-2 min-w-5 rounded-full bg-accent px-1 text-center text-xs leading-5 font-bold text-white"
            :aria-label="`未読 ${notifications.badgeLabel} 件`"
          >
            {{ notifications.badgeLabel }}
          </span>
        </span>
        <span class="hidden xl:inline">{{ item.label }}</span>
      </RouterLink>

      <Button
        size="lg"
        class="mt-4 w-12 px-0 xl:w-full"
        aria-label="ポストする"
        @click="ui.openCompose()"
      >
        <Feather class="size-5 xl:hidden" aria-hidden="true" />
        <span class="hidden xl:inline">ポストする</span>
      </Button>
    </div>

    <!-- アカウントメニュー（テーマの切り替え・ログアウト） -->
    <div v-if="auth.user" class="relative">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-full p-3 hover:bg-surface-hover"
        :aria-expanded="isMenuOpen"
        aria-haspopup="menu"
        aria-label="アカウントメニュー"
        @click="isMenuOpen = !isMenuOpen"
      >
        <Avatar :src="auth.user.avatarUrl" :name="auth.user.displayName" />
        <span class="hidden min-w-0 text-left xl:block">
          <span class="block truncate font-bold">{{ auth.user.displayName }}</span>
          <span class="block truncate text-text-muted">@{{ auth.user.handle }}</span>
        </span>
      </button>

      <div
        v-if="isMenuOpen"
        role="menu"
        class="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-lg"
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-hover"
          @click="cycleTheme"
        >
          <Sun v-if="theme.preference === 'light'" class="size-5" aria-hidden="true" />
          <Moon v-else-if="theme.preference === 'dark'" class="size-5" aria-hidden="true" />
          <SunMoon v-else class="size-5" aria-hidden="true" />
          テーマ: {{ THEME_LABELS[theme.preference] }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-hover"
          @click="logout"
        >
          <LogOut class="size-5" aria-hidden="true" />
          @{{ auth.user.handle }} からログアウト
        </button>
      </div>
    </div>
  </nav>
</template>

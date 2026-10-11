<script setup lang="ts">
// アプリの外枠。ログイン・登録画面は枠なし、それ以外は X の 3 カラムのレイアウトで表示する。
// テーマ（ダークモード）とリアルタイム通知の接続は、ここで 1 回だけ開始する。

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ToastHost from '@/components/common/ToastHost.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useRealtime } from '@/composables/useRealtime'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const isBare = computed(() => route.meta.bareLayout === true)

useThemeStore()
useRealtime()
</script>

<template>
  <RouterView v-if="isBare" />
  <AppLayout v-else>
    <RouterView :key="route.fullPath" />
  </AppLayout>
  <ToastHost />
</template>

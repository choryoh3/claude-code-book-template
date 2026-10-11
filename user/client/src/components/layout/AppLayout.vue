<script setup lang="ts">
// X の 3 カラムのレイアウト（skill: x-ui-patterns）。
//   左: サイドナビ（約 275px。1280px 未満はアイコンだけの約 88px）
//   中: メイン（最大 600px。左右に区切り線）
//   右: 検索とトレンド（約 350px。1000px 未満は出さない）
//   スマホ: 左ナビの代わりに下部のタブバーと、右下の投稿ボタン
// どの画面からでも開くダイアログ（投稿・通報）も、ここに 1 つずつ置く。

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ComposeDialog from '@/components/post/ComposeDialog.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import MobileTabBar from './MobileTabBar.vue'
import RightSidebar from './RightSidebar.vue'
import SideNav from './SideNav.vue'
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-[1265px] justify-center">
    <header class="hidden shrink-0 sm:flex sm:w-[88px] xl:w-[275px]">
      <SideNav />
    </header>

    <main class="min-h-screen w-full max-w-[600px] border-x border-border pb-16 sm:pb-0">
      <slot />
    </main>

    <aside class="hidden w-[350px] shrink-0 pl-6 lg:block">
      <RightSidebar />
    </aside>
  </div>

  <MobileTabBar class="sm:hidden" />
  <ComposeDialog />
  <ReportDialog />
  <ConfirmDialog />
</template>

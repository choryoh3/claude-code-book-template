<script setup lang="ts">
// 確認ダイアログの表示（中身は stores/confirm.ts）。AppLayout に 1 つだけ置く。

import { Button, Dialog } from '@xclone/ui'
import { computed } from 'vue'
import { useConfirmStore } from '@/stores/confirm'

const confirm = useConfirmStore()

/** × や Esc で閉じたら「キャンセル」扱い */
const isOpen = computed({
  get: () => confirm.request !== null,
  set: (value) => {
    if (!value) confirm.answer(false)
  },
})
</script>

<template>
  <Dialog
    v-model:open="isOpen"
    :title="confirm.request?.title ?? ''"
    :description="confirm.request?.message"
    :show-close="false"
  >
    <template #footer>
      <Button variant="secondary" @click="confirm.answer(false)">キャンセル</Button>
      <Button
        :variant="confirm.request?.danger ? 'danger' : 'primary'"
        @click="confirm.answer(true)"
      >
        {{ confirm.request?.confirmLabel }}
      </Button>
    </template>
  </Dialog>
</template>

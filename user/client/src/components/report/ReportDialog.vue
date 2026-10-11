<script setup lang="ts">
// 通報ダイアログ（画面仕様書 U-11）。理由を選び、補足を書いて送る。管理者が admin アプリで処理する。

import type { CreateReportInput } from '@xclone/shared'
import { ERROR_CODES, REPORT_DETAIL_MAX_LENGTH, REPORT_REASONS } from '@xclone/shared'
import { Button, Dialog } from '@xclone/ui'
import { computed, ref, watch } from 'vue'
import { ApiError, errorMessage } from '@/api/client'
import { reportApi } from '@/api/endpoints'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'

type Reason = CreateReportInput['reason']

/** 理由の選択肢（表示名） */
const REASON_LABELS: Record<Reason, string> = {
  spam: 'スパム',
  harassment: '嫌がらせ・攻撃的な内容',
  inappropriate: '不適切な内容',
  other: 'その他',
}

const ui = useUiStore()
const toast = useToastStore()

const reason = ref<Reason | null>(null)
const detail = ref('')
const isSending = ref(false)
const errorText = ref<string | null>(null)

const isOpen = computed({
  get: () => ui.reportTarget !== null,
  set: (value) => {
    if (!value) ui.closeReport()
  },
})

/** 開くたびに入力を空にする */
watch(isOpen, (open) => {
  if (!open) return
  reason.value = null
  detail.value = ''
  errorText.value = null
})

async function submit() {
  const target = ui.reportTarget
  if (!target || !reason.value) return
  isSending.value = true
  errorText.value = null
  try {
    await reportApi.create({
      targetType: target.type,
      targetId: target.id,
      reason: reason.value,
      detail: detail.value,
    })
    ui.closeReport()
    toast.success('通報しました')
  } catch (error) {
    errorText.value =
      error instanceof ApiError && error.code === ERROR_CODES.ALREADY_REPORTED
        ? 'すでに通報済みです'
        : errorMessage(error)
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:open="isOpen"
    title="通報する"
    :description="ui.reportTarget ? `${ui.reportTarget.label}の問題を教えてください` : undefined"
  >
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 font-bold">理由</legend>
        <label
          v-for="value in REPORT_REASONS"
          :key="value"
          class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-hover"
        >
          <input
            v-model="reason"
            type="radio"
            name="report-reason"
            :value="value"
            class="size-4 accent-accent"
          />
          {{ REASON_LABELS[value] }}
        </label>
      </fieldset>

      <label class="block">
        <span class="text-sm text-text-muted"
          >補足（任意・{{ REPORT_DETAIL_MAX_LENGTH }}文字まで）</span
        >
        <textarea
          v-model="detail"
          :maxlength="REPORT_DETAIL_MAX_LENGTH"
          rows="3"
          class="mt-1 w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      <p v-if="errorText" class="text-sm text-red-600" role="alert">
        {{ errorText }}
      </p>
    </form>

    <template #footer>
      <Button variant="danger" :disabled="!reason" :loading="isSending" @click="submit">
        送信
      </Button>
    </template>
  </Dialog>
</template>

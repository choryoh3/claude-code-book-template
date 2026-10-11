<script setup lang="ts">
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'radix-vue'
import { cn } from '../lib/cn'

withDefaults(
  defineProps<{
    /** ダイアログの見出し（画面読み上げの対象。必須） */
    title: string
    /** 補足の説明（任意） */
    description?: string
    /** 右上の × ボタンを表示するか */
    showClose?: boolean
  }>(),
  { description: undefined, showClose: true },
)

/**
 * モーダルダイアログ（投稿フォーム・プロフィール編集・通報・確認など）。
 * アクセシビリティは Radix Vue が担当する:
 *   Esc で閉じる / フォーカスをダイアログ内に閉じ込める / 閉じたら元の場所へフォーカスを戻す / 背景のスクロールを止める
 *
 * 使い方（v-model:open で開閉する）:
 *   <Dialog v-model:open="isOpen" title="通報する" description="理由を選んでください">
 *     ...中身...
 *     <template #footer><Button>送信</Button></template>
 *   </Dialog>
 */
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <DialogContent
        :class="
          cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-6 text-text shadow-xl focus:outline-none',
          )
        "
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="text-xl font-bold">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-text-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            v-if="showClose"
            class="rounded-full p-1 text-text-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="閉じる"
          >
            <X class="size-5" aria-hidden="true" />
          </DialogClose>
        </div>

        <slot />

        <div v-if="$slots.footer" class="mt-6 flex justify-end gap-3">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

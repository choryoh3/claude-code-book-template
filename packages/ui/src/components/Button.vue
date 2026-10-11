<script setup lang="ts">
import type { ButtonVariants } from './button-variants'
import { computed, useAttrs } from 'vue'
import { cn } from '../lib/cn'
import { buttonVariants } from './button-variants'

/**
 * ボタン。
 * - `loading` のあいだは操作できず（二重送信を防ぐ）、スピナーを表示する
 * - 外から渡した `class` は、同じ種類のクラスを上書きする（cn の tailwind-merge）
 *   例: <Button class="px-8"> は、既定の px-5 を px-8 で置き換える
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    /** 処理中。true のあいだ非活性にしてスピナーを出す */
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'primary', size: 'md', loading: false, disabled: false, type: 'button' },
)

const attrs = useAttrs()

/** 見た目のクラス。外から渡された class を最後に合成して、上書きできるようにする */
const classes = computed(() =>
  cn(
    buttonVariants({ variant: props.variant, size: props.size }),
    attrs.class as string | undefined,
  ),
)
/** class 以外の属性（aria-label・data-testid・@click など）は、そのまま button に渡す */
const otherAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    v-bind="otherAttrs"
    :type="type"
    :class="classes"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <!-- 処理中のスピナー。画面読み上げには「処理中」と伝える -->
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      role="status"
      aria-label="処理中"
    />
    <slot />
  </button>
</template>

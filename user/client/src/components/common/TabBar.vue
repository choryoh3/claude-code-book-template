<script setup lang="ts" generic="T extends string">
// 横並びのタブ（「おすすめ / フォロー中」「投稿 / 返信 / メディア / いいね」など）。v-model で選択中のタブを持つ。
const props = defineProps<{ tabs: { value: T; label: string }[] }>()
const selected = defineModel<T>({ required: true })

/** 左右の矢印キーでタブを移動できるようにする（キーボード操作のため） */
function onKeydown(event: KeyboardEvent, index: number) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (step === 0) return
  const next = props.tabs[(index + step + props.tabs.length) % props.tabs.length]
  if (next) selected.value = next.value
}
</script>

<template>
  <div role="tablist" class="flex">
    <button
      v-for="(tab, index) in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="selected === tab.value"
      :tabindex="selected === tab.value ? 0 : -1"
      class="relative flex-1 py-4 text-center hover:bg-surface-hover"
      :class="selected === tab.value ? 'font-bold text-text' : 'text-text-muted'"
      @click="selected = tab.value"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
      <span
        v-if="selected === tab.value"
        class="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-accent"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

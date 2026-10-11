// 投稿本文の表示。ハッシュタグ・メンション・URL をリンクにする。
// 本文は「部品に分けて、文字として」表示する（v-html は使わない = 本文に HTML が混ざっていても実行されない）。
//
// なぜ .vue のテンプレートではなく描画関数（h）で書いているか:
//   本文は改行をそのまま表示する（whitespace-pre-wrap）ので、テンプレートの中の「改行や字下げ」まで
//   文字として画面に出てしまう。整形ツール（Prettier・ESLint）がタグの中身を改行すると、
//   ハッシュタグの前後に余計な空白が入る不具合が起きたため、書式の影響を受けない描画関数にした。

import type { PropType } from 'vue'
import type { ContentSegment } from '@/lib/content'
import { computed, defineComponent, h } from 'vue'
import { RouterLink } from 'vue-router'
import { splitContent } from '@/lib/content'

const LINK_CLASS = 'text-accent hover:underline'

/** リンクのクリックで、外側の投稿カードのクリック（詳細へ移動）を起こさない */
const stopPropagation = (event: Event) => event.stopPropagation()

/** 部品 1 つを、文字またはリンクにする */
function renderSegment(segment: ContentSegment) {
  if (segment.type === 'hashtag') {
    return h(
      RouterLink,
      {
        to: { name: 'search', query: { q: `#${segment.tag}` } },
        class: LINK_CLASS,
        onClick: stopPropagation,
      },
      () => segment.value,
    )
  }
  if (segment.type === 'mention') {
    return h(
      RouterLink,
      {
        to: { name: 'profile', params: { handle: segment.handle } },
        class: LINK_CLASS,
        onClick: stopPropagation,
      },
      () => segment.value,
    )
  }
  if (segment.type === 'url') {
    return h(
      'a',
      {
        href: segment.value,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: LINK_CLASS,
        onClick: stopPropagation,
      },
      segment.value,
    )
  }
  return segment.value
}

export default defineComponent({
  name: 'PostContent',
  props: {
    content: { type: String as PropType<string>, required: true },
  },
  setup(props) {
    const segments = computed(() => splitContent(props.content))
    return () =>
      h('p', { class: 'break-words whitespace-pre-wrap' }, segments.value.map(renderSegment))
  },
})

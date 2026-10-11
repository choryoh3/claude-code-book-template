<script setup lang="ts">
// 投稿カード（画面仕様書 U-12 / skill: x-ui-patterns）。
//   [アイコン] [表示名] [@handle] · [相対時刻]                    [⋯]
//              本文（ハッシュタグ・メンション・URL はリンク）
//              画像（1〜4 枚）/ 引用元
//              [返信] [リポスト] [いいね] [ブックマーク] [共有]
// カード全体をクリックすると投稿詳細へ。中のボタン・リンクはカードのクリックにしない（@click.stop）。
// いいね等は「楽観的更新」（押した瞬間に変わり、失敗したら戻る）。変更は change イベントで親の一覧に伝える。

import type { PostDto } from '@xclone/shared'
import {
  Bookmark,
  Ellipsis,
  Flag,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  Share,
  Trash2,
} from '@lucide/vue'
import { Avatar } from '@xclone/ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/client'
import { postApi } from '@/api/endpoints'
import { usePostActions } from '@/composables/usePostActions'
import { formatCount, formatDateTime, formatRelativeTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import PostContent from './PostContent'
import PostMedia from './PostMedia.vue'
import QuotedPost from './QuotedPost.vue'

const props = withDefaults(
  defineProps<{
    post: PostDto
    /** 投稿詳細の主役として大きく表示する */
    detail?: boolean
  }>(),
  { detail: false },
)
const emit = defineEmits<{ change: [post: PostDto]; removed: [postId: string] }>()

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const toast = useToastStore()
const confirmDialog = useConfirmStore()
const actions = usePostActions((updated) => emit('change', updated))

const isVisible = computed(() => props.post.status === 'visible')
const isOwn = computed(() => props.post.author.id === auth.user?.id)
const detailRoute = computed(() => ({
  name: 'post',
  params: { handle: props.post.author.handle, postId: props.post.id },
}))
const profileRoute = computed(() => ({
  name: 'profile',
  params: { handle: props.post.author.handle },
}))

const isMenuOpen = ref(false)
const isRepostMenuOpen = ref(false)

/** カードの空いているところをクリックしたら詳細へ（文字を選択しているときは移動しない） */
function openDetail() {
  if (props.detail || window.getSelection()?.toString()) return
  router.push(detailRoute.value)
}

function quote() {
  isRepostMenuOpen.value = false
  ui.openCompose(props.post)
}

function toggleRepost() {
  isRepostMenuOpen.value = false
  actions.toggleRepost(props.post)
}

/** 投稿の URL をクリップボードにコピーする */
async function share() {
  const url = `${window.location.origin}${router.resolve(detailRoute.value).href}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success('リンクをコピーしました')
  } catch {
    toast.error('コピーできませんでした')
  }
}

async function remove() {
  isMenuOpen.value = false
  const confirmed = await confirmDialog.ask({
    title: 'この投稿を削除しますか？',
    message: '削除した投稿は元に戻せません。',
    confirmLabel: '削除',
    danger: true,
  })
  if (!confirmed) return
  try {
    await postApi.remove(props.post.id)
    emit('removed', props.post.id)
    toast.success('投稿を削除しました')
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

function report() {
  isMenuOpen.value = false
  ui.openReport({
    type: 'post',
    id: props.post.id,
    label: `@${props.post.author.handle} さんの投稿`,
  })
}
</script>

<template>
  <!-- 削除済み・非表示（中身は返ってこない） -->
  <div
    v-if="!isVisible"
    class="border-b border-border px-4 py-4 text-text-muted"
    data-testid="post-unavailable"
  >
    この投稿は削除されました
  </div>

  <article
    v-else
    class="border-b border-border px-4 pt-3 pb-1 transition-colors"
    :class="{ 'cursor-pointer hover:bg-surface-hover/60': !detail }"
    :aria-label="`${post.author.displayName} さんの投稿`"
    @click="openDetail"
  >
    <!-- 「○○さんがリポストしました」 -->
    <p
      v-if="post.repostedBy"
      class="mb-1 flex items-center gap-2 pl-8 text-sm font-bold text-text-muted"
    >
      <Repeat2 class="size-4" aria-hidden="true" />
      {{ post.repostedBy.displayName }}さんがリポストしました
    </p>

    <div class="flex gap-3">
      <RouterLink :to="profileRoute" class="shrink-0" @click.stop>
        <Avatar :src="post.author.avatarUrl" :name="post.author.displayName" />
      </RouterLink>

      <div class="min-w-0 flex-1">
        <!-- 名前・ハンドル・時刻・メニュー -->
        <div class="flex items-start justify-between gap-2">
          <div
            class="flex min-w-0 flex-wrap items-baseline gap-x-1"
            :class="{ 'flex-col': detail }"
          >
            <RouterLink :to="profileRoute" class="truncate font-bold hover:underline" @click.stop>
              {{ post.author.displayName }}
            </RouterLink>
            <span class="truncate text-text-muted">@{{ post.author.handle }}</span>
            <template v-if="!detail">
              <span class="text-text-muted" aria-hidden="true">·</span>
              <time
                :datetime="post.createdAt"
                class="text-text-muted"
                :title="formatDateTime(post.createdAt)"
              >
                {{ formatRelativeTime(post.createdAt) }}
              </time>
            </template>
          </div>

          <div class="relative">
            <button
              type="button"
              class="rounded-full p-1.5 text-text-muted hover:bg-accent/10 hover:text-accent"
              aria-label="その他の操作"
              aria-haspopup="menu"
              :aria-expanded="isMenuOpen"
              @click.stop="isMenuOpen = !isMenuOpen"
            >
              <Ellipsis class="size-5" aria-hidden="true" />
            </button>
            <div
              v-if="isMenuOpen"
              role="menu"
              class="absolute top-full right-0 z-10 w-56 overflow-hidden rounded-card border border-border bg-surface shadow-lg"
              @click.stop
            >
              <button
                v-if="isOwn"
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-3 px-4 py-3 font-bold text-red-600 hover:bg-surface-hover"
                @click="remove"
              >
                <Trash2 class="size-5" aria-hidden="true" /> 削除
              </button>
              <button
                v-else
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-hover"
                @click="report"
              >
                <Flag class="size-5" aria-hidden="true" /> ポストを通報
              </button>
            </div>
          </div>
        </div>

        <PostContent
          v-if="post.content"
          :content="post.content"
          :class="detail ? 'mt-3 text-xl' : 'mt-0.5'"
        />
        <PostMedia :urls="post.mediaUrls" />
        <QuotedPost v-if="post.quoteOf" :post="post.quoteOf" />

        <p v-if="detail" class="mt-3 border-b border-border pb-3 text-text-muted">
          <time :datetime="post.createdAt">{{ formatDateTime(post.createdAt) }}</time>
        </p>

        <!-- 操作のボタン（色つきのホバー: 返信=青 / リポスト=緑 / いいね=ピンク） -->
        <div
          class="flex max-w-md items-center justify-between py-1 text-sm text-text-muted"
          @click.stop
        >
          <RouterLink
            :to="detailRoute"
            class="group flex items-center gap-1 hover:text-accent"
            :aria-label="`返信 ${post.replyCount} 件`"
          >
            <span class="rounded-full p-2 group-hover:bg-accent/10"
              ><MessageCircle class="size-5" aria-hidden="true"
            /></span>
            {{ formatCount(post.replyCount) }}
          </RouterLink>

          <div class="relative">
            <button
              type="button"
              class="group flex items-center gap-1 hover:text-repost"
              :class="{ 'text-repost': post.reposted }"
              :aria-label="post.reposted ? 'リポストを取り消す・引用' : 'リポスト・引用'"
              :aria-pressed="post.reposted"
              aria-haspopup="menu"
              @click="isRepostMenuOpen = !isRepostMenuOpen"
            >
              <span class="rounded-full p-2 group-hover:bg-repost/10"
                ><Repeat2 class="size-5" aria-hidden="true"
              /></span>
              {{ formatCount(post.repostCount) }}
            </button>
            <div
              v-if="isRepostMenuOpen"
              role="menu"
              class="absolute top-full left-0 z-10 w-48 overflow-hidden rounded-card border border-border bg-surface text-text shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-3 px-4 py-3 font-bold hover:bg-surface-hover"
                @click="toggleRepost"
              >
                <Repeat2 class="size-5" aria-hidden="true" />
                {{ post.reposted ? 'リポストを取り消す' : 'リポスト' }}
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-3 px-4 py-3 font-bold hover:bg-surface-hover"
                @click="quote"
              >
                <Quote class="size-5" aria-hidden="true" /> 引用
              </button>
            </div>
          </div>

          <button
            type="button"
            class="group flex items-center gap-1 hover:text-like"
            :class="{ 'text-like': post.liked }"
            :aria-label="post.liked ? 'いいねを取り消す' : 'いいね'"
            :aria-pressed="post.liked"
            @click="actions.toggleLike(post)"
          >
            <span class="rounded-full p-2 group-hover:bg-like/10">
              <Heart
                class="size-5"
                :fill="post.liked ? 'currentColor' : 'none'"
                aria-hidden="true"
              />
            </span>
            {{ formatCount(post.likeCount) }}
          </button>

          <button
            type="button"
            class="rounded-full p-2 hover:bg-accent/10 hover:text-accent"
            :class="{ 'text-accent': post.bookmarked }"
            :aria-label="post.bookmarked ? 'ブックマークを外す' : 'ブックマーク'"
            :aria-pressed="post.bookmarked"
            @click="actions.toggleBookmark(post)"
          >
            <Bookmark
              class="size-5"
              :fill="post.bookmarked ? 'currentColor' : 'none'"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            class="rounded-full p-2 hover:bg-accent/10 hover:text-accent"
            aria-label="リンクをコピー"
            @click="share"
          >
            <Share class="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
